import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Require auth (no admin). */
async function requireAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

/**
 * GET /api/operations/metrics
 * Returns active metric definitions for targets dropdown.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (auth.error) return auth.error;

  const { data, error } = await supabase
    .from('metric_definitions')
    .select('id, metric_key, label, value_type, period_types, display_order, active_flag')
    .eq('active_flag', true)
    .order('display_order', { ascending: true })
    .order('metric_key', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
