import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bodyUpdateSchema, BodyUpdateData } from '@/lib/validations/body';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const { data, error } = await supabase
    .from('bodies')
    .select(
      `*,
      created_user:users!bodies_created_by_fkey(id,email,full_name),
      updated_user:users!bodies_updated_by_fkey(id,email,full_name)
    `
    )
    .eq('body_id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = {
    ...data,
    created_by_email: data.created_user?.email || null,
    updated_by_email: data.updated_user?.email || null,
  };
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  let body: BodyUpdateData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = bodyUpdateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('bodies')
    .update({ ...parse.data, updated_by: user.id })
    .eq('body_id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  // Add referential integrity checks here if needed
  const { error } = await supabase.from('bodies').delete().eq('body_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
