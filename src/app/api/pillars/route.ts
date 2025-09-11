import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pillarSchema, PillarFormData } from '@/lib/validations/pillar';

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
  const { data, error } = await supabase.from('pillars').select(`*,
      created_user:users!pillars_created_by_fkey(id,email,full_name),
      updated_user:users!pillars_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = (data || []).map(pillar => ({
    ...pillar,
    created_by_email: pillar.created_user?.email || null,
    updated_by_email: pillar.updated_user?.email || null,
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
  let pillar: PillarFormData;
  try {
    pillar = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = pillarSchema.safeParse(pillar);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('pillars')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
