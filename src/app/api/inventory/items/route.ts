import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/inventory/items
 * Fetch all inventory items with therapy details
 */
export async function GET() {
  const supabase = await createClient();

  // Authentication check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch inventory items with therapy information
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        therapy:therapies (
          therapy_id,
          therapy_name,
          description,
          cost,
          charge,
          therapy_type:therapytype (
            therapy_type_name
          )
        )
      `)
      .eq('active_flag', true)
      .order('therapy_id');

    if (error) {
      console.error('Error fetching inventory items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get quantity on order from purchase orders (status = 'ordered')
    const therapyIds = data?.map((item: any) => item.therapy_id).filter(Boolean) || [];
    
    let quantityOnOrderMap = new Map<number, number>();
    
    if (therapyIds.length > 0) {
      const { data: poItems, error: poErr } = await supabase
        .from('purchase_order_items')
        .select(`
          therapy_id,
          quantity_ordered,
          purchase_orders!inner(status)
        `)
        .in('therapy_id', therapyIds)
        .eq('purchase_orders.status', 'ordered');
      
      if (poErr) {
        console.error('Error fetching purchase order items:', poErr);
      } else {
        // Aggregate quantity on order by therapy_id
        (poItems || []).forEach((item: any) => {
          const currentQty = quantityOnOrderMap.get(item.therapy_id) || 0;
          quantityOnOrderMap.set(item.therapy_id, currentQty + (item.quantity_ordered || 0));
        });
      }
    }

    // Merge quantity_on_order into inventory items
    const itemsWithOnOrder = (data || []).map((item: any) => ({
      ...item,
      quantity_on_order: quantityOnOrderMap.get(item.therapy_id) || 0,
    }));

    return NextResponse.json({ data: itemsWithOnOrder }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching inventory items:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}












