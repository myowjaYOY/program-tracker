import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { purchaseOrderSchema } from '@/lib/validations/purchase-orders';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items (
          *,
          therapy:therapies (
            therapy_name,
            therapy_type:therapytype (
              therapy_type_name
            )
          )
        )
      `)
      .eq('po_id', id)
      .single();

    if (error) {
      console.error('[PO API] Fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error('[PO API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { po_id, ...updateData } = body;

    // Validate the update data
    const validatedData = purchaseOrderSchema.parse(updateData);

    // Update the purchase order
    const { data: updatedPO, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: validatedData.status,
        expected_delivery_date: validatedData.expected_delivery_date,
        tax_amount: validatedData.tax_amount,
        shipping_cost: validatedData.shipping_cost,
        notes: validatedData.order_notes,
      })
      .eq('po_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PO API] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Delete existing items and insert new ones
    const { error: deleteError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('po_id', id);

    if (deleteError) {
      console.error('[PO API] Delete items error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new items
    const itemsToInsert = validatedData.purchase_order_items.map(item => ({
      po_id: parseInt(id),
      therapy_id: item.therapy_id,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
      line_total: item.quantity_ordered * item.unit_cost,
    }));

    const { error: insertError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert);

    if (insertError) {
      console.error('[PO API] Insert items error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Fetch the complete updated PO with items
    const { data: completePO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items (
          *,
          therapy:therapies (
            therapy_name,
            therapy_type:therapytype (
              therapy_type_name
            )
          )
        )
      `)
      .eq('po_id', id)
      .single();

    if (fetchError) {
      console.error('[PO API] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ data: completePO }, { status: 200 });
  } catch (error: any) {
    console.error('[PO API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Soft delete by setting active_flag to false
    const { error } = await supabase
      .from('purchase_orders')
      .update({ active_flag: false })
      .eq('po_id', id);

    if (error) {
      console.error('[PO API] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[PO API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}

