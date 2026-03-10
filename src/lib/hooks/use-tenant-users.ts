import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TenantUser {
    id: string;
    email: string;
    full_name: string | null;
    is_admin: boolean;
    is_super_admin: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProvisionUserData {
    email: string;
    full_name?: string;
    is_admin?: boolean;
    send_invite?: boolean;
}

export interface ProvisionUserResponse {
    success: boolean;
    user: {
        id: string;
        email: string;
        full_name: string | null;
        is_admin: boolean;
        tenant_id: string;
    };
    tenant: {
        tenant_id: string;
        tenant_name: string;
        tenant_slug: string;
    };
    invite_sent: boolean;
}

export interface TenantUsersResponse {
    tenant: {
        tenant_id: string;
        tenant_name: string;
    };
    users: TenantUser[];
    count: number;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const tenantUserKeys = {
    all: ['admin', 'tenant-users'] as const,
    list: (tenantId: string) => [...tenantUserKeys.all, 'list', tenantId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch all users for a specific tenant (super admin only)
 */
export function useTenantUsers(tenantId: string | null) {
    return useQuery<TenantUsersResponse>({
        queryKey: tenantUserKeys.list(tenantId || ''),
        queryFn: async () => {
            const res = await fetch(`/api/admin/tenants/${tenantId}/users`, {
                credentials: 'include',
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || `Failed to fetch users (${res.status})`);
            }
            return res.json();
        },
        enabled: !!tenantId,
        staleTime: 30_000,
    });
}

/**
 * Provision a new user for a tenant (super admin only)
 * 
 * Creates both the Supabase Auth user and the public.users record,
 * optionally sending an invite email.
 */
export function useProvisionTenantUser(tenantId: string) {
    const queryClient = useQueryClient();

    return useMutation<ProvisionUserResponse, Error, ProvisionUserData>({
        mutationFn: async (data) => {
            const res = await fetch(`/api/admin/tenants/${tenantId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Failed to provision user');
            }
            return json;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: tenantUserKeys.list(tenantId) });
            // Also invalidate tenant list to update user counts
            queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });

            const inviteMsg = data.invite_sent
                ? ' Invite email sent.'
                : ' No invite email sent.';
            toast.success(`User ${data.user.email} created.${inviteMsg}`);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

/**
 * Delete a user from a tenant (super admin only)
 * 
 * Removes both the public.users record and the Supabase Auth user.
 */
export function useDeleteTenantUser(tenantId: string) {
    const queryClient = useQueryClient();

    return useMutation<{ success: boolean; message: string }, Error, string>({
        mutationFn: async (userId) => {
            const res = await fetch(
                `/api/admin/tenants/${tenantId}/users?userId=${userId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Failed to delete user');
            }
            return json;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: tenantUserKeys.list(tenantId) });
            // Also invalidate tenant list to update user counts
            queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
            toast.success(data.message);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}

/**
 * Resend invite email to a user (super admin only)
 * 
 * Generates a new password reset link and sends it to the user.
 */
export function useResendInvite(tenantId: string) {
    return useMutation<{ success: boolean }, Error, string>({
        mutationFn: async (userEmail) => {
            const res = await fetch(`/api/admin/tenants/${tenantId}/users/resend-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: userEmail }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Failed to resend invite');
            }
            return json;
        },
        onSuccess: () => {
            toast.success('Invite email resent');
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}