'use client';

import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Tenant, TenantContext as TenantContextType } from '@/types/tenant';

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    tenantId: null,
    isLoading: true,
    error: null,
});

// React Query key for tenant data
export const tenantKeys = {
    current: ['tenant', 'current'] as const,
};

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const supabase = createClient();

    const {
        data: tenant,
        isLoading: tenantLoading,
        error,
    } = useQuery<Tenant | null, Error>({
        queryKey: [...tenantKeys.current, user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            // Get the user's tenant_id from the users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('tenant_id')
                .eq('id', user.id)
                .single();

            if (userError || !userData?.tenant_id) {
                // During migration transition, tenant_id may not yet be set
                console.warn('User does not have a tenant_id assigned yet.');
                return null;
            }

            // Fetch the full tenant record
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('*')
                .eq('tenant_id', userData.tenant_id)
                .single();

            if (tenantError) {
                throw new Error('Unable to load organization data');
            }

            return tenantData as Tenant;
        },
        enabled: isAuthenticated && !authLoading && !!user?.id,
        staleTime: 5 * 60 * 1000, // Tenant data rarely changes — cache 5 minutes
        retry: 1,
    });

    const value: TenantContextType = {
        tenant: tenant ?? null,
        tenantId: tenant?.tenant_id ?? null,
        isLoading: authLoading || tenantLoading,
        error: error?.message ?? null,
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
}

/**
 * Hook to access the current tenant context.
 *
 * Usage:
 *   const { tenant, tenantId, isLoading } = useTenant();
 *
 * The tenant data is cached via React Query with a 5-minute stale time,
 * so it won't re-fetch on every component mount.
 */
export function useTenant() {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
}