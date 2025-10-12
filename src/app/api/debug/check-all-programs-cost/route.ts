import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    // Get all programs
    const { data: programs, error: programsError } = await supabase
      .from('member_programs')
      .select('member_program_id, program_template_name, total_cost, total_charge, program_status(status_name)')
      .order('member_program_id');

    if (programsError) {
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    const results = [];

    for (const program of programs || []) {
      // Get items for this program
      const { data: items, error: itemsError } = await supabase
        .from('member_program_items')
        .select('quantity, item_cost, item_charge, active_flag, therapies(taxable)')
        .eq('member_program_id', program.member_program_id);

      if (itemsError) {
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: (program.program_status as any)?.status_name || 'Unknown',
          error: itemsError.message,
        });
        continue;
      }

      let calculatedCost = 0;
      let calculatedCharge = 0;
      let calculatedTaxableCharge = 0;
      let activeItemCount = 0;

      (items || []).forEach((item: any) => {
        if (item.active_flag) {
          activeItemCount++;
          const quantity = item.quantity || 1;
          const cost = item.item_cost || 0;
          const charge = item.item_charge || 0;
          
          calculatedCost += cost * quantity;
          calculatedCharge += charge * quantity;
          
          if (item.therapies?.taxable) {
            calculatedTaxableCharge += charge * quantity;
          }
        }
      });

      const storedCost = Number(program.total_cost || 0);
      const storedCharge = Number(program.total_charge || 0);
      const costDifference = Math.abs(storedCost - calculatedCost);
      const chargeDifference = Math.abs(storedCharge - calculatedCharge);
      const isStale = costDifference > 0.01 || chargeDifference > 0.01;

      results.push({
        programId: program.member_program_id,
        name: program.program_template_name,
        status: (program.program_status as any)?.status_name || 'Unknown',
        storedCost,
        calculatedCost,
        costDifference,
        storedCharge,
        calculatedCharge,
        chargeDifference,
        isStale,
        itemCount: items?.length || 0,
        activeItemCount,
      });
    }

    const stalePrograms = results.filter(r => r.isStale);

    return NextResponse.json({
      totalPrograms: results.length,
      stalePrograms: stalePrograms.length,
      staleList: stalePrograms,
      allResults: results,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

