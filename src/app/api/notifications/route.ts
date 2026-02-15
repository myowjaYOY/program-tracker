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

  // Get user's role info with nested select
  const { data: userData, error: userDataError } = await supabase
    .from('users')
    .select('program_role_id, program_roles!users_program_role_id_fkey(role_name)')
    .eq('id', user.id)
    .single();

  if (userDataError) {
    console.error('Error fetching user data:', userDataError);
    return NextResponse.json(
      { error: 'Failed to get user data', details: userDataError.message },
      { status: 500 }
    );
  }

  const userRoleId = userData.program_role_id;
  const isAdmin = (userData.program_roles as any)?.role_name === 'Admin';

  try {
    // Fetch all role names for lookup (single query, cached reference data)
    const { data: allRoles } = await supabase
      .from('program_roles')
      .select('program_role_id, role_name');
    const roleMap = new Map(
      (allRoles || []).map((r: any) => [r.program_role_id, r.role_name])
    );

    // ============================================================
    // OPTIMIZED: Fetch notifications with lead data in single query
    // ============================================================
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select(`
        *,
        lead:leads(lead_id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
      return NextResponse.json(
        { error: notificationsError.message },
        { status: 500 }
      );
    }

    // ============================================================
    // OPTIMIZED: Batch fetch all users needed for enrichment
    // BEFORE: N queries via Promise.all (1 query per notification)
    // AFTER: 1 query to fetch all unique user IDs at once
    // ============================================================

    // Collect all unique user IDs we need to fetch
    const userIdsToFetch = new Set<string>();
    (notifications || []).forEach((notification: any) => {
      if (notification.created_by) userIdsToFetch.add(notification.created_by);
      if (notification.acknowledged_by) userIdsToFetch.add(notification.acknowledged_by);
    });

    // Single batch query for all users
    let usersMap = new Map<string, { id: string; full_name: string; email: string }>();

    if (userIdsToFetch.size > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', Array.from(userIdsToFetch));

      if (usersError) {
        console.error('Error fetching users for enrichment:', usersError);
        // Continue without user enrichment rather than failing
      } else {
        usersMap = new Map(
          (usersData || []).map((u: any) => [u.id, u])
        );
      }
    }

    // ============================================================
    // Enrich notifications using pre-fetched data (no additional queries)
    // ============================================================
    const enrichedNotifications = (notifications || []).map((notification: any) => {
      // Add target role names from roleMap
      const targetRoleNames = (notification.target_role_ids || []).map(
        (id: number) => roleMap.get(id) || `Role ${id}`
      );

      // Get creator info from usersMap
      const creator = notification.created_by
        ? usersMap.get(notification.created_by)
        : null;

      // Get acknowledger info from usersMap
      const acknowledger = notification.acknowledged_by
        ? usersMap.get(notification.acknowledged_by)
        : null;

      return {
        ...notification,
        target_role_names: targetRoleNames,
        created_by_user: creator
          ? { id: creator.id, full_name: creator.full_name, email: creator.email }
          : null,
        acknowledged_by_user: acknowledger
          ? { id: acknowledger.id, full_name: acknowledger.full_name, email: acknowledger.email }
          : null,
      };
    });

    // Filter notifications based on user role (unless admin)
    const filteredNotifications = isAdmin
      ? enrichedNotifications
      : enrichedNotifications.filter((notification: any) => {
        // Show if user's role is in target_role_ids
        if (
          notification.target_role_ids &&
          notification.target_role_ids.includes(userRoleId)
        ) {
          return true;
        }
        // Show if user created it
        if (notification.created_by === user.id) {
          return true;
        }
        return false;
      });

    return NextResponse.json({ data: filteredNotifications });
  } catch (e: any) {
    console.error('Notifications API error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}