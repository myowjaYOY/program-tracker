import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const programId = Number(id);
    if (!Number.isFinite(programId)) {
      return NextResponse.json(
        { error: 'Invalid program id' },
        { status: 400 }
      );
    }

    // Check for recentOnly query parameter
    const { searchParams } = new URL(req.url);
    const recentOnly = searchParams.get('recentOnly') === 'true';

    // Call RPC with optional p_recent_minutes parameter
    // When recentOnly=true, pass 30 minutes; otherwise pass null for all items
    const { data, error } = await supabase.rpc(
      'generate_member_program_schedule',
      { 
        p_program_id: programId,
        p_recent_minutes: recentOnly ? 30 : null,
      }
    );
    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to generate schedule' },
        { status: 500 }
      );
    }
    if (data && data.ok === false) {
      return NextResponse.json(
        { error: data.error || 'Failed to generate schedule' },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: data || { ok: true } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
