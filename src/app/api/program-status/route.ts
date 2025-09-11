import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  programStatusSchema,
  ProgramStatusFormData,
} from '@/lib/validations/program-status';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join to users for created_by/updated_by (Bodies pattern)
  const { data, error } = await supabase.from('program_status').select(`*,
      created_user:users!program_status_created_by_fkey(id,email,full_name),
      updated_user:users!program_status_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = (data || []).map(programStatus => ({
    ...programStatus,
    created_by_email: programStatus.created_user?.email || null,
    updated_by_email: programStatus.updated_user?.email || null,
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
  let programStatus: ProgramStatusFormData;
  try {
    programStatus = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = programStatusSchema.safeParse(programStatus);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('program_status')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
