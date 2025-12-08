import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's role info - specify the FK relationship explicitly
  const { data: userData, error: userDataError } = await supabase
    .from('users')
    .select('program_role_id, program_roles!users_program_role_id_fkey(role_name)')
    .eq('id', user.id)
    .single();

  if (userDataError) {
    console.error('Error fetching user data:', userDataError);
    return NextResponse.json({ error: 'Failed to get user data', details: userDataError.message }, { status: 500 });
  }

  const userRoleId = userData.program_role_id;
  const isAdmin = (userData.program_roles as any)?.role_name === 'Admin';

  // Fetch all notifications with related data
  try {
    // Fetch all role names for lookup
    const { data: allRoles } = await supabase
      .from('program_roles')
      .select('program_role_id, role_name');
    const roleMap = new Map((allRoles || []).map((r: any) => [r.program_role_id, r.role_name]));

    // First, try a simple query to verify table exists
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select(`
        *,
        lead:leads(lead_id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
      return NextResponse.json({ error: notificationsError.message }, { status: 500 });
    }

    // Fetch additional user data for creator/acknowledger
    const enrichedNotifications = await Promise.all(
      (notifications || []).map(async (notification: any) => {
        // Add target role names
        const targetRoleNames = (notification.target_role_ids || []).map(
          (id: number) => roleMap.get(id) || `Role ${id}`
        );
        notification.target_role_names = targetRoleNames;
        // Get creator info
        if (notification.created_by) {
          const { data: creator } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', notification.created_by)
            .single();
          notification.creator = creator;
        }
        // Get acknowledger info
        if (notification.acknowledged_by) {
          const { data: acknowledger } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', notification.acknowledged_by)
            .single();
          notification.acknowledger = acknowledger;
        }
        // Get source note
        if (notification.source_note_id) {
          const { data: sourceNote } = await supabase
            .from('lead_notes')
            .select('note_id, note, note_type')
            .eq('note_id', notification.source_note_id)
            .single();
          notification.source_note = sourceNote;
        }
        // Get response note
        if (notification.response_note_id) {
          const { data: responseNote } = await supabase
            .from('lead_notes')
            .select('note_id, note, note_type')
            .eq('note_id', notification.response_note_id)
            .single();
          notification.response_note = responseNote;
        }
        return notification;
      })
    );

    // Filter notifications based on business rules:
    // 1. User's role is in target_role_ids
    // 2. OR user created the notification
    // 3. OR user is Admin (sees all)
    const filteredNotifications = enrichedNotifications.filter((notification: any) => {
      // Admin sees all
      if (isAdmin) return true;

      // User created this notification
      if (notification.created_by === user.id) return true;

      // User's role is in target_role_ids
      if (notification.target_role_ids?.includes(userRoleId)) return true;

      return false;
    });

    return NextResponse.json({ data: filteredNotifications });
  } catch (error) {
    console.error('Unexpected error in notifications API:', error);
    return NextResponse.json({ error: 'Unexpected error fetching notifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { lead_id, title, message, priority = 'normal', target_role_ids, source_note_id } = body;

  // Validate required fields
  if (!lead_id) {
    return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }
  if (!target_role_ids || !Array.isArray(target_role_ids) || target_role_ids.length === 0) {
    return NextResponse.json({ error: 'target_role_ids must be a non-empty array' }, { status: 400 });
  }

  // Validate priority
  const validPriorities = ['normal', 'high', 'urgent'];
  if (!validPriorities.includes(priority)) {
    return NextResponse.json({ error: 'priority must be normal, high, or urgent' }, { status: 400 });
  }

  // Create notification
  try {
    const { data: notification, error: createError } = await supabase
      .from('notifications')
      .insert({
        lead_id,
        title,
        message,
        priority,
        target_role_ids,
        source_note_id: source_note_id || null,
        status: 'active',
        created_by: user.id,
      })
      .select(`
        *,
        lead:leads(lead_id, first_name, last_name)
      `)
      .single();

    if (createError) {
      console.error('Error creating notification:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Enrich with creator info
    const { data: creator } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ data: { ...notification, creator } }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating notification:', error);
    return NextResponse.json({ error: 'Unexpected error creating notification' }, { status: 500 });
  }
}
