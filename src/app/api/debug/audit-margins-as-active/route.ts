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
          correctMarginAsActive: null,
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

      // Calculate taxes and projected price
      const financeCharges = Number(finances.finance_charges || 0);
      const discounts = Number(finances.discounts || 0);
      
      const taxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
      const projectedPrice = calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts);

      const currentMargin = Number(finances.margin || 0);
      const statusName = (program.program_status as any)?.status_name || 'Unknown';
      const actuallyIsActive = statusName.toLowerCase() === 'active';

      // ASSUME ALL PROGRAMS ARE ACTIVE - Calculate margin on locked price (final_total_price)
      const lockedPrice = Number(finances.final_total_price || 0);
      const correctMarginAsActive = calculateProjectedMargin(lockedPrice, totalCost, financeCharges, taxes);

      const difference = Math.abs(correctMarginAsActive - currentMargin);

      // For details reporting
      const preTaxLockedPrice = lockedPrice - taxes;
      const adjustedCost = financeCharges < 0 
        ? totalCost + Math.abs(financeCharges)
        : totalCost - financeCharges;

      results.push({
        programId: program.member_program_id,
        name: program.program_template_name,
        actualStatus: statusName,
        actuallyIsActive: actuallyIsActive,
        currentMargin: currentMargin,
        correctMarginAsActive: correctMarginAsActive,
        difference: difference,
        needsUpdate: difference > 0.1,
        details: {
          totalCost,
          totalCharge,
          totalTaxableCharge,
          taxesCalculated: taxes,
          taxesStored: Number(finances.taxes || 0),
          projectedPrice,
          lockedPrice: lockedPrice,
          preTaxLockedPrice: preTaxLockedPrice,
          financeCharges,
          discounts,
          adjustedCost,
          contractedAtMargin: finances.contracted_at_margin,
          variance: finances.variance,
        }
      });
    }

    const discrepancies = results.filter(r => r.needsUpdate);

    return NextResponse.json({
      note: 'This audit ASSUMES all programs are Active and calculates margin on locked price (final_total_price)',
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

