import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; taskScheduleId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const { taskScheduleId } = await context.params;
  let body: { completed_flag?: boolean | null } = {};
  try {
    body = await req.json();
  } catch {}

  try {
    const { data, error } = await supabase
      .from('member_program_items_task_schedule')
      .update({ 
        completed_flag: body.completed_flag !== undefined ? body.completed_flag : null 
      })
      .eq('member_program_item_task_schedule_id', taskScheduleId)
      .select()
      .single();
    if (error) {
      return NextResponse.json(
        { error: 'Failed to update task schedule' },
        { status: 500 }
      );
    }
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
