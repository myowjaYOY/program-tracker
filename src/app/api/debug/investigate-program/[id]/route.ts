import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateTaxesOnTaxableItems,
  calculateProjectedPrice,
  calculateProjectedMargin,
} from '@/lib/utils/financial-calculations';

export async function GET(
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

    // Get program details
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select(`
        member_program_id,
        program_template_name,
        total_cost,
        total_charge,
        program_status(status_name)
      `)
      .eq('member_program_id', programId)
      .single();

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Get finances
    const { data: finances, error: financesError } = await supabase
      .from('member_program_finances')
      .select('*')
      .eq('member_program_id', programId)
      .single();

    if (financesError || !finances) {
      return NextResponse.json({ error: 'Finances not found' }, { status: 404 });
    }

    // Get all items with details
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select(`
        member_program_item_id,
        quantity,
        item_cost,
        item_charge,
        active_flag,
        therapies(
          therapy_id,
          therapy_name,
          cost,
          charge,
          taxable
        )
      `)
      .eq('member_program_id', programId)
      .order('member_program_item_id');

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Calculate totals from items
    let totalCost = 0;
    let totalCharge = 0;
    let totalTaxableCharge = 0;
    const itemDetails: any[] = [];

    (items || []).forEach((item: any) => {
      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;
      const isActive = item.active_flag === true;

      if (isActive) {
        totalCost += cost * quantity;
        totalCharge += charge * quantity;
        if (isTaxable) {
          totalTaxableCharge += charge * quantity;
        }
      }

      itemDetails.push({
        itemId: item.member_program_item_id,
        therapyName: item.therapies?.therapy_name,
        quantity,
        cost,
        charge,
        taxable: isTaxable,
        active: isActive,
        lineCost: cost * quantity,
        lineCharge: charge * quantity,
      });
    });

    // Calculate taxes
    const financeCharges = Number(finances.finance_charges || 0);
    const discounts = Number(finances.discounts || 0);
    
    const taxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
    const projectedPrice = calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts);

    // Determine if Active
    const statusName = (program.program_status as any)?.status_name || 'Unknown';
    const isActive = statusName.toLowerCase() === 'active';

    // Calculate margin using OLD formula (for comparison)
    const oldMarginFormula = projectedPrice > 0
      ? ((projectedPrice - totalCost) / projectedPrice) * 100
      : 0;

    // Calculate margin using NEW formula
    let newMarginFormula: number;
    
    if (isActive) {
      // Active: use locked price
      const lockedPrice = Number(finances.final_total_price || 0);
      newMarginFormula = calculateProjectedMargin(lockedPrice, totalCost, financeCharges, taxes);
    } else {
      // Quote: use projected price
      newMarginFormula = calculateProjectedMargin(projectedPrice, totalCost, financeCharges, taxes);
    }

    // Calculate what the UI shows (from useFinancialsDerived)
    const uiMargin = calculateProjectedMargin(projectedPrice, totalCost, financeCharges, taxes);

    return NextResponse.json({
      program: {
        id: program.member_program_id,
        name: program.program_template_name,
        status: statusName,
        isActive,
      },
      finances: {
        savedMargin: Number(finances.margin || 0),
        contractedAtMargin: finances.contracted_at_margin,
        finalTotalPrice: Number(finances.final_total_price || 0),
        financeCharges: financeCharges,
        discounts: discounts,
        taxesStored: Number(finances.taxes || 0),
        variance: finances.variance,
      },
      calculated: {
        totalCost,
        totalCharge,
        totalTaxableCharge,
        taxesCalculated: taxes,
        projectedPrice,
        lockedPrice: isActive ? Number(finances.final_total_price || 0) : null,
      },
      margins: {
        savedInDatabase: Number(finances.margin || 0),
        oldFormula: oldMarginFormula,
        newFormula: newMarginFormula,
        uiCalculation: uiMargin,
        difference: Math.abs(newMarginFormula - Number(finances.margin || 0)),
      },
      formulas: {
        old: {
          description: 'Includes taxes in denominator',
          formula: '((projectedPrice - totalCost) / projectedPrice) × 100',
          projectedPrice: projectedPrice,
          totalCost: totalCost,
          result: oldMarginFormula,
        },
        new: isActive ? {
          description: 'Active: Uses locked price, excludes taxes, adjusts for negative finance charges',
          formula: '((preTaxLockedPrice - adjustedCost) / preTaxLockedPrice) × 100',
          lockedPrice: Number(finances.final_total_price || 0),
          taxes: taxes,
          preTaxLockedPrice: Number(finances.final_total_price || 0) - taxes,
          totalCost: totalCost,
          financeCharges: financeCharges,
          adjustedCost: financeCharges < 0 ? totalCost + Math.abs(financeCharges) : totalCost,
          result: newMarginFormula,
        } : {
          description: 'Quote: Uses projected price, excludes taxes, adjusts for negative finance charges',
          formula: '((preTaxRevenue - adjustedCost) / preTaxRevenue) × 100',
          projectedPrice: projectedPrice,
          taxes: taxes,
          preTaxRevenue: projectedPrice - taxes,
          totalCost: totalCost,
          financeCharges: financeCharges,
          adjustedCost: financeCharges < 0 ? totalCost + Math.abs(financeCharges) : totalCost,
          result: newMarginFormula,
        },
      },
      items: itemDetails,
      analysis: {
        taxImpact: oldMarginFormula - newMarginFormula,
        taxImpactDescription: `Excluding taxes ${taxes > 0 ? 'increases' : 'has no impact on'} margin by ${Math.abs(oldMarginFormula - newMarginFormula).toFixed(2)}%`,
        financeChargeImpact: financeCharges < 0 
          ? `Negative finance charges ($${Math.abs(financeCharges).toFixed(2)}) are treated as expenses, reducing margin`
          : financeCharges > 0
            ? `Positive finance charges ($${financeCharges.toFixed(2)}) are treated as revenue, increasing margin`
            : 'No finance charges',
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

