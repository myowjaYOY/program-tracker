import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  therapyUpdateSchema,
  TherapyUpdateData,
} from '@/lib/validations/therapy';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    .from('therapies')
    .select(
      `*,
      created_user:users!therapies_created_by_fkey(id,email,full_name),
      updated_user:users!therapies_updated_by_fkey(id,email,full_name),
      therapy_type:therapytype(therapy_type_id,therapy_type_name),
      bucket:buckets(bucket_id,bucket_name)
    `
    )
    .eq('therapy_id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = {
    ...data,
    created_by_email: data.created_user?.email || null,
    updated_by_email: data.updated_user?.email || null,
    therapy_type_name: data.therapy_type?.therapy_type_name || null,
    bucket_name: data.bucket?.bucket_name || null,
  };
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
  let therapy: TherapyUpdateData;
  try {
    therapy = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapyUpdateSchema.safeParse(therapy);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('therapies')
    .update({ ...parse.data, updated_by: user.id })
    .eq('therapy_id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
  const { error } = await supabase
    .from('therapies')
    .delete()
    .eq('therapy_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
