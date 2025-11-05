import { SupabaseClient } from '@supabase/supabase-js';
import { MsqAssessmentSummary, MsqDomainCard } from '@/types/database.types';
import { convertToTScore } from '@/lib/utils/survey-scoring';
import { sortPromisDomains } from '@/lib/utils/promis-assessment';

export interface ReportDataOptions {
  sections: {
    memberProgress: boolean;
    msqAssessment: boolean;
    promisAssessment: boolean;
  };
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface MsqAssessmentData {
  summary: MsqAssessmentSummary;
  domains: MsqDomainCard[];
}

export interface PromisAssessmentData {
  summary: any; // Using any for now, will match API response structure
  domains: any[];
}

export interface ReportCardData {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    name: string;
    email?: string;
    phone?: string;
  };
  memberProgress?: any;
  msqAssessment?: MsqAssessmentData;
  promisAssessment?: PromisAssessmentData;
}

export async function fetchReportCardData(
  supabase: SupabaseClient,
  memberId: number,
  options: ReportDataOptions
): Promise<ReportCardData> {
  try {
    // Fetch member basic info
    const { data: member, error: memberError } = await supabase
      .from('leads')
      .select('lead_id, first_name, last_name, email, phone')
      .eq('lead_id', memberId)
      .single();

    if (memberError || !member) {
      throw new Error(`Member not found: ${memberError?.message || 'Unknown error'}`);
    }

    const reportData: ReportCardData = {
      member: {
        id: member.lead_id,
        firstName: member.first_name,
        lastName: member.last_name,
        name: `${member.first_name} ${member.last_name}`,
        email: member.email || undefined,
        phone: member.phone || undefined,
      },
    };

    // Fetch Member Progress data if requested
    if (options.sections.memberProgress) {
      const { data: progressData, error: progressError } = await supabase
        .from('member_progress_summary')
        .select('*')
        .eq('lead_id', memberId)
        .maybeSingle();

      if (progressError) {
        console.error('Error fetching member progress:', progressError);
      } else if (progressData) {
        reportData.memberProgress = progressData;
      } else {
        console.warn(`⚠️ No dashboard data found for lead_id ${memberId} - member may not have completed surveys yet`);
      }
    }

    // Fetch MSQ Assessment data if requested
    if (options.sections.msqAssessment) {
      try {
        // First, get external_user_id from survey_user_mappings
        const { data: mapping, error: mappingError } = await supabase
          .from('survey_user_mappings')
          .select('external_user_id, first_name, last_name')
          .eq('lead_id', memberId)
          .maybeSingle();

        if (mappingError) {
          console.error('Error fetching user mapping for MSQ:', mappingError);
        } else if (mapping && mapping.external_user_id) {
          const externalUserId = mapping.external_user_id;
          
          // Fetch MSQ sessions
          const MSQ_FORM_ID = 3;
          const { data: sessions, error: sessionsError } = await supabase
            .from('survey_response_sessions')
            .select('session_id, completed_on')
            .eq('external_user_id', externalUserId)
            .eq('form_id', MSQ_FORM_ID)
            .order('completed_on', { ascending: true });

          if (sessionsError || !sessions || sessions.length === 0) {
            console.warn(`⚠️ No MSQ surveys found for external_user_id ${externalUserId}`);
          } else {
            const sessionIds = sessions.map(s => s.session_id);
            const latestSessionId = sessionIds[sessionIds.length - 1]; // Last session (most recent)
            
            // Fetch domain scores for ALL sessions (for trend calculation)
            const { data: allDomainScores, error: allDomainScoresError } = await supabase
              .from('survey_domain_scores')
              .select('session_id, domain_key, domain_total_score, severity_assessment')
              .in('session_id', sessionIds);

            if (!allDomainScoresError && allDomainScores && allDomainScores.length > 0) {
              // Fetch domain definitions
              const { data: domains, error: domainsError } = await supabase
                .from('survey_domains')
                .select('domain_key, domain_label')
                .eq('survey_code', 'MSQ')
                .order('domain_key');

              if (!domainsError && domains) {
                // Build MSQ assessment summary and domain cards
                const assessmentDates = sessions.map(s => s.completed_on);
                
                // Calculate total scores per session
                const allTotalScores = sessionIds.map(sessionId => {
                  const sessionDomains = allDomainScores.filter(ds => ds.session_id === sessionId);
                  return sessionDomains.reduce((sum, ds) => sum + parseFloat(String(ds.domain_total_score || 0)), 0);
                });

                // Calculate trend
                const calculateTrend = (scores: number[]): string => {
                  if (scores.length < 2) return 'no_data';
                  const first = scores[0];
                  const last = scores[scores.length - 1];
                  if (first === undefined || last === undefined) return 'no_data';
                  const change = last - first;
                  const pctChange = first > 0 ? Math.abs(change / first) * 100 : 0;
                  
                  if (change < 0 && pctChange >= 5) return 'improving';
                  if (change > 0 && pctChange >= 5) return 'declining';
                  return 'stable';
                };

                // Build domain cards using LATEST session data only
                const domainCards = domains.map(domain => {
                  // Get scores across all sessions for trend calculation
                  const allScoresForDomain = sessionIds.map(sessionId => {
                    const domainScore = allDomainScores.find(
                      ds => ds.session_id === sessionId && ds.domain_key === domain.domain_key
                    );
                    return domainScore ? parseFloat(String(domainScore.domain_total_score || 0)) : 0;
                  });
                  
                  // Get LATEST session's data for this domain
                  const latestDomainData = allDomainScores.find(
                    ds => ds.session_id === latestSessionId && ds.domain_key === domain.domain_key
                  );
                  
                  const latestScore = latestDomainData 
                    ? parseFloat(String(latestDomainData.domain_total_score || 0))
                    : 0;
                  const latestSeverity = latestDomainData?.severity_assessment || 'minimal';

                  return {
                    domain_key: domain.domain_key,
                    domain_label: domain.domain_label,
                    average_score: latestScore,
                    severity: latestSeverity,
                    trend: calculateTrend(allScoresForDomain),
                    symptoms: [], // Simplified - no individual symptoms for PDF
                  };
                });

                reportData.msqAssessment = {
                  summary: {
                    member_name: `${mapping.first_name} ${mapping.last_name}`,
                    assessment_dates: assessmentDates,
                    all_total_scores: allTotalScores,
                    total_score_trend: calculateTrend(allTotalScores),
                    active_symptoms_count: allDomainScores.filter(ds => parseFloat(String(ds.domain_total_score || 0)) > 0).length,
                  } as any,
                  domains: domainCards as any,
                };
              }
            }
          }
        } else {
          console.warn(`⚠️ No survey user mapping found for lead_id ${memberId}`);
        }
      } catch (error) {
        console.error('Error fetching MSQ assessment:', error);
        // Don't throw - just log and continue
      }
    }

    // Fetch PROMIS-29 Assessment data if requested
    // NOTE: This uses the same calculation logic as the dashboard API endpoint
    // to ensure data consistency
    if (options.sections.promisAssessment) {
      try {
        // First, get external_user_id from survey_user_mappings
        const { data: mapping, error: mappingError } = await supabase
          .from('survey_user_mappings')
          .select('external_user_id, first_name, last_name')
          .eq('lead_id', memberId)
          .maybeSingle();

        if (mappingError) {
          console.error('Error fetching user mapping for PROMIS:', mappingError);
        } else if (mapping && mapping.external_user_id) {
          const externalUserId = mapping.external_user_id;
          
          // Get all PROMIS survey sessions for this member (form_id = 6)
          const PROMIS_FORM_ID = 6;
          const { data: sessions, error: sessionsError } = await supabase
            .from('survey_response_sessions')
            .select('session_id, completed_on')
            .eq('external_user_id', externalUserId)
            .eq('form_id', PROMIS_FORM_ID)
            .order('completed_on', { ascending: true });

          if (sessionsError || !sessions || sessions.length === 0) {
            console.warn(`⚠️ No PROMIS surveys found for external_user_id ${externalUserId}`);
          } else {
            const sessionIds = sessions.map(s => s.session_id);
            const assessmentDates = sessions.map(s => s.completed_on);
            
            // Get ALL survey responses with question mapping
            const { data: responses, error: responsesError } = await supabase
              .from('survey_responses')
              .select('session_id, question_id, answer_numeric, survey_questions(question_text, question_order)')
              .in('session_id', sessionIds);

            if (responsesError || !responses) {
              console.error('Failed to fetch survey responses:', responsesError);
            } else {
              // Get question-domain mappings (PROMIS only)
              const questionIds = [...new Set(responses.map(r => r.question_id))];
              const { data: questionDomainMappings, error: mappingError } = await supabase
                .from('survey_form_question_domain')
                .select('question_id, domain_key, survey_domains!inner(survey_code)')
                .eq('survey_domains.survey_code', 'PROMIS')
                .in('question_id', questionIds);

              if (!mappingError && questionDomainMappings) {
                // Create question_id -> domain_key map
                const questionDomainMap = new Map<number, string>();
                questionDomainMappings.forEach(mapping => {
                  questionDomainMap.set(mapping.question_id, mapping.domain_key);
                });

                // Calculate raw scores and T-scores for each domain in each session
                const domainDataBySession = new Map<number, Map<string, { raw_score: number; t_score: number | null }>>();
                
                sessions.forEach((session, sessionIdx) => {
                  const sessionDomainData = new Map<string, { raw_score: number; t_score: number | null }>();
                  const domainScores = new Map<string, number[]>();
                  
                  // Group responses by domain for this session
                  responses.filter(r => r.session_id === session.session_id).forEach(response => {
                    const domainKey = questionDomainMap.get(response.question_id);
                    if (!domainKey) return;
                    
                    if (!domainScores.has(domainKey)) {
                      domainScores.set(domainKey, []);
                    }
                    domainScores.get(domainKey)!.push(response.answer_numeric || 0);
                  });
                  
                  // Calculate raw score and T-score for each domain
                  domainScores.forEach((scores, domainKey) => {
                    const rawScore = scores.reduce((sum, score) => sum + score, 0);
                    const tScore = domainKey === 'pain_intensity' ? null : convertToTScore(domainKey, rawScore);
                    sessionDomainData.set(domainKey, { raw_score: rawScore, t_score: tScore });
                  });
                  
                  domainDataBySession.set(session.session_id, sessionDomainData);
                });

                // Calculate mean T-scores for each session (excluding pain_intensity)
                const meanTScoresBySession = sessions.map(session => {
                  const sessionData = domainDataBySession.get(session.session_id);
                  if (!sessionData) return 50;
                  
                  const tScores: number[] = [];
                  sessionData.forEach((data, domain) => {
                    if (data.t_score !== null) {
                      tScores.push(data.t_score);
                    }
                  });
                  
                  return tScores.length > 0 
                    ? Number((tScores.reduce((sum, score) => sum + score, 0) / tScores.length).toFixed(1))
                    : 50;
                });

                // Get domain definitions
                const { data: domains, error: domainsError } = await supabase
                  .from('survey_domains')
                  .select('domain_key, domain_label')
                  .eq('survey_code', 'PROMIS')
                  .order('domain_key');

                if (!domainsError && domains) {
                  const domainCards = domains.map(domainDef => {
                    const domainKey = domainDef.domain_key;
                    
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
                    const currentRawScore = allRawScores[allRawScores.length - 1] || 0;
                    const currentTScore = allTScores[allTScores.length - 1] || null;
                    
                    // Calculate trend
                    const calculateTrend = (scores: (number | null)[]): string => {
                      if (scores.length < 2) return 'stable';
                      const validScores = scores.filter(s => s !== null) as number[];
                      if (validScores.length < 2) return 'stable';
                      
                      const first = validScores[0];
                      const last = validScores[validScores.length - 1];
                      if (first === undefined || last === undefined) return 'stable';
                      const change = last - first;
                      const threshold = domainKey === 'pain_intensity' ? 2 : 5;
                      
                      const isDomainSymptom = !['physical_function', 'social_roles'].includes(domainKey);
                      if (isDomainSymptom) {
                        if (change <= -threshold) return 'improving';
                        if (change >= threshold) return 'worsening';
                      } else {
                        if (change >= threshold) return 'improving';
                        if (change <= -threshold) return 'worsening';
                      }
                      return 'stable';
                    };
                    
                    const trendScores = domainKey === 'pain_intensity' ? allRawScores : allTScores;
                    const trend = calculateTrend(trendScores);
                    
                    // Calculate severity (simplified from API endpoint logic)
                    let severity = 'within_normal';
                    if (domainKey === 'pain_intensity') {
                      if (currentRawScore === 0) severity = 'within_normal';
                      else if (currentRawScore <= 3) severity = 'mild';
                      else if (currentRawScore <= 6) severity = 'moderate';
                      else if (currentRawScore <= 9) severity = 'severe';
                      else severity = 'very_severe';
                    } else if (currentTScore !== null) {
                      const isDomainSymptom = !['physical_function', 'social_roles'].includes(domainKey);
                      if (isDomainSymptom) {
                        if (currentTScore < 45) severity = 'within_normal';
                        else if (currentTScore < 55) severity = 'mild';
                        else if (currentTScore < 65) severity = 'moderate';
                        else if (currentTScore < 75) severity = 'severe';
                        else severity = 'very_severe';
                      } else {
                        if (currentTScore >= 55) severity = 'within_normal';
                        else if (currentTScore >= 45) severity = 'mild_limitation';
                        else if (currentTScore >= 35) severity = 'moderate_limitation';
                        else if (currentTScore >= 25) severity = 'severe_limitation';
                        else severity = 'very_severe_limitation';
                      }
                    }
                    
                    return {
                      domain_key: domainKey,
                      domain_label: domainDef.domain_label,
                      current_score: domainKey === 'pain_intensity' ? currentRawScore : (currentTScore || 0),
                      severity,
                      trend,
                      all_scores: domainKey === 'pain_intensity' ? allRawScores : allTScores,
                    };
                  });

                  const currentMeanTScore = meanTScoresBySession[meanTScoresBySession.length - 1] || 50;
                  const calculateOverallTrend = (scores: number[]): string => {
                    if (scores.length < 2) return 'stable';
                    const first = scores[0];
                    const last = scores[scores.length - 1];
                    if (first === undefined || last === undefined) return 'stable';
                    const change = last - first;
                    if (change <= -5) return 'improving';
                    if (change >= 5) return 'worsening';
                    return 'stable';
                  };
                  
                  // Sort domains alphabetically
                  const sortedDomainCards = sortPromisDomains(domainCards);
                  
                  reportData.promisAssessment = {
                    summary: {
                      member_name: `${mapping.first_name} ${mapping.last_name}`,
                      assessment_dates: assessmentDates,
                      all_mean_t_scores: meanTScoresBySession,
                      current_mean_t_score: currentMeanTScore,
                      total_score_trend: calculateOverallTrend(meanTScoresBySession),
                      worsening_domains_count: domainCards.filter(d => d.trend === 'worsening').length,
                      improving_domains_count: domainCards.filter(d => d.trend === 'improving').length,
                    },
                    domains: sortedDomainCards,
                  };
                }
              }
            }
          }
        } else {
          console.warn(`⚠️ No survey user mapping found for lead_id ${memberId}`);
        }
      } catch (error) {
        console.error('Error fetching PROMIS assessment:', error);
        // Don't throw - just log and continue
      }
    }

    return reportData;
  } catch (error) {
    console.error('Error fetching report card data:', error);
    throw error;
  }
}

