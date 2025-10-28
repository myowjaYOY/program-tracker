// Member Progress Analysis Edge Function
// Standalone analysis function that can re-analyze member dashboards on-demand
// Decoupled from import function to enable flexible re-analysis without new imports

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

interface AnalysisRequest {
  mode: 'all' | 'specific' | 'batch';
  lead_ids?: number[];
  import_batch_id?: number;
}

interface AnalysisResult {
  success: boolean;
  analyzed_count: number;
  failed_count: number;
  duration_seconds: number;
  errors: string[];
}

/**
 * Fallback module sequence used when database lookup fails
 * Corresponds to the standard 4 Month AIP Program (program_id = 2)
 */
const FALLBACK_MODULE_SEQUENCE = [
  'MODULE 1 - PRE-PROGRAM',
  'MODULE 2 - WEEK 1',
  'MODULE 3 - WEEK 2',
  'MODULE 4 - START OF DETOX',
  'MODULE 5 - WEEK 4',
  'MODULE 6 - MID-DETOX',
  'MODULE 7 - END OF DETOX',
  'MODULE 8 - END OF MONTH 2',
  'MODULE 9 - START OF MONTH 3',
  'MODULE 10 - MID-MONTH 3',
  'MODULE 11 - END OF MONTH 3',
  'MODULE 12 - START OF MONTH 4',
  'MODULE 13 - MID-MONTH 4'
];

/**
 * Main handler for analysis requests
 */
Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startTime = Date.now();
    const requestBody: AnalysisRequest = await req.json();
    const { mode, lead_ids, import_batch_id } = requestBody;

    console.log(`Starting analysis in mode: ${mode}`);

    let leadIdsToAnalyze: number[] = [];

    // Determine which members to analyze based on mode
    switch (mode) {
      case 'all':
        // Analyze all members with survey mappings
        const { data: allMappings, error: allMappingsError } = await supabase
          .from('survey_user_mappings')
          .select('lead_id');

        if (allMappingsError) {
          throw new Error(`Failed to fetch members: ${allMappingsError.message}`);
        }

        leadIdsToAnalyze = [...new Set(allMappings.map((m: any) => m.lead_id))];
        console.log(`Mode: all - Found ${leadIdsToAnalyze.length} members to analyze`);
        break;

      case 'specific':
        if (!lead_ids || lead_ids.length === 0) {
          return new Response(
            JSON.stringify({ error: 'lead_ids required for specific mode' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        leadIdsToAnalyze = lead_ids;
        console.log(`Mode: specific - Analyzing ${leadIdsToAnalyze.length} specified members`);
        break;

      case 'batch':
        if (!import_batch_id) {
          return new Response(
            JSON.stringify({ error: 'import_batch_id required for batch mode' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Get lead_ids from this import batch
        const { data: batchSessions, error: batchError } = await supabase
          .from('survey_response_sessions')
          .select('lead_id')
          .eq('import_batch_id', import_batch_id);

        if (batchError) {
          throw new Error(`Failed to fetch batch sessions: ${batchError.message}`);
        }

        leadIdsToAnalyze = [...new Set(batchSessions.map((s: any) => s.lead_id))];
        console.log(`Mode: batch (job ${import_batch_id}) - Found ${leadIdsToAnalyze.length} members to analyze`);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid mode. Must be: all, specific, or batch' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Analyze each member
    const errors: string[] = [];
    let analyzedCount = 0;
    let failedCount = 0;

    // Create cache for module sequences by program_id
    const moduleSequenceCache = new Map<number, string[]>();

    // Process members in controlled parallel batches to avoid timeouts and rate limits
    const BATCH_SIZE = 30; // Process 30 members at a time (optimized for scale up to 200+ members)
    const totalBatches = Math.ceil(leadIdsToAnalyze.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, leadIdsToAnalyze.length);
      const batch = leadIdsToAnalyze.slice(batchStart, batchEnd);
      
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} members)...`);

      // Process this batch in parallel
      const batchPromises = batch.map(async (leadId) => {
        try {
          console.log(`  → Analyzing lead ${leadId}...`);
          const metrics = await calculateMemberMetrics(supabase, leadId, moduleSequenceCache);

          // Upsert to member_progress_summary
          const { error: upsertError } = await supabase
            .from('member_progress_summary')
            .upsert({
              lead_id: leadId,
              ...metrics,
              calculated_at: new Date().toISOString(),
              last_import_batch_id: import_batch_id || null
            }, {
              onConflict: 'lead_id'
            });

          if (upsertError) {
            console.error(`  ✗ Failed to upsert dashboard for lead ${leadId}:`, upsertError);
            return { leadId, success: false, error: upsertError.message };
          } else {
            console.log(`  ✓ Successfully analyzed lead ${leadId}`);
            return { leadId, success: true };
          }
        } catch (memberError: any) {
          console.error(`  ✗ Error analyzing lead ${leadId}:`, memberError);
          return { leadId, success: false, error: memberError.message || 'Unknown error' };
        }
      });

      // Wait for all members in this batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Aggregate results
      for (const result of batchResults) {
        if (result.success) {
          analyzedCount++;
        } else {
          failedCount++;
          errors.push(`Lead ${result.leadId}: ${result.error}`);
        }
      }

      console.log(`✓ Batch ${batchIndex + 1}/${totalBatches} complete: ${batchResults.filter(r => r.success).length} succeeded, ${batchResults.filter(r => !r.success).length} failed`);
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Analysis complete: ${analyzedCount} succeeded, ${failedCount} failed, ${durationSeconds}s`);

    const result: AnalysisResult = {
      success: failedCount === 0,
      analyzed_count: analyzedCount,
      failed_count: failedCount,
      duration_seconds: parseFloat(durationSeconds),
      errors: errors
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error: any) {
    console.error('Fatal error in analysis function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

/**
 * Get module sequence from database for a specific program
 * Returns the ordered list of module names from the survey_modules table
 * 
 * @param supabase - Supabase client
 * @param programId - Program ID to fetch modules for
 * @returns Array of module names in order
 */
async function getModuleSequence(supabase: any, programId: number): Promise<string[]> {
  try {
    const { data: modules, error } = await supabase
      .from('survey_modules')
      .select('module_name, module_order')
      .eq('program_id', programId)
      .eq('active_flag', true);

    if (error) {
      console.error(`Error fetching module sequence for program ${programId}:`, error);
      return FALLBACK_MODULE_SEQUENCE;
    }

    if (!modules || modules.length === 0) {
      console.warn(`No modules found for program ${programId}, using fallback`);
      return FALLBACK_MODULE_SEQUENCE;
    }

    // If module_order is populated, sort by it
    if (modules[0]?.module_order !== null && modules[0]?.module_order !== undefined) {
      const sorted = modules.sort((a, b) => (a.module_order || 0) - (b.module_order || 0));
      return sorted.map(m => m.module_name);
    }

    // If module_order is null, extract number from "MODULE X - ..." pattern and sort
    const sorted = modules.sort((a, b) => {
      const aMatch = a.module_name.match(/MODULE (\d+)/);
      const bMatch = b.module_name.match(/MODULE (\d+)/);
      const aNum = aMatch ? parseInt(aMatch[1]) : 9999;
      const bNum = bMatch ? parseInt(bMatch[1]) : 9999;
      return aNum - bNum;
    });

    const sequence = sorted.map(m => m.module_name);
    console.log(`Loaded ${sequence.length} modules for program ${programId}`);
    return sequence;
  } catch (error) {
    console.error(`Exception fetching module sequence for program ${programId}:`, error);
    return FALLBACK_MODULE_SEQUENCE;
  }
}

/**
 * Calculate all dashboard metrics for a specific member
 * 
 * @param supabase - Supabase client
 * @param leadId - Lead ID to calculate metrics for
 * @param moduleSequenceCache - Cache of module sequences by program_id (to avoid repeated DB queries)
 */
async function calculateMemberMetrics(supabase: any, leadId: number, moduleSequenceCache: Map<number, string[]>) {
  console.log(`Calculating metrics for lead ${leadId}...`);

  // Get external_user_id and mapping_id from survey_user_mappings
  const { data: mapping, error: mappingError } = await supabase
    .from('survey_user_mappings')
    .select('external_user_id, mapping_id')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (mappingError || !mapping) {
    console.log(`No survey mapping found for lead ${leadId}`);
    return getDefaultMetrics();
  }

  const externalUserId = mapping.external_user_id;

  // Get member program info for days_in_program
  const { data: program, error: programError } = await supabase
    .from('member_programs')
    .select('start_date, duration, program_name')
    .eq('lead_id', leadId)
    .eq('active_flag', true)
    .maybeSingle();

  let daysInProgram: number | null = null;
  console.log(`[DAYS_IN_PROGRAM DEBUG] Lead ${leadId}: programError=${!!programError}, program=${!!program}, start_date=${program?.start_date}`);
  
  if (programError) {
    console.error(`Error fetching program for lead ${leadId}:`, programError);
  } else if (!program) {
    console.warn(`No active program found for lead ${leadId}`);
  } else if (!program.start_date) {
    console.warn(`Program found for lead ${leadId} but no start_date:`, JSON.stringify(program));
  } else {
    const startDate = new Date(program.start_date);
    const today = new Date();
    daysInProgram = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`[DAYS_IN_PROGRAM SUCCESS] Lead ${leadId}: start_date=${program.start_date}, days_in_program=${daysInProgram}, type=${typeof daysInProgram}`);
  }
  
  console.log(`[DAYS_IN_PROGRAM FINAL] Lead ${leadId}: daysInProgram=${daysInProgram} (will be saved to DB)`);

  // Get curriculum progress from survey_user_progress (via mapping_id)
  // Also get program_id to fetch the correct module sequence for this member
  const { data: userProgress, error: progressError } = await supabase
    .from('survey_user_progress')
    .select('program_id, status, last_completed, working_on, date_of_last_completed')
    .eq('mapping_id', mapping.mapping_id)
    .maybeSingle();

  // Get or fetch module sequence for this member's program
  let moduleSequence: string[] = FALLBACK_MODULE_SEQUENCE; // Default
  let programId = 2; // Default to 4 Month AIP Program
  
  if (userProgress && userProgress.program_id) {
    programId = userProgress.program_id;
    
    // Check cache first
    if (moduleSequenceCache.has(programId)) {
      moduleSequence = moduleSequenceCache.get(programId)!;
      console.log(`Using cached module sequence for program ${programId}`);
    } else {
      // Fetch from database and cache it
      console.log(`Fetching module sequence for program ${programId}...`);
      moduleSequence = await getModuleSequence(supabase, programId);
      moduleSequenceCache.set(programId, moduleSequence);
      console.log(`Cached module sequence for program ${programId} (${moduleSequence.length} modules)`);
    }
  } else {
    console.warn(`No program_id found for lead ${leadId}, using fallback sequence`);
  }

  // Get all surveys for this member (excluding MSQ and PROMIS for now)
  const { data: allSessions, error: sessionsError } = await supabase
    .from('survey_response_sessions')
    .select('session_id, form_id, completed_on, survey_forms!inner(form_name)')
    .eq('external_user_id', externalUserId)
    .not('form_id', 'in', '(3,6)') // Exclude MSQ and PROMIS for now
    .order('completed_on', { ascending: true });

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    return getDefaultMetrics();
  }

  if (!allSessions || allSessions.length === 0) {
    console.log(`No surveys found for lead ${leadId}`);
    return getDefaultMetrics();
  }

  const sessionIds = allSessions.map(s => s.session_id);

  // Get all responses for these sessions
  const { data: responses, error: responsesError} = await supabase
    .from('survey_responses')
    .select('session_id, question_id, answer_text, answer_numeric, survey_questions!inner(question_text)')
    .in('session_id', sessionIds);

  if (responsesError) {
    console.error('Error fetching responses:', responsesError);
    return getDefaultMetrics();
  }

  // Calculate health vitals
  const healthVitals = calculateHealthVitals(allSessions, responses);
  
  // Calculate compliance metrics (with target for exercise)
  const compliance = calculateCompliance(allSessions, responses);
  
  // Extract alerts (wins and concerns) - using GPT for sentiment analysis
  const alerts = await extractAlerts(allSessions, responses, leadId);
  
  // Calculate timeline progress using survey_user_progress
  const timeline = calculateTimelineProgress(userProgress, allSessions, moduleSequence);
  
  // Get goals from "Goals & Whys" survey
  const goals = await extractGoals(supabase, externalUserId);
  
  // Extract weight tracking with session dates for chronological sorting
  const weight = extractWeightData(allSessions, responses);
  
  // Calculate status indicator
  const statusIndicator = calculateStatusIndicator(healthVitals, compliance, alerts, userProgress);

  return {
    // Profile
    last_survey_date: allSessions[allSessions.length - 1]?.completed_on || null,
    last_survey_name: (allSessions[allSessions.length - 1]?.survey_forms as any)?.form_name || null,
    total_surveys_completed: allSessions.length,
    days_in_program: daysInProgram,
    status_indicator: statusIndicator,
    
    // Health vitals
    ...healthVitals,
    
    // Compliance
    ...compliance,
    
    // Alerts
    latest_wins: JSON.stringify(alerts.wins),
    latest_concerns: JSON.stringify(alerts.concerns),
    
    // Timeline
    module_sequence: JSON.stringify(moduleSequence), // Full module list for member's program
    ...timeline,
    
    // Goals
    goals: JSON.stringify(goals),
    
    // Weight
    current_weight: weight.current,
    weight_change: weight.change
  };
}

/**
 * Calculate health vitals (energy, mood, motivation, wellbeing, sleep)
 */
function calculateHealthVitals(sessions: any[], responses: any[]) {
  const metrics = {
    energy: { scores: [] as number[], trend: 'no_data' as string },
    mood: { scores: [] as number[], trend: 'no_data' as string },
    motivation: { scores: [] as number[], trend: 'no_data' as string },
    wellbeing: { scores: [] as number[], trend: 'no_data' as string },
    sleep: { scores: [] as number[], trend: 'no_data' as string }
  };

  // Map question patterns to metrics
  const questionPatterns = {
    energy: ['rate your energy', 'energy level'],
    mood: ['rate your mood', 'mood /'],
    motivation: ['rate your motivation', 'motivation level'],
    wellbeing: ['rate your wellbeing', 'general wellbeing'],
    sleep: ['rate your sleep', 'sleep quality']
  };

  // Group responses by session
  const sessionMap = new Map<number, any[]>();
  for (const response of responses) {
    if (!sessionMap.has(response.session_id)) {
      sessionMap.set(response.session_id, []);
    }
    sessionMap.get(response.session_id)!.push(response);
  }

  // Extract scores for each session
  for (const session of sessions) {
    const sessionResponses = sessionMap.get(session.session_id) || [];
    
    for (const [metric, patterns] of Object.entries(questionPatterns)) {
      for (const response of sessionResponses) {
        const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
        
        // Check if this question matches the metric pattern
        if (patterns.some(pattern => questionText.includes(pattern))) {
          const score = response.answer_numeric;
          if (score !== null && score !== undefined) {
            metrics[metric as keyof typeof metrics].scores.push(Number(score));
          }
          break; // Found the question for this metric in this session
        }
      }
    }
  }

  // Calculate trends and prepare output
  const result: any = {};
  for (const [metric, data] of Object.entries(metrics)) {
    if (data.scores.length > 0) {
      const currentScore = data.scores[data.scores.length - 1];
      const trend = data.scores.length >= 2 
        ? calculateTrend(data.scores[data.scores.length - 2], currentScore)
        : 'stable';
      
      result[`${metric}_score`] = currentScore;
      result[`${metric}_trend`] = trend;
      result[`${metric}_sparkline`] = JSON.stringify(data.scores.slice(-10)); // Last 10 scores
    } else {
      result[`${metric}_score`] = null;
      result[`${metric}_trend`] = 'no_data';
      result[`${metric}_sparkline`] = JSON.stringify([]);
    }
  }

  return result;
}

/**
 * Calculate compliance metrics
 */
function calculateCompliance(sessions: any[], responses: any[]) {
  const compliance = {
    nutrition: { yes: 0, total: 0 },
    supplements: { yes: 0, total: 0 },
    exercise: { days: [] as number[] },
    meditation: { yes: 0, total: 0 }
  };

  // Group responses by session
  const sessionMap = new Map<number, any[]>();
  for (const response of responses) {
    if (!sessionMap.has(response.session_id)) {
      sessionMap.set(response.session_id, []);
    }
    sessionMap.get(response.session_id)!.push(response);
  }

  // Extract compliance data
  for (const session of sessions) {
    const sessionResponses = sessionMap.get(session.session_id) || [];
    
    for (const response of sessionResponses) {
      const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
      const answer = response.answer_text?.toLowerCase() || '';

      // Nutrition compliance
      if (questionText.includes('following the nutritional plan') || 
          questionText.includes('followed the nutritional plan')) {
        compliance.nutrition.total++;
        if (answer === 'yes') compliance.nutrition.yes++;
      }

      // Supplements compliance
      if (questionText.includes('taken your supplements') || 
          questionText.includes('taking supplements as prescribed')) {
        compliance.supplements.total++;
        if (answer === 'yes') compliance.supplements.yes++;
      }

      // Exercise days per week
      if (questionText.includes('how many days per week do you exercise')) {
        const days = response.answer_numeric;
        if (days !== null && days !== undefined) {
          compliance.exercise.days.push(Number(days));
        }
      }

      // Meditation compliance
      if (questionText.includes('abdominal breathing') || 
          questionText.includes('meditation')) {
        compliance.meditation.total++;
        if (answer === 'yes' || answer === 'daily') compliance.meditation.yes++;
      }
    }
  }

  // Calculate percentages
  const exerciseTarget = 5; // Standard target: 5 days per week
  const latestExerciseDays = compliance.exercise.days.length > 0 
    ? compliance.exercise.days[compliance.exercise.days.length - 1] 
    : null;
  
  return {
    nutrition_compliance_pct: compliance.nutrition.total > 0 
      ? Math.round((compliance.nutrition.yes / compliance.nutrition.total) * 100) 
      : null,
    nutrition_streak: compliance.nutrition.yes, // Simplified for now
    supplements_compliance_pct: compliance.supplements.total > 0 
      ? Math.round((compliance.supplements.yes / compliance.supplements.total) * 100) 
      : null,
    exercise_compliance_pct: latestExerciseDays !== null
      ? Math.round((latestExerciseDays / exerciseTarget) * 100)
      : null,
    exercise_days_per_week: latestExerciseDays,
    meditation_compliance_pct: compliance.meditation.total > 0 
      ? Math.round((compliance.meditation.yes / compliance.meditation.total) * 100) 
      : null
  };
}

/**
 * Extract wins and challenges using GPT-4o-mini for accurate sentiment analysis
 * 
 * IMPORTANT: Uses OpenAI to analyze sentiment of answers with full context awareness:
 * - Understands negation ("isn't hurting" = positive, "hurting" = negative)
 * - Handles mixed sentiment (can split into both wins AND challenges)
 * - Context-aware (considers question + answer together)
 * - All feedback is captured (nothing disappears)
 * 
 * Returns last 10 wins and last 10 challenges, newest first.
 * 
 * NOTE: Falls back to basic keyword analysis if GPT fails.
 */
async function extractAlerts(sessions: any[], responses: any[], leadId: number) {
  try {
    // Check for OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.warn(`[Lead ${leadId}] OPENAI_API_KEY not set, using fallback sentiment analysis`);
      return extractAlertsFallback(sessions, responses);
    }

    // Group responses by session
    const sessionMap = new Map<number, any[]>();
    for (const response of responses) {
      if (!sessionMap.has(response.session_id)) {
        sessionMap.set(response.session_id, []);
      }
      sessionMap.get(response.session_id)!.push(response);
    }

    // Extract from recent sessions (last 10 to give GPT enough context)
    const recentSessions = sessions.slice(-10);

    // Build Q&A pairs for GPT
    const surveyData: any[] = [];
    for (const session of recentSessions) {
      const sessionResponses = sessionMap.get(session.session_id) || [];
      const qaList: any[] = [];
      
      for (const response of sessionResponses) {
        const questionText = (response.survey_questions as any)?.question_text || '';
        const answer = response.answer_text || '';

        // Skip empty, very short, or placeholder answers
        if (!answer || answer.length < 5 || 
            answer.toLowerCase() === 'none' || answer.toLowerCase() === 'n/a' || 
            answer.toLowerCase() === 'no' || answer.toLowerCase() === 'yes') {
          continue;
        }

        // Skip pure numeric answers
        if (/^\d+$/.test(answer.trim())) {
          continue;
        }

        // Skip if question is asking for numeric data (weight, days, ratings)
        const questionLower = questionText.toLowerCase();
        if (questionLower.includes('how many') || questionLower.includes('your weight') ||
            questionLower.includes('rate') || questionLower.includes('scale of')) {
          continue;
        }

        qaList.push({
          question: questionText,
          answer: answer
        });
      }

      if (qaList.length > 0) {
        surveyData.push({
          date: session.completed_on,
          responses: qaList
        });
      }
    }

    // If no meaningful data, return empty
    if (surveyData.length === 0) {
      console.log(`[Lead ${leadId}] No meaningful survey responses for sentiment analysis`);
      return { wins: [], concerns: [] };
    }

    // Build GPT prompt
    const prompt = `Analyze these survey responses and identify wins (positive progress) and challenges (concerns/struggles).

Survey responses:
${JSON.stringify(surveyData, null, 2)}

Instructions:
- Analyze each answer's sentiment considering the question context
- Handle negation correctly (e.g., "not hurting" = positive, "hurting" = negative)
- Split mixed sentiment into separate wins AND challenges (e.g., "better sleep but worse pain" → 1 win + 1 challenge)
- Skip meaningless responses like "I can't think of any", "None", lists of symptoms without context
- Keep messages concise and clear (< 150 characters)
- Return the LAST 10 WINS and LAST 10 CHALLENGES maximum, newest first

Return JSON in this exact format:
{
  "wins": [
    {"date": "2024-11-18T02:10:00+00:00", "message": "Brief description of the win"},
  ],
  "challenges": [
    {"date": "2024-11-18T02:10:00+00:00", "message": "Brief description of the challenge", "severity": "medium"}
  ]
}`;

    // Call OpenAI
    const openai = new OpenAI({ apiKey: openaiKey });
    
    console.log(`[Lead ${leadId}] Calling GPT for sentiment analysis (${surveyData.length} sessions)...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a health coach analyzing member survey responses to identify positive progress (wins) and concerns (challenges). Be accurate, context-aware, and handle negation properly.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.error(`[Lead ${leadId}] No response from OpenAI, using fallback`);
      return extractAlertsFallback(sessions, responses);
    }

    const aiResponse = JSON.parse(responseContent);
    
    console.log(`[Lead ${leadId}] GPT analysis complete: ${aiResponse.wins?.length || 0} wins, ${aiResponse.challenges?.length || 0} challenges`);

    return {
      wins: (aiResponse.wins || []).slice(0, 10), // Ensure max 10, already sorted by GPT
      concerns: (aiResponse.challenges || []).slice(0, 10) // Ensure max 10, already sorted by GPT
    };

  } catch (error: any) {
    console.error(`[Lead ${leadId}] Error in GPT sentiment analysis:`, error.message);
    console.log(`[Lead ${leadId}] Falling back to keyword-based analysis`);
    return extractAlertsFallback(sessions, responses);
  }
}

/**
 * Fallback: Basic keyword-based sentiment analysis
 * Used when OpenAI API is unavailable or fails
 */
function extractAlertsFallback(sessions: any[], responses: any[]) {
  const wins: any[] = [];
  const challenges: any[] = [];
  
  // Group responses by session
  const sessionMap = new Map<number, any[]>();
  for (const response of responses) {
    if (!sessionMap.has(response.session_id)) {
      sessionMap.set(response.session_id, []);
    }
    sessionMap.get(response.session_id)!.push(response);
  }

  // Extract from recent sessions (last 10)
  const recentSessions = sessions.slice(-10);

  // Define sentiment indicators
  const positiveIndicators = [
    'better', 'improved', 'improvement', 'great', 'excellent', 'amazing', 'fantastic',
    'wonderful', 'good', 'positive', 'progress', 'successful', 'success',
    'more energy', 'feeling better', 'less pain', 'decreased', 'reduction in',
    'sleeping better', 'happier', 'clearer', 'stronger', 'healthier',
    'motivated', 'confident', 'grateful', 'thankful', 'blessed',
    'weight loss', 'lost weight', 'inches lost', 'feeling great'
  ];

  const negativeIndicators = [
    'worse', 'worsened', 'getting worse', 'gotten worse', 'no improvement', 'not improved',
    'not better', 'no change', 'same', 'still', 'haven\'t', 'hasn\'t', 'didn\'t help',
    'don\'t feel', 'doesn\'t', 'failed', 'unfortunately', 'disappointed', 'frustrated',
    'difficult', 'struggling', 'struggle', 'pain', 'painful', 'hurt', 'hurting',
    'tired', 'exhausted', 'fatigue', 'anxious', 'anxiety', 'depressed', 'depression',
    'stressed', 'stress', 'overwhelmed', 'confused', 'concerned', 'worried', 'worry',
    'problem', 'issue', 'trouble', 'challenge', 'obstacle', 'setback',
    'however', 'but ', 'although', 'despite', 'unfortunately',
    'can\'t', 'cannot', 'unable', 'not able', 'no progress',
    'gaining weight', 'gained weight', 'weight gain', 'heavier'
  ];

  for (const session of recentSessions) {
    const sessionResponses = sessionMap.get(session.session_id) || [];
    
    for (const response of sessionResponses) {
      const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
      const answer = response.answer_text || '';
      const answerLower = answer.toLowerCase();

      // Skip empty, very short, or placeholder answers
      if (!answer || answer.length < 5 || 
          answerLower === 'none' || answerLower === 'n/a' || 
          answerLower === 'no' || answerLower === 'yes') {
        continue;
      }

      // Skip pure numeric answers or yes/no
      if (/^\d+$/.test(answer.trim()) || /^(yes|no)$/i.test(answer.trim())) {
        continue;
      }

      // Skip if question is asking for numeric data (weight, days, etc.)
      if (questionText.includes('how many') || questionText.includes('your weight') ||
          questionText.includes('rate') || questionText.includes('scale of')) {
        continue;
      }

      // Analyze answer sentiment
      const positiveCount = positiveIndicators.filter(indicator => 
        answerLower.includes(indicator)
      ).length;
      
      const negativeCount = negativeIndicators.filter(indicator => 
        answerLower.includes(indicator)
      ).length;

      // Classify based on sentiment score
      if (positiveCount > 0 || negativeCount > 0) {
        if (positiveCount > negativeCount) {
          // More positive sentiment → Win
          wins.push({
            date: session.completed_on,
            message: answer.substring(0, 150),
            type: 'positive_sentiment'
          });
        } else if (negativeCount > positiveCount) {
          // More negative sentiment → Challenge
          challenges.push({
            date: session.completed_on,
            message: answer.substring(0, 150),
            severity: 'medium'
          });
        } else {
          // Equal positive/negative (mixed sentiment) → Challenge (be cautious)
          challenges.push({
            date: session.completed_on,
            message: answer.substring(0, 150),
            severity: 'medium'
          });
        }
      }
    }
  }

  return {
    wins: wins.slice(-10).reverse(), // Keep last 10, newest first
    concerns: challenges.slice(-10).reverse() // Keep last 10, newest first
  };
}

/**
 * Calculate timeline progress using survey_user_progress table
 * 
 * IMPORTANT: 
 * - last_completed = last module they finished
 * - working_on = module they SHOULD BE on (not currently on)
 * - Overdue = all modules from (last_completed + 1) to working_on (INCLUSIVE of working_on)
 * 
 * @param userProgress - User progress data from survey_user_progress table
 * @param sessions - All survey sessions for this member
 * @param moduleSequence - Ordered array of module names from survey_modules table
 */
function calculateTimelineProgress(userProgress: any | null, sessions: any[], moduleSequence: string[]) {
  if (!userProgress || !userProgress.last_completed) {
    // Fallback: use session data
    const milestones = sessions.map(s => (s.survey_forms as any)?.form_name || 'Unknown');
    return {
      completed_milestones: JSON.stringify(milestones),
      next_milestone: null,
      overdue_milestones: JSON.stringify([])
    };
  }

  const lastCompleted = userProgress.last_completed;
  const workingOn = userProgress.working_on; // SHOULD BE on (not currently on)

  // Find position in module sequence
  const lastCompletedIndex = moduleSequence.indexOf(lastCompleted);
  const workingOnIndex = moduleSequence.indexOf(workingOn);

  // Warn if module not found (indicates bad data in survey_user_progress)
  if (lastCompletedIndex === -1) {
    console.warn(`[TIMELINE WARNING] Module not found in sequence: last_completed="${lastCompleted}" (available: ${moduleSequence.join(', ')})`);
  }
  if (workingOn !== 'Finished' && workingOnIndex === -1) {
    console.warn(`[TIMELINE WARNING] Module not found in sequence: working_on="${workingOn}"`);
  }

  // Completed milestones: all modules up to and including last_completed
  const completedMilestones = lastCompletedIndex >= 0 
    ? moduleSequence.slice(0, lastCompletedIndex + 1)
    : [];

  // Next milestone: always the module immediately after last_completed
  // ONLY show "Program Complete" if they've ACTUALLY completed all modules
  let nextMilestone: string | null = null;
  const allModulesActuallyCompleted = lastCompletedIndex >= 0 && lastCompletedIndex === moduleSequence.length - 1;
  
  if (allModulesActuallyCompleted) {
    nextMilestone = 'Program Complete';
  } else if (lastCompletedIndex >= 0 && lastCompletedIndex < moduleSequence.length - 1) {
    nextMilestone = moduleSequence[lastCompletedIndex + 1];
  }

  // Overdue milestones: ALL modules from (last_completed + 1) to working_on (INCLUSIVE)
  // SPECIAL CASE: If working_on = "Finished" but they haven't completed all modules,
  // then ALL remaining modules are overdue
  const overdueMilestones: string[] = [];
  
  if (workingOn === 'Finished' && !allModulesActuallyCompleted && lastCompletedIndex >= 0) {
    // They SHOULD be finished, but aren't → all remaining modules are overdue
    for (let i = lastCompletedIndex + 1; i < moduleSequence.length; i++) {
      overdueMilestones.push(moduleSequence[i]);
    }
  } else if (lastCompletedIndex >= 0 && workingOnIndex >= 0 && workingOnIndex > lastCompletedIndex) {
    // Normal case: modules between last_completed and working_on are overdue
    for (let i = lastCompletedIndex + 1; i <= workingOnIndex; i++) {
      if (i < moduleSequence.length) {
        overdueMilestones.push(moduleSequence[i]);
      }
    }
  }

  return {
    completed_milestones: JSON.stringify(completedMilestones),
    next_milestone: nextMilestone,
    overdue_milestones: JSON.stringify(overdueMilestones)
  };
}

/**
 * Extract weight tracking data from survey responses
 * Sorts by session date to ensure correct chronological order
 */
function extractWeightData(sessions: any[], responses: any[]) {
  const weightPattern = ['weight', 'current weight', 'body weight'];
  const weightData: Array<{ value: number; date: string; sessionId: number }> = [];

  // Create a map of session_id to completed_on date
  const sessionDateMap = new Map<number, string>();
  for (const session of sessions) {
    sessionDateMap.set(session.session_id, session.completed_on);
  }

  for (const response of responses) {
    const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
    
    // Check if this is a weight question (exclude MSQ "excessive weight" type questions)
    const isWeightQuestion = weightPattern.some(pattern => questionText.includes(pattern));
    const isActualWeight = questionText.includes('current weight') || questionText.includes('body weight');
    
    if (isWeightQuestion && isActualWeight) {
      const weight = response.answer_numeric;
      const sessionDate = sessionDateMap.get(response.session_id);
      
      if (weight !== null && weight !== undefined && weight > 0 && weight < 500 && sessionDate) {
        // Reasonable weight range filter
        weightData.push({ 
          value: Number(weight), 
          date: sessionDate,
          sessionId: response.session_id
        });
      }
    }
  }

  if (weightData.length === 0) {
    return { current: null, change: null };
  }

  // Sort by date chronologically (earliest to latest)
  weightData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const firstWeight = weightData[0].value;
  const currentWeight = weightData[weightData.length - 1].value;
  const weightChange = currentWeight - firstWeight;

  return {
    current: currentWeight,
    change: weightChange
  };
}

/**
 * Extract goals from "Goals & Whys" survey
 */
async function extractGoals(supabase: any, memberId: number) {
  const { data: goalSession, error } = await supabase
    .from('survey_response_sessions')
    .select(`
      session_id,
      survey_responses!inner(answer_text, survey_questions!inner(question_text))
    `)
    .eq('external_user_id', memberId)
    .eq('form_id', 2) // "Goals & Whys" survey
    .order('completed_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !goalSession) {
    return [];
  }

  const goals: any[] = [];
  const responses = goalSession.survey_responses || [];

  for (const response of responses) {
    const questionText = response.survey_questions?.question_text || '';
    const answer = response.answer_text || '';

    if (questionText.includes('SMART Goal') && answer && answer !== '' && answer.toLowerCase() !== 'n/a') {
      goals.push({
        goal_text: answer,
        status: 'on_track' // Default status
      });
    }
  }

  return goals;
}

/**
 * Calculate overall status indicator
 */
function calculateStatusIndicator(healthVitals: any, compliance: any, alerts: any, userProgress: any | null): string {
  // Red flags
  if (alerts.concerns.length >= 3) return 'red';
  if (compliance.nutrition_compliance_pct !== null && compliance.nutrition_compliance_pct < 40) return 'red';
  
  // Check for declining trends
  const decliningCount = Object.keys(healthVitals)
    .filter(key => key.includes('_trend'))
    .filter(key => healthVitals[key] === 'declining')
    .length;
  
  if (decliningCount >= 3) return 'red';
  
  // Check if behind on curriculum AND overdue > 14 days
  if (userProgress && userProgress.status === 'Behind' && userProgress.date_of_last_completed) {
    const lastCompletionDate = new Date(userProgress.date_of_last_completed);
    const today = new Date();
    const daysSinceLastSurvey = Math.floor((today.getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastSurvey > 14) return 'red';
  }
  
  // Yellow flags
  if (alerts.concerns.length >= 1) return 'yellow';
  if (compliance.nutrition_compliance_pct !== null && compliance.nutrition_compliance_pct < 70) return 'yellow';
  if (decliningCount >= 1) return 'yellow';
  if (userProgress && userProgress.status === 'Behind') return 'yellow';
  
  // Green - all good
  return 'green';
}

/**
 * Calculate trend based on previous and current scores
 */
function calculateTrend(previousScore: number, currentScore: number): string {
  const diff = currentScore - previousScore;
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

/**
 * Get default metrics when no data is available
 */
function getDefaultMetrics() {
  return {
    last_survey_date: null,
    last_survey_name: null,
    total_surveys_completed: 0,
    days_in_program: null,
    status_indicator: 'green',
    energy_score: null,
    energy_trend: 'no_data',
    energy_sparkline: JSON.stringify([]),
    mood_score: null,
    mood_trend: 'no_data',
    mood_sparkline: JSON.stringify([]),
    motivation_score: null,
    motivation_trend: 'no_data',
    motivation_sparkline: JSON.stringify([]),
    wellbeing_score: null,
    wellbeing_trend: 'no_data',
    wellbeing_sparkline: JSON.stringify([]),
    sleep_score: null,
    sleep_trend: 'no_data',
    sleep_sparkline: JSON.stringify([]),
    nutrition_compliance_pct: null,
    nutrition_streak: 0,
    supplements_compliance_pct: null,
    exercise_compliance_pct: null,
    exercise_days_per_week: null,
    meditation_compliance_pct: null,
    latest_wins: JSON.stringify([]),
    latest_concerns: JSON.stringify([]),
    module_sequence: JSON.stringify(FALLBACK_MODULE_SEQUENCE), // Use fallback when no data
    completed_milestones: JSON.stringify([]),
    next_milestone: null,
    overdue_milestones: JSON.stringify([]),
    goals: JSON.stringify([]),
    current_weight: null,
    weight_change: null
  };
}

