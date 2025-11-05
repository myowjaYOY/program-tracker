import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { countDetailBatchUpdateSchema } from '@/lib/validations/inventory-count';

/**
 * POST /api/inventory/count-details/batch-update
 * Batch update physical quantities for count details
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parse = countDetailBatchUpdateSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { count_session_id, updates } = parse.data;

    // Verify session exists and is in_progress
    const { data: session, error: sessionError } = await supabase
      .from('inventory_count_sessions')
      .select('status')
      .eq('count_session_id', count_session_id)
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
        { error: 'Can only update items in an in-progress session' },
        { status: 400 }
      );
    }

    // Batch update count details
    const updatePromises = updates.map(async (update) => {
      return supabase
        .from('inventory_count_details')
        .update({
          physical_quantity: update.physical_quantity,
          notes: update.notes || null,
          status: 'counted',
        })
        .eq('count_detail_id', update.count_detail_id)
        .eq('count_session_id', count_session_id);
    });

    const results = await Promise.all(updatePromises);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('Error updating count details:', errors);
      return NextResponse.json(
        { error: 'Failed to update some count details' },
        { status: 500 }
      );
    }

    // Fetch updated details to determine which need approval
    const { data: updatedDetails, error: fetchError } = await supabase
      .from('inventory_count_details')
      .select('count_detail_id, variance, variance_pct')
      .eq('count_session_id', count_session_id)
      .eq('status', 'counted');

    if (fetchError) {
      console.error('Error fetching updated details:', fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    // Mark items with variance > 10% as requiring approval
    const VARIANCE_THRESHOLD = 10;
    const approvalUpdates = updatedDetails
      .filter((detail) => Math.abs(detail.variance_pct || 0) > VARIANCE_THRESHOLD)
      .map((detail) => ({
        count_detail_id: detail.count_detail_id,
        requires_approval: true,
      }));

    if (approvalUpdates.length > 0) {
      const approvalPromises = approvalUpdates.map(async (approval) => {
        return supabase
          .from('inventory_count_details')
          .update({ requires_approval: true })
          .eq('count_detail_id', approval.count_detail_id);
      });

      await Promise.all(approvalPromises);
    }

    return NextResponse.json(
      {
        data: {
          updated: updates.length,
          requires_approval: approvalUpdates.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error batch updating count details:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}



