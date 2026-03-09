/**
 * Admin API authentication helpers.
 * Centralizes super-admin verification and admin Supabase client creation
 * to avoid duplication across admin routes.
 */
import { createClient } from '@/lib/supabase/server';
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type Session,
} from '@supabase/supabase-js';

export interface SuperAdminUser {
  is_super_admin: boolean;
  is_admin?: boolean;
  email: string;
  tenant_id?: string;
}

export type SuperAdminCheck =
  | {
    authorized: true;
    status: 200;
    error: null;
    session: Session;
    user: SuperAdminUser;
    adminSupabase: SupabaseClient;
  }
  | {
    authorized: false;
    status: number;
    error: string;
    session: Session | null;
    user: null;
    adminSupabase: SupabaseClient;
  };

/**
 * Creates a Supabase client with service role key (bypasses RLS).
 * Use only in admin API routes for tenant/users queries.
 */
export function getAdminSupabase(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Verifies the current user is a super admin.
 * Returns auth result with admin Supabase client for use in the route.
 *
 * @example
 * ```ts
 * const auth = await verifySuperAdmin();
 * if (!auth.authorized) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const { adminSupabase, session, user } = auth;
 * ```
 */
export async function verifySuperAdmin(): Promise<SuperAdminCheck> {
  const adminSupabase = getAdminSupabase();
  const authClient = await createClient();
  const { data: { user: authUser }, error: authError } =
    await authClient.auth.getUser();

  if (authError || !authUser) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized',
      session: null,
      user: null,
      adminSupabase,
    };
  }

  const { data: user, error: userError } = await adminSupabase
    .from('users')
    .select('is_super_admin, is_admin, email, tenant_id')
    .eq('id', authUser.id)
    .single();

  if (userError || !user?.is_super_admin) {
    return {
      authorized: false,
      status: 403,
      error: 'Super admin access required',
      session: { user: authUser } as Session,
      user: null,
      adminSupabase,
    };
  }

  return {
    authorized: true,
    status: 200,
    error: null,
    session: { user: authUser } as Session,
    user: user as SuperAdminUser,
    adminSupabase,
  };
}
/**
 * Verifies the current user is a tenant admin or a super admin.
 */
export async function verifyTenantAdmin(): Promise<SuperAdminCheck> {
  const adminSupabase = getAdminSupabase();
  const authClient = await createClient();
  const { data: { user: authUser }, error: authError } =
    await authClient.auth.getUser();

  if (authError || !authUser) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized',
      session: null,
      user: null,
      adminSupabase,
    };
  }

  const { data: user, error: userError } = await adminSupabase
    .from('users')
    .select('is_super_admin, is_admin, email, tenant_id')
    .eq('id', authUser.id)
    .single();

  if (userError || (!user?.is_admin && !user?.is_super_admin)) {
    return {
      authorized: false,
      status: 403,
      error: 'Admin access required',
      session: { user: authUser } as Session,
      user: null,
      adminSupabase,
    };
  }

  return {
    authorized: true,
    status: 200,
    error: null,
    session: { user: authUser } as Session,
    user: user as SuperAdminUser,
    adminSupabase,
  };
}
