import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateTaxesOnTaxableItems,
  calculateProjectedPrice,
  calculateProjectedMargin,
} from '@/lib/utils/financial-calculations';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔧 Starting Margin Fix Migration...\n');

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
          member_program_finance_id,
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
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const program of programs || []) {
      const finances = (program.member_program_finances as any)?.[0];
      if (!finances) {
        skippedCount++;
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: 'Skipped - No Finances',
          updated: false,
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

      const statusName = (program.program_status as any)?.status_name || 'Unknown';
      const isActive = statusName.toLowerCase() === 'active';

      let correctMargin: number;

      // For active programs, calculate margin on locked price
      if (isActive) {
        const lockedPrice = Number(finances.final_total_price || 0);
        correctMargin = calculateProjectedMargin(lockedPrice, totalCost, financeCharges, taxes);
      } else {
        // For Quote programs, calculate margin on projected price
        correctMargin = calculateProjectedMargin(projectedPrice, totalCost, financeCharges, taxes);
      }

      const currentMargin = Number(finances.margin || 0);
      const difference = Math.abs(correctMargin - currentMargin);

      // Update if difference is significant (> 0.01%)
      if (difference > 0.01) {
        const updateData: any = {
          margin: correctMargin,
          updated_by: session.user.id,
        };

        // For Active programs, also set contracted_at_margin if not already set
        if (isActive && !finances.contracted_at_margin) {
          updateData.contracted_at_margin = correctMargin;
        }

        const { error: updateError } = await supabase
          .from('member_program_finances')
          .update(updateData)
          .eq('member_program_finance_id', finances.member_program_finance_id);

        if (updateError) {
          errorCount++;
          results.push({
            programId: program.member_program_id,
            name: program.program_template_name,
            status: 'Error',
            error: updateError.message,
            updated: false,
          });
          console.error(`Error updating program ${program.member_program_id}:`, updateError);
        } else {
          updatedCount++;
          results.push({
            programId: program.member_program_id,
            name: program.program_template_name,
            status: statusName,
            oldMargin: currentMargin,
            newMargin: correctMargin,
            difference: difference,
            updated: true,
            contractedAtMarginSet: isActive && !finances.contracted_at_margin,
          });
          console.log(`✅ Updated Program ${program.member_program_id}: ${currentMargin.toFixed(2)}% → ${correctMargin.toFixed(2)}%`);
        }
      } else {
        skippedCount++;
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: statusName,
          margin: currentMargin,
          updated: false,
          reason: 'Already correct',
        });
      }
    }

    console.log('\n✅ Migration Complete!');
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalPrograms: programs?.length || 0,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      results,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

