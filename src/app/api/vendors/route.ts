import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vendorSchema, VendorFormData } from '@/lib/validations/vendor';

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
  // Join vendors to users for created_by and updated_by
  const { data, error } = await supabase.from('vendors').select(`*,
      created_user:users!vendors_created_by_fkey(id,email,full_name),
      updated_user:users!vendors_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Map to flat fields for frontend
  const mapped = (data || []).map(vendor => ({
    ...vendor,
    created_by_email: vendor.created_user?.email || null,
    created_by_full_name: vendor.created_user?.full_name || null,
    updated_by_email: vendor.updated_user?.email || null,
    updated_by_full_name: vendor.updated_user?.full_name || null,
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
  let body: VendorFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = vendorSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('vendors')
    .insert([parse.data])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
