import { NextRequest, NextResponse } from 'next/server';
import { verifyTenantAdmin } from '@/lib/auth/admin';

/**
 * GET /api/tenant/settings
 * Fetch settings for the current tenant (or overridden tenant for super admins).
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyTenantAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { adminSupabase, user } = auth;

        // Determine the target tenant ID
        // If super admin, check for override cookie
        let targetTenantId = user.tenant_id;
        if (user.is_super_admin) {
            const overrideId = request.cookies.get('x-tenant-override')?.value;
            if (overrideId) {
                targetTenantId = overrideId;
            }
        }

        if (!targetTenantId) {
            return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
        }

        const { data: tenant, error } = await adminSupabase
            .from('tenants')
            .select('settings')
            .eq('tenant_id', targetTenantId)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
        }

        return NextResponse.json({ settings: tenant.settings });
    } catch (error) {
        console.error('Fetch tenant settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/tenant/settings
 * Update settings for the current tenant (or overridden tenant for super admins).
 */
export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyTenantAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { adminSupabase, user } = auth;

        // Determine the target tenant ID
        let targetTenantId = user.tenant_id;
        if (user.is_super_admin) {
            const overrideId = request.cookies.get('x-tenant-override')?.value;
            if (overrideId) {
                targetTenantId = overrideId;
            }
        }

        if (!targetTenantId) {
            return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
        }

        const body = await request.json();
        const { settings } = body;

        if (!settings) {
            return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
        }

        // Get current settings to merge branding properly
        const { data: currentTenant } = await adminSupabase
            .from('tenants')
            .select('settings')
            .eq('tenant_id', targetTenantId)
            .single();

        const newSettings = {
            ...(currentTenant?.settings || {}),
            ...settings,
            branding: {
                ...(currentTenant?.settings?.branding || {}),
                ...(settings?.branding || {}),
            }
        };

        const { data: updatedTenant, error: updateError } = await adminSupabase
            .from('tenants')
            .update({ settings: newSettings, updated_at: new Date().toISOString() })
            .eq('tenant_id', targetTenantId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ settings: updatedTenant.settings });
    } catch (error) {
        console.error('Update tenant settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
