import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { therapyTaskUpdateSchema } from '@/lib/validations/therapy-task';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await supabase
    .from('therapy_tasks')
    .select(`*,
      created_user:users!therapy_tasks_created_by_fkey(id,email,full_name),
      updated_user:users!therapy_tasks_updated_by_fkey(id,email,full_name),
      therapy:therapies!fk_therapy(therapy_id,therapy_name,therapy_type_id),
      program_role:program_roles(program_role_id,role_name,display_color)
    `)
    .eq('task_id', params.id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = {
    ...data,
    created_by_email: data.created_user?.email || null,
    created_by_full_name: data.created_user?.full_name || null,
    updated_by_email: data.updated_user?.email || null,
    updated_by_full_name: data.updated_user?.full_name || null,
    therapy_name: data.therapy?.therapy_name || null,
    therapy_type_id: data.therapy?.therapy_type_id || null,
    role_name: data.program_role?.role_name || null,
    role_display_color: data.program_role?.display_color || null,
  };
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapyTaskUpdateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('therapy_tasks')
    .update(parse.data)
    .eq('task_id', params.id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { error } = await supabase
    .from('therapy_tasks')
    .delete()
    .eq('task_id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { message: 'Therapy task deleted successfully' },
    { status: 200 }
  );
}
