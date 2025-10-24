import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

// GET /api/coordinator/metrics
// Returns counts for:
// - lateTasks: task schedules with due_date < today, incomplete, Active programs only
// - tasksDueToday: task schedules due today, incomplete, Active programs only
// - apptsDueToday: item schedules scheduled today, incomplete, Active programs only
// - programChangesThisWeek: count from program_changes view (Active programs only)
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Get Active program IDs using the centralized service (default: Active only)
    const programIds = await ProgramStatusService.getValidProgramIds(supabase);
    // Note: Do NOT early-return; still compute programChangesThisWeek even if no active programs

    // Item ids for active programs
    let itemIds: number[] = [];
    if (programIds.length > 0) {
      const { data: items, error: itemErr } = await supabase
        .from('member_program_items')
        .select('member_program_item_id')
        .in('member_program_id', programIds);
      if (itemErr)
        return NextResponse.json(
          { error: 'Failed to load items' },
          { status: 500 }
        );
      itemIds = (items || []).map((r: any) => r.member_program_item_id);
    }

    // Schedule ids for those items
    let scheduleIds: number[] = [];
    if (itemIds.length > 0) {
      const { data: sched, error: schedErr } = await supabase
        .from('member_program_item_schedule')
        .select('member_program_item_schedule_id')
        .in('member_program_item_id', itemIds);
      if (schedErr)
        return NextResponse.json(
          { error: 'Failed to load item schedules' },
          { status: 500 }
        );
      scheduleIds = (sched || []).map(
        (r: any) => r.member_program_item_schedule_id
      );
    }

    // Counts
    // Late tasks
    let lateTasks = 0;
    if (scheduleIds.length > 0) {
      const { count } = await supabase
        .from('member_program_items_task_schedule')
        .select('*', { count: 'exact', head: true })
        .in('member_program_item_schedule_id', scheduleIds)
        .lt('due_date', todayStr)
        .or('completed_flag.is.null,completed_flag.eq.false');
      lateTasks = count || 0;
    }

    // Tasks due today
    let tasksDueToday = 0;
    if (scheduleIds.length > 0) {
      const { count } = await supabase
        .from('member_program_items_task_schedule')
        .select('*', { count: 'exact', head: true })
        .in('member_program_item_schedule_id', scheduleIds)
        .eq('due_date', todayStr)
        .or('completed_flag.is.null,completed_flag.eq.false');
      tasksDueToday = count || 0;
    }

    // Appointments due today
    let apptsDueToday = 0;
    if (itemIds.length > 0) {
      const { count } = await supabase
        .from('member_program_item_schedule')
        .select('*', { count: 'exact', head: true })
        .in('member_program_item_id', itemIds)
        .eq('scheduled_date', todayStr)
        .or('completed_flag.is.null,completed_flag.eq.false');
      apptsDueToday = count || 0;
    }

    // Program changes this week (use audit view)
    // Exclude Script and Todo completion changes as they are routine operational activity
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    // For inclusive end-of-day, compare with next day using < operator
    const nextDay = new Date(weekEnd);
    nextDay.setDate(weekEnd.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);
    
    // Use centralized service for Active programs only
    const programChangesValidIds = await ProgramStatusService.getValidProgramIds(supabase);

    let programChangesThisWeek = 0;
    if (programChangesValidIds.length > 0) {
      const { count } = await supabase
        .from('vw_audit_member_items')
        .select('*', { count: 'exact', head: true })
        .gte('event_at', weekStartStr)
        .lt('event_at', nextDayStr)
        .in('program_id', programChangesValidIds);
      programChangesThisWeek = count || 0;
    } else {
      programChangesThisWeek = 0;
    }

    return NextResponse.json({
      data: {
        lateTasks,
        tasksDueToday,
        apptsDueToday,
        programChangesThisWeek: programChangesThisWeek,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
