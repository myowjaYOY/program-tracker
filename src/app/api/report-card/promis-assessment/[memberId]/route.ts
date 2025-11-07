import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertToTScore } from '@/lib/utils/survey-scoring';
import type {
  PromisAssessmentSummary,
  PromisDomainCard,
  PromisQuestionProgression,
  PromisDomain,
  PromisSymptomSeverity,
  PromisFunctionSeverity,
  DomainTrendType,
} from '@/types/database.types';

/**
 * GET /api/report-card/promis-assessment/:memberId
 * 
 * Returns PROMIS-29 assessment summary for a specific member:
 * - Member info (name, dates, program)
 * - Top summary card (mean T-score, trend, worsening/improving counts, period)
 * - 8 domain cards with T-scores, trends, and question-level detail
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

    // Step 2: Get all PROMIS survey sessions for this member (form_id = 6)
    const PROMIS_FORM_ID = 6;
    const { data: sessions, error: sessionsError } = await supabase
      .from('survey_response_sessions')
      .select('session_id, completed_on, external_user_id')
      .eq('external_user_id', memberId)
      .eq('form_id', PROMIS_FORM_ID)
      .order('completed_on', { ascending: true });

    if (sessionsError || !sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'No PROMIS-29 surveys found for this member' },
        { status: 404 }
      );
    }

    const assessmentDates = sessions.map(s => s.completed_on);
    const sessionIds = sessions.map(s => s.session_id);

    // Step 3: Get domain scores from survey_domain_scores table (PROMIS only)
    const { data: domainScores, error: domainScoresError } = await supabase
      .from('survey_domain_scores')
      .select(`
        domain_score_id,
        session_id,
        domain_key,
        domain_total_score,
        severity_assessment,
        survey_domains!inner(survey_code)
      `)
      .eq('survey_domains.survey_code', 'PROMIS')
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

    // Step 4: Get all domain definitions from database (PROMIS only)
    const { data: domains, error: domainsError } = await supabase
      .from('survey_domains')
      .select('domain_key, domain_label')
      .eq('survey_code', 'PROMIS')
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

    // Step 6: Get question-domain mappings (PROMIS only)
    const questionIds = [...new Set(responses.map(r => r.question_id))];
    const { data: questionDomainMappings, error: mappingError } = await supabase
      .from('survey_form_question_domain')
      .select('question_id, domain_key, survey_domains!inner(survey_code)')
      .eq('survey_domains.survey_code', 'PROMIS')
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

    // Step 7: Organize responses by domain and question
    // Key: "domain_key:question_id", Value: { question_text, scores across sessions }
    const questionScoresByDomain = new Map<string, { 
      domain_key: string;
      question_id: number;
      question_text: string;
      question_order: number;
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
        const questionOrder = questionData.question_order || 0;
        const mapKey = `${domainKey}:${response.question_id}`;

        // Use answer_numeric (already converted by import function)
        const score = response.answer_numeric || 0;

        if (!questionScoresByDomain.has(mapKey)) {
          questionScoresByDomain.set(mapKey, {
            domain_key: domainKey,
            question_id: response.question_id,
            question_text: questionText,
            question_order: questionOrder,
            scores: new Array(sessions.length).fill(0),
          });
        }

        const entry = questionScoresByDomain.get(mapKey)!;
        entry.scores[sessionIdx] = score;
      });
    });

    // Step 8: Calculate domain raw scores and T-scores for each session
    const domainDataBySession = new Map<number, Map<string, {
      raw_score: number;
      t_score: number | null;
    }>>();

    sessions.forEach((session, sessionIdx) => {
      const sessionDomainData = new Map<string, { raw_score: number; t_score: number | null }>();

      // Group questions by domain for this session
      const domainQuestions = new Map<string, number[]>();
      
      questionScoresByDomain.forEach((questionData, key) => {
        const domain = questionData.domain_key;
        if (!domainQuestions.has(domain)) {
          domainQuestions.set(domain, []);
        }
        const score = questionData.scores[sessionIdx] ?? 0;
        domainQuestions.get(domain)!.push(score);
      });

      // Calculate raw score and T-score for each domain
      domainQuestions.forEach((scores, domain) => {
        const rawScore = scores.reduce((sum, score) => sum + score, 0);
        
        // Convert to T-score (null for pain_intensity)
        const tScore = domain === 'pain_intensity' 
          ? null 
          : convertToTScore(domain, rawScore);

        sessionDomainData.set(domain, { raw_score: rawScore, t_score: tScore });
      });

      domainDataBySession.set(session.session_id, sessionDomainData);
    });

    // Step 9: Calculate mean T-scores for each session (for summary card)
    const meanTScoresBySession: number[] = [];
    
    sessions.forEach(session => {
      const sessionData = domainDataBySession.get(session.session_id);
      if (!sessionData) {
        meanTScoresBySession.push(50); // Default
        return;
      }

      // Calculate mean of all T-scores (excluding pain_intensity which is null)
      const tScores: number[] = [];
      sessionData.forEach((data, domain) => {
        if (data.t_score !== null) {
          tScores.push(data.t_score);
        }
      });

      const mean = tScores.length > 0
        ? tScores.reduce((sum, score) => sum + score, 0) / tScores.length
        : 50;
      
      meanTScoresBySession.push(Number((Math.round(mean * 10) / 10).toFixed(1))); // Round to 1 decimal
    });

    // Step 10: Build domain cards
    const domainCards: PromisDomainCard[] = [];

    domains.forEach(domainDef => {
      const domainKey = domainDef.domain_key as PromisDomain;
      
      // Get all raw scores and T-scores for this domain across sessions
      const allRawScores: number[] = [];
      const allTScores: (number | null)[] = [];

      sessions.forEach(session => {
        const sessionData = domainDataBySession.get(session.session_id);
        const domainData = sessionData?.get(domainKey);
        
        allRawScores.push(domainData?.raw_score || 0);
        allTScores.push(domainData?.t_score ?? null);
      });

      // Current assessment (latest)
      const currentRawScore = allRawScores[allRawScores.length - 1] ?? 0;
      const currentTScore = allTScores[allTScores.length - 1] ?? null;

      // Determine domain type (symptom vs function)
      const domainType = ['physical_function', 'social_roles'].includes(domainKey)
        ? 'function'
        : 'symptom';

      // Calculate severity
      const currentSeverity = interpretPromisSeverity(
        currentTScore,
        currentRawScore,
        domainType,
        domainKey
      );

      // Calculate trend
      const trend = calculatePromisTrend(
        allTScores,
        allRawScores,
        domainType,
        domainKey
      );

      // Calculate change amount for tooltip
      const firstScore = domainKey === 'pain_intensity' 
        ? allRawScores[0] 
        : allTScores[0];
      const lastScore = domainKey === 'pain_intensity'
        ? allRawScores[allRawScores.length - 1]
        : allTScores[allTScores.length - 1];
      const changeAmount = (lastScore !== null && lastScore !== undefined && firstScore !== null && firstScore !== undefined)
        ? lastScore - firstScore
        : 0;

      // Get trend description
      const trendDescription = getPromisTrendDescription(trend, domainType, changeAmount, domainKey);

      // Build question-level detail
      const questions: PromisQuestionProgression[] = [];
      questionScoresByDomain.forEach((questionData, key) => {
        if (questionData.domain_key === domainKey) {
          questions.push({
            question_text: questionData.question_text,
            question_order: questionData.question_order,
            all_raw_scores: questionData.scores,
            all_dates: assessmentDates,
            trend: calculateQuestionTrend(questionData.scores),
          });
        }
      });

      // Sort questions by order
      questions.sort((a, b) => a.question_order - b.question_order);

      domainCards.push({
        domain_key: domainKey,
        domain_label: domainDef.domain_label,
        emoji: getPromisDomainEmoji(domainKey),
        domain_type: domainType,
        current_raw_score: currentRawScore,
        current_t_score: currentTScore,
        current_severity: currentSeverity,
        trend,
        trend_description: trendDescription,
        all_raw_scores: allRawScores,
        all_t_scores: allTScores,
        assessment_dates: assessmentDates,
        questions,
      });
    });

    // Step 11: Calculate summary metrics
    const currentMeanTScore = meanTScoresBySession[meanTScoresBySession.length - 1] || 50;
    const currentSeverity = interpretMeanTScoreSeverity(currentMeanTScore);

    // Calculate overall trend
    const totalScoreTrend = calculateOverallTrend(meanTScoresBySession);

    // Calculate overall trend description and magnitude
    const firstMeanTScore = meanTScoresBySession[0] || 50;
    const lastMeanTScore = meanTScoresBySession[meanTScoresBySession.length - 1] || 50;
    const overallChangeAmount = lastMeanTScore - firstMeanTScore;
    const overallTrendDescription = getPromisTrendDescription(
      totalScoreTrend,
      'symptom', // Overall mean is treated like a symptom (lower = better)
      overallChangeAmount,
      'overall', // Not a specific domain
      meanTScoresBySession.length // Pass the number of assessments
    );
    const overallChangeMagnitude = meanTScoresBySession.length < 2
      ? 'N/A' 
      : getChangeMagnitude(Math.abs(overallChangeAmount), false);

    // Count worsening and improving domains
    const worseningDomainsCount = domainCards.filter(d => d.trend === 'worsening').length;
    const improvingDomainsCount = domainCards.filter(d => d.trend === 'improving').length;

    // Step 12: Build summary object
    const summary: PromisAssessmentSummary = {
      member_name: memberName,
      external_user_id: memberId,
      lead_id: memberData.lead_id,
      current_mean_t_score: currentMeanTScore,
      current_severity: currentSeverity,
      total_score_trend: totalScoreTrend,
      overall_trend_description: overallTrendDescription,
      overall_change_magnitude: overallChangeMagnitude,
      worsening_domains_count: worseningDomainsCount,
      improving_domains_count: improvingDomainsCount,
      assessment_dates: assessmentDates,
      all_mean_t_scores: meanTScoresBySession,
      period_start: assessmentDates[0],
      period_end: assessmentDates[assessmentDates.length - 1],
    };

    // Step 13: Return complete assessment data
    return NextResponse.json({
      summary,
      domains: domainCards,
    });

  } catch (error) {
    console.error('Error in PROMIS assessment API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Interprets PROMIS severity based on T-score or raw score
 */
function interpretPromisSeverity(
  tScore: number | null,
  rawScore: number,
  domainType: 'symptom' | 'function',
  domainKey: string
): PromisSymptomSeverity | PromisFunctionSeverity {
  // Pain intensity uses raw score (0-10)
  if (domainKey === 'pain_intensity') {
    if (rawScore === 0) return 'within_normal';
    if (rawScore <= 3) return 'mild';
    if (rawScore <= 6) return 'moderate';
    if (rawScore <= 9) return 'severe';
    return 'very_severe';
  }

  // Use T-score for other domains
  if (tScore === null) return 'within_normal';

  if (domainType === 'symptom') {
    // Higher T-score = worse for symptom domains
    if (tScore < 45) return 'within_normal';
    if (tScore < 55) return 'mild';
    if (tScore < 65) return 'moderate';
    if (tScore < 75) return 'severe';
    return 'very_severe';
  } else {
    // Higher T-score = better for function domains (reversed)
    if (tScore >= 55) return 'within_normal';
    if (tScore >= 45) return 'mild_limitation';
    if (tScore >= 35) return 'moderate_limitation';
    if (tScore >= 25) return 'severe_limitation';
    return 'very_severe_limitation';
  }
}

/**
 * Interprets mean T-score severity (uses symptom domain thresholds)
 */
function interpretMeanTScoreSeverity(meanTScore: number): PromisSymptomSeverity {
  if (meanTScore < 45) return 'within_normal';
  if (meanTScore < 55) return 'mild';
  if (meanTScore < 65) return 'moderate';
  if (meanTScore < 75) return 'severe';
  return 'very_severe';
}

/**
 * Calculates trend for a PROMIS domain
 */
function calculatePromisTrend(
  allTScores: (number | null)[],
  allRawScores: number[],
  domainType: 'symptom' | 'function',
  domainKey: string
): DomainTrendType {
  // Need at least 2 assessments for trend
  if (allTScores.length < 2) return 'stable';

  // Use raw scores for pain_intensity, T-scores for others
  const scores = domainKey === 'pain_intensity' 
    ? allRawScores 
    : allTScores.filter(s => s !== null) as number[];

  if (scores.length < 2) return 'stable';

  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];
  
  if (firstScore === undefined || lastScore === undefined) return 'stable';
  
  const change = lastScore - firstScore;

  // Threshold for clinically meaningful change
  const threshold = domainKey === 'pain_intensity' ? 2 : 5;

  if (domainType === 'symptom' || domainKey === 'pain_intensity') {
    // For symptom domains: decrease = improvement
    if (change <= -threshold) return 'improving';
    if (change >= threshold) return 'worsening';
  } else {
    // For function domains: increase = improvement
    if (change >= threshold) return 'improving';
    if (change <= -threshold) return 'worsening';
  }

  return 'stable';
}

/**
 * Calculates overall trend from mean T-scores
 */
function calculateOverallTrend(meanTScores: number[]): DomainTrendType {
  if (meanTScores.length < 2) return 'stable';

  const firstScore = meanTScores[0];
  const lastScore = meanTScores[meanTScores.length - 1];
  
  if (firstScore === undefined || lastScore === undefined) return 'stable';
  
  const change = lastScore - firstScore;

  // For mean T-score, lower is better (symptom-like)
  if (change <= -5) return 'improving';
  if (change >= 5) return 'worsening';
  return 'stable';
}

/**
 * Calculates trend for a single question
 */
function calculateQuestionTrend(scores: number[]): DomainTrendType {
  if (scores.length < 2) return 'stable';

  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];
  
  if (firstScore === undefined || lastScore === undefined) return 'stable';
  
  const change = lastScore - firstScore;

  // Lower scores = improvement for most PROMIS questions
  if (change <= -1) return 'improving';
  if (change >= 1) return 'worsening';
  return 'stable';
}

/**
 * Gets change magnitude label based on Clinical Significance table
 */
function getChangeMagnitude(absChange: number, isPainIntensity: boolean): string {
  const threshold = isPainIntensity ? 2 : 5;
  
  if (absChange < threshold) {
    return 'Minimal Change';
  } else if (absChange >= threshold && absChange <= 10) {
    return 'Moderate Change';
  } else {
    return 'Substantial Change';
  }
}

/**
 * Gets human-readable trend description
 */
function getPromisTrendDescription(
  trend: DomainTrendType,
  domainType: 'symptom' | 'function',
  changeAmount: number,
  domainKey: string,
  assessmentCount: number = 2
): string {
  // Handle single assessment case (like MSQ does)
  if (assessmentCount < 2) {
    return 'Need at least 2 assessments to calculate trend';
  }

  const absChange = Math.abs(changeAmount);
  const isPainIntensity = domainKey === 'pain_intensity';
  const scoreType = isPainIntensity ? 'points' : 'T-score points';
  
  // Format change with direction
  const changeDirection = changeAmount > 0 ? '+' : '';
  const changeText = `Change: ${changeDirection}${changeAmount.toFixed(1)} ${scoreType}`;
  
  // Determine change magnitude based on Clinical Significance table
  let changeMagnitude: string;
  let clinicalMeaning: string;
  const threshold = isPainIntensity ? 2 : 5;
  
  if (absChange < threshold) {
    changeMagnitude = 'Minimal Change';
    clinicalMeaning = 'No clinically meaningful change';
  } else if (absChange >= threshold && absChange <= 10) {
    changeMagnitude = 'Moderate Change';
    clinicalMeaning = 'Noticeable change in daily function';
  } else {
    changeMagnitude = 'Substantial Change';
    clinicalMeaning = 'Significant clinical improvement/decline';
  }
  
  // Return format: "Change: +7.2 T-score points\nModerate Change - Noticeable change in daily function"
  return `${changeText}\n${changeMagnitude} - ${clinicalMeaning}`;
}

/**
 * Gets emoji for PROMIS domain
 */
function getPromisDomainEmoji(domain: PromisDomain): string {
  const emojiMap: Record<PromisDomain, string> = {
    physical_function: '🏃',
    anxiety: '😰',
    depression: '😔',
    fatigue: '😴',
    sleep_disturbance: '🌙',
    social_roles: '👥',
    pain_interference: '🤕',
    pain_intensity: '⚡',
  };
  return emojiMap[domain] || '📊';
}

