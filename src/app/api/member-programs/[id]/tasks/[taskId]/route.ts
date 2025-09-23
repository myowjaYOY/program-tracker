import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberProgramItemTaskUpdateSchema } from '@/lib/validations/member-program-item-task';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  const { taskId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validatedData = memberProgramItemTaskUpdateSchema.parse(body);

  const updateData = {
    ...validatedData,
    updated_by: user.id,
  };

  // If marking as completed, set completed_date and completed_by
  if (validatedData.completed_flag === true) {
    updateData.completed_date = new Date().toISOString();
    updateData.completed_by = user.id;
  } else if (validatedData.completed_flag === false) {
    updateData.completed_date = undefined;
    updateData.completed_by = undefined;
  }

  const { data, error } = await supabase
    .from('member_program_item_tasks')
    .update(updateData)
    .eq('member_program_item_task_id', taskId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Regenerate schedule rows for this task (idempotent)
  try {
    await supabase.rpc('regen_member_program_task_schedule', {
      p_member_program_item_task_id: Number(taskId),
    });
  } catch (_) {}

  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  const { taskId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('member_program_item_tasks')
    .delete()
    .eq('member_program_item_task_id', taskId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
