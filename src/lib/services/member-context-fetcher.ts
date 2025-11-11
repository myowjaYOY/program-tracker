import { createClient } from '@/lib/supabase/server';
import type { MemberContext, SurveyResponse, ProviderNote } from '@/types/ai-chat.types';

/**
 * Fetches comprehensive member context for AI analysis
 * - All survey responses (90 days)
 * - Provider notes (90 days)
 * - NO PII (no names, emails, phone numbers, provider identities)
 */
export async function fetchMemberContext(
  member_id: number,
  days: number = 90
): Promise<MemberContext> {
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  // Fetch survey responses with question text and form name
  const { data: surveyData, error: surveyError } = await supabase
    .from('survey_responses')
    .select(`
      answer_text,
      answer_numeric,
      answer_date,
      answer_boolean,
      survey_response_sessions!inner (
        completed_on,
        lead_id,
        form_id,
        survey_forms (
          form_name
        )
      ),
      survey_questions!inner (
        question_text
      )
    `)
    .eq('survey_response_sessions.lead_id', member_id)
    .gte('survey_response_sessions.completed_on', startDateStr);

  if (surveyError) {
    console.error('[Member Context] Survey fetch error:', surveyError);
    throw new Error(`Failed to fetch survey data: ${surveyError.message || JSON.stringify(surveyError)}`);
  }

  // Fetch provider notes (exclude created_by for privacy)
  const { data: notesData, error: notesError } = await supabase
    .from('lead_notes')
    .select('created_at, note_type, note')
    .eq('lead_id', member_id)
    .gte('created_at', startDateStr);

  if (notesError) {
    console.error('[Member Context] Notes fetch error:', notesError);
    throw new Error('Failed to fetch provider notes');
  }

  // Transform survey data to our format and sort chronologically (oldest first)
  const surveyResponses: SurveyResponse[] = (surveyData || [])
    .map((row: any) => {
      // Determine answer value (could be text, numeric, date, or boolean)
      const answer = row.answer_text || 
                     row.answer_numeric?.toString() || 
                     row.answer_date || 
                     row.answer_boolean?.toString() || 
                     '';

      return {
        date: row.survey_response_sessions.completed_on,
        survey_name: row.survey_response_sessions.survey_forms.form_name,
        question: row.survey_questions.question_text,
        answer: answer,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Transform notes data to our format and sort chronologically (oldest first)
  const providerNotes: ProviderNote[] = (notesData || [])
    .map((note: any) => ({
      date: note.created_at,
      note_type: note.note_type || 'General',
      content: note.note,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate data size
  const jsonString = JSON.stringify({ surveyResponses, providerNotes });
  const dataSizeKb = parseFloat((new TextEncoder().encode(jsonString).length / 1024).toFixed(2));

  // Get unique session count
  const uniqueSessions = new Set(
    surveyData?.map((row: any) => row.survey_response_sessions.completed_on) || []
  ).size;

  // Build date range
  const endDate = new Date();
  const dateRange = {
    start: startDate.toISOString().split('T')[0] || '',
    end: endDate.toISOString().split('T')[0] || '',
  };

  return {
    data_disclaimer: 'This is anonymized health data. No personally identifiable information is included.',
    time_period: `Past ${days} days`,
    survey_data: surveyResponses,
    provider_notes: providerNotes,
    data_summary: {
      survey_session_count: uniqueSessions,
      question_count: surveyResponses.length,
      note_count: providerNotes.length,
      date_range: dateRange,
      data_size_kb: dataSizeKb,
    },
  };
}

