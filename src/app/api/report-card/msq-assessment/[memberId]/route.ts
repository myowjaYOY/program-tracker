import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateTrend,
  generateClinicalAlerts,
} from '@/lib/utils/msq-assessment';
import type {
  MsqAssessmentSummary,
  MsqDomainCard,
  MsqSymptomProgression,
} from '@/types/database.types';

/**
 * GET /api/report-card/msq-assessment/:memberId
 * 
 * Returns MSQ assessment summary for a specific member:
 * - Member info (name, dates, program)
 * - 4 header cards (total score, active symptoms, worsening, improving)
 * - 3 clinical alerts (rule-based)
 * - 10 domain cards with symptoms and trends
 * 
 * @param memberId - external_user_id from survey_user_mappings
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { memberId: memberIdParam } = await context.params;
    const memberId = parseInt(memberIdParam);
    if (isNaN(memberId)) {
      console.error('Invalid member ID:', memberIdParam);
      return NextResponse.json(
        { error: 'Invalid member ID' },
        { status: 400 }
      );
    }

    console.log('Fetching MSQ assessment for member:', memberId);

    // Step 1: Get member info from survey_user_mappings
    const { data: memberData, error: memberError } = await supabase
      .from('survey_user_mappings')
      .select('external_user_id, lead_id, first_name, last_name')
      .eq('external_user_id', memberId)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    const memberName = `${memberData.first_name} ${memberData.last_name}`;

    // Step 2: Get all MSQ survey sessions for this member (form_id = 3)
    const MSQ_FORM_ID = 3;
    const { data: sessions, error: sessionsError } = await supabase
      .from('survey_response_sessions')
      .select('session_id, completed_on, external_user_id')
      .eq('external_user_id', memberId)
      .eq('form_id', MSQ_FORM_ID)
      .order('completed_on', { ascending: true });

    if (sessionsError || !sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'No MSQ surveys found for this member' },
        { status: 404 }
      );
    }

    const assessmentDates = sessions.map(s => s.completed_on);
    const sessionIds = sessions.map(s => s.session_id);

    // Step 3: Get domain scores from survey_domain_scores table (pre-calculated)
    const { data: domainScores, error: domainScoresError } = await supabase
      .from('survey_domain_scores')
      .select(`
        domain_score_id,
        session_id,
        domain_key,
        domain_total_score,
        severity_assessment
      `)
      .in('session_id', sessionIds);

    if (domainScoresError) {
      console.error('Failed to fetch domain scores:', domainScoresError);
      return NextResponse.json(
        { error: 'Failed to fetch domain scores', details: domainScoresError.message },
        { status: 500 }
      );
    }

    if (!domainScores || domainScores.length === 0) {
      console.warn('No domain scores found for sessions:', sessionIds);
    }

    // Step 4: Get all domain definitions from database
    const { data: domains, error: domainsError } = await supabase
      .from('survey_domains')
      .select('domain_key, domain_label')
      .order('domain_key');

    if (domainsError || !domains) {
      return NextResponse.json(
        { error: 'Failed to fetch domain definitions' },
        { status: 500 }
      );
    }

    // Step 5: Get ALL survey responses with question text
    const { data: responses, error: responsesError } = await supabase
      .from('survey_responses')
      .select(`
        session_id, 
        question_id,
        answer_text, 
        answer_numeric, 
        survey_questions(question_text, question_order)
      `)
      .in('session_id', sessionIds);

    if (responsesError || !responses) {
      console.error('Failed to fetch survey responses:', responsesError);
      return NextResponse.json(
        { error: 'Failed to fetch survey responses', details: responsesError?.message },
        { status: 500 }
      );
    }

    // Step 5b: Get question-domain mappings
    const questionIds = [...new Set(responses.map(r => r.question_id))];
    const { data: questionDomainMappings, error: mappingError } = await supabase
      .from('survey_form_question_domain')
      .select('question_id, domain_key')
      .in('question_id', questionIds);

    if (mappingError) {
      console.error('Failed to fetch question-domain mappings:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch question-domain mappings', details: mappingError.message },
        { status: 500 }
      );
    }

    // Create a map of question_id -> domain_key for fast lookup
    const questionDomainMap = new Map<number, string>();
    questionDomainMappings?.forEach(mapping => {
      questionDomainMap.set(mapping.question_id, mapping.domain_key);
    });

    // Step 6: Organize responses by domain and symptom (for symptom-level detail)
    // Key: "domain_key:question_text", Value: array of scores across sessions
    const symptomScoresByDomain = new Map<string, { 
      domain_key: string;
      question_text: string; 
      scores: number[];
    }>();

    sessions.forEach((session, sessionIdx) => {
      const sessionResponses = responses.filter(
        r => r.session_id === session.session_id
      );

      sessionResponses.forEach(response => {
        const questionData = response.survey_questions as any;
        
        if (!questionData || !questionData.question_text) return;

        // Get domain from the mapping
        const domainKey = questionDomainMap.get(response.question_id);
        if (!domainKey) return; // Skip questions without domain mapping

        const questionText = questionData.question_text;
        const mapKey = `${domainKey}:${questionText}`;

        // Prefer numeric; fall back to mapping text (handles "0"-"4" strings too)
        const score = typeof response.answer_numeric === 'number'
          ? response.answer_numeric
          : mapMsqAnswer(response.answer_text);

        if (!symptomScoresByDomain.has(mapKey)) {
          symptomScoresByDomain.set(mapKey, {
            domain_key: domainKey,
            question_text: questionText,
            scores: new Array(sessions.length).fill(0),
          });
        }

        const symptomData = symptomScoresByDomain.get(mapKey)!;
        symptomData.scores[sessionIdx] = score;
      });
    });

    // Step 7: Build domain cards using pre-calculated scores from survey_domain_scores
    const domainCards: MsqDomainCard[] = [];
    const latestSessionId = sessions[sessions.length - 1]!.session_id;
    const latestDomainScores = domainScores.filter(ds => ds.session_id === latestSessionId);

    // Build a card for each domain from the database
    domains.forEach(domainDef => {
      const domainKey = domainDef.domain_key;
      
      // Get all symptoms for this domain
      const symptoms: MsqSymptomProgression[] = [];
      symptomScoresByDomain.forEach((symptomData, mapKey) => {
        if (symptomData.domain_key === domainKey) {
          symptoms.push({
            symptom_name: extractSymptomName(symptomData.question_text),
            question_text: symptomData.question_text,
            scores: symptomData.scores,
            trend: calculateTrend(symptomData.scores),
          });
        }
      });

      // Sort symptoms alphabetically
      symptoms.sort((a, b) =>
        a.symptom_name.localeCompare(b.symptom_name)
      );

      // Get pre-calculated score and severity from survey_domain_scores
      const domainScore = latestDomainScores.find(ds => ds.domain_key === domainKey);
      const averageScore = domainScore ? parseFloat(domainScore.domain_total_score as string) : 0;
      const severity = domainScore?.severity_assessment || 'minimal';

      // Calculate trend based on symptoms
      const trend = calculateDomainTrend(symptoms);

      // Get emoji and color from hardcoded config (fallback)
      const emoji = getDomainEmoji(domainKey);
      const borderColor = getDomainColor(domainKey);

      domainCards.push({
        domain: domainKey as any,
        domain_label: domainDef.domain_label,
        emoji,
        average_score: Math.round(averageScore * 10) / 10,
        severity: severity as any,
        trend,
        trend_description: `${trend.charAt(0).toUpperCase() + trend.slice(1)}`,
        symptoms,
        border_color: borderColor,
      });
    });

    // Step 8: Calculate summary metrics
    const latestAssessmentIdx = sessions.length - 1;
    let totalScore = 0;
    let activeSymptoms = 0;
    let worseningCount = 0;
    let improvingCount = 0;

    symptomScoresByDomain.forEach((symptomData) => {
      const latestScore = symptomData.scores[latestAssessmentIdx]!;
      totalScore += latestScore;

      if (latestScore > 0) {
        activeSymptoms++;
      }

      const trend = calculateTrend(symptomData.scores);
      if (trend === 'worsening') worseningCount++;
      if (trend === 'improving') improvingCount++;
    });

    // Calculate total scores for each session
    const allTotalScores: number[] = [];
    sessions.forEach((session, sessionIdx) => {
      let sessionTotal = 0;
      symptomScoresByDomain.forEach((symptomData) => {
        sessionTotal += symptomData.scores[sessionIdx] || 0;
      });
      allTotalScores.push(sessionTotal);
    });

    // Calculate trend using linear regression
    const totalScoreTrend = calculateTotalScoreTrend(allTotalScores);

    // Step 9: Generate clinical alerts
    const clinicalAlerts = generateClinicalAlerts(domainCards, totalScore);

    // Step 10: Build summary response
    const summary: MsqAssessmentSummary = {
      member_name: memberName,
      external_user_id: memberId,
      lead_id: memberData.lead_id,
      program_name: extractProgramName(memberData),
      period_start: assessmentDates[0]!,
      period_end: assessmentDates[assessmentDates.length - 1]!,
      total_symptoms_count: symptomScoresByDomain.size,
      assessment_dates: assessmentDates,
      total_msq_score: totalScore,
      total_score_trend: totalScoreTrend,
      all_total_scores: allTotalScores,
      active_symptoms: activeSymptoms,
      worsening_count: worseningCount,
      improving_count: improvingCount,
      clinical_alerts: clinicalAlerts,
    };

    return NextResponse.json({
      data: {
        summary,
        domains: domainCards,
      },
    });
  } catch (error) {
    console.error('MSQ Assessment API error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapMsqAnswer(answer: string | null): number {
  if (!answer) return 0;
  const normalized = answer.trim();

  // Case 1: numeric strings like "0", "1", ... "4"
  const asNumber = Number(normalized);
  if (!Number.isNaN(asNumber)) {
    // Clamp to 0-4 and round (in case of stray decimals)
    return Math.max(0, Math.min(4, Math.round(asNumber)));
  }

  // Case 2: textual answers (Never → Always), case-insensitive
  const map: Record<string, number> = {
    never: 0,
    rarely: 1,
    sometimes: 2,
    frequently: 3,
    always: 4,
  };
  return map[normalized.toLowerCase()] ?? 0;
}

function extractSymptomName(questionText: string): string {
  let name = questionText
    .replace(/^(Do you (experience|have|suffer from|feel))\s+/i, '')
    .replace(/\?$/g, '');

  return name.charAt(0).toUpperCase() + name.slice(1);
}

function calculateDomainTrend(symptoms: MsqSymptomProgression[]): 'improving' | 'worsening' | 'stable' | 'fluctuating' {
  if (symptoms.length === 0) return 'stable';

  const improving = symptoms.filter(s => s.trend === 'improving').length;
  const worsening = symptoms.filter(s => s.trend === 'worsening').length;
  const fluctuating = symptoms.filter(s => s.trend === 'fluctuating').length;

  if (worsening > improving && worsening > fluctuating) return 'worsening';
  if (improving > worsening && improving > fluctuating) return 'improving';
  if (fluctuating > improving && fluctuating > worsening) return 'fluctuating';

  return 'stable';
}

function extractProgramName(memberData: any): string | null {
  try {
    if (
      memberData.leads &&
      memberData.leads.member_programs &&
      memberData.leads.member_programs.length > 0
    ) {
      const program = memberData.leads.member_programs[0];
      if (program.program_template && program.program_template.template_name) {
        return program.program_template.template_name;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

/**
 * Get emoji icon for domain (fallback mapping)
 */
function getDomainEmoji(domainKey: string): string {
  const emojiMap: Record<string, string> = {
    head: '🧠',
    eyes: '👁️',
    ears: '👂',
    nose: '👃',
    mouth_throat: '👄',
    digestive_tract: '🫃',
    heart: '❤️',
    lungs: '🫁',
    skin: '🧴',
    joints_muscle: '💪',
    weight: '⚖️',
    energy_activity: '⚡',
    mind: '🧘',
    emotions: '😊',
    other: '📋',
  };
  return emojiMap[domainKey] || '📊';
}

/**
 * Get border color for domain (fallback mapping)
 */
function getDomainColor(domainKey: string): string {
  const colorMap: Record<string, string> = {
    head: '#8b5cf6',
    eyes: '#3b82f6',
    ears: '#06b6d4',
    nose: '#10b981',
    mouth_throat: '#84cc16',
    digestive_tract: '#eab308',
    heart: '#f59e0b',
    lungs: '#ef4444',
    skin: '#ec4899',
    joints_muscle: '#d946ef',
    weight: '#a855f7',
    energy_activity: '#6366f1',
    mind: '#8b5cf6',
    emotions: '#ec4899',
    other: '#6b7280',
  };
  return colorMap[domainKey] || '#6b7280';
}

/**
 * Calculate total score trend based on clinical guidelines
 * 
 * Clinical Thresholds:
 * - ≥10-15 point decrease = measurable clinical improvement
 * - >30 point decrease = significant functional improvement
 * - >50% reduction = major transformation
 */
function calculateTotalScoreTrend(scores: number[]): 'improving' | 'worsening' | 'stable' | 'fluctuating' {
  if (scores.length < 2) return 'stable';
  
  const firstScore = scores[0]!;
  const lastScore = scores[scores.length - 1]!;
  const change = lastScore - firstScore;
  const percentChange = firstScore > 0 ? (change / firstScore) * 100 : 0;
  
  // Check for fluctuation (high variance in middle values)
  if (scores.length >= 3) {
    const middleScores = scores.slice(1, -1);
    const avgMiddle = middleScores.reduce((sum, s) => sum + s, 0) / middleScores.length;
    const avgEnds = (firstScore + lastScore) / 2;
    const fluctuationDiff = Math.abs(avgMiddle - avgEnds);
    
    // If middle values differ significantly from endpoints AND endpoints are similar
    if (fluctuationDiff > 15 && Math.abs(change) < 10) {
      return 'fluctuating';
    }
  }
  
  // Clinical improvement thresholds (negative change = improvement)
  if (change <= -10) {
    return 'improving'; // ≥10 point decrease = measurable improvement
  }
  
  // Clinical worsening thresholds (positive change = worsening)
  if (change >= 10) {
    return 'worsening'; // ≥10 point increase = measurable worsening
  }
  
  // Stable: less than 10 point change in either direction
  return 'stable';
}
