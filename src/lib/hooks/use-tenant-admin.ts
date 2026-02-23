'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Tenant {
    tenant_id: string;
    tenant_name: string;
    tenant_slug: string;
    is_active: boolean;
    subscription_tier: string;
    settings: Record<string, unknown>;
    contact_email: string | null;
    contact_name: string | null;
    max_users: number;
    created_at: string;
    updated_at: string;
    user_count?: number;
}

export interface TenantDetail {
    tenant: Tenant;
    users: TenantUser[];
    stats: Record<string, number>;
}

export interface TenantUser {
    id: string;
    email: string;
    full_name: string | null;
    is_admin: boolean;
    is_active: boolean;
    is_super_admin: boolean;
    created_at: string;
}

export interface TenantContextStatus {
    override_active: boolean;
    tenant: { tenant_id: string; tenant_name: string; tenant_slug: string } | null;
}

export interface AuditLogEntry {
    id: number;
    admin_user_id: string;
    admin_email: string;
    action: string;
    target_tenant_id: string | null;
    target_tenant_name: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
}

export interface CreateTenantData {
    tenant_name: string;
    tenant_slug: string;
    subscription_tier?: string;
    contact_email?: string;
    contact_name?: string;
    max_users?: number;
    settings?: Record<string, unknown>;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const tenantAdminKeys = {
    all: ['admin', 'tenants'] as const,
    list: () => [...tenantAdminKeys.all, 'list'] as const,
    detail: (id: string) => [...tenantAdminKeys.all, 'detail', id] as const,
    context: () => ['admin', 'tenant-context'] as const,
    auditLog: (params?: Record<string, string>) => ['admin', 'audit-log', params] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch all tenants (super admin only) */
export function useTenants() {
    return useQuery<Tenant[]>({
        queryKey: tenantAdminKeys.list(),
        queryFn: async () => {
            const res = await fetch('/api/admin/tenants', { credentials: 'include' });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || `Failed to fetch tenants (${res.status})`);
            }
            const json = await res.json();
            return json.tenants;
        },
        staleTime: 30_000,
    });
}

/** Fetch a single tenant's details (super admin only) */
export function useTenantDetail(tenantId: string | null) {
    return useQuery<TenantDetail>({
        queryKey: tenantAdminKeys.detail(tenantId || ''),
        queryFn: async () => {
            const res = await fetch(`/api/admin/tenants/${tenantId}`, { credentials: 'include' });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || 'Failed to fetch tenant details');
            }
            return res.json();
        },
        enabled: !!tenantId,
        staleTime: 15_000,
    });
}

/** Create a new tenant */
export function useCreateTenant() {
    const queryClient = useQueryClient();

    return useMutation<Tenant, Error, CreateTenantData>({
        mutationFn: async (data) => {
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to create tenant');
            return json.tenant;
        },
        onSuccess: (tenant) => {
            queryClient.invalidateQueries({ queryKey: tenantAdminKeys.list() });
            toast.success(`Tenant "${tenant.tenant_name}" created`);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

/** Update a tenant */
export function useUpdateTenant() {
    const queryClient = useQueryClient();

    return useMutation<Tenant, Error, { tenantId: string; data: Partial<Tenant> }>({
        mutationFn: async ({ tenantId, data }) => {
            const res = await fetch(`/api/admin/tenants/${tenantId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to update tenant');
            return json.tenant;
        },
        onSuccess: (tenant) => {
            queryClient.invalidateQueries({ queryKey: tenantAdminKeys.list() });
            queryClient.invalidateQueries({ queryKey: tenantAdminKeys.detail(tenant.tenant_id) });
            toast.success(`Tenant "${tenant.tenant_name}" updated`);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

/** Switch super admin into a tenant's context */
export function useSwitchTenantContext() {
    const queryClient = useQueryClient();

    return useMutation<{ tenant: { tenant_id: string; tenant_name: string; tenant_slug: string } }, Error, string>({
        mutationFn: async (tenantId) => {
            const res = await fetch('/api/admin/tenant-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tenant_id: tenantId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to switch tenant context');
            return json;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: tenantAdminKeys.context() });
            toast.success(`Switched to tenant: ${data.tenant.tenant_name}`);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

/** Clear the tenant context override */
export function useClearTenantContext() {
    const queryClient = useQueryClient();

    return useMutation<void, Error>({
        mutationFn: async () => {
            const res = await fetch('/api/admin/tenant-context', {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || 'Failed to clear tenant context');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tenantAdminKeys.context() });
            toast.success('Returned to your own tenant');
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

/** Get current tenant context override status */
export function useTenantContext() {
    return useQuery<TenantContextStatus>({
        queryKey: tenantAdminKeys.context(),
        queryFn: async () => {
            const res = await fetch('/api/admin/tenant-context', { credentials: 'include' });
            if (!res.ok) return { override_active: false, tenant: null };
            return res.json();
        },
        staleTime: 10_000,
    });
}

/** Fetch super admin audit log */
export function useAdminAuditLog(params?: { tenant_id?: string; action?: string; limit?: number; offset?: number }) {
    return useQuery<{ entries: AuditLogEntry[]; total: number }>({
        queryKey: tenantAdminKeys.auditLog(params as Record<string, string>),
        queryFn: async () => {
            const searchParams = new URLSearchParams();
            if (params?.tenant_id) searchParams.set('tenant_id', params.tenant_id);
            if (params?.action) searchParams.set('action', params.action);
            if (params?.limit) searchParams.set('limit', String(params.limit));
            if (params?.offset) searchParams.set('offset', String(params.offset));

            const res = await fetch(`/api/admin/audit-log?${searchParams}`, { credentials: 'include' });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || 'Failed to fetch audit log');
            }
            return res.json();
        },
        staleTime: 15_000,
    });
}