import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; recordId: string }> }
) {
  try {
    const { table, recordId } = await params;
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get audit logs for specific table and record
    const { data: auditLogs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', table)
      .eq('record_id', parseInt(recordId))
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    // Get unique user IDs from audit logs
    const userIds = [...new Set(auditLogs?.map(log => log.changed_by).filter(Boolean) || [])];
    
    // Fetch user information for all unique user IDs
    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
      } else {
        users = usersData || [];
      }
    }

    // Create a map of user ID to user data
    const userMap = new Map(users.map(user => [user.id, user]));

    // Transform the data to include user information
    const transformedLogs = auditLogs?.map(log => {
      const user = userMap.get(log.changed_by);
      return {
        ...log,
        changed_by_email: user?.email || null,
        changed_by_name: user?.full_name || null,
      };
    }) || [];

    return NextResponse.json({ data: transformedLogs });

  } catch (error) {
    console.error('Audit logs API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
