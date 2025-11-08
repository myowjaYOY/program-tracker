import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/inventory/count-sessions/[id]/post
 * Post count session to inventory (update quantities and create transactions)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('inventory_count_sessions')
      .select('status, count_session_id, started_at, session_number')
      .eq('count_session_id', id)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Count session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 }
      );
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Can only post an in-progress session' },
        { status: 400 }
      );
    }

    // Fetch all count details for this session
    const { data: details, error: detailsError } = await supabase
      .from('inventory_count_details')
      .select('*')
      .eq('count_session_id', id);

    if (detailsError) {
      console.error('Error fetching count details:', detailsError);
      return NextResponse.json(
        { error: detailsError.message },
        { status: 500 }
      );
    }

    // Validate all items are counted and approved (if required)
    const uncounted = details.filter(
      (d) => d.physical_quantity === null || d.status === 'pending'
    );
    if (uncounted.length > 0) {
      return NextResponse.json(
        { error: `${uncounted.length} items have not been counted yet` },
        { status: 400 }
      );
    }

    const pendingApproval = details.filter(
      (d) => d.requires_approval && d.status !== 'approved' && d.status !== 'rejected'
    );
    if (pendingApproval.length > 0) {
      return NextResponse.json(
        {
          error: `${pendingApproval.length} items with variance require admin approval`,
        },
        { status: 400 }
      );
    }

    // Filter out rejected items
    const approvedDetails = details.filter((d) => d.status !== 'rejected');

    // Get movements during count for transaction-based posting
    const completedAt = new Date().toISOString();
    let movementsDuringCount = new Map<number, number>();

    if (session.started_at) {
      // NEW LOGIC: Calculate movements that occurred during the count
      const itemIds = approvedDetails.map((d) => d.inventory_item_id);
      
      const { data: transactions } = await supabase
        .from('inventory_transactions')
        .select('inventory_item_id, quantity_change')
        .in('inventory_item_id', itemIds)
        .gte('transaction_date', session.started_at)
        .lt('transaction_date', completedAt)
        .neq('reference_type', 'count_session'); // Exclude count adjustments
      
      (transactions || []).forEach((tx: any) => {
        const current = movementsDuringCount.get(tx.inventory_item_id) || 0;
        movementsDuringCount.set(tx.inventory_item_id, current + tx.quantity_change);
      });
    }

    // Update inventory quantities and create transactions
    const updatePromises = approvedDetails.map(async (detail) => {
      const movementDuringCount = movementsDuringCount.get(detail.inventory_item_id) || 0;
      
      // Calculate true adjustment
      // If started_at exists: adjustment = physical - (expected + movements)
      // If started_at is NULL (old sessions): adjustment = variance (old logic)
      const trueAdjustment = session.started_at
        ? detail.physical_quantity - (detail.expected_quantity + movementDuringCount)
        : detail.variance;

      if (trueAdjustment === 0) {
        // No adjustment needed, but still update last_counted_at
        await supabase
          .from('inventory_items')
          .update({
            last_counted_at: completedAt,
            updated_by: user.id,
          })
          .eq('inventory_item_id', detail.inventory_item_id);

        await supabase
          .from('inventory_count_details')
          .update({ status: 'posted' })
          .eq('count_detail_id', detail.count_detail_id);

        return { success: true };
      }

      // Update inventory_items quantity by adjustment (not absolute set)
      const { data: currentItem } = await supabase
        .from('inventory_items')
        .select('quantity_on_hand')
        .eq('inventory_item_id', detail.inventory_item_id)
        .single();

      const newQuantity = (currentItem?.quantity_on_hand || 0) + trueAdjustment;

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity_on_hand: newQuantity,
          last_counted_at: completedAt,
          updated_by: user.id,
        })
        .eq('inventory_item_id', detail.inventory_item_id);

      if (updateError) {
        console.error('Error updating inventory item:', updateError);
        return { success: false, error: updateError };
      }

      // Create inventory transaction with detailed notes
      const transactionNotes = session.started_at && movementDuringCount !== 0
        ? `Physical count adjustment - ${session.session_number}. Expected: ${detail.expected_quantity}, Movements during count: ${movementDuringCount}, Physical: ${detail.physical_quantity}, Adjustment: ${trueAdjustment}`
        : detail.notes || `Physical count adjustment - ${session.session_number}`;

      const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert([
          {
            inventory_item_id: detail.inventory_item_id,
            transaction_type: 'adjustment',
            quantity_change: trueAdjustment,
            reference_type: 'count_session',
            reference_id: parseInt(id),
            transaction_date: completedAt,
            notes: transactionNotes,
            created_by: user.id,
            updated_by: user.id,
          },
        ]);

      if (transactionError) {
        console.error('Error creating inventory transaction:', transactionError);
        return { success: false, error: transactionError };
      }

      // Update count detail status
      await supabase
        .from('inventory_count_details')
        .update({ status: 'posted' })
        .eq('count_detail_id', detail.count_detail_id);

      return { success: true };
    });

    const results = await Promise.all(updatePromises);
    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      return NextResponse.json(
        {
          error: `Failed to post ${failures.length} items to inventory. Transaction rolled back.`,
        },
        { status: 500 }
      );
    }

    // Mark session as completed
    const { error: completeError } = await supabase
      .from('inventory_count_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('count_session_id', id);

    if (completeError) {
      console.error('Error completing count session:', completeError);
      return NextResponse.json(
        { error: completeError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: {
          items_posted: approvedDetails.length,
          items_rejected: details.length - approvedDetails.length,
          session_id: id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error posting count session:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}












