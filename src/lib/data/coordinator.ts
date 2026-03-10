/**
 * Server-side data fetching utilities for Coordinator
 * 
 * These functions are used in Server Components to fetch data on the server,
 * enabling SSR and faster initial page loads.
 */

import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

export interface CoordinatorMetrics {
    lateTasks: number;
    tasksDueToday: number;
    apptsDueToday: number;
    programChangesThisWeek: number;
}

export interface MemberOption {
    id: number;
    name: string;
}

export interface CoordinatorData {
    metrics: CoordinatorMetrics;
    memberOptions: MemberOption[];
}

/**
 * Fetch coordinator dashboard data server-side
 * Optimized with parallel queries for better performance
 */
export async function getCoordinatorData(): Promise<CoordinatorData> {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error('Unauthorized');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Get Active program IDs using centralized service
    const programIds = await ProgramStatusService.getValidProgramIds(supabase);

    // Week boundaries for program changes
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + (6 - today.getDay() + 1));
    const nextDayStr = nextDay.toISOString().slice(0, 10);

    // OPTIMIZED: Run all queries in parallel
    const [lateTasksRes, tasksTodayRes, apptsTodayRes, programChangesRes, membersRes] = await Promise.all([
        // Late tasks (pending only - excludes missed and completed)
        programIds.length > 0
            ? supabase
                .from('vw_coordinator_task_schedule')
                .select('*', { count: 'exact', head: true })
                .in('member_program_id', programIds)
                .lt('due_date', todayStr)
                .is('completed_flag', null)
            : Promise.resolve({ count: 0 }),

        // Tasks due today (pending only)
        programIds.length > 0
            ? supabase
                .from('vw_coordinator_task_schedule')
                .select('*', { count: 'exact', head: true })
                .in('member_program_id', programIds)
                .eq('due_date', todayStr)
                .is('completed_flag', null)
            : Promise.resolve({ count: 0 }),

        // Script items due today (pending only)
        programIds.length > 0
            ? supabase
                .from('vw_coordinator_item_schedule')
                .select('*', { count: 'exact', head: true })
                .in('member_program_id', programIds)
                .eq('scheduled_date', todayStr)
                .is('completed_flag', null)
            : Promise.resolve({ count: 0 }),

        // Program changes this week
        programIds.length > 0
            ? supabase
                .from('vw_audit_member_items')
                .select('*', { count: 'exact', head: true })
                .gte('event_at', weekStartStr)
                .lt('event_at', nextDayStr)
                .in('program_id', programIds)
            : Promise.resolve({ count: 0 }),

        // Lightweight members query for dropdown
        supabase
            .from('member_programs')
            .select('lead_id, lead_name, status_name')
            .eq('status_name', 'Active'),
    ]);

    // Dedupe and sort members
    const memberOptions: MemberOption[] = [];
    const seen = new Set<number>();
    for (const p of membersRes.data || []) {
        if (p.lead_id && !seen.has(p.lead_id)) {
            seen.add(p.lead_id);
            memberOptions.push({
                id: p.lead_id,
                name: p.lead_name || `Lead #${p.lead_id}`
            });
        }
    }
    memberOptions.sort((a, b) => a.name.localeCompare(b.name));

    return {
        metrics: {
            lateTasks: lateTasksRes.count || 0,
            tasksDueToday: tasksTodayRes.count || 0,
            apptsDueToday: apptsTodayRes.count || 0,
            programChangesThisWeek: programChangesRes.count || 0,
        },
        memberOptions,
    };
}