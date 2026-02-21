// ============================================================================
// Multi-Tenant Types
// ============================================================================

export interface Tenant {
    tenant_id: string;
    tenant_name: string;
    tenant_slug: string;
    is_active: boolean;
    subscription_tier: 'standard' | 'professional' | 'enterprise';
    settings: TenantSettings;
    contact_email: string | null;
    contact_name: string | null;
    max_users: number;
    created_at: string;
    updated_at: string;
}

export interface TenantSettings {
    is_original_tenant?: boolean;
    branding?: {
        logo_url?: string;
        primary_color?: string;
        company_name?: string;
    };
    features?: {
        inventory_enabled?: boolean;
        crm_enabled?: boolean;
        surveys_enabled?: boolean;
        ai_insights_enabled?: boolean;
    };
    [key: string]: unknown;
}

export interface TenantContext {
    tenant: Tenant | null;
    tenantId: string | null;
    isLoading: boolean;
    error: string | null;
}

// Extend the existing User type to include tenant_id
export interface TenantUser {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    tenant_id: string;
    tenant?: Tenant;
}