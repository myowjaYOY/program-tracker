import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Tenant } from '@/types/tenant';
import type { TenantFormData, TenantUpdateData } from '@/lib/validations/tenant';

// Query keys
export const tenantKeys = {
    all: ['tenants'] as const,
    list: () => [...tenantKeys.all, 'list'] as const,
    detail: (id: string) => [...tenantKeys.all, 'detail', id] as const,
};

// Tenant with user count from the admin API
export interface TenantWithUsers extends Tenant {
    user_count: number;
    users?: Array<{
        id: string;
        email: string;
        full_name: string | null;
        is_admin: boolean;
        created_at: string;
    }>;
}

// Fetch all tenants (admin only)
export function useTenants() {
    return useQuery<TenantWithUsers[], Error>({
        queryKey: tenantKeys.list(),
        queryFn: async () => {
            const res = await fetch('/api/admin/tenants', {
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch tenants');
            return json.tenants as TenantWithUsers[];
        },
    });
}

// Fetch single tenant (admin only)
export function useTenantDetail(id: string | null) {
    return useQuery<TenantWithUsers, Error>({
        queryKey: tenantKeys.detail(id!),
        queryFn: async () => {
            const res = await fetch(`/api/admin/tenants/${id}`, {
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch tenant');
            return json.tenant as TenantWithUsers;
        },
        enabled: !!id,
    });
}

// Create tenant
export function useCreateTenant() {
    const queryClient = useQueryClient();

    return useMutation<Tenant, Error, TenantFormData>({
        mutationFn: async (data) => {
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to create tenant');
            return json.tenant as Tenant;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tenantKeys.all });
            toast.success('Tenant created successfully');
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

// Update tenant
export function useUpdateTenant() {
    const queryClient = useQueryClient();

    return useMutation<Tenant, Error, { id: string; data: TenantUpdateData }>({
        mutationFn: async ({ id, data }) => {
            const res = await fetch(`/api/admin/tenants/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to update tenant');
            return json.tenant as Tenant;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: tenantKeys.all });
            queryClient.invalidateQueries({
                queryKey: tenantKeys.detail(data.tenant_id),
            });
            toast.success('Tenant updated successfully');
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

// Deactivate tenant (soft delete)
export function useDeactivateTenant() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: async (id) => {
            const res = await fetch(`/api/admin/tenants/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Failed to deactivate tenant');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tenantKeys.all });
            toast.success('Tenant deactivated successfully');
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}