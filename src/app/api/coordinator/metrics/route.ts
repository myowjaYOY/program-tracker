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

    // Use optimized views - filter by program_id (44 IDs) instead of schedule_id (2000+ IDs)
    // Late tasks (pending only - excludes missed and completed)
    let lateTasks = 0;
    if (programIds.length > 0) {
      const { count } = await supabase
        .from('vw_coordinator_task_schedule')
        .select('*', { count: 'exact', head: true })
        .in('member_program_id', programIds)
        .lt('due_date', todayStr)
        .is('completed_flag', null);
      lateTasks = count || 0;
    }

    // Tasks due today (pending only - excludes missed and completed)
    let tasksDueToday = 0;
    if (programIds.length > 0) {
      const { count } = await supabase
        .from('vw_coordinator_task_schedule')
        .select('*', { count: 'exact', head: true })
        .in('member_program_id', programIds)
        .eq('due_date', todayStr)
        .is('completed_flag', null);
      tasksDueToday = count || 0;
    }

    // Script items due today (pending only - excludes missed and completed)
    let apptsDueToday = 0;
    if (programIds.length > 0) {
      const { count } = await supabase
        .from('vw_coordinator_item_schedule')
        .select('*', { count: 'exact', head: true })
        .in('member_program_id', programIds)
        .eq('scheduled_date', todayStr)
        .is('completed_flag', null);
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
