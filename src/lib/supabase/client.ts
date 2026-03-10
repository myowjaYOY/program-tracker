import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Get the Supabase browser client (singleton).
 * 
 * This ensures we reuse the same client instance across the app,
 * which is important for:
 * 1. Consistent auth state
 * 2. Proper event listener cleanup
 * 3. Avoiding memory leaks
 * 4. Preventing infinite re-render loops in hooks
 */
export function createClient() {
  if (client) {
    return client;
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}