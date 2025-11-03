import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for receiving items
const receiveItemSchema = z.object({
  po_item_id: z.number(),
  quantity_receiving: z.number().min(0),
});

const receiveSchema = z.object({
  items: z.array(receiveItemSchema),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = receiveSchema.parse(body);

    // Filter out items with zero quantity
    const itemsToReceive = validatedData.items.filter(item => item.quantity_receiving > 0);

    if (itemsToReceive.length === 0) {
      return NextResponse.json({ error: 'No items to receive' }, { status: 400 });
    }

    // Get current PO to verify status
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status, po_id')
      .eq('po_id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Verify PO can be received against
    const validStatuses = ['ordered', 'partially_received'];
    if (!validStatuses.includes(currentPO.status)) {
      return NextResponse.json(
        { error: `Cannot receive against PO with status: ${currentPO.status}. Only 'ordered' or 'partially_received' POs can be received.` },
        { status: 400 }
      );
    }

    // Get all PO items with their current quantities
    const { data: poItems, error: poItemsError } = await supabase
      .from('purchase_order_items')
      .select('po_item_id, therapy_id, quantity_ordered, quantity_received')
      .eq('po_id', id);

    if (poItemsError) {
      return NextResponse.json({ error: poItemsError.message }, { status: 500 });
    }

    // Validate each item being received
    for (const receiveItem of itemsToReceive) {
      const poItem = poItems?.find(item => item.po_item_id === receiveItem.po_item_id);
      
      if (!poItem) {
        return NextResponse.json(
          { error: `PO item ${receiveItem.po_item_id} not found` },
          { status: 400 }
        );
      }

      const remaining = poItem.quantity_ordered - poItem.quantity_received;
      if (receiveItem.quantity_receiving > remaining) {
        return NextResponse.json(
          { error: `Cannot receive ${receiveItem.quantity_receiving} items for PO item ${receiveItem.po_item_id}. Only ${remaining} remaining.` },
          { status: 400 }
        );
      }
    }

    // Process each item: update purchase_order_items
    // Note: The database trigger 'update_inventory_on_po_receive' automatically:
    // - Creates inventory_transactions record
    // - Updates inventory_items.quantity_on_hand
    const now = new Date().toISOString();

    for (const receiveItem of itemsToReceive) {
      const poItem = poItems?.find(item => item.po_item_id === receiveItem.po_item_id);
      if (!poItem) continue;

      const newQuantityReceived = poItem.quantity_received + receiveItem.quantity_receiving;
      const isFullyReceived = newQuantityReceived >= poItem.quantity_ordered;

      // Update purchase_order_items - trigger will handle inventory updates
      const updateData: any = {
        quantity_received: newQuantityReceived,
        updated_by: user.id,
      };
      
      // Only set received_date if this is the first receive or full receive
      if (isFullyReceived || poItem.quantity_received === 0) {
        updateData.received_date = now;
      }

      const { error: updatePOItemError } = await supabase
        .from('purchase_order_items')
        .update(updateData)
        .eq('po_item_id', receiveItem.po_item_id);

      if (updatePOItemError) {
        console.error('[PO Receive API] Update PO item error:', updatePOItemError);
        return NextResponse.json({ error: updatePOItemError.message }, { status: 500 });
      }
    }

    // Get updated PO items to check if all are fully received
    const { data: updatedPOItems, error: updatedItemsError } = await supabase
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('po_id', id);

    if (updatedItemsError) {
      return NextResponse.json({ error: updatedItemsError.message }, { status: 500 });
    }

    // Determine new PO status
    let newStatus = 'partially_received';
    const allFullyReceived = updatedPOItems?.every(item => item.quantity_received >= item.quantity_ordered);
    if (allFullyReceived) {
      newStatus = 'received';
    }

    // Update PO status
    const { data: updatedPO, error: updatePOError } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
      })
      .eq('po_id', id)
      .select()
      .single();

    if (updatePOError) {
      return NextResponse.json({ error: updatePOError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updatedPO }, { status: 200 });
  } catch (error: any) {
    console.error('[PO Receive API] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to receive purchase order items' },
      { status: 500 }
    );
  }
}

