import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  memberProgramItemTaskSchema,
  MemberProgramItemTaskFormData,
} from '@/lib/validations/member-program-item-task';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all tasks for all items in this member program
  const { data, error } = await supabase
    .from('member_program_item_tasks')
    .select(
      `
      *,
      member_program_items!inner(member_program_id),
      created_user:users!fk_member_program_item_tasks_created_by(id,email,full_name),
      updated_user:users!fk_member_program_item_tasks_updated_by(id,email,full_name),
      completed_user:users!fk_member_program_item_tasks_completed_by(id,email,full_name),
      therapy_tasks!fk_member_program_item_tasks_task(
        therapy_id,
        therapies!fk_therapy(
          therapy_name,
          therapytype!fk_therapy_type(therapy_type_name)
        )
      )
    `
    )
    .eq('member_program_items.member_program_id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to flat fields for frontend
  const mapped = (data || []).map(task => ({
    ...task,
    created_by_email: task.created_user?.email || null,
    created_by_full_name: task.created_user?.full_name || null,
    updated_by_email: task.updated_user?.email || null,
    updated_by_full_name: task.updated_user?.full_name || null,
    completed_by_email: task.completed_user?.email || null,
    completed_by_full_name: task.completed_user?.full_name || null,
    therapy_name: task.therapy_tasks?.therapies?.therapy_name || null,
    therapy_type_name:
      task.therapy_tasks?.therapies?.therapytype?.therapy_type_name || null,
  }));

  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validatedData = memberProgramItemTaskSchema.parse(body);

  const taskData = {
    ...validatedData,
    created_by: user.id,
    updated_by: user.id,
  };

  const { data, error } = await supabase
    .from('member_program_item_tasks')
    .insert([taskData])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
