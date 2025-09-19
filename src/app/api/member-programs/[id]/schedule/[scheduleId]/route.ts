import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; scheduleId: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, scheduleId } = await context.params;
  let body: { completed_flag?: boolean } = {};
  try { body = await req.json(); } catch {}

  try {
    const { data, error } = await supabase
      .from('member_program_item_schedule')
      .update({ completed_flag: !!body.completed_flag })
      .eq('member_program_item_schedule_id', scheduleId)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}


