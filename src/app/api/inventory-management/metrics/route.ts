import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending approval count
    const { count: pendingApprovalCount, error: pendingError } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_approval')
      .eq('active_flag', true);

    if (pendingError) {
      console.error('[Inventory Metrics] Pending approval error:', pendingError);
      throw pendingError;
    }

    // Get awaiting receipt count (ordered + partially_received)
    const { count: awaitingReceiptCount, error: awaitingError } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ordered', 'partially_received'])
      .eq('active_flag', true);

    if (awaitingError) {
      console.error('[Inventory Metrics] Awaiting receipt error:', awaitingError);
      throw awaitingError;
    }

    // Get open PO value (all POs not fully received)
    const { data: openPOs, error: openPOError } = await supabase
      .from('purchase_orders')
      .select('total_cost')
      .in('status', ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received'])
      .eq('active_flag', true);

    if (openPOError) {
      console.error('[Inventory Metrics] Open PO value error:', openPOError);
      throw openPOError;
    }

    const openPOValue = openPOs?.reduce((sum, po) => sum + (po.total_cost || 0), 0) || 0;

    // Get low stock items count (items below reorder point)
    // Fetch all active items and filter in-memory since Supabase doesn't support column comparison
    const { data: allItems, error: lowStockError } = await supabase
      .from('inventory_items')
      .select('quantity_on_hand, reorder_point')
      .eq('active_flag', true);

    if (lowStockError) {
      console.error('[Inventory Metrics] Low stock error:', lowStockError);
      throw lowStockError;
    }

    // Filter items where quantity_on_hand < reorder_point
    const lowStockCount = allItems?.filter(
      item => item.quantity_on_hand < item.reorder_point
    ).length || 0;

    // Get in-progress count sessions
    const { count: inProgressCountsCount, error: countsError } = await supabase
      .from('inventory_count_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress');

    if (countsError) {
      console.error('[Inventory Metrics] In-progress counts error:', countsError);
      throw countsError;
    }

    // Get pending variance approvals across all in-progress sessions
    const { count: pendingVariancesCount, error: variancesError } = await supabase
      .from('inventory_count_details')
      .select('*', { count: 'exact', head: true })
      .eq('requires_approval', true)
      .in('status', ['counted']);

    if (variancesError) {
      console.error('[Inventory Metrics] Pending variances error:', variancesError);
      throw variancesError;
    }

    return NextResponse.json({
      data: {
        pending_approval_count: pendingApprovalCount || 0,
        awaiting_receipt_count: awaitingReceiptCount || 0,
        open_po_value: openPOValue,
        low_stock_count: lowStockCount || 0,
        in_progress_counts: inProgressCountsCount || 0,
        pending_variances: pendingVariancesCount || 0,
      },
    });
  } catch (error) {
    console.error('[Inventory Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory metrics' },
      { status: 500 }
    );
  }
}

