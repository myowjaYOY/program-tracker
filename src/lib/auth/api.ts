/**
 * API route authentication helper.
 * Uses getUser() for a fresh check against the auth server (recommended over getSession()).
 */
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export type RequireAuthResult =
  | { authorized: true; user: User; supabase: Awaited<ReturnType<typeof createClient>> }
  | { authorized: false; status: 401; error: string };

/**
 * Ensures the request is from an authenticated user.
 * Returns the Supabase client and user on success so the route can proceed.
 *
 * @example
 * ```ts
 * const auth = await requireAuth();
 * if (!auth.authorized) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const { supabase, user } = auth;
 * // use supabase and user.id
 * ```
 */
export async function requireAuth(): Promise<RequireAuthResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false, status: 401, error: 'Unauthorized' };
  }

  return { authorized: true, user, supabase };
}
