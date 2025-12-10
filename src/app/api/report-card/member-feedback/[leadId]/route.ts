import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Support rating text to numeric score mapping
 * Scale: 1-5 (higher is better)
 */
const SUPPORT_RATING_MAP: Record<string, number> = {
  'exceeding expectations': 5,
  'very supportive': 4,
  'adequately supportive': 3,
  'mildly supportive': 2,
  'not applicable': 1,
};

/**
 * Question IDs for feedback questions (across forms)
 * 
 * TODO: Need to fix this at some point so that it's not hardcoded
 * and is more dynamic (e.g., query by question text pattern or
 * use a question metadata/tag system).
 */
const FEEDBACK_QUESTION_IDS = {
  // Provider support questions
  providerSupport: [207, 250, 417], // Final, Mid-Program, Initial Results
  
  // Staff/Coach support questions
  staffSupport: [208, 251, 418], // Final, Mid-Program, Initial Results
  
  // Curriculum support questions
  curriculumSupport: [209, 252], // Final, Mid-Program Results (not in Initial)
  
  // Text feedback questions
  improvementSuggestions: [210, 219, 253, 262, 432], // For which topics, What improvements
  educationRequests: [210, 253], // For which topics, if any
  programSentiment: [21], // Week 1 - how you feel about program
};

// All rating question IDs for support ratings
const RATING_QUESTION_IDS = [
  ...FEEDBACK_QUESTION_IDS.providerSupport,
  ...FEEDBACK_QUESTION_IDS.staffSupport,
  ...FEEDBACK_QUESTION_IDS.curriculumSupport,
];

// All text feedback question IDs
const TEXT_FEEDBACK_QUESTION_IDS = [
  219, 262, 432, // Improvement suggestions (without overlap of 210, 253)
  210, 253, // Education requests
  21, // Program sentiment
];

/**
 * Calculate trend from an array of scores
 */
function calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' | 'no_data' {
  if (scores.length < 2) return 'no_data';
  
  const firstScore = scores[0]!;
  const lastScore = scores[scores.length - 1]!;
  const change = lastScore - firstScore;
  
  // ±0.5 threshold for meaningful change on 1-5 scale
  if (change >= 0.5) return 'improving';
  if (change <= -0.5) return 'declining';
  return 'stable';
}

/**
 * Map support rating text to numeric score
 */
function mapSupportRating(answer: string | null): number | null {
  if (!answer) return null;
  const normalized = answer.toLowerCase().trim();
  return SUPPORT_RATING_MAP[normalized] ?? null;
}

/**
 * Categorize feedback question by type
 */
function categorizeFeedback(questionId: number): 'improvement' | 'education' | 'sentiment' {
  if ([21].includes(questionId)) return 'sentiment';
  if ([210, 253].includes(questionId)) return 'education';
  return 'improvement';
}

/**
 * GET /api/report-card/member-feedback/:leadId
 * 
 * Returns member feedback data including:
 * - Support ratings (provider, staff, curriculum) with trends
 * - Rating timeline for charts
 * - Text feedback entries chronologically
 * 
 * @param leadId - Lead ID of the member
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
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

    const { leadId: leadIdParam } = await context.params;
    const leadId = parseInt(leadIdParam);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    // Step 1: Get member info and verify they exist
    const { data: memberData, error: memberError } = await supabase
      .from('leads')
      .select('lead_id, first_name, last_name')
      .eq('lead_id', leadId)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Step 2: Get all survey sessions for this member with form info
    const { data: sessions, error: sessionsError } = await supabase
      .from('survey_response_sessions')
      .select(`
        session_id,
        completed_on,
        form_id,
        survey_forms!inner(form_id, form_name)
      `)
      .eq('lead_id', leadId)
      .order('completed_on', { ascending: true });

    if (sessionsError) {
      console.error('Failed to fetch sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch survey sessions' },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        data: {
          ratings: {
            overall: { current: null, trend: 'no_data', surveyCount: 0 },
            provider: { current: null, trend: 'no_data', history: [] },
            staff: { current: null, trend: 'no_data', history: [] },
            curriculum: { current: null, trend: 'no_data', history: [] },
          },
          ratingTimeline: [],
          feedback: [],
        },
      });
    }

    const sessionIds = sessions.map(s => s.session_id);

    // Step 3: Get all responses for rating questions
    const { data: ratingResponses, error: ratingError } = await supabase
      .from('survey_responses')
      .select(`
        response_id,
        session_id,
        question_id,
        answer_text
      `)
      .in('session_id', sessionIds)
      .in('question_id', RATING_QUESTION_IDS);

    if (ratingError) {
      console.error('Failed to fetch rating responses:', ratingError);
      return NextResponse.json(
        { error: 'Failed to fetch rating responses' },
        { status: 500 }
      );
    }

    // Step 4: Get all responses for text feedback questions
    const { data: textResponses, error: textError } = await supabase
      .from('survey_responses')
      .select(`
        response_id,
        session_id,
        question_id,
        answer_text,
        survey_questions!inner(question_text)
      `)
      .in('session_id', sessionIds)
      .in('question_id', TEXT_FEEDBACK_QUESTION_IDS);

    if (textError) {
      console.error('Failed to fetch text responses:', textError);
      return NextResponse.json(
        { error: 'Failed to fetch text responses' },
        { status: 500 }
      );
    }

    // Step 5: Build rating histories
    const providerHistory: { date: string; value: number; formName: string }[] = [];
    const staffHistory: { date: string; value: number; formName: string }[] = [];
    const curriculumHistory: { date: string; value: number; formName: string }[] = [];

    // Map session_id to session data for quick lookup
    const sessionMap = new Map(
      sessions.map(s => [s.session_id, {
        date: s.completed_on,
        formName: (s.survey_forms as any).form_name,
      }])
    );

    // Process rating responses
    ratingResponses?.forEach(response => {
      const sessionData = sessionMap.get(response.session_id);
      if (!sessionData) return;

      const score = mapSupportRating(response.answer_text);
      if (score === null) return;

      const entry = {
        date: sessionData.date,
        value: score,
        formName: sessionData.formName,
      };

      if (FEEDBACK_QUESTION_IDS.providerSupport.includes(response.question_id)) {
        providerHistory.push(entry);
      }
      if (FEEDBACK_QUESTION_IDS.staffSupport.includes(response.question_id)) {
        staffHistory.push(entry);
      }
      if (FEEDBACK_QUESTION_IDS.curriculumSupport.includes(response.question_id)) {
        curriculumHistory.push(entry);
      }
    });

    // Sort histories by date
    providerHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    staffHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    curriculumHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Step 6: Calculate current scores and trends
    const getLatestScore = (history: typeof providerHistory) => 
      history.length > 0 ? history[history.length - 1]!.value : null;

    const providerCurrent = getLatestScore(providerHistory);
    const staffCurrent = getLatestScore(staffHistory);
    const curriculumCurrent = getLatestScore(curriculumHistory);

    const providerTrend = calculateTrend(providerHistory.map(h => h.value));
    const staffTrend = calculateTrend(staffHistory.map(h => h.value));
    const curriculumTrend = calculateTrend(curriculumHistory.map(h => h.value));

    // Calculate overall score (average of available dimensions)
    const currentScores = [providerCurrent, staffCurrent, curriculumCurrent].filter(s => s !== null) as number[];
    const overallCurrent = currentScores.length > 0 
      ? Math.round((currentScores.reduce((a, b) => a + b, 0) / currentScores.length) * 10) / 10
      : null;

    // Count surveys with any rating
    const surveysWithRatings = new Set([
      ...providerHistory.map(h => h.date),
      ...staffHistory.map(h => h.date),
      ...curriculumHistory.map(h => h.date),
    ]).size;

    // Calculate overall trend (average of trends that have data)
    const trends = [providerTrend, staffTrend, curriculumTrend].filter(t => t !== 'no_data');
    let overallTrend: 'improving' | 'stable' | 'declining' | 'no_data' = 'no_data';
    if (trends.length > 0) {
      const improvingCount = trends.filter(t => t === 'improving').length;
      const decliningCount = trends.filter(t => t === 'declining').length;
      if (improvingCount > decliningCount) overallTrend = 'improving';
      else if (decliningCount > improvingCount) overallTrend = 'declining';
      else overallTrend = 'stable';
    }

    // Step 7: Build rating timeline for chart
    const ratingTimeline: {
      date: string;
      formName: string;
      provider: number | null;
      staff: number | null;
      curriculum: number | null;
    }[] = [];

    // Get unique dates that have any ratings
    const allRatingDates = new Set([
      ...providerHistory.map(h => h.date),
      ...staffHistory.map(h => h.date),
      ...curriculumHistory.map(h => h.date),
    ]);

    Array.from(allRatingDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).forEach(date => {
      const providerEntry = providerHistory.find(h => h.date === date);
      const staffEntry = staffHistory.find(h => h.date === date);
      const curriculumEntry = curriculumHistory.find(h => h.date === date);

      ratingTimeline.push({
        date,
        formName: providerEntry?.formName || staffEntry?.formName || curriculumEntry?.formName || 'Survey',
        provider: providerEntry?.value ?? null,
        staff: staffEntry?.value ?? null,
        curriculum: curriculumEntry?.value ?? null,
      });
    });

    // Step 8: Build feedback timeline
    const feedbackBySession = new Map<string, {
      date: string;
      formName: string;
      items: { category: 'improvement' | 'education' | 'sentiment'; text: string; questionText: string }[];
    }>();

    textResponses?.forEach(response => {
      // Skip empty or whitespace-only responses
      if (!response.answer_text || response.answer_text.trim().length === 0) return;
      
      const sessionData = sessionMap.get(response.session_id);
      if (!sessionData) return;

      const key = `${sessionData.date}_${response.session_id}`;
      
      if (!feedbackBySession.has(key)) {
        feedbackBySession.set(key, {
          date: sessionData.date,
          formName: sessionData.formName,
          items: [],
        });
      }

      const category = categorizeFeedback(response.question_id);
      const questionText = (response.survey_questions as any)?.question_text || '';
      
      feedbackBySession.get(key)!.items.push({
        category,
        text: response.answer_text.trim(),
        questionText,
      });
    });

    // Convert to array and sort by date descending (most recent first)
    const feedback = Array.from(feedbackBySession.values())
      .filter(f => f.items.length > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Step 9: Build response
    return NextResponse.json({
      data: {
        ratings: {
          overall: {
            current: overallCurrent,
            trend: overallTrend,
            surveyCount: surveysWithRatings,
          },
          provider: {
            current: providerCurrent,
            trend: providerTrend,
            history: providerHistory,
          },
          staff: {
            current: staffCurrent,
            trend: staffTrend,
            history: staffHistory,
          },
          curriculum: {
            current: curriculumCurrent,
            trend: curriculumTrend,
            history: curriculumHistory,
          },
        },
        ratingTimeline,
        feedback,
      },
    });
  } catch (error) {
    console.error('Member Feedback API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}



