import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateProgramTemplateTotals } from '@/lib/utils/program-template-calculations';

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
      .from('program_template_items')
      .select(
        `
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
      `
      )
      .eq('program_template_id', id)
      .order('days_from_start');

    if (error) {
      console.error('Error fetching program template items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch program template items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in program template items GET:', error);
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

    const itemData = {
      program_template_id: parseInt(id),
      therapy_id: body.therapy_id,
      quantity: body.quantity,
      days_from_start: body.days_from_start,
      days_between: body.days_between || 0,
      instructions: body.instructions || '',
      active_flag: body.active_flag ?? true,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template_items')
      .insert([itemData])
      .select()
      .single();

    if (error) {
      console.error('Error creating program template item:', error);
      return NextResponse.json(
        { error: 'Failed to create program template item' },
        { status: 500 }
      );
    }

    // Update the program template's calculated fields
    await updateTemplateCalculatedFields(supabase, parseInt(id));

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in program template items POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateTemplateCalculatedFields(
  supabase: any,
  templateId: number
) {
  try {
    // Get all items for this template with therapy data
    const { data: items, error: itemsError } = await supabase
      .from('program_template_items')
      .select(
        `
        quantity,
        therapies(cost, charge)
      `
      )
      .eq('program_template_id', templateId)
      .eq('active_flag', true);

    if (itemsError) {
      console.error('Error fetching items for calculation:', itemsError);
      return;
    }

    // Transform items to match the expected format for calculation
    const transformedItems = (items || []).map(item => ({
      quantity: item.quantity || 1,
      cost: item.therapies?.cost || 0,
      charge: item.therapies?.charge || 0,
    }));

    // Calculate totals using our utility function
    const totals = calculateProgramTemplateTotals(transformedItems);

    // Update the template
    const { data: updateData, error: updateError } = await supabase
      .from('program_template')
      .update({
        total_cost: totals.total_cost,
        total_charge: totals.total_charge,
        margin_percentage: totals.margin_percentage,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('program_template_id', templateId)
      .select();

    if (updateError) {
      console.error('Error updating template calculated fields:', updateError);
      console.error('Update query details:', {
        templateId,
        totals,
        updateData,
      });
    } else {
      console.log(
        `Successfully updated template ${templateId} calculated fields:`,
        updateData
      );
    }
  } catch (error) {
    console.error('Error in updateTemplateCalculatedFields:', error);
  }
}
