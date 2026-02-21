import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) return null;

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_admin, is_super_admin')
        .eq('id', session.user.id)
        .single();

    if (userError || !user?.is_super_admin) return null;
    return session;
}

function getAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * GET /api/admin/tenants/[id]
 * Get a single tenant with user count.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        if (!await verifyAdmin(supabase)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const adminSupabase = getAdminClient();

        const { data: tenant, error } = await adminSupabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', id)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Get user count
        const { count } = await adminSupabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', id);

        // Get users list
        const { data: users } = await adminSupabase
            .from('users')
            .select('id, email, full_name, is_admin, created_at')
            .eq('tenant_id', id)
            .order('created_at', { ascending: true });

        return NextResponse.json({
            tenant: { ...tenant, user_count: count || 0, users: users || [] },
        });
    } catch (error) {
        console.error('Tenant GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/tenants/[id]
 * Update a tenant's details.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        if (!await verifyAdmin(supabase)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const {
            tenant_name,
            tenant_slug,
            is_active,
            subscription_tier,
            contact_email,
            contact_name,
            max_users,
            settings,
        } = body;

        // Validate slug format if provided
        if (tenant_slug && !/^[a-z0-9-]+$/.test(tenant_slug)) {
            return NextResponse.json(
                { error: 'tenant_slug must be lowercase alphanumeric with hyphens only' },
                { status: 400 }
            );
        }

        const adminSupabase = getAdminClient();

        // Check slug uniqueness if changing
        if (tenant_slug) {
            const { data: existing } = await adminSupabase
                .from('tenants')
                .select('tenant_id')
                .eq('tenant_slug', tenant_slug)
                .neq('tenant_id', id)
                .single();

            if (existing) {
                return NextResponse.json(
                    { error: 'A tenant with this slug already exists' },
                    { status: 409 }
                );
            }
        }

        // Build update object with only provided fields
        const updateData: Record<string, unknown> = {};
        if (tenant_name !== undefined) updateData.tenant_name = tenant_name;
        if (tenant_slug !== undefined) updateData.tenant_slug = tenant_slug;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier;
        if (contact_email !== undefined) updateData.contact_email = contact_email;
        if (contact_name !== undefined) updateData.contact_name = contact_name;
        if (max_users !== undefined) updateData.max_users = max_users;
        if (settings !== undefined) updateData.settings = settings;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data: updated, error: updateError } = await adminSupabase
            .from('tenants')
            .update(updateData)
            .eq('tenant_id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating tenant:', updateError);
            return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
        }

        return NextResponse.json({ tenant: updated });
    } catch (error) {
        console.error('Tenant PUT error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/tenants/[id]
 * Deactivate a tenant (soft delete). Does NOT delete data.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        if (!await verifyAdmin(supabase)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Prevent deleting the original tenant
        if (id === '00000000-0000-0000-0000-000000000001') {
            return NextResponse.json(
                { error: 'Cannot deactivate the primary tenant' },
                { status: 400 }
            );
        }

        const adminSupabase = getAdminClient();

        // Soft delete — set is_active to false
        const { data: updated, error } = await adminSupabase
            .from('tenants')
            .update({ is_active: false })
            .eq('tenant_id', id)
            .select()
            .single();

        if (error) {
            console.error('Error deactivating tenant:', error);
            return NextResponse.json({ error: 'Failed to deactivate tenant' }, { status: 500 });
        }

        return NextResponse.json({
            tenant: updated,
            message: 'Tenant deactivated. User access has been revoked.',
        });
    } catch (error) {
        console.error('Tenant DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}