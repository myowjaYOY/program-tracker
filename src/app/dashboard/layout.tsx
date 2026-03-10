import DashboardLayoutClient from '@/components/layout/DashboardLayoutClient';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/auth/admin';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Dashboard layout - auth is enforced by middleware.
 * 
 * We still fetch the user here because we need user data for the layout,
 * but we don't need to redirect - middleware guarantees authentication.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // This call is fast because the session is already validated by middleware
  // and cached in cookies. We need the user object for the layout UI.
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware should guarantee user exists for /dashboard routes.
  // If it doesn't, redirect gracefully instead of crashing.
  if (!user) {
    redirect('/login');
  }

  // Tenant Authorization Logic
  const headersList = await headers();
  const currentTenantSlug = headersList.get('x-tenant-slug');

  if (currentTenantSlug) {
    const adminSupabase = getAdminSupabase();
    let userTenantSlug = user.user_metadata?.tenant_slug;

    // Fast path: Check user metadata
    if (!userTenantSlug) {
      // Slow path: Fallback to database check for users without metadata
      const { data: userData } = await adminSupabase
        .from('users')
        .select('is_super_admin, tenant_id, tenants(tenant_slug, is_active)')
        .eq('id', user.id)
        .single();

      if (userData) {
        // Super admins can access any tenant dashboard
        if (userData.is_super_admin) {
          userTenantSlug = currentTenantSlug;
        } else if (userData.tenants && !Array.isArray(userData.tenants)) {
          userTenantSlug = (userData.tenants as any).tenant_slug;
        }
      }
    }

    // Safety check - if somehow we get here without a tenant slug and not a super admin, 
    // the middleware didn't catch it. Redirect to a safe place.
    if (!userTenantSlug && userTenantSlug !== currentTenantSlug) {
      redirect('/login?error=unauthorized_tenant');
    }

    // Fallback active check on layout level
    const { data: activeCheck } = await adminSupabase.from('tenants').select('is_active').eq('tenant_slug', currentTenantSlug).single();
    if (activeCheck && !activeCheck.is_active) {
      redirect('/login?error=tenant_deactivated');
    }
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}