import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bodySchema, BodyFormData } from '@/lib/validations/body';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join to users for created_by/updated_by
  const { data, error } = await supabase.from('bodies').select(`*,
      created_user:users!bodies_created_by_fkey(id,email,full_name),
      updated_user:users!bodies_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = (data || []).map(body => ({
    ...body,
    created_by_email: body.created_user?.email || null,
    updated_by_email: body.updated_user?.email || null,
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
  let body: BodyFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = bodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('bodies')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
