import DashboardLayout from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/server';

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

  // Middleware guarantees user exists for /dashboard routes,
  // but TypeScript doesn't know that. This is a safety fallback.
  if (!user) {
    // This should never happen if middleware is working correctly
    throw new Error('Authentication required - middleware should have redirected');
  }

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}