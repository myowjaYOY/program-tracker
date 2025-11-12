import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateTaxesOnTaxableItems,
  calculateProjectedPrice,
  calculateProjectedMargin,
} from '@/lib/utils/financial-calculations';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all programs with finances
    const { data: programs, error: programsError } = await supabase
      .from('member_programs')
      .select(`
        member_program_id,
        program_template_name,
        total_cost,
        total_charge,
        program_status(status_name),
        member_program_finances(
          final_total_price,
          margin,
          finance_charges,
          discounts,
          taxes,
          contracted_at_margin,
          variance
        )
      `)
      .order('member_program_id');

    if (programsError) {
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    const results = [];

    for (const program of programs || []) {
      const finances = (program.member_program_finances as any)?.[0];
      if (!finances) {
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: 'No Finances',
          currentMargin: null,
          correctMargin: null,
          difference: null,
        });
        continue;
      }

      // Get items to calculate taxable charge
      const { data: items } = await supabase
        .from('member_program_items')
        .select('quantity, item_cost, item_charge, therapies(taxable)')
        .eq('member_program_id', program.member_program_id)
        .eq('active_flag', true);

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
        if (isTaxable) {
          totalTaxableCharge += charge * quantity;
        }
      });

      // Calculate what margin SHOULD be
      const financeCharges = Number(finances.finance_charges || 0);
      const discounts = Number(finances.discounts || 0);
      
      const taxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
      const projectedPrice = calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts);
      const correctMargin = calculateProjectedMargin(projectedPrice, totalCost, financeCharges, taxes);

      const currentMargin = Number(finances.margin || 0);
      const difference = Math.abs(correctMargin - currentMargin);

      const statusName = (program.program_status as any)?.status_name || 'Unknown';
      const isActive = statusName.toLowerCase() === 'active';

      // For active programs, calculate margin on locked price
      let correctMarginForActive = null;
      if (isActive && finances.contracted_at_margin) {
        const lockedPrice = Number(finances.final_total_price || 0);
        correctMarginForActive = calculateProjectedMargin(lockedPrice, totalCost, financeCharges, taxes);
      }

      results.push({
        programId: program.member_program_id,
        name: program.program_template_name,
        status: statusName,
        currentMargin: currentMargin,
        correctMargin: isActive && correctMarginForActive !== null ? correctMarginForActive : correctMargin,
        difference: difference,
        needsUpdate: difference > 0.1,
        details: {
          totalCost,
          totalCharge,
          projectedPrice,
          lockedPrice: isActive ? Number(finances.final_total_price || 0) : null,
          financeCharges,
          discounts,
          taxes,
          totalTaxableCharge,
          isActive,
          contractedAtMargin: finances.contracted_at_margin,
        }
      });
    }

    const discrepancies = results.filter(r => r.needsUpdate);

    return NextResponse.json({
      totalPrograms: results.length,
      programsWithDiscrepancies: discrepancies.length,
      discrepancies: discrepancies,
      allResults: results,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

