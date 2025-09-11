import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { paymentMethodsSchema, PaymentMethodsFormData } from '@/lib/validations/payment-methods';

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
  // Join payment_methods to users for created_by and updated_by
  const { data, error } = await supabase.from('payment_methods').select(`*,
      created_user:users!payment_methods_created_by_fkey(id,email,full_name),
      updated_user:users!payment_methods_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Map to flat fields for frontend
  const mapped = (data || []).map(paymentMethod => ({
    ...paymentMethod,
    created_by_email: paymentMethod.created_user?.email || null,
    created_by_full_name: paymentMethod.created_user?.full_name || null,
    updated_by_email: paymentMethod.updated_user?.email || null,
    updated_by_full_name: paymentMethod.updated_user?.full_name || null,
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
  let body: PaymentMethodsFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = paymentMethodsSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('payment_methods')
    .insert([parse.data])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
