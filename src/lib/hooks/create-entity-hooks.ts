/**
 * Generic Entity Hook Factory
 *
 * Creates standardized React Query hooks for CRUD operations on any entity.
 * Eliminates ~80 lines of boilerplate per entity hook file.
 *
 * Follows the MANDATORY patterns from .cursorrules:
 * - use[Entities]()       → fetch all
 * - useActive[Entities]() → fetch active only (for dropdowns)
 * - useCreate[Entity]()   → mutation with toast notifications
 * - useUpdate[Entity]()   → mutation with cache updates + detail invalidation
 * - useDelete[Entity]()   → mutation with optimistic updates + rollback
 * - UseSafeQueryOptions type to support exactOptionalPropertyTypes
 * - [entity]Keys object   → query key consistency
 *
 * @module create-entity-hooks
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryOptions,
    type UseMutationOptions,
    type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================
// COMPATIBILITY TYPES
// ============================================

/**
 * Wrappers for React Query options that explicitly allow undefined.
 * This satisfies projects with 'exactOptionalPropertyTypes: true' in tsconfig.json.
 */
export type SafeQueryOptions<TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends readonly unknown[] = readonly unknown[]> = {
    [K in keyof UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>]?: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>[K] | undefined;
};

export type SafeMutationOptions<TData = unknown, TError = Error, TVariables = void, TContext = unknown> = {
    [K in keyof UseMutationOptions<TData, TError, TVariables, TContext>]?: UseMutationOptions<TData, TError, TVariables, TContext>[K] | undefined;
};

// ============================================
// TYPES
// ============================================

/**
 * Configuration for creating entity hooks.
 *
 * @template T          - The entity row type (e.g., Buckets, Vendors)
 * @template TCreate    - The create payload type (defaults to Partial<T>)
 * @template TUpdate    - The update payload type (defaults to Partial<T>)
 * @template TId        - The ID field type: number | string
 */
export interface EntityHookConfig<
    T extends object,
    TCreate = Partial<T>,
    TUpdate = Partial<T>,
    TId extends string | number = number,
> {
    /** Display name for toast messages (e.g., "Bucket", "Vendor") */
    entityName: string;

    /** Base API endpoint without trailing slash (e.g., "/api/buckets") */
    endpoint: string;

    /** Root query key string (e.g., "buckets") */
    queryKey: string;

    /** Primary key field name on the entity (e.g., "bucket_id") */
    idField: keyof T & string;

    /**
     * Additional query keys to invalidate on create/update/delete mutations.
     * Useful for cross-entity cache busting (e.g., purchase orders → inventory metrics).
     *
     * @example [['inventory-metrics'], ['program-templates']]
     */
    additionalInvalidations?: readonly (readonly string[])[];

    /**
     * Default query options for the list query.
     * Useful for setting staleTime, gcTime, refetchOnWindowFocus, etc.
     */
    listQueryOptions?: SafeQueryOptions<T[], Error>;

    /**
     * Whether the active filter should use a server-side query param (?active=true)
     * instead of client-side filtering on active_flag. Defaults to false (client-side).
     */
    activeFilterServerSide?: boolean;
}

/**
 * The update mutation input shape.
 * Wraps the update payload with the entity ID.
 */
export interface UpdateInput<TUpdate, TId extends string | number = number> {
    id: TId;
    data: TUpdate;
}

/**
 * Return type from createEntityHooks — all hooks + query keys.
 */
export interface EntityHooks<
    T extends object,
    TCreate,
    TUpdate,
    TId extends string | number,
> {
    /** Query key factory for this entity */
    keys: EntityKeys<TId>;

    /** Fetch all entities */
    useList: (options?: SafeQueryOptions<T[], Error>) => ReturnType<typeof useQuery<T[], Error>>;

    /** Fetch only active entities (active_flag === true) — for dropdowns */
    useActive: (options?: SafeQueryOptions<T[], Error>) => ReturnType<typeof useQuery<T[], Error>>;

    /** Fetch a single entity by ID */
    useDetail: (
        id: TId | null | undefined,
        options?: SafeQueryOptions<T, Error>,
    ) => ReturnType<typeof useQuery<T, Error>>;

    /** Create a new entity */
    useCreate: (
        options?: SafeMutationOptions<T, Error, TCreate>,
    ) => ReturnType<typeof useMutation<T, Error, TCreate>>;

    /** Update an existing entity */
    useUpdate: (
        options?: SafeMutationOptions<T, Error, UpdateInput<TUpdate, TId>>,
    ) => ReturnType<typeof useMutation<T, Error, UpdateInput<TUpdate, TId>>>;

    /** Delete an entity with optimistic removal from list cache */
    useDelete: (
        options?: SafeMutationOptions<void, Error, TId, { previous: T[] | undefined }>,
    ) => ReturnType<typeof useMutation<void, Error, TId, { previous: T[] | undefined }>>;
}

// ============================================
// QUERY KEY FACTORY TYPE
// ============================================

export interface EntityKeys<TId extends string | number = number> {
    all: readonly string[];
    list: () => readonly string[];
    active: () => readonly string[];
    detail: (id: TId) => readonly (string | TId)[];
}

// ============================================
// SHARED FETCH HELPER
// ============================================

/**
 * Standardized fetch wrapper for API calls.
 * Always includes credentials and Content-Type for mutations.
 * Throws a descriptive Error on non-OK responses.
 */
async function apiFetch<TResponse>(
    url: string,
    options?: RequestInit & { entityName?: string; action?: string },
): Promise<TResponse> {
    const { entityName = 'record', action = 'fetch', ...fetchOptions } = options || {};

    const res = await fetch(url, {
        credentials: 'include',
        ...fetchOptions,
    });

    // DELETE may return 204 No Content
    if (res.status === 204) {
        return undefined as unknown as TResponse;
    }

    const json = await res.json();

    if (!res.ok) {
        throw new Error(
            json.error || `Failed to ${action} ${entityName.toLowerCase()}`,
        );
    }

    return json.data as TResponse;
}

// ============================================
// INVALIDATION HELPER
// ============================================

function invalidateAll<TId extends string | number>(
    queryClient: QueryClient,
    keys: EntityKeys<TId>,
    additionalInvalidations?: readonly (readonly string[])[],
): void {
    queryClient.invalidateQueries({ queryKey: keys.all });

    if (additionalInvalidations) {
        for (const key of additionalInvalidations) {
            queryClient.invalidateQueries({ queryKey: [...key] });
        }
    }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Creates a complete set of React Query hooks for a CRUD entity.
 *
 * @example
 * ```typescript
 * // src/lib/hooks/use-buckets.ts
 * import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
 * import type { Buckets } from '@/types/database.types';
 * import type { BucketFormData, BucketUpdateData } from '@/lib/validations/bucket';
 *
 * const hooks = createEntityHooks<Buckets, BucketFormData, BucketUpdateData>({
 *   entityName: 'Bucket',
 *   endpoint: '/api/buckets',
 *   queryKey: 'buckets',
 *   idField: 'bucket_id',
 * });
 *
 * export const bucketKeys = hooks.keys;
 * export const useBuckets = hooks.useList;
 * export const useActiveBuckets = hooks.useActive;
 * export const useCreateBucket = hooks.useCreate;
 * export const useUpdateBucket = hooks.useUpdate;
 * export const useDeleteBucket = hooks.useDelete;
 * ```
 */
export function createEntityHooks<
    T extends object,
    TCreate = Partial<T>,
    TUpdate = Partial<T>,
    TId extends string | number = number,
>(
    config: EntityHookConfig<T, TCreate, TUpdate, TId>,
): EntityHooks<T, TCreate, TUpdate, TId> {
    const {
        entityName,
        endpoint,
        queryKey,
        idField,
        additionalInvalidations,
        listQueryOptions,
        activeFilterServerSide = false,
    } = config;

    // ------------------------------------------
    // Query Key Factory
    // ------------------------------------------
    const keys: EntityKeys<TId> = {
        all: [queryKey] as const,
        list: () => [queryKey, 'list'] as const,
        active: () => [queryKey, 'active'] as const,
        detail: (id: TId) => [queryKey, 'detail', id] as const,
    };

    // ------------------------------------------
    // useList — fetch all entities
    // ------------------------------------------
    function useList(
        options?: SafeQueryOptions<T[], Error>,
    ) {
        return useQuery<T[], Error>({
            queryKey: keys.list(),
            queryFn: () =>
                apiFetch<T[]>(endpoint, {
                    entityName,
                    action: 'fetch',
                }),
            ...(listQueryOptions as any),
            ...(options as any),
        });
    }

    // ------------------------------------------
    // useActive — fetch active entities only
    // ------------------------------------------
    function useActive(
        options?: SafeQueryOptions<T[], Error>,
    ) {
        return useQuery<T[], Error>({
            queryKey: keys.active(),
            queryFn: async () => {
                const url = activeFilterServerSide
                    ? `${endpoint}?active=true`
                    : endpoint;

                const data = await apiFetch<T[]>(url, {
                    entityName,
                    action: 'fetch',
                });

                // Client-side filter when not using server-side filtering
                if (!activeFilterServerSide) {
                    return data.filter(
                        (item) => (item as { active_flag?: boolean }).active_flag === true,
                    );
                }

                return data;
            },
            ...(options as any),
        });
    }

    // ------------------------------------------
    // useDetail — fetch single entity by ID
    // ------------------------------------------
    function useDetail(
        id: TId | null | undefined,
        options?: SafeQueryOptions<T, Error>,
    ) {
        return useQuery<T, Error>({
            queryKey: keys.detail(id as TId),
            queryFn: () =>
                apiFetch<T>(`${endpoint}/${id}`, {
                    entityName,
                    action: 'fetch',
                }),
            enabled: id != null && id !== undefined,
            ...(options as any),
        });
    }

    // ------------------------------------------
    // useCreate — create with toast + invalidation
    // ------------------------------------------
    function useCreate(
        options?: SafeMutationOptions<T, Error, TCreate>,
    ) {
        const queryClient = useQueryClient();

        return useMutation<T, Error, TCreate>({
            ...(options as any),
            mutationFn: (data) =>
                apiFetch<T>(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    entityName,
                    action: 'create',
                }),
            onSuccess: (data, variables, context) => {
                toast.success(`${entityName} created successfully`);
                invalidateAll(queryClient, keys, additionalInvalidations);
                (options?.onSuccess as ((d: T, v: TCreate, c: unknown) => void) | undefined)?.(data, variables, context);
            },
            onError: (error, variables, context) => {
                toast.error(error.message || `Failed to create ${entityName.toLowerCase()}`);
                (options?.onError as ((e: Error, v: TCreate, c: unknown) => void) | undefined)?.(error, variables, context);
            },
        });
    }

    // ------------------------------------------
    // useUpdate — update with toast + invalidation (including detail key)
    // ------------------------------------------
    function useUpdate(
        options?: SafeMutationOptions<T, Error, UpdateInput<TUpdate, TId>>,
    ) {
        const queryClient = useQueryClient();

        return useMutation<T, Error, UpdateInput<TUpdate, TId>>({
            ...(options as any),
            mutationFn: ({ id, data }) =>
                apiFetch<T>(`${endpoint}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    entityName,
                    action: 'update',
                }),
            onSuccess: (data, variables, context) => {
                toast.success(`${entityName} updated successfully`);
                invalidateAll(queryClient, keys, additionalInvalidations);
                queryClient.invalidateQueries({
                    queryKey: keys.detail(variables.id),
                });
                (options?.onSuccess as ((d: T, v: UpdateInput<TUpdate, TId>, c: unknown) => void) | undefined)?.(data, variables, context);
            },
            onError: (error, variables, context) => {
                toast.error(error.message || `Failed to update ${entityName.toLowerCase()}`);
                (options?.onError as ((e: Error, v: UpdateInput<TUpdate, TId>, c: unknown) => void) | undefined)?.(error, variables, context);
            },
        });
    }

    // ------------------------------------------
    // useDelete — optimistic removal + rollback + toast
    // ------------------------------------------
    function useDelete(
        options?: SafeMutationOptions<void, Error, TId, { previous: T[] | undefined }>,
    ) {
        const queryClient = useQueryClient();

        return useMutation<void, Error, TId, { previous: T[] | undefined }>({
            ...(options as any),
            mutationFn: async (id) => {
                const res = await fetch(`${endpoint}/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });

                if (!res.ok) {
                    let errorMessage = `Failed to delete ${entityName.toLowerCase()}`;
                    try {
                        const json = await res.json();
                        errorMessage = json.error || errorMessage;
                    } catch {
                        // Response may not be JSON (e.g., 204 No Content that failed)
                    }
                    throw new Error(errorMessage);
                }
            },

            onMutate: async (id) => {
                const userContext =
                    typeof options?.onMutate === 'function'
                        ? await (options.onMutate as (variables: TId, context?: unknown) => Promise<Record<string, unknown> | undefined>)(id, undefined)
                        : undefined;
                await queryClient.cancelQueries({ queryKey: keys.all });

                const previous = queryClient.getQueryData<T[]>(keys.list());

                if (previous) {
                    queryClient.setQueryData<T[]>(
                        keys.list(),
                        previous.filter((item) => {
                            const itemId = item[idField];
                            if (typeof id === 'string') {
                                return String(itemId) !== id;
                            }
                            return itemId !== id;
                        }),
                    );
                }

                return {
                    previous,
                    ...(userContext && typeof userContext === 'object' ? userContext : {}),
                };
            },

            onError: (error, _id, context) => {
                toast.error(error.message || `Failed to delete ${entityName.toLowerCase()}`);
                if (context?.previous) {
                    queryClient.setQueryData(keys.list(), context.previous);
                }
                (options?.onError as ((e: Error, id: TId, c: { previous: T[] | undefined } | undefined) => void) | undefined)?.(error, _id, context);
            },

            onSuccess: (data, variables, context) => {
                toast.success(`${entityName} deleted successfully`);
                invalidateAll(queryClient, keys, additionalInvalidations);
                (options?.onSuccess as ((d: void, v: TId, c: { previous: T[] | undefined } | undefined) => void) | undefined)?.(data, variables, context);
            },
        });
    }

    return {
        keys,
        useList,
        useActive,
        useDetail,
        useCreate,
        useUpdate,
        useDelete,
    };
}