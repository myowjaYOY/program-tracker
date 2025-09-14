import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { data, error } = await supabase
      .from('member_program_items')
      .select(`
        *,
        therapies(
          therapy_name,
          cost,
          charge,
          therapy_type_id,
          active_flag,
          therapytype(therapy_type_name),
          buckets(bucket_name)
        )
      `)
      .eq('member_program_id', id)
      .order('days_from_start');

    if (error) {
      console.error('Error fetching member program items:', error);
      return NextResponse.json({ error: 'Failed to fetch member program items' }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in member program items GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    
    // Validate required fields
    if (!body.therapy_id || !body.quantity || body.days_from_start === undefined) {
      return NextResponse.json({ error: 'Therapy ID, quantity, and days from start are required' }, { status: 400 });
    }

    // Get therapy cost and charge for calculations
    const { data: therapyData, error: therapyError } = await supabase
      .from('therapies')
      .select('cost, charge')
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
      active_flag: true,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('member_program_items')
      .insert([itemData])
      .select()
      .single();

    if (error) {
      console.error('Error creating member program item:', error);
      return NextResponse.json({ error: 'Failed to create member program item' }, { status: 500 });
    }

    // Update the member program's calculated fields
    await updateMemberProgramCalculatedFields(supabase, parseInt(id));

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in member program items POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function updateMemberProgramCalculatedFields(supabase: any, memberProgramId: number) {
  try {
    // Get all items for this member program
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select(`
        quantity,
        item_cost,
        item_charge
      `)
      .eq('member_program_id', memberProgramId)
      .eq('active_flag', true);

    if (itemsError) {
      console.error('Error fetching items for calculation:', itemsError);
      return;
    }

    // Calculate totals
    let totalCost = 0;
    let totalCharge = 0;

    (items || []).forEach(item => {
      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      
      totalCost += cost * quantity;
      totalCharge += charge * quantity;
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
      console.error('Error updating member program calculated fields:', updateError);
    } else {
      console.log(`Successfully updated member program ${memberProgramId} calculated fields:`, updateData);
    }

    // Calculate and update margin in finances table
    const margin = totalCharge > 0 ? ((totalCharge - totalCost) / totalCharge) * 100 : 0;
    
    // Check if finances record exists
    const { data: existingFinances, error: financesFetchError } = await supabase
      .from('member_program_finances')
      .select('member_program_finance_id')
      .eq('member_program_id', memberProgramId)
      .single();

    if (financesFetchError && financesFetchError.code !== 'PGRST116') {
      console.error('Error checking existing finances:', financesFetchError);
    } else if (!existingFinances) {
      // Create default finances record
      const { data: newFinances, error: createFinancesError } = await supabase
        .from('member_program_finances')
        .insert({
          member_program_id: memberProgramId,
          margin: margin,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select();

      if (createFinancesError) {
        console.error('Error creating default finances record:', createFinancesError);
      } else {
        console.log(`Successfully created default finances record for member program ${memberProgramId}:`, newFinances);
      }
    } else {
      // Update existing finances record
      const { data: updatedFinances, error: updateFinancesError } = await supabase
        .from('member_program_finances')
        .update({
          margin: margin,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('member_program_id', memberProgramId)
        .select();

      if (updateFinancesError) {
        console.error('Error updating finances margin:', updateFinancesError);
      } else {
        console.log(`Successfully updated finances margin for member program ${memberProgramId}:`, updatedFinances);
      }
    }
  } catch (error) {
    console.error('Error in updateMemberProgramCalculatedFields:', error);
  }
}
