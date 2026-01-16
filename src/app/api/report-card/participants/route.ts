import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';
import type { ParticipantOption } from '@/types/database.types';

/**
 * GET /api/report-card/participants
 * 
 * Returns list of survey participants from survey_user_mappings
 * FILTERED to members on active OR paused programs that have member_progress_summary data
 * (Matches the Member Progress Coverage card logic, extended to include paused)
 * 
 * Query params:
 * - program_id (optional): Filter by specific survey program
 * 
 * Response includes:
 * - external_user_id (primary identifier)
 * - lead_id (secondary reference, may be null)
 * - first_name
 * - last_name
 * - full_name
 * - survey_count (MSQ-95 surveys only)
 * - latest_survey_date
 * - is_paused (whether member's program is paused)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    // ====================================
    // Get active AND paused program IDs using centralized service
    // ====================================
    const validProgramIds = await ProgramStatusService.getValidProgramIds(supabase, {
      includeStatuses: ['active', 'paused']
    });

    if (!validProgramIds || validProgramIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // ====================================
    // Get member_programs for active/paused programs with status info
    // ====================================
    const { data: programsData, error: programsError } = await supabase
      .from('member_programs')
      .select('lead_id, member_program_id, program_status_id')
      .in('member_program_id', validProgramIds);

    if (programsError) {
      console.error('Error fetching programs:', programsError);
      return NextResponse.json(
        { error: 'Failed to fetch programs' },
        { status: 500 }
      );
    }

    if (!programsData || programsData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get the status ID for "Paused" to identify paused members
    const { data: pausedStatus } = await supabase
      .from('program_status')
      .select('program_status_id')
      .eq('status_name', 'Paused')
      .single();

    const pausedStatusId = pausedStatus?.program_status_id;

    // Build a map of lead_id → is_paused (true if ANY of their programs is paused)
    // Note: If a member has multiple programs, we mark as paused if their most recent is paused
    const leadPausedMap = new Map<number, boolean>();
    for (const program of programsData) {
      if (program.lead_id) {
        // If already marked as NOT paused (active), keep it that way
        // Only mark as paused if not already in map or if currently marked as paused
        const currentStatus = leadPausedMap.get(program.lead_id);
        const isPaused = pausedStatusId ? program.program_status_id === pausedStatusId : false;
        
        if (currentStatus === undefined) {
          leadPausedMap.set(program.lead_id, isPaused);
        } else if (currentStatus === true && !isPaused) {
          // If they have an active program, prioritize showing as active
          leadPausedMap.set(program.lead_id, false);
        }
      }
    }

    // Get unique lead_ids
    const uniqueLeadIds = [...new Set(programsData.map(p => p.lead_id).filter(Boolean))] as number[];

    if (uniqueLeadIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // ====================================
    // Get member_progress_summary to identify members with progress data
    // ====================================
    const { data: progressData, error: progressError } = await supabase
      .from('member_progress_summary')
      .select('lead_id')
      .in('lead_id', uniqueLeadIds);

    if (progressError) {
      console.error('Error fetching progress data:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress data' },
        { status: 500 }
      );
    }

    // Filter to only lead_ids that have progress data
    const leadIdsWithProgress = progressData 
      ? [...new Set(progressData.map(p => p.lead_id))]
      : [];

    if (leadIdsWithProgress.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // ====================================
    // Query survey_user_mappings filtered by lead_ids with progress data
    // ====================================
    const { data: userMappings, error: mappingsError } = await supabase
      .from('survey_user_mappings')
      .select('external_user_id, lead_id, first_name, last_name')
      .in('lead_id', leadIdsWithProgress)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (mappingsError) {
      console.error('Error fetching user mappings:', mappingsError);
      return NextResponse.json(
        { error: 'Failed to fetch user mappings' },
        { status: 500 }
      );
    }

    if (!userMappings || userMappings.length === 0) {
      return NextResponse.json({ data: [] });
    }

    console.log('[Participants API] Filtered results:', {
      totalValidProgramIds: validProgramIds.length,
      uniqueLeadIds: uniqueLeadIds.length,
      leadIdsWithProgress: leadIdsWithProgress.length,
      userMappingsFound: userMappings.length,
      pausedMembers: [...leadPausedMap.entries()].filter(([, isPaused]) => isPaused).length,
    });

    // Query MSQ-95 sessions for each user
    const MSQ_FORM_ID = 3;
    let sessionsQuery = supabase
      .from('survey_response_sessions')
      .select('external_user_id, completed_on, session_id')
      .eq('form_id', MSQ_FORM_ID)
      .order('completed_on', { ascending: false });

    // If program filter is specified, filter by program context
    if (programId) {
      const { data: contextData } = await supabase
        .from('survey_session_program_context')
        .select('session_id')
        .eq('program_id', parseInt(programId));

      if (contextData && contextData.length > 0) {
        const sessionIds = contextData.map((c) => c.session_id);
        sessionsQuery = sessionsQuery.in('session_id', sessionIds);
      } else {
        // No sessions for this program
        return NextResponse.json({ data: [] });
      }
    }

    const { data: sessionData, error } = await sessionsQuery;

    if (error) {
      console.error('Error fetching participants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Build a map of external_user_id → survey count & latest date
    const surveyDataMap = new Map<
      number,
      { count: number; latest_date: string | null }
    >();

    for (const session of sessionData || []) {
      const userId = session.external_user_id;
      const existing = surveyDataMap.get(userId);

      if (!existing) {
        surveyDataMap.set(userId, {
          count: 1,
          latest_date: session.completed_on,
        });
      } else {
        existing.count += 1;
        if (
          !existing.latest_date ||
          new Date(session.completed_on) > new Date(existing.latest_date)
        ) {
          existing.latest_date = session.completed_on;
        }
      }
    }

    // ====================================
    // Get risk levels from member_individual_insights
    // ====================================
    const { data: insightsData, error: insightsError } = await supabase
      .from('member_individual_insights')
      .select('lead_id, risk_level')
      .in('lead_id', leadIdsWithProgress);

    if (insightsError) {
      console.error('Error fetching insights data:', insightsError);
      // Don't fail the request, just log the error
    }

    // Build a map of lead_id → risk_level
    const riskLevelMap = new Map<number, string>();
    if (insightsData) {
      for (const insight of insightsData) {
        if (insight.lead_id && insight.risk_level) {
          riskLevelMap.set(insight.lead_id, insight.risk_level);
        }
      }
    }

    // Build final participant list from user mappings + survey counts + risk levels + paused status
    // Always include users; default survey_count to 0 when missing
    const participants: ParticipantOption[] = userMappings.map((user) => {
      const surveyData = surveyDataMap.get(user.external_user_id);
      const riskLevel = user.lead_id ? riskLevelMap.get(user.lead_id) : null;
      const isPaused = user.lead_id ? (leadPausedMap.get(user.lead_id) ?? false) : false;
      return {
        external_user_id: user.external_user_id,
        lead_id: user.lead_id,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`,
        survey_count: surveyData?.count ?? 0,
        latest_survey_date: surveyData?.latest_date ?? null,
        risk_level: riskLevel ?? null,
        is_paused: isPaused,
      };
    });

    // Already sorted by last_name, first_name from the initial query

    return NextResponse.json({ data: participants });
  } catch (error) {
    console.error('Participants API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

