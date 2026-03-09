'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TenantSettings } from '@/types/tenant';

export const tenantSettingsKeys = {
    all: ['tenant', 'settings'] as const,
};

export function useTenantSettings() {
    return useQuery<{ settings: TenantSettings }, Error>({
        queryKey: tenantSettingsKeys.all,
        queryFn: async () => {
            const res = await fetch('/api/tenant/settings', { credentials: 'include' });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to fetch settings');
            }
            return res.json();
        },
    });
}

export function useUpdateTenantSettings() {
    const queryClient = useQueryClient();

    return useMutation<{ settings: TenantSettings }, Error, Partial<TenantSettings>>({
        mutationFn: async (settings) => {
            const res = await fetch('/api/tenant/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ settings }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to update settings');
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.setQueryData(tenantSettingsKeys.all, data);
            // Also invalidate tenant info as it might be used elsewhere (like the logo/sidebar)
            queryClient.invalidateQueries({ queryKey: ['tenant', 'current'] });
            toast.success('Settings updated');
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
}
