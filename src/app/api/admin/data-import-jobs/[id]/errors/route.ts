import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/data-import-jobs/[id]/errors
 * Fetches all errors for a specific import job
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      .from('data_import_errors')
      .select('*')
      .eq('import_batch_id', parseInt(id))
      .order('row_number', { ascending: true });

    if (error) {
      console.error('[Import Errors API] Error fetching errors:', error);
      return NextResponse.json(
        { error: 'Failed to fetch import errors' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Import Errors API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

