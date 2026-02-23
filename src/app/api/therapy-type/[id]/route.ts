import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api';
import {
  therapyTypeUpdateSchema,
  TherapyTypeUpdateData,
} from '@/lib/validations/therapy-type';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;
  const { id } = await context.params;
  const { data, error } = await supabase
    .from('therapytype')
    .select(
      `*,
      created_user:users!therapytype_created_by_fkey(id,email,full_name),
      updated_user:users!therapytype_updated_by_fkey(id,email,full_name)
    `
    )
    .eq('therapy_type_id', id)
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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;
  const { id } = await context.params;
  let therapyType: TherapyTypeUpdateData;
  try {
    therapyType = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapyTypeUpdateSchema.safeParse(therapyType);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('therapytype')
    .update({ ...parse.data, updated_by: user.id })
    .eq('therapy_type_id', id)
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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;
  const { id } = await context.params;
  // Add referential integrity checks here if needed
  const { error } = await supabase
    .from('therapytype')
    .delete()
    .eq('therapy_type_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
