import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/tenants
 * List all tenants (super admin only).
 * Uses service_role to bypass RLS.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // Verify the requesting user is authenticated and is a super admin
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('is_admin, is_super_admin')
            .eq('id', session.user.id)
            .single();

        if (userError || !user?.is_super_admin) {
            return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        // Use service_role to bypass RLS and see all tenants
        const adminSupabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: tenants, error: tenantsError } = await adminSupabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: true });

        if (tenantsError) {
            console.error('Error fetching tenants:', tenantsError);
            return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
        }

        // Enrich with user counts per tenant
        const enrichedTenants = await Promise.all(
            (tenants || []).map(async (tenant) => {
                const { count } = await adminSupabase
                    .from('users')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.tenant_id);

                return { ...tenant, user_count: count || 0 };
            })
        );

        return NextResponse.json({ tenants: enrichedTenants });
    } catch (error) {
        console.error('Tenants API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/tenants
 * Create a new tenant (super admin only).
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify admin
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('is_admin, is_super_admin')
            .eq('id', session.user.id)
            .single();

        if (userError || !user?.is_super_admin) {
            return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

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

        // Validate slug format (lowercase alphanumeric + hyphens)
        if (!/^[a-z0-9-]+$/.test(tenant_slug)) {
            return NextResponse.json(
                { error: 'tenant_slug must be lowercase alphanumeric with hyphens only' },
                { status: 400 }
            );
        }

        const adminSupabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Check for slug uniqueness
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

        return NextResponse.json({ tenant: newTenant }, { status: 201 });
    } catch (error) {
        console.error('Tenants API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}