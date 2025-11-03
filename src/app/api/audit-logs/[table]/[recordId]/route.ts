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

    // Get audit logs for specific table and record
    // Use custom view for purchase_orders to get human-readable summaries
    if (table === 'purchase_orders') {
      const { data: auditLogs, error } = await supabase
        .from('vw_purchase_order_audit_history')
        .select('*')
        .eq('po_id', recordId)
        .order('event_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching PO audit logs:', error);
        return NextResponse.json(
          { error: 'Failed to fetch audit logs' },
          { status: 500 }
        );
      }

      // Transform to match expected format
      const transformedLogs = (auditLogs || []).map(log => ({
        id: log.id,
        event_at: log.event_at,
        table_name: log.table_name,
        operation: log.operation,
        changed_by: log.changed_by, // Already full name from view
        changed_by_email: log.changed_by_email,
        related_member_id: null, // Not applicable for POs
        related_member_name: null, // Not applicable for POs
        related_program_id: null, // Not applicable for POs
        related_program_name: null, // Not applicable for POs
        summary: log.summary,
        context: null,
        changes: null,
      }));

      return NextResponse.json({ data: transformedLogs });
    }

    // For other tables, use the member audit events view
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

    return NextResponse.json({ data: auditLogs || [] });
  } catch (error) {
    console.error('Audit logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
