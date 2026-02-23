import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/admin';

/**
 * GET /api/admin/tenants/[tenantId]
 * Get a single tenant's full details including user list and stats.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { adminSupabase } = auth;

        // Get tenant details
        const { data: tenant, error: tenantError } = await adminSupabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Get users for this tenant
        const { data: users } = await adminSupabase
            .from('users')
            .select('id, email, full_name, is_admin, is_active, is_super_admin, created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: true });

        // Get summary stats
        const stats: Record<string, number> = {};

        const countTables = ['leads', 'member_programs', 'therapies', 'inventory_items'];
        for (const table of countTables) {
            const { count } = await adminSupabase
                .from(table)
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId);
            stats[table] = count || 0;
        }

        return NextResponse.json({
            tenant,
            users: users || [],
            stats,
        });
    } catch (error) {
        console.error('Tenant detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/tenants/[tenantId]
 * Update a tenant's settings. Super admin only.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { adminSupabase } = auth;
        const body = await request.json();

        // Only allow updating specific fields
        const allowedFields = [
            'tenant_name', 'is_active', 'subscription_tier',
            'contact_email', 'contact_name', 'max_users', 'settings'
        ];

        const updates: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { data: tenant, error: updateError } = await adminSupabase
            .from('tenants')
            .update(updates)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating tenant:', updateError);
            return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
        }

        // Log the update
        await adminSupabase
            .from('super_admin_audit_log')
            .insert({
                admin_user_id: auth.session!.user.id,
                admin_email: auth.user!.email,
                action: 'tenant_update',
                target_tenant_id: tenantId,
                target_tenant_name: tenant.tenant_name,
                details: { updated_fields: Object.keys(updates) },
            });

        return NextResponse.json({ tenant });
    } catch (error) {
        console.error('Tenant update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}