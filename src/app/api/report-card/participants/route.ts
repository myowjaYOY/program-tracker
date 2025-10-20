import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ParticipantOption } from '@/types/database.types';

/**
 * GET /api/report-card/participants
 * 
 * Returns list of survey participants from survey_user_mappings
 * Includes ALL mapped users and attaches MSQ survey counts (0 if none)
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
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    // Query survey_user_mappings for all users with survey data
    const { data: userMappings, error: mappingsError } = await supabase
      .from('survey_user_mappings')
      .select('external_user_id, lead_id, first_name, last_name')
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

    // Build final participant list from user mappings + survey counts
    // Always include users; default survey_count to 0 when missing
    const participants: ParticipantOption[] = userMappings.map((user) => {
      const surveyData = surveyDataMap.get(user.external_user_id);
      return {
        external_user_id: user.external_user_id,
        lead_id: user.lead_id,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`,
        survey_count: surveyData?.count ?? 0,
        latest_survey_date: surveyData?.latest_date ?? null,
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

