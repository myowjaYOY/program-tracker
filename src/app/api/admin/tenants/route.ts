import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/admin';

/**
 * GET /api/admin/tenants
 * List all tenants with user counts and stats. Super admin only.
 */
export async function GET() {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase } = auth;

        // Fetch all tenants
        const { data: tenants, error: tenantsError } = await adminSupabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: true });

        if (tenantsError) {
            console.error('Error fetching tenants:', tenantsError);
            return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
        }

        // Enrich with stats using a single aggregation query instead of N+1
        const { data: userCounts } = await adminSupabase
            .from('users')
            .select('tenant_id')
            .not('tenant_id', 'is', null);

        const countMap: Record<string, number> = {};
        (userCounts || []).forEach((u: { tenant_id: string }) => {
            countMap[u.tenant_id] = (countMap[u.tenant_id] || 0) + 1;
        });

        const enrichedTenants = (tenants || []).map((tenant) => ({
            ...tenant,
            user_count: countMap[tenant.tenant_id] || 0,
        }));

        return NextResponse.json({ tenants: enrichedTenants });
    } catch (error) {
        console.error('Tenants API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/tenants
 * Create a new tenant. Super admin only.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase } = auth;

        const body = await request.json();
        const {
            tenant_name,
            tenant_slug,
            subscription_tier = 'standard',
            contact_email,
            contact_name,
            max_users = 50,
            settings = {},
        } = body;

        if (!tenant_name || !tenant_slug) {
            return NextResponse.json(
                { error: 'tenant_name and tenant_slug are required' },
                { status: 400 }
            );
        }

        // Validate slug format
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(tenant_slug) || tenant_slug.length < 2) {
            return NextResponse.json(
                { error: 'tenant_slug must be lowercase alphanumeric with hyphens, min 2 chars, no leading/trailing hyphens' },
                { status: 400 }
            );
        }

        // Reserved slugs
        const reserved = ['admin', 'api', 'app', 'www', 'mail', 'ftp', 'dashboard', 'super-admin', 'platform'];
        if (reserved.includes(tenant_slug)) {
            return NextResponse.json(
                { error: `"${tenant_slug}" is a reserved slug` },
                { status: 400 }
            );
        }

        // Check uniqueness
        const { data: existing } = await adminSupabase
            .from('tenants')
            .select('tenant_id')
            .eq('tenant_slug', tenant_slug)
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'A tenant with this slug already exists' },
                { status: 409 }
            );
        }

        const { data: newTenant, error: createError } = await adminSupabase
            .from('tenants')
            .insert({
                tenant_name,
                tenant_slug,
                subscription_tier,
                contact_email,
                contact_name,
                max_users,
                settings,
                is_active: true,
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating tenant:', createError);
            return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
        }

        // Log the creation
        await adminSupabase
            .from('super_admin_audit_log')
            .insert({
                admin_user_id: auth.session!.user.id,
                admin_email: auth.user!.email,
                action: 'tenant_create',
                target_tenant_id: newTenant.tenant_id,
                target_tenant_name: newTenant.tenant_name,
                details: { subscription_tier, max_users },
            });

        return NextResponse.json({ tenant: newTenant }, { status: 201 });
    } catch (error) {
        console.error('Tenants API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}