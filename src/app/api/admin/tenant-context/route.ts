import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, getAdminSupabase } from '@/lib/auth/admin';
import { requireAuth } from '@/lib/auth/api';

/**
 * POST /api/admin/tenant-context
 * Super admin switches into a tenant's context.
 *
 * Body: { tenant_id: string }
 *
 * This sets a cookie/header that downstream requests use to override
 * the tenant context. The actual RLS override happens via
 * set_super_admin_tenant_context() in Postgres.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase, session, user } = auth;

        const body = await request.json();
        const { tenant_id } = body;

        if (!tenant_id) {
            return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
        }

        // Verify the target tenant exists
        const { data: tenant, error: tenantError } = await adminSupabase
            .from('tenants')
            .select('tenant_id, tenant_name, tenant_slug')
            .eq('tenant_id', tenant_id)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Log the context switch
        await adminSupabase
            .from('super_admin_audit_log')
            .insert({
                admin_user_id: session.user.id,
                admin_email: user.email,
                action: 'tenant_switch',
                target_tenant_id: tenant.tenant_id,
                target_tenant_name: tenant.tenant_name,
                details: { switched_at: new Date().toISOString() },
                ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            });

        // Set the tenant override cookie
        const response = NextResponse.json({
            success: true,
            tenant: {
                tenant_id: tenant.tenant_id,
                tenant_name: tenant.tenant_name,
                tenant_slug: tenant.tenant_slug,
            },
        });

        // Store the override in a secure httpOnly cookie
        response.cookies.set('x-tenant-override', tenant.tenant_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8, // 8 hours
        });

        return response;
    } catch (error) {
        console.error('Tenant context switch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/tenant-context
 * Clear the tenant override and return to the super admin's own tenant.
 */
export async function DELETE() {
    try {
        const auth = await requireAuth();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const response = NextResponse.json({ success: true, message: 'Tenant context cleared' });

        // Remove the override cookie
        response.cookies.set('x-tenant-override', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0,
        });

        return response;
    } catch (error) {
        console.error('Clear tenant context error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET /api/admin/tenant-context
 * Get the current tenant override status.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const overrideTenantId = request.cookies.get('x-tenant-override')?.value;

        if (!overrideTenantId) {
            return NextResponse.json({ override_active: false, tenant: null });
        }

        // Get the override tenant details (service role for tenant lookup)
        const adminSupabase = getAdminSupabase();
        const { data: tenant } = await adminSupabase
            .from('tenants')
            .select('tenant_id, tenant_name, tenant_slug')
            .eq('tenant_id', overrideTenantId)
            .single();

        return NextResponse.json({
            override_active: !!tenant,
            tenant: tenant || null,
        });
    } catch (error) {
        console.error('Get tenant context error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}