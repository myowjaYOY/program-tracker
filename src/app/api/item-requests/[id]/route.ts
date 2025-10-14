import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveStatus } from '@/lib/utils/item-request-status';
import { itemRequestUpdateSchema } from '@/lib/validations/item-requests';

export async function PUT(
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

    // Parse and validate request body
    const body = await req.json();
    const validation = itemRequestUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Build update object (only include fields that were provided)
    const updateData: any = {};
    if (validatedData.lead_id !== undefined) {
      updateData.lead_id = validatedData.lead_id;
    }
    if (validatedData.item_description !== undefined) {
      updateData.item_description = validatedData.item_description;
    }
    if (validatedData.quantity !== undefined) {
      updateData.quantity = validatedData.quantity;
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    // Update the item request
    const { data, error } = await supabase
      .from('item_requests')
      .update(updateData)
      .eq('item_request_id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating item request:', error);
      return NextResponse.json(
        { error: 'Failed to update item request' },
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
    console.error('Unexpected error in PUT /api/item-requests/[id]:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



