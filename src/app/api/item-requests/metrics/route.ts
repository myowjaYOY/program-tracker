import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveStatus } from '@/lib/utils/item-request-status';

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

    // Get current month date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      .toISOString();

    // Fetch all item requests (we'll derive status and calculate metrics)
    const { data: allRequests, error } = await supabase
      .from('item_requests')
      .select('*')
      .order('requested_date', { ascending: false });

    if (error) {
      console.error('Error fetching item requests for metrics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      );
    }

    // Derive status for each request
    const requestsWithStatus = (allRequests || []).map((request: any) => ({
      ...request,
      status: deriveStatus(request),
    }));

    // Card 1: Pending Requests (no ordered_date, not cancelled)
    const pendingCount = requestsWithStatus.filter(
      (r: any) => r.status === 'Pending'
    ).length;

    // Card 2: Ordered This Month (ordered_date within current month, not yet received)
    const orderedThisMonth = requestsWithStatus.filter(
      (r: any) =>
        r.status === 'Ordered' &&
        r.ordered_date &&
        r.ordered_date >= monthStart &&
        r.ordered_date <= monthEnd
    ).length;

    // Card 3: Received This Month (received_date within current month)
    const receivedThisMonth = requestsWithStatus.filter(
      (r: any) =>
        r.received_date &&
        r.received_date >= monthStart &&
        r.received_date <= monthEnd
    ).length;

    // Card 4: Cancelled (is_cancelled = true)
    const cancelledCount = requestsWithStatus.filter(
      (r: any) => r.status === 'Cancelled'
    ).length;

    const metrics = {
      pendingCount,
      orderedThisMonth,
      receivedThisMonth,
      cancelledCount,
      // Optional: total count for reference
      totalRequests: requestsWithStatus.length,
    };

    return NextResponse.json({ data: metrics }, { status: 200 });
  } catch (e: any) {
    console.error('Unexpected error in GET /api/item-requests/metrics:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



