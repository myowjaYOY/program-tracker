import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api';
import {
  therapyTypeSchema,
  TherapyTypeFormData,
} from '@/lib/validations/therapy-type';

export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;
  // Join to users for created_by/updated_by
  const { data, error } = await supabase.from('therapytype').select(`*,
      created_user:users!therapytype_created_by_fkey(id,email,full_name),
      updated_user:users!therapytype_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = (data || []).map(therapyType => ({
    ...therapyType,
    created_by_email: therapyType.created_user?.email || null,
    updated_by_email: therapyType.updated_user?.email || null,
  }));
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;
  let therapyType: TherapyTypeFormData;
  try {
    therapyType = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapyTypeSchema.safeParse(therapyType);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('therapytype')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
