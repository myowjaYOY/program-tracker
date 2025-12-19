import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

// GET /api/coordinator/script?memberId=&range=today|week|month|all&start=&end=
// Returns schedule rows for Active programs only.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  const range = (searchParams.get('range') || 'all').toLowerCase();
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const showCompleted = searchParams.get('showCompleted') === 'true';
  const showMissed = searchParams.get('showMissed') === 'true';

  try {
    // Get Active program IDs using centralized service (default: Active only)
    const programIds = await ProgramStatusService.getValidProgramIds(
      supabase,
      memberId ? { memberId: Number(memberId) } : undefined
    );
    if (programIds.length === 0) return NextResponse.json({ data: [] });

    // Use the optimized view that pre-joins all tables
    // This allows us to filter by program_id (44 IDs) instead of item_id (1378 IDs)
    let schedQuery = supabase
      .from('vw_coordinator_item_schedule')
      .select('*')
      .in('member_program_id', programIds)
      .order('scheduled_date', { ascending: true });

    // Filter by completed_flag
    // Default behavior: hide missed and completed, show only pending
    if (showCompleted && showMissed) {
      // Show everything (pending + missed + completed)
      // No filter needed - show all
    } else if (showCompleted && !showMissed) {
      // Show completed + pending (exclude missed)
      schedQuery = schedQuery.or('completed_flag.is.null,completed_flag.eq.true');
    } else if (!showCompleted && showMissed) {
      // Show pending + missed (exclude completed)
      schedQuery = schedQuery.or('completed_flag.is.null,completed_flag.eq.false');
    } else {
      // Default: Show only pending items (exclude missed and completed)
      schedQuery = schedQuery.is('completed_flag', null);
    }

    // Date filtering for script view: if range is not 'all'
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startStr =
      start ||
      (range === 'today'
        ? today.toISOString().slice(0, 10)
        : range === 'week'
          ? new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() - today.getDay()
            )
              .toISOString()
              .slice(0, 10)
          : range === 'month'
            ? new Date(today.getFullYear(), today.getMonth(), 1)
                .toISOString()
                .slice(0, 10)
            : undefined);
    const endStr =
      end ||
      (range === 'today'
        ? today.toISOString().slice(0, 10)
        : range === 'week'
          ? new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() - today.getDay() + 6
            )
              .toISOString()
              .slice(0, 10)
          : range === 'month'
            ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
                .toISOString()
                .slice(0, 10)
            : undefined);
    if (startStr) schedQuery = schedQuery.gte('scheduled_date', startStr);
    if (endStr) schedQuery = schedQuery.lte('scheduled_date', endStr);

    const { data: scheduleRows, error: schedErr } = await schedQuery;
    if (schedErr)
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      );

    // Enrich with audit emails and note counts
    // View already includes: therapy_name, therapy_type_name, program_status_name, 
    // member_name, role_name, role_display_color, member_program_id, lead_id
    const userIds = Array.from(
      new Set([
        ...(scheduleRows || []).map((r: any) => r.created_by).filter(Boolean),
        ...(scheduleRows || []).map((r: any) => r.updated_by).filter(Boolean),
      ] as any)
    );
    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds as any);
      users = usersData || [];
    }
    const userMap = new Map(users.map(u => [u.id, u]));

    // Get note counts for each lead
    const leadIds = Array.from(new Set((scheduleRows || []).map((r: any) => r.lead_id).filter(Boolean)));
    let noteCounts: Record<number, number> = {};
    if (leadIds.length > 0) {
      const { data: notesData, error: notesError } = await supabase
        .from('lead_notes')
        .select('lead_id')
        .in('lead_id', leadIds);
      
      if (notesError) {
        console.error('Error fetching note counts:', notesError);
      }
      
      // Count notes per lead
      (notesData || []).forEach((note: any) => {
        noteCounts[note.lead_id] = (noteCounts[note.lead_id] || 0) + 1;
      });
    }

    const enriched = (scheduleRows || []).map((r: any) => {
      return {
        ...r,
        note_count: r.lead_id ? (noteCounts[r.lead_id] || 0) : 0,
        created_by_email: r.created_by
          ? userMap.get(r.created_by)?.email || null
          : null,
        created_by_full_name: r.created_by
          ? userMap.get(r.created_by)?.full_name || null
          : null,
        updated_by_email: r.updated_by
          ? userMap.get(r.updated_by)?.email || null
          : null,
        updated_by_full_name: r.updated_by
          ? userMap.get(r.updated_by)?.full_name || null
          : null,
      };
    });

    const response = NextResponse.json({ data: enriched });
    // Bust cache to ensure fresh data after role fixes
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
