import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  calculateVariance, 
  validateActiveProgramChanges,
  calculateProjectedPrice,
  calculateProjectedMargin,
  calculateTaxesOnTaxableItems,
  validateActiveProgramItemAddition,
  validateAndUpdateActiveProgramFinances
} from '@/lib/utils/financial-calculations';

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

    const updateData = { ...body };

    // Remove therapy_type_id as it's not a column in member_program_items
    delete updateData.therapy_type_id;

    // Get current item and program status to determine if we can update prices
    const { data: currentItem, error: currentItemError } = await supabase
      .from('member_program_items')
      .select('therapy_id, member_program_id')
      .eq('member_program_item_id', itemId)
      .single();

    if (currentItemError || !currentItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('program_status(status_name)')
      .eq('member_program_id', currentItem.member_program_id)
      .single();

    const isActive = (program?.program_status as any)?.status_name?.toLowerCase() === 'active';

    // CRITICAL: For Active programs, NEVER update item_cost or item_charge
    // These prices are LOCKED when the program goes Active
    // Only fetch new prices if:
    // 1. Program is NOT Active AND
    // 2. therapy_id is actually CHANGING (not just present in body)
    if (!isActive && body.therapy_id && body.therapy_id !== currentItem.therapy_id) {
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

    // For Active programs, explicitly remove item_cost and item_charge from updateData
    // to ensure locked prices are never modified
    if (isActive) {
      delete updateData.item_cost;
      delete updateData.item_charge;
    }

    // Add audit fields
    updateData.updated_by = session.user.id;

    // Check if this is an Active program and validate against bounds BEFORE updating the item
    try {
      await validateActiveProgramItemAddition(supabase, parseInt(id), { ...updateData, itemId, operation: 'update' });
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

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

    // Update Active program variance and margin if needed
    await validateAndUpdateActiveProgramFinances(supabase, parseInt(id));

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
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

    // Check if this is an Active program and validate against bounds BEFORE deleting the item
    try {
      await validateActiveProgramItemAddition(supabase, parseInt(id), { itemId, operation: 'delete' });
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

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

    // Update Active program variance and margin if needed
    await validateAndUpdateActiveProgramFinances(supabase, parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateMemberProgramCalculatedFields(
  supabase: any,
  memberProgramId: number
): Promise<void> {
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
    let totalTaxableCharge = 0;

    (items || []).forEach((item: any) => {
      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;

      totalCost += cost * quantity;
      totalCharge += charge * quantity;
      
      // Track taxable charge separately
      if (isTaxable) {
        totalTaxableCharge += charge * quantity;
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

    if (updateError) {
      throw new Error(`Failed to update member_programs calculated fields: ${updateError.message}`);
    }

    // Check if program is Active to skip margin calculation
    const { data: programStatus } = await supabase
      .from('member_programs')
      .select('program_status(status_name)')
      .eq('member_program_id', memberProgramId)
      .single();
    
    const isActive = (programStatus?.program_status as any)?.status_name?.toLowerCase() === 'active';

    // Calculate and update Program Price and Margin in finances table using shared utility
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

    // Use shared calculation utility
    const { calculateProgramFinancials } = await import('@/lib/utils/financial-calculations');
    const financialResult = calculateProgramFinancials({
      totalCost,
      totalCharge,
      financeCharges,
      discounts,
      totalTaxableCharge,
    });
    
    const finalTotal = financialResult.programPrice;
    const margin = financialResult.margin;
    const calculatedTaxes = financialResult.taxes;

    // Prevent negative margin for Quote (non-Active) when finance charges are negative
    if (!isActive && margin <= 0 && financeCharges < 0) {
      throw new Error('FINANCE_CHARGES_MARGIN_FLOOR');
    }

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
      // For Active programs, skip margin and final_total_price updates - they will be handled by validateAndUpdateActiveProgramFinances
      const updateData: any = {
        taxes: calculatedTaxes,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
      };
      
      // Only update margin and final_total_price for non-Active programs
      if (!isActive) {
        updateData.margin = margin;
        updateData.final_total_price = finalTotal;
      }
      
      const { data: updatedFinances, error: updateFinancesError } =
        await supabase
          .from('member_program_finances')
          .update(updateData)
          .eq('member_program_id', memberProgramId)
          .select();
    }
  } catch (error: any) {
    throw error;
  }
}
