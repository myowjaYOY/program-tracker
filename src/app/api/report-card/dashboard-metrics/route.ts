import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

export const dynamic = 'force-dynamic';

// Types for dashboard metrics
export interface MemberListItem {
  name: string;
  value: string | number;
}

export interface DashboardMetrics {
  // Card 1: Member Progress Coverage
  totalActiveMembers: number;
  membersWithProgress: number;
  progressPercentage: number;

  // Card 2: Upcoming Program Endings
  programsEndingSoon: number;
  endingSoonList: MemberListItem[]; // name + projected_end_date

  // Card 3: Worst MSQ Scores
  worstMsqCount: number;
  worstMsqList: MemberListItem[]; // name + msq_score
  worstMsqAverage: number; // average of top 6 worst MSQ scores

  // Card 4: Most Behind on Schedule
  behindScheduleCount: number;
  behindScheduleList: MemberListItem[]; // name + late_count

  // Card 5: Worst Compliance Scores
  worstComplianceCount: number;
  worstComplianceList: MemberListItem[]; // name + compliance_percentage
  worstComplianceAverage: number; // average of top 6 worst compliance scores

  // Card 6: Best Progress Scores
  bestProgressCount: number;
  bestProgressList: MemberListItem[]; // name + progress_percentage
  bestProgressAverage: number; // average of top 6 best progress scores
}

/**
 * GET /api/report-card/dashboard-metrics
 * 
 * Returns metrics for all 6 dashboard cards:
 * 1. Member Progress Coverage
 * 2. Programs Ending in 14 Days
 * 3. Worst MSQ Scores (Top 6)
 * 4. Most Behind on Schedule (Top 6)
 * 5. Worst Compliance (Top 6)
 * 6. Best Progress (Top 6)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Dashboard Metrics] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active program IDs using centralized service
    const activeProgramIds = await ProgramStatusService.getValidProgramIds(supabase);

    if (activeProgramIds.length === 0) {
      // No active programs - return empty metrics
      return NextResponse.json({
        data: {
          totalActiveMembers: 0,
          membersWithProgress: 0,
          progressPercentage: 0,
          programsEndingSoon: 0,
          endingSoonList: [],
          worstMsqCount: 0,
          worstMsqList: [],
          worstMsqAverage: 0,
          behindScheduleCount: 0,
          behindScheduleList: [],
          worstComplianceCount: 0,
          worstComplianceList: [],
          worstComplianceAverage: 0,
          bestProgressCount: 0,
          bestProgressList: [],
          bestProgressAverage: 0,
        } as DashboardMetrics,
      });
    }

    // Get unique lead_ids from active programs
    const { data: activePrograms, error: programsError } = await supabase
      .from('member_programs')
      .select('member_program_id, lead_id, start_date, duration')
      .in('member_program_id', activeProgramIds);

    if (programsError || !activePrograms) {
      console.error('Error fetching active programs:', programsError);
      throw new Error('Failed to fetch active programs');
    }

    // Calculate end date for each program (start_date + duration days)
    const programsWithEndDate = activePrograms.map(program => {
      let calculatedEndDate: Date | null = null;
      if (program.start_date && program.duration) {
        const startDate = new Date(program.start_date);
        calculatedEndDate = new Date(startDate);
        calculatedEndDate.setDate(calculatedEndDate.getDate() + program.duration);
      }
      return {
        ...program,
        end_date: calculatedEndDate,
      };
    });

    // Get unique members (lead_ids)
    const uniqueLeadIds = [...new Set(programsWithEndDate.map(p => p.lead_id).filter(Boolean))];
    const totalActiveMembers = uniqueLeadIds.length;

    // Fetch lead names for all active members
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('lead_id, first_name, last_name')
      .in('lead_id', uniqueLeadIds);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    }

    // Create a map of lead_id => lead info for quick lookup
    const leadsMap = new Map(
      (leadsData || []).map(lead => [lead.lead_id, lead])
    );

    // ====================================
    // CARD 1: Member Progress Coverage
    // ====================================
    const { data: progressData } = await supabase
      .from('member_progress_summary')
      .select('lead_id, status_score')
      .in('lead_id', uniqueLeadIds)
      .not('status_score', 'is', null);

    const membersWithProgress = progressData?.length || 0;
    const progressPercentage = totalActiveMembers > 0 
      ? Math.round((membersWithProgress / totalActiveMembers) * 100) 
      : 0;

    // ====================================
    // CARD 2: Programs Ending in 14 Days
    // ====================================
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
    fourteenDaysFromNow.setHours(23, 59, 59, 999); // End of day
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    const programsEndingSoon = programsWithEndDate.filter(p => {
      if (!p.end_date) return false;
      return p.end_date >= today && p.end_date <= fourteenDaysFromNow;
    });

    const endingSoonList: MemberListItem[] = programsEndingSoon
      .slice(0, 6) // Top 6
      .map(p => {
        const lead = leadsMap.get(p.lead_id);
        return {
          name: lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Unknown',
          value: p.end_date 
            ? p.end_date.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A',
        };
      });

    // ====================================
    // CARD 3: Worst MSQ Scores (Top 6)
    // ====================================
    // Get all MSQ data for active members
    const { data: msqData } = await supabase
      .from('survey_user_mappings')
      .select(`
        external_user_id,
        lead_id,
        first_name,
        last_name
      `)
      .in('lead_id', uniqueLeadIds);

    let worstMsqList: MemberListItem[] = [];
    let worstMsqCount = 0;

    if (msqData && msqData.length > 0) {
      const externalUserIds = msqData.map(m => m.external_user_id);

      // Get latest MSQ sessions for each user
      const MSQ_FORM_ID = 3;
      const { data: msqSessions } = await supabase
        .from('survey_response_sessions')
        .select('session_id, external_user_id, completed_on')
        .eq('form_id', MSQ_FORM_ID)
        .in('external_user_id', externalUserIds)
        .order('completed_on', { ascending: false });

      if (msqSessions && msqSessions.length > 0) {
        // Get latest session per user
        const latestSessionsByUser = new Map<number, number>();
        msqSessions.forEach(session => {
          if (!latestSessionsByUser.has(session.external_user_id)) {
            latestSessionsByUser.set(session.external_user_id, session.session_id);
          }
        });

        const latestSessionIds = Array.from(latestSessionsByUser.values());

        // Get domain scores for latest sessions
        const { data: domainScores } = await supabase
          .from('survey_domain_scores')
          .select('session_id, domain_total_score')
          .in('session_id', latestSessionIds);

        if (domainScores) {
          // Calculate total MSQ score per user
          const userScores = new Map<number, number>();
          latestSessionsByUser.forEach((sessionId, userId) => {
            const userDomains = domainScores.filter(ds => ds.session_id === sessionId);
            const totalScore = userDomains.reduce((sum, ds) => 
              sum + (parseFloat(String(ds.domain_total_score)) || 0), 0
            );
            userScores.set(userId, totalScore);
          });

          // Create list with names and scores
          const msqScoresList = Array.from(userScores.entries())
            .map(([userId, score]) => {
              const user = msqData.find(m => m.external_user_id === userId);
              return {
                name: user ? `${user.first_name} ${user.last_name}`.trim() : 'Unknown',
                score: Math.round(score),
              };
            })
            .filter(item => item.score > 0) // Only include members with scores
            .sort((a, b) => b.score - a.score); // Highest (worst) first

          worstMsqCount = msqScoresList.length;
          const top6MsqScores = msqScoresList.slice(0, 6);
          worstMsqList = top6MsqScores.map(item => ({
            name: item.name,
            value: item.score,
          }));
        }
      }
    }

    // Calculate average MSQ score for top 6
    const worstMsqAverage = worstMsqList.length > 0
      ? Math.round(worstMsqList.reduce((sum, item) => sum + Number(item.value), 0) / worstMsqList.length)
      : 0;

    // ====================================
    // CARD 4: Most Behind on Schedule (Top 6)
    // ====================================
    const todayStr = new Date().toISOString().split('T')[0];

    // Get all program items for active programs
    const { data: allProgramItems } = await supabase
      .from('member_program_items')
      .select('member_program_item_id, member_program_id')
      .in('member_program_id', activeProgramIds);

    const programItemIds = (allProgramItems || []).map(item => item.member_program_item_id);

    // Get late/missed items from member_program_item_schedule (singular, not plural)
    const { data: itemSchedules, error: itemSchedulesError } = await supabase
      .from('member_program_item_schedule')
      .select('member_program_item_schedule_id, member_program_item_id, scheduled_date, completed_flag')
      .in('member_program_item_id', programItemIds);

    if (itemSchedulesError) {
      console.error('[Behind Schedule] Error fetching item schedules:', itemSchedulesError);
    }

    // Get task schedules (member_program_item_tasks with their schedules)
    const { data: itemTasks, error: itemTasksError } = await supabase
      .from('member_program_item_tasks')
      .select('member_program_item_task_id, member_program_item_id, completed_flag')
      .in('member_program_item_id', programItemIds);

    if (itemTasksError) {
      console.error('[Behind Schedule] Error fetching item tasks:', itemTasksError);
    }

    const itemTaskIds = (itemTasks || []).map(task => task.member_program_item_task_id);

    // Get task schedules
    const { data: taskSchedules, error: taskSchedulesError } = await supabase
      .from('member_program_items_task_schedule')
      .select('member_program_item_task_schedule_id, member_program_item_task_id, due_date, completed_flag')
      .in('member_program_item_task_id', itemTaskIds);

    if (taskSchedulesError) {
      console.error('[Behind Schedule] Error fetching task schedules:', taskSchedulesError);
    }

    // Create mapping chains
    const itemToProgramMap = new Map(
      (allProgramItems || []).map(item => [item.member_program_item_id, item.member_program_id])
    );

    const taskToItemMap = new Map(
      (itemTasks || []).map(task => [task.member_program_item_task_id, task.member_program_item_id])
    );

    // Create program_id => lead_id map
    const programToLeadMap = new Map(
      programsWithEndDate.map(p => [p.member_program_id, p.lead_id])
    );

    // Count late items per member
    const lateCountByMember = new Map<number, { name: string; count: number }>();
    let lateItemsFound = 0;
    let missedMappings = {
      noProgram: 0,
      noLead: 0,
      noLeadInfo: 0,
    };

    // Process item schedules
    if (itemSchedules) {
      itemSchedules.forEach((item: any) => {
        const isLateOrMissed = 
          item.completed_flag === false || 
          (item.completed_flag === null && item.scheduled_date && item.scheduled_date < todayStr!);

        if (isLateOrMissed) {
          lateItemsFound++;
          const programId = itemToProgramMap.get(item.member_program_item_id);
          if (!programId) {
            missedMappings.noProgram++;
            return;
          }

          const leadId = programToLeadMap.get(programId);
          if (!leadId) {
            missedMappings.noLead++;
            return;
          }

          const lead = leadsMap.get(leadId);
          if (!lead) {
            missedMappings.noLeadInfo++;
            return;
          }

          const existing = lateCountByMember.get(leadId);
          const name = `${lead.first_name} ${lead.last_name}`.trim();
          
          if (existing) {
            existing.count += 1;
          } else {
            lateCountByMember.set(leadId, { name, count: 1 });
          }
        }
      });
    }


    // Process task schedules
    let lateTasksFound = 0;
    let taskMissedMappings = {
      noItem: 0,
      noProgram: 0,
      noLead: 0,
      noLeadInfo: 0,
    };

    if (taskSchedules) {
      taskSchedules.forEach((task: any) => {
        const isLateOrMissed = 
          task.completed_flag === false || 
          (task.completed_flag === null && task.due_date && task.due_date < todayStr!);

        if (isLateOrMissed) {
          lateTasksFound++;
          const itemId = taskToItemMap.get(task.member_program_item_task_id);
          if (!itemId) {
            taskMissedMappings.noItem++;
            return;
          }

          const programId = itemToProgramMap.get(itemId);
          if (!programId) {
            taskMissedMappings.noProgram++;
            return;
          }

          const leadId = programToLeadMap.get(programId);
          if (!leadId) {
            taskMissedMappings.noLead++;
            return;
          }

          const lead = leadsMap.get(leadId);
          if (!lead) {
            taskMissedMappings.noLeadInfo++;
            return;
          }

          const existing = lateCountByMember.get(leadId);
          const name = `${lead.first_name} ${lead.last_name}`.trim();
          
          if (existing) {
            existing.count += 1;
          } else {
            lateCountByMember.set(leadId, { name, count: 1 });
          }
        }
      });
    }

    const behindScheduleList: MemberListItem[] = Array.from(lateCountByMember.values())
      .sort((a, b) => b.count - a.count) // Highest count first
      .slice(0, 6)
      .map(item => ({
        name: item.name,
        value: `${item.count} missed or late items`,
      }));

    const behindScheduleCount = lateCountByMember.size;

    // ====================================
    // CARD 5: Worst Compliance (Top 6)
    // ====================================
    const { data: worstCompliance } = await supabase
      .from('member_progress_summary')
      .select('lead_id, status_score')
      .in('lead_id', uniqueLeadIds)
      .not('status_score', 'is', null)
      .order('status_score', { ascending: true }) // Lowest scores first
      .limit(6);

    const worstComplianceList: MemberListItem[] = (worstCompliance || []).map((item: any) => {
      const lead = leadsMap.get(item.lead_id);
      return {
        name: lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Unknown',
        value: `${Math.round(item.status_score)}%`,
      };
    });

    const worstComplianceCount = worstComplianceList.length;

    // Calculate average compliance score for top 6
    const worstComplianceAverage = (worstCompliance && worstCompliance.length > 0)
      ? Math.round(worstCompliance.reduce((sum: number, item: any) => sum + Number(item.status_score), 0) / worstCompliance.length)
      : 0;

    // ====================================
    // CARD 6: Best Progress (Top 6)
    // ====================================
    const { data: bestProgress } = await supabase
      .from('member_progress_summary')
      .select('lead_id, status_score')
      .in('lead_id', uniqueLeadIds)
      .not('status_score', 'is', null)
      .order('status_score', { ascending: false }) // Highest scores first
      .limit(6);

    const bestProgressList: MemberListItem[] = (bestProgress || []).map((item: any) => {
      const lead = leadsMap.get(item.lead_id);
      return {
        name: lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Unknown',
        value: `${Math.round(item.status_score)}%`,
      };
    });

    const bestProgressCount = bestProgressList.length;

    // Calculate average progress score for top 6
    const bestProgressAverage = (bestProgress && bestProgress.length > 0)
      ? Math.round(bestProgress.reduce((sum: number, item: any) => sum + Number(item.status_score), 0) / bestProgress.length)
      : 0;

    // ====================================
    // RETURN ALL METRICS
    // ====================================
    const metrics: DashboardMetrics = {
      totalActiveMembers,
      membersWithProgress,
      progressPercentage,
      programsEndingSoon: programsEndingSoon.length,
      endingSoonList,
      worstMsqCount,
      worstMsqList,
      worstMsqAverage,
      behindScheduleCount,
      behindScheduleList,
      worstComplianceCount,
      worstComplianceList,
      worstComplianceAverage,
      bestProgressCount,
      bestProgressList,
      bestProgressAverage,
    };

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Dashboard Metrics] Error fetching dashboard metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

