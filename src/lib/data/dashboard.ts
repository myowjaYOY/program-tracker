import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';
import { DashboardMetrics } from '@/lib/hooks/use-dashboard-metrics';
import { DashboardMember } from '@/lib/hooks/use-dashboard-member-programs';
import { MemberPrograms } from '@/types/database.types';

export interface DashboardData {
    metrics: DashboardMetrics | null;
    coordinatorMetrics: {
        lateTasks: number;
        tasksDueToday: number;
        apptsDueToday: number;
        programChangesThisWeek: number;
    } | null;
    members: DashboardMember[];
}

export async function getDashboardData(): Promise<DashboardData> {
    const supabase = await createClient();

    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const todayStr = today.toISOString().slice(0, 10);

        // 1. Dashboard Metrics
        const activeProgramIds = await ProgramStatusService.getValidProgramIds(supabase);

        // We execute these in parallel for better performance
        const [
            activeMembersData,
            newProgramsCount,
            statusesData,
        ] = await Promise.all([
            activeProgramIds.length > 0
                ? supabase.from('member_programs').select('lead_id').in('member_program_id', activeProgramIds)
                : Promise.resolve({ data: [], error: null }),
            activeProgramIds.length > 0
                ? supabase.from('member_programs').select('*', { count: 'exact', head: true })
                    .in('member_program_id', activeProgramIds)
                    .gte('start_date', new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10))
                    .lte('start_date', new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10))
                : Promise.resolve({ count: 0, error: null }),
            supabase.from('program_status').select('program_status_id, status_name')
        ]);

        const activeMembers = new Set((activeMembersData.data || []).map(p => p.lead_id).filter(Boolean)).size;
        const newProgramsThisMonth = newProgramsCount.count || 0;

        const completedStatusId = statusesData.data?.find(s => s.status_name?.toLowerCase() === 'completed')?.program_status_id;
        const pausedStatusId = statusesData.data?.find(s => s.status_name?.toLowerCase() === 'paused')?.program_status_id;

        const [completedProgramsCount, pausedProgramsCount] = await Promise.all([
            completedStatusId
                ? supabase.from('member_programs').select('*', { count: 'exact', head: true }).eq('program_status_id', completedStatusId)
                : Promise.resolve({ count: 0 }),
            pausedStatusId
                ? supabase.from('member_programs').select('*', { count: 'exact', head: true }).eq('program_status_id', pausedStatusId)
                : Promise.resolve({ count: 0 })
        ]);

        const metrics: DashboardMetrics = {
            activeMembers,
            newProgramsThisMonth,
            completedPrograms: completedProgramsCount.count || 0,
            pausedPrograms: pausedProgramsCount.count || 0,
            membersOnMemberships: 0, // Placeholder
        };

        // 2. Coordinator Metrics
        let lateTasks = 0;
        let tasksDueToday = 0;
        let apptsDueToday = 0;
        let programChangesThisWeek = 0;

        if (activeProgramIds.length > 0) {
            const [lateRes, todayRes, apptsRes] = await Promise.all([
                supabase.from('vw_coordinator_task_schedule').select('*', { count: 'exact', head: true })
                    .in('member_program_id', activeProgramIds).lt('due_date', todayStr).is('completed_flag', null),
                supabase.from('vw_coordinator_task_schedule').select('*', { count: 'exact', head: true })
                    .in('member_program_id', activeProgramIds).eq('due_date', todayStr).is('completed_flag', null),
                supabase.from('vw_coordinator_item_schedule').select('*', { count: 'exact', head: true })
                    .in('member_program_id', activeProgramIds).eq('scheduled_date', todayStr).is('completed_flag', null)
            ]);
            lateTasks = lateRes.count || 0;
            tasksDueToday = todayRes.count || 0;
            apptsDueToday = apptsRes.count || 0;
        }

        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const nextDay = new Date(today);
        nextDay.setDate(today.getDate() + (6 - today.getDay() + 1));
        const nextDayStr = nextDay.toISOString().slice(0, 10);

        if (activeProgramIds.length > 0) {
            const { count } = await supabase.from('vw_audit_member_items').select('*', { count: 'exact', head: true })
                .gte('event_at', weekStartStr).lt('event_at', nextDayStr).in('program_id', activeProgramIds);
            programChangesThisWeek = count || 0;
        }

        const coordinatorMetrics = {
            lateTasks,
            tasksDueToday,
            apptsDueToday,
            programChangesThisWeek,
        };

        // 3. Members
        const { data: allProgramsData } = await supabase.from('member_programs').select(`
      *,
      lead:leads!fk_member_programs_lead(lead_id, first_name, last_name, email),
      program_status:program_status!fk_member_programs_program_status(program_status_id, status_name),
      program_template:program_template!fk_member_programs_source_template(program_template_id, program_template_name)
    `).eq('active_flag', true);

        const filteredPrograms = (allProgramsData || []).filter(p => p.program_status?.status_name?.toLowerCase() === 'active');

        const memberMap = new Map<number, DashboardMember>();
        filteredPrograms.forEach(p => {
            if (!p.lead_id || !p.lead) return;
            const leadId = p.lead_id;
            if (!memberMap.has(leadId)) {
                memberMap.set(leadId, {
                    lead_id: leadId,
                    lead_name: `${p.lead.first_name} ${p.lead.last_name}`.trim(),
                    lead_email: p.lead.email || null,
                    programs: [],
                });
            }
            memberMap.get(leadId)!.programs.push({
                ...p,
                lead_name: `${p.lead.first_name} ${p.lead.last_name}`.trim(),
                lead_email: p.lead.email || null,
                status_name: p.program_status?.status_name || null,
                template_name: p.program_template?.program_template_name || null,
            } as any);
        });

        const members = Array.from(memberMap.values()).sort((a, b) => a.lead_name.localeCompare(b.lead_name));

        return {
            metrics,
            coordinatorMetrics,
            members
        };
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return {
            metrics: null,
            coordinatorMetrics: null,
            members: []
        };
    }
}
