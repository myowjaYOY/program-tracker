import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ table: string; recordId: string }> }
) {
  try {
    const { table, recordId } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get audit logs for specific table and record from the view
    const { data: auditLogs, error } = await supabase
      .from('vw_member_audit_events')
      .select('*')
      .eq('table_name', table)
      .order('event_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }

    // The view already includes user email, so no need to fetch users separately
    const transformedLogs = auditLogs || [];

    return NextResponse.json({ data: transformedLogs });
  } catch (error) {
    console.error('Audit logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
