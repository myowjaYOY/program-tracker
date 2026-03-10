import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/admin';

/**
 * POST /api/admin/tenants/[tenantId]/users
 * 
 * Provision a new user for a specific tenant. Super admin only.
 * 
 * This endpoint:
 * 1. Creates a user in Supabase Auth (using Admin API)
 * 2. Creates the corresponding record in public.users with the target tenant_id
 * 3. Sends an invite email with password reset link
 * 
 * Body: {
 *   email: string;          // Required - user's email
 *   full_name?: string;     // Optional - display name
 *   is_admin?: boolean;     // Optional - make them a tenant admin (default: false)
 *   send_invite?: boolean;  // Optional - send invite email (default: true)
 * }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase, session } = auth;
        const { tenantId } = await params;

        // Validate tenant exists
        const { data: tenant, error: tenantError } = await adminSupabase
            .from('tenants')
            .select('tenant_id, tenant_name, tenant_slug, is_active, max_users')
            .eq('tenant_id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        if (!tenant.is_active) {
            return NextResponse.json({ error: 'Cannot add users to inactive tenant' }, { status: 400 });
        }

        // Check user count against max_users limit
        const { count: currentUserCount } = await adminSupabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);

        if (currentUserCount !== null && currentUserCount >= tenant.max_users) {
            return NextResponse.json(
                { error: `Tenant has reached maximum user limit (${tenant.max_users})` },
                { status: 400 }
            );
        }

        // Parse request body
        const body = await request.json();
        const {
            email,
            full_name,
            is_admin = false,
            send_invite = true
        } = body;

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'email is required' }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // Check if user already exists in this tenant
        const { data: existingUser } = await adminSupabase
            .from('users')
            .select('id, email, tenant_id')
            .eq('email', email.toLowerCase())
            .single();

        if (existingUser) {
            if (existingUser.tenant_id === tenantId) {
                return NextResponse.json(
                    { error: 'User already exists in this tenant' },
                    { status: 409 }
                );
            } else {
                return NextResponse.json(
                    { error: 'User exists in another tenant. Users cannot belong to multiple tenants.' },
                    { status: 409 }
                );
            }
        }

        // Create user in Supabase Auth using Admin API
        // This uses the service role which has admin.createUser permissions
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email: email.toLowerCase(),
            email_confirm: true, // Auto-confirm email since we're provisioning
            user_metadata: {
                full_name: full_name || '',
                tenant_id: tenantId,
                tenant_slug: tenant.tenant_slug,
                provisioned_by: session.user.email,
            },
        });

        if (authError) {
            console.error('Auth user creation error:', authError);
            // Handle specific error cases
            if (authError.message?.includes('already been registered')) {
                return NextResponse.json(
                    { error: 'A user with this email already exists in the authentication system' },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: `Failed to create auth user: ${authError.message}` },
                { status: 500 }
            );
        }

        if (!authData.user) {
            return NextResponse.json({ error: 'Auth user creation returned no user' }, { status: 500 });
        }

        // Create record in public.users table
        const { data: newUser, error: userError } = await adminSupabase
            .from('users')
            .insert({
                id: authData.user.id,
                email: email.toLowerCase(),
                full_name: full_name || null,
                tenant_id: tenantId,
                is_admin: is_admin,
                is_super_admin: false, // Never create super admins through this endpoint
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (userError) {
            console.error('Public users insert error:', userError);
            // Attempt to clean up the auth user if public.users insert fails
            await adminSupabase.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { error: `Failed to create user record: ${userError.message}` },
                { status: 500 }
            );
        }

        // Send password reset / invite email if requested
        let inviteSent = false;
        if (send_invite) {
            const { error: resetError } = await adminSupabase.auth.admin.generateLink({
                type: 'recovery',
                email: email.toLowerCase(),
                options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/auth/reset-password`,
                },
            });

            if (resetError) {
                console.warn('Failed to send invite email:', resetError);
                // Don't fail the whole operation, just note that invite wasn't sent
            } else {
                inviteSent = true;
            }
        }

        // Log the user creation in audit log
        await adminSupabase
            .from('super_admin_audit_log')
            .insert({
                admin_user_id: session.user.id,
                admin_email: auth.user?.email,
                action: 'user_provision',
                target_tenant_id: tenantId,
                target_tenant_name: tenant.tenant_name,
                details: {
                    user_id: newUser.id,
                    user_email: newUser.email,
                    is_admin: is_admin,
                    invite_sent: inviteSent,
                },
                ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
            });

        return NextResponse.json({
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email,
                full_name: newUser.full_name,
                is_admin: newUser.is_admin,
                tenant_id: newUser.tenant_id,
            },
            tenant: {
                tenant_id: tenant.tenant_id,
                tenant_name: tenant.tenant_name,
                tenant_slug: tenant.tenant_slug,
            },
            invite_sent: inviteSent,
        }, { status: 201 });

    } catch (error) {
        console.error('Provision tenant user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET /api/admin/tenants/[tenantId]/users
 * 
 * List all users for a specific tenant. Super admin only.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase } = auth;
        const { tenantId } = await params;

        // Validate tenant exists
        const { data: tenant, error: tenantError } = await adminSupabase
            .from('tenants')
            .select('tenant_id, tenant_name')
            .eq('tenant_id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Fetch users for this tenant
        const { data: users, error: usersError } = await adminSupabase
            .from('users')
            .select('id, email, full_name, is_admin, is_super_admin, created_at, updated_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: true });

        if (usersError) {
            console.error('Fetch tenant users error:', usersError);
            return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }

        return NextResponse.json({
            tenant: {
                tenant_id: tenant.tenant_id,
                tenant_name: tenant.tenant_name,
            },
            users: users || [],
            count: users?.length || 0,
        });

    } catch (error) {
        console.error('Get tenant users error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/tenants/[tenantId]/users
 * 
 * Remove a user from a tenant. Super admin only.
 * Query param: ?userId=xxx
 * 
 * This deletes both the auth user and the public.users record.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase, session } = auth;
        const { tenantId } = await params;

        const userId = request.nextUrl.searchParams.get('userId');
        if (!userId) {
            return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
        }

        // Verify the user belongs to this tenant
        const { data: user, error: userError } = await adminSupabase
            .from('users')
            .select('id, email, tenant_id, is_super_admin')
            .eq('id', userId)
            .eq('tenant_id', tenantId)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found in this tenant' }, { status: 404 });
        }

        // Prevent deleting super admins through this endpoint
        if (user.is_super_admin) {
            return NextResponse.json(
                { error: 'Cannot delete super admin users through this endpoint' },
                { status: 403 }
            );
        }

        // Get tenant name for audit log
        const { data: tenant } = await adminSupabase
            .from('tenants')
            .select('tenant_name')
            .eq('tenant_id', tenantId)
            .single();

        // Delete from public.users first
        const { error: deleteUserError } = await adminSupabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (deleteUserError) {
            console.error('Delete user record error:', deleteUserError);
            return NextResponse.json({ error: 'Failed to delete user record' }, { status: 500 });
        }

        // Delete from Supabase Auth
        const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            console.error('Delete auth user error:', deleteAuthError);
            // User record is already deleted, log warning but don't fail
        }

        // Log the deletion
        await adminSupabase
            .from('super_admin_audit_log')
            .insert({
                admin_user_id: session.user.id,
                admin_email: auth.user?.email,
                action: 'user_delete',
                target_tenant_id: tenantId,
                target_tenant_name: tenant?.tenant_name || 'Unknown',
                details: {
                    deleted_user_id: userId,
                    deleted_user_email: user.email,
                },
                ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
            });

        return NextResponse.json({
            success: true,
            message: `User ${user.email} has been removed from the tenant`,
        });

    } catch (error) {
        console.error('Delete tenant user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}