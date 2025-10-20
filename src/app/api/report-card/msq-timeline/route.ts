import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateMsqScore,
  calculateWeekNumber,
} from '@/lib/utils/survey-scoring';
import type { MsqScore, SurveyResponse } from '@/types/database.types';

/**
 * GET /api/report-card/msq-timeline
 * 
 * Returns MSQ-95 weekly scores for timeline chart
 * 
 * Query params:
 * - external_user_id (required): Survey participant to fetch data for
 * - program_id (optional): Filter by specific program
 * - start_date (optional): Filter start date
 * - end_date (optional): Filter end date
 * 
 * Response: Array of MsqScore objects with week-by-week data
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
    const externalUserId = searchParams.get('external_user_id');
    const programId = searchParams.get('program_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!externalUserId) {
      return NextResponse.json(
        { error: 'external_user_id is required' },
        { status: 400 }
      );
    }

    // Get participant name from survey_user_mappings
    const { data: userData } = await supabase
      .from('survey_user_mappings')
      .select('first_name, last_name, lead_id')
      .eq('external_user_id', parseInt(externalUserId))
      .single();

    const leadName = userData
      ? `${userData.first_name} ${userData.last_name}`
      : undefined;

    // Use lead_id if available for backward compatibility with existing logic
    const leadId = userData?.lead_id || parseInt(externalUserId);

    // Get program start date if program_id is specified
    let programStartDate: Date | null = null;
    if (programId) {
      const { data: contextData } = await supabase
        .from('survey_session_program_context')
        .select(`
          survey_programs!inner (
            program_id,
            created_at
          )
        `)
        .eq('program_id', parseInt(programId))
        .limit(1)
        .single();

      if (contextData) {
        const programData = contextData.survey_programs as any;
        programStartDate = new Date(programData.created_at);
      }
    }

    // If no program start date, use first survey date as baseline
    if (!programStartDate) {
      const { data: firstSession } = await supabase
        .from('survey_response_sessions')
        .select('completed_on')
        .eq('external_user_id', parseInt(externalUserId))
        .eq('form_id', 3) // MSQ
        .order('completed_on', { ascending: true })
        .limit(1)
        .single();

      programStartDate = firstSession
        ? new Date(firstSession.completed_on)
        : new Date();
    }

    // Query MSQ sessions for this participant
    let sessionQuery = supabase
      .from('survey_response_sessions')
      .select('session_id, completed_on')
      .eq('external_user_id', parseInt(externalUserId))
      .eq('form_id', 3) // MSQ form
      .order('completed_on', { ascending: true });

    if (startDate) {
      sessionQuery = sessionQuery.gte('completed_on', startDate);
    }
    if (endDate) {
      sessionQuery = sessionQuery.lte('completed_on', endDate);
    }

    const { data: sessions, error: sessionError } = await sessionQuery;

    if (sessionError) {
      console.error('Error fetching MSQ sessions:', sessionError);
      return NextResponse.json(
        { error: 'Failed to fetch MSQ sessions' },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get all responses for these sessions
    const sessionIds = sessions.map((s) => s.session_id);
    const { data: responsesData, error: responsesError } = await supabase
      .from('survey_responses')
      .select(`
        response_id,
        session_id,
        question_id,
        answer_text,
        answer_numeric,
        answer_date,
        answer_boolean,
        created_at,
        created_by,
        survey_questions!inner (
          question_text,
          question_order,
          form_id
        )
      `)
      .in('session_id', sessionIds);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return NextResponse.json(
        { error: 'Failed to fetch survey responses' },
        { status: 500 }
      );
    }

    // Group responses by session
    const responsesBySession = new Map<number, SurveyResponse[]>();
    for (const row of responsesData || []) {
      const questionData = row.survey_questions as any;
      const response: SurveyResponse = {
        response_id: row.response_id,
        session_id: row.session_id,
        question_id: row.question_id,
        answer_text: row.answer_text,
        answer_numeric: row.answer_numeric,
        answer_date: row.answer_date,
        answer_boolean: row.answer_boolean,
        created_at: row.created_at,
        created_by: row.created_by,
        question_text: questionData.question_text,
        question_order: questionData.question_order,
        form_id: questionData.form_id,
      };

      if (!responsesBySession.has(row.session_id)) {
        responsesBySession.set(row.session_id, []);
      }
      responsesBySession.get(row.session_id)!.push(response);
    }

    // Calculate MSQ scores for each session
    const msqScores: MsqScore[] = [];
    for (const session of sessions) {
      const responses = responsesBySession.get(session.session_id) || [];
      if (responses.length === 0) continue;

      const completedDate = new Date(session.completed_on);
      const weekNumber = calculateWeekNumber(completedDate, programStartDate);

      const score = calculateMsqScore(
        responses,
        session.session_id,
        parseInt(leadId),
        session.completed_on,
        weekNumber
      );

      if (leadName) {
        score.lead_name = leadName;
      }
      msqScores.push(score);
    }

    return NextResponse.json({ data: msqScores });
  } catch (error) {
    console.error('MSQ timeline API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

