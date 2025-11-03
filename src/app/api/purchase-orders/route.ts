import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { purchaseOrderSchema, PurchaseOrderFormData } from '@/lib/validations/purchase-orders';

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.from('purchase_orders').select(`*,
        created_user:users!purchase_orders_created_by_fkey(id,email,full_name),
        updated_user:users!purchase_orders_updated_by_fkey(id,email,full_name)
      `).order('created_at', { ascending: false });

    if (error) {
      console.error('[PO API] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get aggregated item counts for all POs
    const { data: itemCounts, error: itemCountsError } = await supabase
      .from('purchase_order_items')
      .select('po_id, quantity_ordered, quantity_received');

    if (itemCountsError) {
      console.error('[PO API] Error fetching item counts:', itemCountsError);
      return NextResponse.json({ error: itemCountsError.message }, { status: 500 });
    }

    // Aggregate counts by po_id
    const countsMap = new Map<number, { item_count: number; total_ordered: number; total_received: number }>();
    (itemCounts || []).forEach((item: any) => {
      const existing = countsMap.get(item.po_id) || { item_count: 0, total_ordered: 0, total_received: 0 };
      countsMap.set(item.po_id, {
        item_count: existing.item_count + 1,
        total_ordered: existing.total_ordered + item.quantity_ordered,
        total_received: existing.total_received + item.quantity_received,
      });
    });

    const mapped = (data || []).map(po => {
      const counts = countsMap.get(po.po_id) || { item_count: 0, total_ordered: 0, total_received: 0 };
      return {
        ...po,
        created_by_email: po.created_user?.email || null,
        created_by_full_name: po.created_user?.full_name || null,
        updated_by_email: po.updated_user?.email || null,
        updated_by_full_name: po.updated_user?.full_name || null,
        item_count: counts.item_count,
        total_ordered: counts.total_ordered,
        total_received: counts.total_received,
      };
    });

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (e: any) {
    console.error('[PO API] Unexpected error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PurchaseOrderFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parse = purchaseOrderSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  // Generate purchase order number
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-4);
  const purchase_order_number = `PO-${year}${month}${day}-${timestamp}`;

  // Calculate total cost
  const subtotal = parse.data.purchase_order_items.reduce((sum, item) =>
    sum + (item.quantity_ordered * item.unit_cost), 0);
  const totalCost = subtotal + parse.data.tax_amount + parse.data.shipping_cost;

  // Start a transaction-like operation

  const { data: poData, error: poError } = await supabase
    .from('purchase_orders')
    .insert([{
      po_number: purchase_order_number,
      order_date: new Date().toISOString(),
      status: parse.data.status,
      expected_delivery_date: parse.data.expected_delivery_date,
      subtotal_cost: subtotal,
      tax_amount: parse.data.tax_amount,
      shipping_cost: parse.data.shipping_cost,
      total_cost: totalCost,
      notes: parse.data.order_notes,
    }])
    .select()
    .single();

  if (poError) {
    return NextResponse.json({ error: poError.message }, { status: 500 });
  }

  // Insert purchase order items
  const itemsToInsert = parse.data.purchase_order_items.map(item => ({
    po_id: poData.po_id,
    therapy_id: item.therapy_id,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    line_total: item.quantity_ordered * item.unit_cost,
    created_by: poData.created_by,
    updated_by: poData.updated_by,
  }));

  const { data: itemsData, error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert)
    .select();

  if (itemsError) {
    // Clean up the purchase order if items insertion failed
    await supabase.from('purchase_orders').delete().eq('po_id', poData.po_id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      ...poData,
      purchase_order_items: itemsData
    }
  }, { status: 201 });
}
