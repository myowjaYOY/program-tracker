import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: list payments for a program with joined status/method names
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('member_program_payments')
      .select(`*,
        payment_status:payment_status(payment_status_name),
        payment_methods:payment_methods(payment_method_name)
      `)
      .eq('member_program_id', id)
      .order('payment_due_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch program payments' }, { status: 500 });
    }

    const mapped = (data || []).map((row: any) => ({
      ...row,
      payment_status_name: row.payment_status?.payment_status_name ?? null,
      payment_method_name: row.payment_methods?.payment_method_name ?? null,
    }));

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const programId = parseInt(id, 10);
    if (!Number.isFinite(programId)) {
      return NextResponse.json({ error: 'Invalid program id' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Basic validation; deeper Zod validation is handled on client; enforce minimal server checks
    if (body.member_program_id && body.member_program_id !== programId) {
      return NextResponse.json({ error: 'member_program_id mismatch' }, { status: 400 });
    }

    const insertData = {
      member_program_id: programId,
      payment_amount: body.payment_amount ?? null,
      payment_due_date: body.payment_due_date ?? null,
      payment_date: body.payment_date ?? null,
      payment_status_id: body.payment_status_id ?? null,
      payment_method_id: body.payment_method_id ?? null,
      payment_reference: body.payment_reference ?? null,
      notes: body.notes ?? null,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('member_program_payments')
      .insert([insertData])
      .select(`*,
        payment_status:payment_status(payment_status_name),
        payment_methods:payment_methods(payment_method_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create payment' }, { status: 500 });
    }

    const mapped = data && {
      ...data,
      payment_status_name: data.payment_status?.payment_status_name ?? null,
      payment_method_name: data.payment_methods?.payment_method_name ?? null,
    };

    return NextResponse.json({ data: mapped }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
