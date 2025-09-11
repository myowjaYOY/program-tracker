import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { statusSchema, StatusFormData } from '@/lib/validations/status';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Get status data
  const { data, error } = await supabase.from('status').select('*');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user emails for created_by/updated_by
  const userIds = new Set<string>();
  (data || []).forEach(s => {
    if (s.created_by) userIds.add(s.created_by);
    if (s.updated_by) userIds.add(s.updated_by);
  });

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .in('id', Array.from(userIds));

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const userMap = new Map(users?.map(u => [u.id, u.email]) || []);

  const mapped = (data || []).map(status => ({
    ...status,
    created_by_email: userMap.get(status.created_by) || null,
    updated_by_email: userMap.get(status.updated_by) || null,
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
  let status: StatusFormData;
  try {
    status = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = statusSchema.safeParse(status);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('status')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
