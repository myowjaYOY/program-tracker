import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { therapySchema, TherapyFormData } from '@/lib/validations/therapy';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join to users for created_by/updated_by and related tables
  const { data, error } = await supabase.from('therapies').select(`*,
      created_user:users!therapies_created_by_fkey(id,email,full_name),
      updated_user:users!therapies_updated_by_fkey(id,email,full_name),
      therapy_type:therapytype(therapy_type_id,therapy_type_name),
      bucket:buckets(bucket_id,bucket_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = (data || []).map(therapy => ({
    ...therapy,
    created_by_email: therapy.created_user?.email || null,
    updated_by_email: therapy.updated_user?.email || null,
    therapy_type_name: therapy.therapy_type?.therapy_type_name || null,
    bucket_name: therapy.bucket?.bucket_name || null,
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
  let therapy: TherapyFormData;
  try {
    therapy = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapySchema.safeParse(therapy);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('therapies')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
