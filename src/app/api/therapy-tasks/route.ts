import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  therapyTaskSchema,
  TherapyTaskFormData,
} from '@/lib/validations/therapy-task';

export async function GET(_req: NextRequest) {
  // STANDARD: Always join to public.users for created_by/updated_by for all entity APIs
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join therapy_tasks to users, therapies, and program_roles
  const { data, error } = await supabase.from('therapy_tasks').select(`*,
      created_user:users!therapy_tasks_created_by_fkey(id,email,full_name),
      updated_user:users!therapy_tasks_updated_by_fkey(id,email,full_name),
      therapy:therapies!fk_therapy(therapy_id,therapy_name,therapy_type_id),
      program_role:program_roles(program_role_id,role_name,display_color)
    `);
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
    therapy_name: task.therapy?.therapy_name || null,
    therapy_type_id: task.therapy?.therapy_type_id || null,
    role_name: task.program_role?.role_name || null,
    role_display_color: task.program_role?.display_color || null,
  }));
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: TherapyTaskFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapyTaskSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('therapy_tasks')
    .insert([parse.data])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
