import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; paymentId: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, paymentId } = await context.params;
    const body = await req.json();

    const updateData: any = {
      ...body,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('member_program_payments')
      .update(updateData)
      .eq('member_program_payment_id', paymentId)
      .eq('member_program_id', id)
      .select(`*,
        payment_status:payment_status(payment_status_name),
        payment_methods:payment_methods(payment_method_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 });
    }

    const mapped = data && {
      ...data,
      payment_status_name: data.payment_status?.payment_status_name ?? null,
      payment_method_name: data.payment_methods?.payment_method_name ?? null,
    };

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; paymentId: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, paymentId } = await context.params;

    const { error } = await supabase
      .from('member_program_payments')
      .delete()
      .eq('member_program_payment_id', paymentId)
      .eq('member_program_id', id);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to delete payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}


