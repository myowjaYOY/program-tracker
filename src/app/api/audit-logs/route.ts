import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handle GET requests for audit logs or available users
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
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
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }
      
      return NextResponse.json({ data: users || [] });
    }
    
    // Default: fetch audit logs (MUI will handle pagination client-side)
    const tableName = searchParams.get('table_name');
    const operation = searchParams.get('operation');
    const changedBy = searchParams.get('changed_by');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const recordId = searchParams.get('record_id');

    // Build the query for audit logs
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('changed_at', { ascending: false });

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
    
    if (recordId) {
      query = query.eq('record_id', parseInt(recordId));
    }
    
    if (startDate) {
      query = query.gte('changed_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('changed_at', endDate);
    }

    // Execute the query (MUI DataGrid will handle pagination client-side)
    const { data: auditLogs, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    // Get unique user IDs from audit logs (optimized for performance)
    const userIds = [...new Set(auditLogs?.map(log => log.changed_by).filter(Boolean) || [])];
    
    // Fetch user information for all unique user IDs (batch fetch for performance)
    let users: any[] = [];
    if (userIds.length > 0) {
      // Batch fetch users in chunks to avoid query size limits
      const batchSize = 100;
      const userBatches = [];
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        userBatches.push(batch);
      }
      
      // Fetch all batches in parallel
      const userPromises = userBatches.map(batch =>
        supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', batch)
      );
      
      try {
        const userResults = await Promise.all(userPromises);
        users = userResults.flatMap(result => result.data || []);
      } catch (usersError) {
        console.error('Error fetching users:', usersError);
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

    return NextResponse.json({
      data: transformedLogs,
    });

  } catch (error) {
    console.error('Audit logs API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
