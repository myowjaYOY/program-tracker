import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
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
    const { id, itemId } = await context.params;
    const body = await req.json();

    // If therapy_id is being updated, get the new cost and charge
    const updateData = { ...body };

    // Remove therapy_type_id as it's not a column in member_program_items
    delete updateData.therapy_type_id;

    if (body.therapy_id) {
      const { data: therapyData, error: therapyError } = await supabase
        .from('therapies')
        .select('cost, charge, taxable')
        .eq('therapy_id', body.therapy_id)
        .single();

      if (therapyError || !therapyData) {
        return NextResponse.json(
          { error: 'Therapy not found' },
          { status: 404 }
        );
      }

      updateData.item_cost = therapyData.cost;
      updateData.item_charge = therapyData.charge;
    }

    // Add audit fields
    updateData.updated_by = session.user.id;

    const { data, error } = await supabase
      .from('member_program_items')
      .update(updateData)
      .eq('member_program_item_id', itemId)
      .eq('member_program_id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update member program item' },
        { status: 500 }
      );
    }

    // Update the member program's calculated fields
    await updateMemberProgramCalculatedFields(supabase, parseInt(id));

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
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
    const { id, itemId } = await context.params;

    const { error } = await supabase
      .from('member_program_items')
      .delete()
      .eq('member_program_item_id', itemId)
      .eq('member_program_id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete member program item' },
        { status: 500 }
      );
    }

    // Update the member program's calculated fields
    await updateMemberProgramCalculatedFields(supabase, parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateMemberProgramCalculatedFields(
  supabase: any,
  memberProgramId: number
) {
  try {
    // Get all items for this member program with therapy data
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select(
        `
        quantity,
        item_cost,
        item_charge,
        therapies(
          taxable
        )
      `
      )
      .eq('member_program_id', memberProgramId)
      .eq('active_flag', true);

    if (itemsError) {
      return;
    }

    // Calculate totals
    let totalCost = 0;
    let totalCharge = 0;
    let calculatedTaxes = 0;

    (items || []).forEach((item: any) => {
      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;

      totalCost += cost * quantity;
      totalCharge += charge * quantity;
      
      // Calculate taxes for taxable items (8.25% rate)
      if (isTaxable) {
        calculatedTaxes += charge * quantity * 0.0825;
      }
    });

    // Update the member program
    const { data: updateData, error: updateError } = await supabase
      .from('member_programs')
      .update({
        total_cost: totalCost,
        total_charge: totalCharge,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('member_program_id', memberProgramId)
      .select();

    // Calculate and update Program Price and Margin in finances table (match Financials tab rules)
    // Program Price = totalCharge + max(0, finance_charges) + discounts + taxes
    // Margin = (Program Price - (totalCost + max(0, -finance_charges))) / Program Price * 100
    let financeCharges = 0;
    let discounts = 0;
    const { data: finVals } = await supabase
      .from('member_program_finances')
      .select('finance_charges, discounts')
      .eq('member_program_id', memberProgramId)
      .maybeSingle();
    if (finVals) {
      financeCharges = Number(finVals.finance_charges || 0);
      discounts = Number(finVals.discounts || 0);
    }
    const positiveFinance = Math.max(0, financeCharges);
    const negativeFinanceFee = Math.max(0, -financeCharges);
    const finalTotal = totalCharge + positiveFinance + discounts + calculatedTaxes;
    const margin =
      finalTotal > 0
        ? ((finalTotal - (totalCost + negativeFinanceFee)) / finalTotal) * 100
        : 0;

    // Check if finances record exists
    const { data: existingFinances, error: financesFetchError } = await supabase
      .from('member_program_finances')
      .select('member_program_finance_id')
      .eq('member_program_id', memberProgramId)
      .single();

    if (financesFetchError && financesFetchError.code !== 'PGRST116') {
    } else if (!existingFinances) {
      // Create default finances record
      const { data: newFinances, error: createFinancesError } = await supabase
        .from('member_program_finances')
        .insert({
          member_program_id: memberProgramId,
          taxes: calculatedTaxes,
          final_total_price: finalTotal,
          margin: margin,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select();
    } else {
      // Update existing finances record
      const { data: updatedFinances, error: updateFinancesError } =
        await supabase
          .from('member_program_finances')
          .update({
            taxes: calculatedTaxes,
            final_total_price: finalTotal,
            margin: margin,
            updated_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .eq('member_program_id', memberProgramId)
          .select();
    }
  } catch (error) {}
}
