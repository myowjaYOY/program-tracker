import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handle GET requests for audit logs or available users
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // If requesting available users for filtering
    if (action === 'users') {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .order('email');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return NextResponse.json(
          { error: 'Failed to fetch users' },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: users || [] });
    }

    // Default: fetch audit logs from vw_member_audit_events view
    const tableName = searchParams.get('table_name');
    const operation = searchParams.get('operation');
    const changedBy = searchParams.get('changed_by');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const relatedMemberId = searchParams.get('related_member_id');
    const relatedProgramId = searchParams.get('related_program_id');

    // Build the query for audit logs from the view
    let query = supabase
      .from('vw_member_audit_events')
      .select('*')
      .order('event_at', { ascending: false });

    // Apply filters
    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    if (operation) {
      query = query.eq('operation', operation);
    }

    if (changedBy) {
      query = query.eq('changed_by', changedBy);
    }

    if (relatedMemberId) {
      query = query.eq('related_member_id', parseInt(relatedMemberId));
    }

    if (relatedProgramId) {
      query = query.eq('related_program_id', parseInt(relatedProgramId));
    }

    if (startDate) {
      query = query.gte('event_at', startDate);
    }

    if (endDate) {
      query = query.lte('event_at', endDate);
    }

    // Execute the query (MUI DataGrid will handle pagination client-side)
    const { data: auditLogs, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }

    // The view already includes user email, so no need to fetch users separately
    // Just return the data as-is since the view provides all needed information
    const transformedLogs = auditLogs || [];

    return NextResponse.json({
      data: transformedLogs,
    });
  } catch (error) {
    console.error('Audit logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
