import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get program total_cost from database
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('member_program_id, program_template_name, total_cost, total_charge')
      .eq('member_program_id', id)
      .single();

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Calculate actual cost from items
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select('quantity, item_cost, active_flag')
      .eq('member_program_id', id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    let calculatedCost = 0;
    let calculatedCharge = 0;

    (items || []).forEach((item: any) => {
      if (item.active_flag) {
        calculatedCost += (item.item_cost || 0) * (item.quantity || 1);
      }
    });

    const difference = Math.abs(Number(program.total_cost || 0) - calculatedCost);

    return NextResponse.json({
      programId: program.member_program_id,
      name: program.program_template_name,
      storedCost: Number(program.total_cost || 0),
      calculatedCost: calculatedCost,
      difference: difference,
      isStale: difference > 0.01,
      itemCount: items?.length || 0,
      activeItemCount: items?.filter((i: any) => i.active_flag).length || 0,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

