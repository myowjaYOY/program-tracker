import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
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
    const { id } = context.params;
    const body = await req.json();

    // Validate required fields
    if (body.therapy_id !== undefined && !body.therapy_id) {
      return NextResponse.json(
        { error: 'Therapy ID cannot be empty' },
        { status: 400 }
      );
    }

    if (body.quantity !== undefined && body.quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be at least 1' },
        { status: 400 }
      );
    }

    if (body.days_from_start !== undefined && body.days_from_start < 0) {
      return NextResponse.json(
        { error: 'Days from start cannot be negative' },
        { status: 400 }
      );
    }

    const updateData = {
      ...body,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template_items')
      .update(updateData)
      .eq('program_template_items_id', id)
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
    await updateTemplateCalculatedFields(supabase, data.program_template_id);

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
  context: { params: { id: string } }
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
    const { id } = context.params;

    // Get the item to find the template ID before deletion
    const { data: item, error: fetchError } = await supabase
      .from('program_template_items')
      .select('program_template_id')
      .eq('program_template_items_id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching item for deletion:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch item for deletion' },
        { status: 500 }
      );
    }

    const templateId = item.program_template_id;

    // Soft delete by setting active_flag to false
    const { error } = await supabase
      .from('program_template_items')
      .update({
        active_flag: false,
        updated_by: session.user.id,
      })
      .eq('program_template_items_id', id);

    if (error) {
      console.error('Error deleting program template item:', error);
      return NextResponse.json(
        { error: 'Failed to delete program template item' },
        { status: 500 }
      );
    }

    // Update the program template's calculated fields
    await updateTemplateCalculatedFields(supabase, templateId);

    return NextResponse.json({
      message: 'Program template item deleted successfully',
    });
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
    // Get all items for this template
    const { data: items, error: itemsError } = await supabase
      .from('program_template_items')
      .select(
        `
        quantity,
        therapy:therapies(cost, charge)
      `
      )
      .eq('program_template_id', templateId)
      .eq('active_flag', true);

    if (itemsError) {
      console.error('Error fetching items for calculation:', itemsError);
      return;
    }

    // Calculate totals
    let totalCost = 0;
    let totalCharge = 0;

    items.forEach((item: any) => {
      const itemCost = (item.therapy.cost || 0) * (item.quantity || 1);
      const itemCharge = (item.therapy.charge || 0) * (item.quantity || 1);
      totalCost += itemCost;
      totalCharge += itemCharge;
    });

    // Calculate margin percentage
    const marginPercentage =
      totalCost > 0 ? ((totalCharge - totalCost) / totalCost) * 100 : 0;

    // Update the template
    const { error: updateError } = await supabase
      .from('program_template')
      .update({
        total_cost: totalCost,
        total_charge: totalCharge,
        margin_percentage: marginPercentage,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('program_template_id', templateId);

    if (updateError) {
      console.error('Error updating template calculated fields:', updateError);
    }
  } catch (error) {
    console.error('Error in updateTemplateCalculatedFields:', error);
  }
}
