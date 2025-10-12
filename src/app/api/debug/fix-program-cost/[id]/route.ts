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
    const programId = parseInt(id);

    console.log(`🔧 Manually fixing total_cost and total_charge for Program ${programId}...`);

    // Get all active items
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select('quantity, item_cost, item_charge, active_flag, therapies(taxable)')
      .eq('member_program_id', programId);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    let totalCost = 0;
    let totalCharge = 0;
    let totalTaxableCharge = 0;

    (items || []).forEach((item: any) => {
      if (item.active_flag) {
        const quantity = item.quantity || 1;
        const cost = item.item_cost || 0;
        const charge = item.item_charge || 0;
        
        totalCost += cost * quantity;
        totalCharge += charge * quantity;
        
        if (item.therapies?.taxable) {
          totalTaxableCharge += charge * quantity;
        }
      }
    });

    console.log(`  Calculated Cost: $${totalCost.toFixed(2)}`);
    console.log(`  Calculated Charge: $${totalCharge.toFixed(2)}`);

    // Update member_programs table
    const { error: updateError } = await supabase
      .from('member_programs')
      .update({
        total_cost: totalCost,
        total_charge: totalCharge,
        updated_by: session.user.id,
      })
      .eq('member_program_id', programId);

    if (updateError) {
      console.error('  ❌ Failed to update:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`  ✅ Successfully updated member_programs table`);

    // Verify the update
    const { data: verifyProgram } = await supabase
      .from('member_programs')
      .select('total_cost, total_charge')
      .eq('member_program_id', programId)
      .single();

    return NextResponse.json({
      success: true,
      programId,
      before: {
        note: 'Values were stale'
      },
      after: {
        totalCost: Number(verifyProgram?.total_cost || 0),
        totalCharge: Number(verifyProgram?.total_charge || 0),
      },
      calculated: {
        totalCost,
        totalCharge,
        totalTaxableCharge,
      }
    });

  } catch (error: any) {
    console.error('Fix error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

