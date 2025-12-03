import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/cron-job-runs
 * Fetches all cron job runs, ordered by most recent first
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('cron_job_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Cron Job Runs API] Error fetching runs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cron job runs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Cron Job Runs API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

