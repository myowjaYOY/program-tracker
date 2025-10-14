import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveStatus } from '@/lib/utils/item-request-status';
import { itemRequestSchema } from '@/lib/validations/item-requests';

export async function GET(req: NextRequest) {
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

    // Parse query parameters for filtering
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // 'Pending', 'Ordered', 'Received', 'Cancelled'
    const requestedBy = searchParams.get('requestedBy'); // user ID

    // Build base query - fetch all item requests with user and lead joins
    let query = supabase
      .from('item_requests')
      .select('*')
      .order('requested_date', { ascending: false });

    // Apply requested_by filter if provided
    if (requestedBy) {
      query = query.eq('requested_by', requestedBy);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching item requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch item requests' },
        { status: 500 }
      );
    }

    // If no data, return empty array
    if (!data || data.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // Collect unique user IDs (UUIDs) for fetching user information
    const userIds = new Set<string>();
    data.forEach((request: any) => {
      if (request.requested_by) userIds.add(request.requested_by);
      if (request.ordered_by) userIds.add(request.ordered_by);
      if (request.received_by) userIds.add(request.received_by);
      if (request.cancelled_by) userIds.add(request.cancelled_by);
    });

    // Collect unique lead IDs (integers) for fetching lead information
    const leadIds = data
      .map((r: any) => r.lead_id)
      .filter((id): id is number => id !== null && id !== undefined);

    // Fetch users from public.users table
    let users: any[] = [];
    if (userIds.size > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', Array.from(userIds));
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
      } else {
        users = usersData || [];
      }
    }

    // Fetch leads from leads table
    let leads: any[] = [];
    if (leadIds.length > 0) {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('lead_id, first_name, last_name')
        .in('lead_id', leadIds);
      
      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
      } else {
        leads = leadsData || [];
      }
    }

    // Create lookup maps
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const leadMap = new Map(leads.map((l: any) => [l.lead_id, l]));

    // Map data to include derived status and enriched user/lead information
    let mappedData = (data || []).map((request: any) => {
      const status = deriveStatus(request);
      
      // Get user information
      const requestedByUser = userMap.get(request.requested_by);
      const orderedByUser = userMap.get(request.ordered_by);
      const receivedByUser = userMap.get(request.received_by);
      const cancelledByUser = userMap.get(request.cancelled_by);
      
      // Get lead information
      const lead = leadMap.get(request.lead_id);
      
      return {
        ...request,
        // Derive status
        status,
        // User fields
        requested_by_email: requestedByUser?.email || null,
        requested_by_name: requestedByUser?.full_name || null,
        ordered_by_email: orderedByUser?.email || null,
        ordered_by_name: orderedByUser?.full_name || null,
        received_by_email: receivedByUser?.email || null,
        received_by_name: receivedByUser?.full_name || null,
        cancelled_by_email: cancelledByUser?.email || null,
        cancelled_by_name: cancelledByUser?.full_name || null,
        // Lead fields
        lead_first_name: lead?.first_name || null,
        lead_last_name: lead?.last_name || null,
        member_name: lead
          ? `${lead.first_name} ${lead.last_name}`
          : null,
      };
    });

    // Apply client-side status filter (since status is derived)
    if (statusFilter) {
      mappedData = mappedData.filter(
        (request: any) => request.status === statusFilter
      );
    }

    return NextResponse.json({ data: mappedData }, { status: 200 });
  } catch (e: any) {
    console.error('Unexpected error in GET /api/item-requests:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    // Parse and validate request body
    const body = await req.json();
    const validation = itemRequestSchema.safeParse(body);

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

    // Insert new item request with requested_date and requested_by set automatically
    const { data, error } = await supabase
      .from('item_requests')
      .insert({
        lead_id: validatedData.lead_id || null,
        item_description: validatedData.item_description,
        quantity: validatedData.quantity,
        notes: validatedData.notes || null,
        requested_date: new Date().toISOString(),
        requested_by: session.user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating item request:', error);
      return NextResponse.json(
        { error: 'Failed to create item request' },
        { status: 500 }
      );
    }

    // Fetch user information for requested_by
    const { data: requestedByUser } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', data.requested_by)
      .single();

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

    // Map response to include derived status and enriched information
    const status = deriveStatus(data);
    const mappedData = {
      ...data,
      status,
      requested_by_email: requestedByUser?.email || null,
      requested_by_name: requestedByUser?.full_name || null,
      ordered_by_email: null,
      ordered_by_name: null,
      received_by_email: null,
      received_by_name: null,
      cancelled_by_email: null,
      cancelled_by_name: null,
      lead_first_name: lead?.first_name || null,
      lead_last_name: lead?.last_name || null,
      member_name: lead
        ? `${lead.first_name} ${lead.last_name}`
        : null,
    };

    return NextResponse.json({ data: mappedData }, { status: 201 });
  } catch (e: any) {
    console.error('Unexpected error in POST /api/item-requests:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

