import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { batchVarianceApprovalSchema } from '@/lib/validations/inventory-count';

/**
 * POST /api/inventory/count-details/approve
 * Approve or reject variance items (admin only)
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
    // Check if user is admin
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.is_admin) {
      return NextResponse.json(
        { error: 'Only administrators can approve variances' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parse = batchVarianceApprovalSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { count_session_id, approvals } = parse.data;

    // Verify session exists
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
        { error: 'Can only approve items in an in-progress session' },
        { status: 400 }
      );
    }

    // Process approvals
    const updatePromises = approvals.map(async (approval) => {
      const updateData: any = {
        status: approval.approved ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };

      if (approval.notes) {
        updateData.notes = approval.notes;
      }

      return supabase
        .from('inventory_count_details')
        .update(updateData)
        .eq('count_detail_id', approval.count_detail_id)
        .eq('count_session_id', count_session_id)
        .eq('requires_approval', true);
    });

    const results = await Promise.all(updatePromises);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('Error approving variances:', errors);
      return NextResponse.json(
        { error: 'Failed to approve some variances' },
        { status: 500 }
      );
    }

    const approved = approvals.filter((a) => a.approved).length;
    const rejected = approvals.filter((a) => !a.approved).length;

    return NextResponse.json(
      {
        data: {
          approved,
          rejected,
          total: approvals.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error approving variances:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}



