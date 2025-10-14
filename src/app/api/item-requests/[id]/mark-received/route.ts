import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveStatus } from '@/lib/utils/item-request-status';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Authentication check
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // First, fetch the current request to validate state
    const { data: currentRequest, error: fetchError } = await supabase
      .from('item_requests')
      .select('ordered_date, is_cancelled')
      .eq('item_request_id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching item request:', fetchError);
      return NextResponse.json(
        { error: 'Item request not found' },
        { status: 404 }
      );
    }

    // Validate: cannot mark as received if not yet ordered
    if (!currentRequest.ordered_date) {
      return NextResponse.json(
        { error: 'Cannot mark as received: item must be ordered first' },
        { status: 400 }
      );
    }

    // Validate: cannot mark as received if cancelled
    if (currentRequest.is_cancelled) {
      return NextResponse.json(
        { error: 'Cannot mark as received: item request is cancelled' },
        { status: 400 }
      );
    }

    // Update the item request - set received_date and received_by
    const { data, error } = await supabase
      .from('item_requests')
      .update({
        received_date: new Date().toISOString(),
        received_by: session.user.id,
      })
      .eq('item_request_id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error marking item request as received:', error);
      return NextResponse.json(
        { error: 'Failed to mark as received' },
        { status: 500 }
      );
    }

    // Collect user IDs for fetching user information
    const userIds: string[] = [];
    if (data.requested_by) userIds.push(data.requested_by);
    if (data.ordered_by) userIds.push(data.ordered_by);
    if (data.received_by) userIds.push(data.received_by);
    if (data.cancelled_by) userIds.push(data.cancelled_by);

    // Fetch users from public.users table
    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);
      users = usersData || [];
    }

    // Fetch lead information if lead_id is provided
    let lead: any = null;
    if (data.lead_id) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('lead_id, first_name, last_name')
        .eq('lead_id', data.lead_id)
        .single();
      lead = leadData;
    }

    // Create user lookup map
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Get user information
    const requestedByUser = userMap.get(data.requested_by);
    const orderedByUser = userMap.get(data.ordered_by);
    const receivedByUser = userMap.get(data.received_by);
    const cancelledByUser = userMap.get(data.cancelled_by);

    // Map response to include flattened fields
    const status = deriveStatus(data);
    const mappedData = {
      ...data,
      status,
      requested_by_email: requestedByUser?.email || null,
      requested_by_name: requestedByUser?.full_name || null,
      ordered_by_email: orderedByUser?.email || null,
      ordered_by_name: orderedByUser?.full_name || null,
      received_by_email: receivedByUser?.email || null,
      received_by_name: receivedByUser?.full_name || null,
      cancelled_by_email: cancelledByUser?.email || null,
      cancelled_by_name: cancelledByUser?.full_name || null,
      lead_first_name: lead?.first_name || null,
      lead_last_name: lead?.last_name || null,
      member_name: lead
        ? `${lead.first_name} ${lead.last_name}`
        : null,
    };

    return NextResponse.json({ data: mappedData }, { status: 200 });
  } catch (e: any) {
    console.error('Unexpected error in POST /api/item-requests/[id]/mark-received:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



