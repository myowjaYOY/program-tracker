import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { paymentUpdates } = body;

    if (!Array.isArray(paymentUpdates)) {
      return NextResponse.json(
        { error: 'paymentUpdates must be an array' },
        { status: 400 }
      );
    }

    // Validate that all payment updates are for the same program
    const programId = parseInt(id);
    for (const update of paymentUpdates) {
      if (update.member_program_id !== programId) {
        return NextResponse.json(
          { error: 'All payments must belong to the same program' },
          { status: 400 }
        );
      }
    }

    // Update all payments in a transaction
    const results = [];
    for (const update of paymentUpdates) {
      const { member_program_payment_id, ...updateData } = update;
      
      // Remove payment_method_id if it's 0 (not selected for pending payments)
      const { payment_method_id, ...cleanUpdateData } = updateData;
      const finalUpdateData = payment_method_id === 0 
        ? cleanUpdateData 
        : updateData;
      
      const { data, error } = await supabase
        .from('member_program_payments')
        .update({
          ...finalUpdateData,
          updated_by: session.user.id,
        })
        .eq('member_program_payment_id', member_program_payment_id)
        .eq('member_program_id', programId)
        .select(
          `*,
          payment_status:payment_status(payment_status_name),
          payment_methods:payment_methods(payment_method_name)
        `
        )
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Failed to update payment ${member_program_payment_id}: ${error.message}` },
          { status: 500 }
        );
      }

      const mapped = data && {
        ...data,
        payment_status_name: data.payment_status?.payment_status_name ?? null,
        payment_method_name: data.payment_methods?.payment_method_name ?? null,
      };

      results.push(mapped);
    }

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
