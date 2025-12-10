import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateProgramTemplateTotals } from '@/lib/utils/program-template-calculations';

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

    const updateData = {
      therapy_id: body.therapy_id,
      quantity: body.quantity,
      days_from_start: body.days_from_start,
      days_between: body.days_between || 0,
      program_role_id: body.program_role_id || null,
      active_flag: body.active_flag ?? true,
      instructions: body.instructions || '',
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template_items')
      .update(updateData)
      .eq('program_template_items_id', parseInt(itemId))
      .eq('program_template_id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('Error updating program template item:', error);
      return NextResponse.json(
        { error: 'Failed to update program template item' },
        { status: 500 }
      );
    }

    // Update the program template's calculated fields
    await updateTemplateCalculatedFields(supabase, parseInt(id));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in program template item PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

    const { error } = await supabase
      .from('program_template_items')
      .delete()
      .eq('program_template_items_id', parseInt(itemId))
      .eq('program_template_id', parseInt(id));

    if (error) {
      console.error('Error deleting program template item:', error);
      return NextResponse.json(
        { error: 'Failed to delete program template item' },
        { status: 500 }
      );
    }


    // Update the program template's calculated fields
    await updateTemplateCalculatedFields(supabase, parseInt(id));

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error in program template item DELETE:', error);
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
    const transformedItems = (items || []).map((item: any) => ({
      quantity: item.quantity || 1,
      item_cost: item.therapies?.cost || 0,
      item_charge: item.therapies?.charge || 0,
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
    }
  } catch (error) {
    console.error('Error in updateTemplateCalculatedFields:', error);
  }
}
