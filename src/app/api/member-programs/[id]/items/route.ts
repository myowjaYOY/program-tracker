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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { data, error } = await supabase
      .from('member_program_items')
      .select(
        `
        *,
        therapies(
          therapy_name,
          cost,
          charge,
          therapy_type_id,
          active_flag,
          taxable,
          therapytype(therapy_type_name),
          buckets(bucket_name)
        )
      `
      )
      .eq('member_program_id', id)
      .order('days_from_start');

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch member program items' },
        { status: 500 }
      );
    }

    // Compute used_count per item (completed schedule rows)
    const itemIds = (data || []).map((it: any) => it.member_program_item_id);
    const idToUsed: Record<string, number> = {};
    if (itemIds.length > 0) {
      const { data: schedRows, error: schedErr } = await supabase
        .from('member_program_item_schedule')
        .select('member_program_item_id, completed_flag')
        .in('member_program_item_id', itemIds);
      if (!schedErr && schedRows) {
        for (const r of schedRows as any[]) {
          if (r.completed_flag) {
            const key = String(r.member_program_item_id);
            idToUsed[key] = (idToUsed[key] || 0) + 1;
          }
        }
      }
    }

    const withUsed = (data || []).map((it: any) => ({
      ...it,
      used_count: idToUsed[String(it.member_program_item_id)] || 0,
    }));

    return NextResponse.json({ data: withUsed });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Validate required fields
    if (
      !body.therapy_id ||
      !body.quantity ||
      body.days_from_start === undefined
    ) {
      return NextResponse.json(
        { error: 'Therapy ID, quantity, and days from start are required' },
        { status: 400 }
      );
    }

    // Get therapy cost, charge, taxable status, and program_role_id for calculations
    const { data: therapyData, error: therapyError } = await supabase
      .from('therapies')
      .select('cost, charge, taxable, program_role_id')
      .eq('therapy_id', body.therapy_id)
      .single();

    if (therapyError || !therapyData) {
      return NextResponse.json({ error: 'Therapy not found' }, { status: 404 });
    }

    const itemData = {
      member_program_id: parseInt(id),
      therapy_id: body.therapy_id,
      quantity: body.quantity,
      item_cost: therapyData.cost,
      item_charge: therapyData.charge,
      days_from_start: body.days_from_start,
      days_between: body.days_between || 0,
      instructions: body.instructions || '',
      program_role_id: therapyData.program_role_id,
      active_flag: true,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    // Check if this is an Active program and validate against bounds BEFORE inserting the item
    try {
      await validateActiveProgramItemAddition(supabase, parseInt(id), itemData);
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('member_program_items')
      .insert([itemData])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create member program item' },
        { status: 500 }
      );
    }

    // Copy default tasks from therapy_tasks into member_program_item_tasks for this item
    // Idempotent without requiring a DB unique index: insert only missing
    try {
      const { data: tasks } = await supabase
        .from('therapy_tasks')
        .select('task_id, task_name, description, task_delay, program_role_id')
        .eq('therapy_id', body.therapy_id)
        .eq('active_flag', true);
      if (tasks && tasks.length > 0 && data?.member_program_item_id) {
        const newItemId = data.member_program_item_id;
        const { data: existing } = await supabase
          .from('member_program_item_tasks')
          .select('task_id')
          .eq('member_program_item_id', newItemId);
        const existingSet = new Set(
          (existing || []).map((r: any) => r.task_id)
        );
        const toInsert = tasks
          .filter((t: any) => !existingSet.has(t.task_id))
          .map((t: any) => ({
            member_program_item_id: newItemId,
            task_id: t.task_id,
            task_name: t.task_name,
            description: t.description,
            task_delay: t.task_delay,
            program_role_id: t.program_role_id, // CRITICAL: Copy role from therapy_task
            created_by: session.user.id,
            updated_by: session.user.id,
          }));
        if (toInsert.length > 0) {
          await supabase.from('member_program_item_tasks').insert(toInsert);
        }
      }
    } catch (_) {
      // Non-fatal: item was created successfully; task copying failed silently
    }

    // Update the member program's calculated fields
    await updateMemberProgramCalculatedFields(supabase, parseInt(id));

    // Update variance and margin for Active programs
    // If this fails, rollback by deleting the item we just inserted
    try {
      await validateAndUpdateActiveProgramFinances(supabase, parseInt(id));
    } catch (validationError: any) {
      // Rollback: delete the item we just inserted
      if (data?.member_program_item_id) {
        await supabase
          .from('member_program_items')
          .delete()
          .eq('member_program_item_id', data.member_program_item_id);
      }
      // Re-throw to be handled by outer catch block
      throw validationError;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'FINANCE_CHARGES_MARGIN_FLOOR') {
      return NextResponse.json(
        { error: 'Finance charges would reduce margin below 0%. Please adjust values.' },
        { status: 400 }
      );
    }
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
    // Re-throw the error so the parent route can handle it
    throw error;
  }
}
