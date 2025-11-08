// Member Progress Analysis Edge Function
// Standalone analysis function that can re-analyze member dashboards on-demand
// Decoupled from import function to enable flexible re-analysis without new imports

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'npm:openai@4'

interface AnalysisRequest {
  mode: 'all' | 'specific' | 'batch';
  lead_ids?: number[];
  import_batch_id?: number;
  test_mode?: boolean; // If true, includes inactive programs (for testing)
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
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startTime = Date.now();
    const requestBody: AnalysisRequest = await req.json();
    const { mode, lead_ids, import_batch_id, test_mode = false } = requestBody;

    console.log(`Starting analysis in mode: ${mode}, test_mode: ${test_mode}`);

    let leadIdsToAnalyze: number[] = [];

    // Determine which members to analyze based on mode
    switch (mode) {
      case 'all':
        // Analyze members with survey mappings
        // PRODUCTION: Only active programs (program_status_id = 1)
        // TEST MODE: All programs including inactive
        
        if (test_mode) {
          console.log('⚠️ TEST MODE: Including inactive programs');
          
          // Get all members with survey mappings (regardless of program status)
          const { data: allMappings, error: allMappingsError } = await supabase
            .from('survey_user_mappings')
            .select('lead_id');

          if (allMappingsError) {
            throw new Error(`Failed to fetch members: ${allMappingsError.message}`);
          }

          leadIdsToAnalyze = [...new Set(allMappings.map((m: any) => m.lead_id))];
          console.log(`Mode: all (TEST) - Found ${leadIdsToAnalyze.length} members to analyze (includes inactive)`);
          
        } else {
          console.log('✅ PRODUCTION MODE: Active programs only');
          
          // Get only members with active programs
          const { data: activeMappings, error: activeMappingsError } = await supabase
            .from('survey_user_mappings')
            .select(`
              lead_id,
              leads!inner(
                member_programs!inner(
                  program_status_id
                )
              )
            `)
            .eq('leads.member_programs.program_status_id', 1); // Only active programs

          if (activeMappingsError) {
            throw new Error(`Failed to fetch active members: ${activeMappingsError.message}`);
          }

          // Extract unique lead_ids where active program exists
          leadIdsToAnalyze = [...new Set(activeMappings
            .filter((m: any) => m.leads?.member_programs?.length > 0)
            .map((m: any) => m.lead_id)
          )];
          
          console.log(`Mode: all (PRODUCTION) - Found ${leadIdsToAnalyze.length} members with active programs`);
        }
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

          // Calculate individual insights (NEW)
          const insights = await calculateIndividualInsights(supabase, leadId, metrics);

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
          }

          // Upsert to member_individual_insights (NEW)
          if (insights) {
            const { error: insightsError } = await supabase
              .from('member_individual_insights')
              .upsert({
                lead_id: leadId,
                ...insights,
                calculated_at: new Date().toISOString()
              }, {
                onConflict: 'lead_id'
              });

            if (insightsError) {
              console.error(`  ⚠️  Failed to upsert insights for lead ${leadId}:`, insightsError);
              // Don't fail the whole member analysis - just log the error
            }
          }

          console.log(`  ✓ Successfully analyzed lead ${leadId}`);
          return { leadId, success: true };
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
    .select('start_date, duration')
    .eq('lead_id', leadId)
    .eq('program_status_id', 1) // 1 = Active status
    .maybeSingle();

  let daysInProgram: number | null = null;
  let projectedEndDate: string | null = null;
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
    
    // Calculate projected end date (start_date + duration)
    if (program.duration) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + program.duration);
      projectedEndDate = endDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }
    
    console.log(`[DAYS_IN_PROGRAM SUCCESS] Lead ${leadId}: start_date=${program.start_date}, days_in_program=${daysInProgram}, projected_end_date=${projectedEndDate}, type=${typeof daysInProgram}`);
  }
  
  console.log(`[DAYS_IN_PROGRAM FINAL] Lead ${leadId}: daysInProgram=${daysInProgram}, projectedEndDate=${projectedEndDate} (will be saved to DB)`);

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

  // GPT CACHING LOGIC: Check if we need to re-run GPT analysis
  const currentSurveyCount = allSessions.length;
  
  const { data: existingSummary } = await supabase
    .from('member_progress_summary')
    .select('last_analyzed_session_count, latest_wins, latest_concerns, goals')
    .eq('lead_id', leadId)
    .maybeSingle();

  const lastAnalyzedCount = existingSummary?.last_analyzed_session_count || 0;
  const hasNewSurveys = currentSurveyCount > lastAnalyzedCount;

  console.log(`[Lead ${leadId}] 📊 Survey count: ${currentSurveyCount}, Last analyzed: ${lastAnalyzedCount}, Has new: ${hasNewSurveys ? '✅ YES' : '❌ NO'}`);

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
  
  // CONDITIONAL GPT ANALYSIS: Only run if new surveys exist
  let alerts;
  let goals;

  if (hasNewSurveys) {
    console.log(`[Lead ${leadId}] 🤖 Running GPT analysis (new surveys detected)...`);
    
    // Get initial goals from "Goals & Whys" survey
    const initialGoals = await extractInitialGoals(supabase, externalUserId);
    
    // Run GPT analysis for wins, challenges, AND goal tracking
    const gptResults = await extractAlertsAndGoals(allSessions, responses, initialGoals, leadId);
    
    if (gptResults.error) {
      console.error(`[Lead ${leadId}] ❌ GPT analysis failed: ${gptResults.error}`);
      alerts = { wins: [], concerns: [] };
      goals = [];
    } else {
      console.log(`[Lead ${leadId}] ✅ GPT analysis complete: ${gptResults.wins?.length || 0} wins, ${gptResults.concerns?.length || 0} challenges, ${gptResults.goals?.length || 0} goals`);
      alerts = { wins: gptResults.wins, concerns: gptResults.concerns };
      goals = gptResults.goals;
    }
    
  } else {
    console.log(`[Lead ${leadId}] ♻️ Reusing cached GPT results (no new surveys)`);
    
    // Reuse existing GPT results from cache
    alerts = {
      wins: existingSummary?.latest_wins ? JSON.parse(existingSummary.latest_wins) : [],
      concerns: existingSummary?.latest_concerns ? JSON.parse(existingSummary.latest_concerns) : []
    };
    goals = existingSummary?.goals ? JSON.parse(existingSummary.goals) : [];
  }
  
  // Calculate timeline progress using survey_user_progress
  const timeline = calculateTimelineProgress(userProgress, allSessions, moduleSequence);
  
  // Extract weight tracking with session dates for chronological sorting
  const weight = extractWeightData(allSessions, responses);
  
  // Calculate status indicator
  const statusResult = calculateStatusIndicator(
    healthVitals, 
    compliance, 
    alerts, 
    userProgress, 
    daysInProgram, 
    allSessions.length
  );

  return {
    // Profile
    last_survey_date: allSessions[allSessions.length - 1]?.completed_on || null,
    last_survey_name: (allSessions[allSessions.length - 1]?.survey_forms as any)?.form_name || null,
    total_surveys_completed: allSessions.length,
    days_in_program: daysInProgram,
    projected_end_date: projectedEndDate,
    status_indicator: statusResult.status,
    status_score: statusResult.score,
    
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
    
    // Goals (now with GPT tracking)
    goals: JSON.stringify(goals),
    
    // Weight
    current_weight: weight.current,
    weight_change: weight.change,
    
    // Cache tracking
    last_analyzed_session_count: currentSurveyCount
  };
}

/**
 * Calculate individual insights and comparative analytics
 * 
 * @param supabase - Supabase client
 * @param leadId - Lead ID
 * @param metrics - Member's calculated metrics (from calculateMemberMetrics)
 * @returns Individual insights object or null if insufficient data
 */
async function calculateIndividualInsights(
  supabase: any,
  leadId: number,
  metrics: any
) {
  console.log(`[Lead ${leadId}] 📊 Calculating individual insights...`);

  try {
    // ============================================================
    // 1. GET ALL MEMBERS FOR COMPARISON (not just active)
    // ============================================================
    const { data: allMembers, error: membersError } = await supabase
      .from('member_progress_summary')
      .select(`
        lead_id,
        status_score,
        nutrition_compliance_pct,
        supplements_compliance_pct,
        exercise_compliance_pct,
        meditation_compliance_pct,
        energy_score,
        mood_score,
        motivation_score,
        wellbeing_score,
        sleep_score
      `)
      .not('status_score', 'is', null);

    if (membersError || !allMembers || allMembers.length === 0) {
      console.error(`[Lead ${leadId}] ❌ Failed to fetch population data:`, membersError);
      return null; // Skip insights if no comparison data
    }

    console.log(`[Lead ${leadId}] Comparing against ${allMembers.length} members`);

    // ============================================================
    // 2. CALCULATE RANKING (Percentile & Quartile)
    // ============================================================
    const memberScore = metrics.status_score;
    const allScores = allMembers
      .map(m => m.status_score)
      .filter(s => s !== null)
      .sort((a, b) => b - a); // Descending (high = better)

    const rank = allScores.indexOf(memberScore) + 1;
    const percentile = Math.round(((allScores.length - rank + 1) / allScores.length) * 100);
    const quartile = Math.ceil((rank / allScores.length) * 4);

    console.log(`[Lead ${leadId}] Rank: ${rank}/${allScores.length}, Percentile: ${percentile}, Quartile: Q${quartile}`);

    // ============================================================
    // 3. CALCULATE POPULATION AVERAGES
    // ============================================================
    const avg = (values: number[]) => {
      const filtered = values.filter(v => v !== null && v !== undefined);
      return filtered.length > 0 ? filtered.reduce((sum, v) => sum + v, 0) / filtered.length : null;
    };

    const popAvg = {
      status_score: avg(allScores),
      nutrition: avg(allMembers.map(m => m.nutrition_compliance_pct)),
      supplements: avg(allMembers.map(m => m.supplements_compliance_pct)),
      exercise: avg(allMembers.map(m => m.exercise_compliance_pct)),
      meditation: avg(allMembers.map(m => m.meditation_compliance_pct)),
      energy: avg(allMembers.map(m => m.energy_score)),
      mood: avg(allMembers.map(m => m.mood_score)),
      motivation: avg(allMembers.map(m => m.motivation_score)),
      wellbeing: avg(allMembers.map(m => m.wellbeing_score)),
      sleep: avg(allMembers.map(m => m.sleep_score))
    };

    // ============================================================
    // 4. BUILD COMPLIANCE COMPARISON
    // ============================================================
    const complianceComparison = {
      overall: {
        member: memberScore,
        population_avg: Math.round(popAvg.status_score || 0),
        diff: memberScore - Math.round(popAvg.status_score || 0)
      },
      nutrition: {
        member: metrics.nutrition_compliance_pct || 0,
        population_avg: Math.round(popAvg.nutrition || 0),
        diff: (metrics.nutrition_compliance_pct || 0) - Math.round(popAvg.nutrition || 0)
      },
      supplements: {
        member: metrics.supplements_compliance_pct || 0,
        population_avg: Math.round(popAvg.supplements || 0),
        diff: (metrics.supplements_compliance_pct || 0) - Math.round(popAvg.supplements || 0)
      },
      exercise: {
        member: metrics.exercise_compliance_pct || 0,
        population_avg: Math.round(popAvg.exercise || 0),
        diff: (metrics.exercise_compliance_pct || 0) - Math.round(popAvg.exercise || 0)
      },
      meditation: {
        member: metrics.meditation_compliance_pct || 0,
        population_avg: Math.round(popAvg.meditation || 0),
        diff: (metrics.meditation_compliance_pct || 0) - Math.round(popAvg.meditation || 0)
      }
    };

    // ============================================================
    // 5. BUILD VITALS COMPARISON
    // ============================================================
    const vitalsComparison = {
      energy: {
        member_score: metrics.energy_score,
        member_trend: metrics.energy_trend,
        population_avg: popAvg.energy ? Number(popAvg.energy.toFixed(1)) : null
      },
      mood: {
        member_score: metrics.mood_score,
        member_trend: metrics.mood_trend,
        population_avg: popAvg.mood ? Number(popAvg.mood.toFixed(1)) : null
      },
      motivation: {
        member_score: metrics.motivation_score,
        member_trend: metrics.motivation_trend,
        population_avg: popAvg.motivation ? Number(popAvg.motivation.toFixed(1)) : null
      },
      wellbeing: {
        member_score: metrics.wellbeing_score,
        member_trend: metrics.wellbeing_trend,
        population_avg: popAvg.wellbeing ? Number(popAvg.wellbeing.toFixed(1)) : null
      },
      sleep: {
        member_score: metrics.sleep_score,
        member_trend: metrics.sleep_trend,
        population_avg: popAvg.sleep ? Number(popAvg.sleep.toFixed(1)) : null
      }
    };

    // ============================================================
    // 6. DETERMINE RISK FACTORS
    // ============================================================
    const riskFactors: string[] = [];
    
    // Compliance gaps (>15% below average)
    if (complianceComparison.nutrition.diff < -15) {
      riskFactors.push(`Nutrition ${Math.abs(complianceComparison.nutrition.diff)}% below average`);
    }
    if (complianceComparison.supplements.diff < -15) {
      riskFactors.push(`Supplements ${Math.abs(complianceComparison.supplements.diff)}% below average`);
    }
    if (complianceComparison.exercise.diff < -15) {
      riskFactors.push(`Exercise ${Math.abs(complianceComparison.exercise.diff)}% below average`);
    }
    if (complianceComparison.meditation.diff < -15) {
      riskFactors.push(`Meditation ${Math.abs(complianceComparison.meditation.diff)}% below average`);
    }

    // Curriculum issues
    const overdueModules = JSON.parse(metrics.overdue_milestones || '[]');
    if (overdueModules.length >= 2) {
      riskFactors.push(`${overdueModules.length} modules overdue`);
    }

    // Declining vitals
    if (metrics.energy_trend === 'declining' && metrics.energy_score && metrics.energy_score < 5) {
      riskFactors.push('Energy declining and low');
    }
    if (metrics.mood_trend === 'declining' && metrics.mood_score && metrics.mood_score < 5) {
      riskFactors.push('Mood declining and low');
    }

    // High challenge burden
    const concerns = JSON.parse(metrics.latest_concerns || '[]');
    const wins = JSON.parse(metrics.latest_wins || '[]');
    if (concerns.length >= 3 && wins.length === 0) {
      riskFactors.push('High challenge burden with no recent wins');
    }

    // ============================================================
    // 7. DETERMINE JOURNEY PATTERN (4 Quadrants)
    // ============================================================
    const complianceTier = memberScore >= 70 ? 'high' : (memberScore >= 40 ? 'medium' : 'low');
    const healthTrajectory = determineHealthTrajectory(metrics);
    const journeyPattern = mapToJourneyPattern(complianceTier, healthTrajectory);

    // ============================================================
    // 8. GENERATE AI RECOMMENDATIONS
    // ============================================================
    const aiRecommendations = await generateAIRecommendations(
      leadId,
      metrics,
      complianceComparison,
      vitalsComparison,
      riskFactors,
      journeyPattern
    );

    console.log(`[Lead ${leadId}] ✅ Individual insights calculated: Q${quartile}, ${riskFactors.length} risk factors, ${aiRecommendations.length} recommendations`);

    // ============================================================
    // 9. RETURN INSIGHTS OBJECT
    // ============================================================
    return {
      compliance_percentile: percentile,
      quartile: quartile,
      rank_in_population: rank,
      total_members_in_population: allScores.length,
      risk_level: metrics.status_indicator, // 'green', 'yellow', 'red'
      risk_score: memberScore,
      risk_factors: riskFactors,
      journey_pattern: journeyPattern.name,
      compliance_comparison: complianceComparison,
      vitals_comparison: vitalsComparison,
      outcomes_comparison: null, // TODO: Add MSQ/PROMIS comparison if needed
      ai_recommendations: aiRecommendations
    };

  } catch (error: any) {
    console.error(`[Lead ${leadId}] ❌ Error calculating individual insights:`, error.message);
    return null;
  }
}

/**
 * Determine overall health trajectory from vitals trends
 */
function determineHealthTrajectory(metrics: any): string {
  const vitals = ['energy', 'mood', 'motivation', 'wellbeing', 'sleep'];
  let improving = 0;
  let declining = 0;
  
  for (const vital of vitals) {
    const trend = metrics[`${vital}_trend`];
    if (trend === 'improving') improving++;
    if (trend === 'declining') declining++;
  }
  
  if (improving > declining) return 'improving';
  if (declining > improving) return 'worsening';
  return 'stable';
}

/**
 * Map compliance tier + health trajectory to journey pattern quadrant
 */
function mapToJourneyPattern(complianceTier: string, healthTrajectory: string) {
  if (complianceTier === 'low' && healthTrajectory === 'worsening') {
    return { name: 'high_priority', description: 'Low compliance + worsening health' };
  }
  if (complianceTier === 'high' && healthTrajectory === 'worsening') {
    return { name: 'clinical_attention', description: 'High compliance but not improving' };
  }
  if (complianceTier === 'low' && (healthTrajectory === 'improving' || healthTrajectory === 'stable')) {
    return { name: 'motivational_support', description: 'Low compliance but improving' };
  }
  return { name: 'success_stories', description: 'High compliance + improving health' };
}

/**
 * Generate AI-powered recommendations using GPT-4o-mini
 */
async function generateAIRecommendations(
  leadId: number,
  metrics: any,
  complianceComparison: any,
  vitalsComparison: any,
  riskFactors: string[],
  journeyPattern: any
) {
  try {
    // Check for OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.log(`[Lead ${leadId}] ⚠️  No OpenAI key - skipping AI recommendations`);
      return [];
    }

    // Build comprehensive prompt
    // Build compliance comparison with explicit ABOVE/BELOW indicators
    const formatComparison = (category: string, data: any) => {
      const diff = data.diff;
      const comparison = diff > 0 ? `${diff}% ABOVE average` : diff < 0 ? `${Math.abs(diff)}% BELOW average` : 'AT average';
      return `- ${category}: ${data.member}% (population avg: ${data.population_avg}%, difference: ${comparison})`;
    };

    const prompt = `Analyze this member's health program data and provide 3-5 specific, actionable recommendations for their care coordinator.

MEMBER PROFILE:
- Days in program: ${metrics.days_in_program || 'N/A'}
- Status score: ${metrics.status_score}/100
- Journey pattern: ${journeyPattern.description}

COMPLIANCE COMPARISON (member vs. population average):
${formatComparison('Overall', complianceComparison.overall)}
${formatComparison('Nutrition', complianceComparison.nutrition)}
${formatComparison('Supplements', complianceComparison.supplements)}
${formatComparison('Exercise', complianceComparison.exercise)}
${formatComparison('Meditation', complianceComparison.meditation)}

HEALTH VITALS:
${Object.entries(vitalsComparison).map(([vital, data]: [string, any]) => 
  `- ${vital}: ${data.member_score || 'N/A'} (trend: ${data.member_trend}, population avg: ${data.population_avg || 'N/A'})`
).join('\n')}

CURRICULUM:
- Overdue modules: ${JSON.parse(metrics.overdue_milestones || '[]').length}

RISK FACTORS:
${riskFactors.length > 0 ? riskFactors.map(f => `- ${f}`).join('\n') : '- None identified'}

PROGRAM INSIGHTS (from population data):
- High compliance (≥70%) members have 70-80% improvement rate
- Low compliance (<40%) members have 27-46% improvement rate
- Nutrition compliance is strongest predictor of success
- Members with ≥2 modules overdue have 40% lower completion rate

CRITICAL INSTRUCTIONS:
1. PAY ATTENTION: If a member is "X% ABOVE average", they are performing BETTER than average. If "X% BELOW average", they are performing WORSE.
2. Only recommend actions for areas that are significantly BELOW average (>15% gap) or declining
3. Prioritize by impact: high = urgent gaps, medium = moderate concerns, low = minor optimizations
4. Be mathematically accurate - if member is 17% and average is 15%, member is ABOVE average, not below
5. Reference specific numbers from the data provided

Return JSON array with 3-5 recommendations:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Brief title (< 50 chars)",
      "current_state": "What's happening now (be accurate with numbers)",
      "impact": "Why this matters (cite program data)",
      "action": "Specific next step for coordinator"
    }
  ]
}`;

    // Call OpenAI
    const openai = new OpenAI({ apiKey: openaiKey });
    
    console.log(`[Lead ${leadId}] 🤖 Calling GPT-4o-mini for recommendations...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a health program analyst providing evidence-based recommendations to care coordinators. Be specific, actionable, and cite program data. Return structured JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.error(`[Lead ${leadId}] ❌ No AI response`);
      return [];
    }

    const aiResponse = JSON.parse(responseContent);
    const recommendations = aiResponse.recommendations || [];
    
    console.log(`[Lead ${leadId}] ✅ AI generated ${recommendations.length} recommendations`);
    return recommendations;

  } catch (error: any) {
    console.error(`[Lead ${leadId}] ❌ AI recommendation failed:`, error.message);
    return [];
  }
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
 * Extract wins, challenges, AND evaluate goals using GPT-4o-mini
 * 
 * IMPORTANT: Uses OpenAI to analyze sentiment AND track goal progress:
 * - Wins/Challenges: Understands negation, handles mixed sentiment, context-aware
 * - Goals: Evaluates progress toward each goal based on survey data
 * 
 * Returns up to 6 wins, up to 6 challenges, and all goals with tracking status.
 * 
 * NOTE: Returns error object if GPT fails (no fallback analysis).
 */
async function extractAlertsAndGoals(
  sessions: any[], 
  responses: any[], 
  initialGoals: string[], 
  leadId: number
) {
  try {
    // Check for OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error(`[Lead ${leadId}] ❌ OPENAI_API_KEY not set - GPT analysis unavailable`);
      return { 
        wins: [], 
        concerns: [], 
        goals: [],
        error: 'GPT unavailable: API key not configured' 
      };
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
    if (surveyData.length === 0 && initialGoals.length === 0) {
      console.log(`[Lead ${leadId}] No meaningful survey responses for GPT analysis`);
      return { wins: [], concerns: [], goals: [] };
    }

    // Build GPT prompt with GOALS evaluation
    const prompt = `Analyze these survey responses and evaluate progress toward goals.

MEMBER'S GOALS (from initial survey):
${initialGoals.length > 0 ? JSON.stringify(initialGoals, null, 2) : 'No goals set'}

RECENT SURVEY RESPONSES:
${JSON.stringify(surveyData, null, 2)}

INSTRUCTIONS:
1. Identify WINS (positive progress, improvements, successes)
2. Identify CHALLENGES (concerns, struggles, setbacks)
3. Evaluate EACH GOAL:
   - Assess if member is making progress toward it based on survey data
   - Determine status: "on_track" (progressing well) | "at_risk" (struggling/off track) | "win" (achieved) | "insufficient_data" (not enough data)
   - Write brief progress summary (< 100 chars)

RULES:
- Handle negation correctly ("not hurting" = win, "hurting" = challenge)
- Split mixed sentiment into separate items ("better sleep but worse pain" → 1 win + 1 challenge)
- Skip meaningless responses like "I can't think of any", "None"
- Keep messages concise (< 150 chars)
- Return UP TO 6 WINS and UP TO 6 CHALLENGES maximum, newest first
- If fewer than 6 exist, return what you have (don't pad)

Return JSON in this exact format:
{
  "wins": [
    {"date": "2024-11-18T02:10:00+00:00", "message": "Brief description of win"}
  ],
  "challenges": [
    {"date": "2024-11-18T02:10:00+00:00", "message": "Brief description of challenge", "severity": "medium"}
  ],
  "goals": [
    {
      "goal_text": "Lose 10 lbs in 8 weeks",
      "status": "on_track",
      "progress_summary": "Lost 5 lbs in 4 weeks, trending well"
    },
    {
      "goal_text": "Reduce inflammation",
      "status": "at_risk",
      "progress_summary": "Still experiencing high inflammation levels"
    },
    {
      "goal_text": "Sleep 8 hours nightly",
      "status": "win",
      "progress_summary": "Consistently achieving 8+ hours of sleep"
    }
  ]
}`;

    // Call OpenAI
    const openai = new OpenAI({ apiKey: openaiKey });
    
    console.log(`[Lead ${leadId}] 🤖 Calling GPT-4o-mini for analysis (${surveyData.length} sessions, ${initialGoals.length} goals)...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a health coach analyzing member survey responses to identify wins, challenges, and evaluate goal progress. Be accurate, context-aware, and handle negation properly. Return structured JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 2000, // Increased for goals
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.error(`[Lead ${leadId}] ❌ No response from OpenAI`);
      return { 
        wins: [], 
        concerns: [], 
        goals: [],
        error: 'GPT returned empty response' 
      };
    }

    const aiResponse = JSON.parse(responseContent);
    
    console.log(`[Lead ${leadId}] ✅ GPT analysis complete: ${aiResponse.wins?.length || 0} wins, ${aiResponse.challenges?.length || 0} challenges, ${aiResponse.goals?.length || 0} goals`);

    return {
      wins: (aiResponse.wins || []).slice(0, 6), // Ensure max 6
      concerns: (aiResponse.challenges || []).slice(0, 6), // Ensure max 6
      goals: aiResponse.goals || [] // All goals with tracking
    };

  } catch (error: any) {
    console.error(`[Lead ${leadId}] ❌ GPT analysis failed:`, error.message);
    return { 
      wins: [], 
      concerns: [], 
      goals: [],
      error: `GPT analysis failed: ${error.message}` 
    };
  }
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

  // FIX: If last_completed module not in sequence, use session-based fallback
  // This handles cases like "[BONUS] HORMONE MODULE" which aren't in the standard sequence
  if (lastCompletedIndex === -1) {
    console.warn(`[TIMELINE] Module "${lastCompleted}" not found in sequence. Using session-based fallback. (Available: ${moduleSequence.join(', ')})`);
    const milestones = sessions.map(s => (s.survey_forms as any)?.form_name || 'Unknown');
    return {
      completed_milestones: JSON.stringify(milestones),
      next_milestone: null,
      overdue_milestones: JSON.stringify([])
    };
  }

  // Warn if working_on module not found (non-fatal)
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
 * Extract initial goals from "Goals & Whys" survey
 * Returns simple array of goal text strings (GPT will evaluate them)
 */
async function extractInitialGoals(supabase: any, memberId: number): Promise<string[]> {
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

  const goals: string[] = [];
  const responses = goalSession.survey_responses || [];

  for (const response of responses) {
    const questionText = response.survey_questions?.question_text || '';
    const answer = response.answer_text || '';

    if (questionText.includes('SMART Goal') && answer && answer !== '' && answer.toLowerCase() !== 'n/a') {
      goals.push(answer); // Just the goal text
    }
  }

  return goals;
}

/**
 * Calculate overall status indicator using weighted scoring system
 * 
 * NEW SCORING SYSTEM (100 points total):
 * - Protocol Compliance: 35 points (avg of 4 compliance metrics)
 * - Curriculum Progress: 35 points (On Track=100%, Behind=50%, Significantly Behind=0%)
 * - Wins: 5 points (has wins = 5, no wins = 0)
 * - Challenges: 5 points (has challenges = 5, no challenges = 0)
 * - Health Vitals: 20 points (5 metrics x 4 points each, based on trend)
 * 
 * Status Thresholds:
 * - Green: >= 70 points
 * - Yellow: >= 40 and < 70 points
 * - Red: < 40 points
 */
function calculateStatusIndicator(
  healthVitals: any, 
  compliance: any, 
  alerts: any, 
  userProgress: any | null,
  daysInProgram: number | null,
  totalSurveys: number
): { score: number; status: string } {
  let totalScore = 0;

  // ============================================================
  // 1. PROTOCOL COMPLIANCE (35 points max)
  // ============================================================
  const complianceMetrics = [
    compliance.nutrition_compliance_pct,
    compliance.supplements_compliance_pct,
    compliance.exercise_compliance_pct,
    compliance.meditation_compliance_pct
  ];
  
  // Filter out null values
  const validComplianceScores = complianceMetrics.filter(score => score !== null && score !== undefined);
  
  let complianceScore = 0;
  if (validComplianceScores.length > 0) {
    // Calculate average compliance percentage (0-100)
    const avgCompliance = validComplianceScores.reduce((sum, score) => sum + score, 0) / validComplianceScores.length;
    // Convert to points (35% weight)
    complianceScore = (avgCompliance / 100) * 35;
  }
  // If no compliance data, score = 0 (as per requirements: don't skip, score as 0)
  
  totalScore += complianceScore;
  console.log(`[Status Calc] Compliance: ${complianceScore.toFixed(2)}/35 (avg: ${validComplianceScores.length > 0 ? (complianceScore / 0.35).toFixed(1) : 0}%)`);

  // ============================================================
  // 2. CURRICULUM PROGRESS (35 points max)
  // ============================================================
  let curriculumScore = 0;
  
  if (userProgress && userProgress.status) {
    if (userProgress.status === 'On Track' || userProgress.status === 'Current' || userProgress.status === 'Finished') {
      curriculumScore = 35; // 100% of 35 points - up-to-date or completed
    } else if (userProgress.status === 'Behind') {
      curriculumScore = 17.5; // 50% of 35 points
    } else if (userProgress.status === 'Inactive') {
      curriculumScore = 0; // Inactive = 0 points
    }
    // Any other status = 0 points
  }
  // If no userProgress data, score = 0
  
  totalScore += curriculumScore;
  console.log(`[Status Calc] Curriculum: ${curriculumScore}/35 (status: ${userProgress?.status || 'N/A'})`);

  // ============================================================
  // 3. WINS (5 points max)
  // ============================================================
  const winsScore = (alerts.wins && alerts.wins.length > 0) ? 5 : 0;
  totalScore += winsScore;
  console.log(`[Status Calc] Wins: ${winsScore}/5 (count: ${alerts.wins?.length || 0})`);

  // ============================================================
  // 4. CHALLENGES (5 points max)
  // ============================================================
  const challengesScore = (alerts.concerns && alerts.concerns.length > 0) ? 5 : 0;
  totalScore += challengesScore;
  console.log(`[Status Calc] Challenges: ${challengesScore}/5 (count: ${alerts.concerns?.length || 0})`);

  // ============================================================
  // 5. HEALTH VITALS (20 points max: 5 metrics x 4 points each)
  // ============================================================
  const vitalMetrics = ['energy', 'mood', 'motivation', 'wellbeing', 'sleep'];
  let vitalsScore = 0;
  const vitalBreakdown: string[] = [];
  
  vitalMetrics.forEach(metric => {
    const trendKey = `${metric}_trend`;
    const trend = healthVitals[trendKey];
    
    let points = 0;
    if (trend === 'improving') {
      points = 4;
    } else if (trend === 'stable') {
      points = 2;
    } else if (trend === 'declining') {
      points = 0;
    } else {
      // 'no_data' or any other value = 0 points (as per requirements)
      points = 0;
    }
    
    vitalsScore += points;
    vitalBreakdown.push(`${metric}:${points}`);
  });
  
  totalScore += vitalsScore;
  console.log(`[Status Calc] Vitals: ${vitalsScore}/20 (${vitalBreakdown.join(', ')})`);

  // ============================================================
  // FINAL STATUS DETERMINATION
  // ============================================================
  const roundedScore = Math.round(totalScore);
  console.log(`[Status Calc] TOTAL SCORE: ${roundedScore}/100`);
  
  let status: string;
  if (totalScore >= 70) {
    console.log(`[Status Calc] Result: GREEN (>= 70)`);
    status = 'green';
  } else if (totalScore >= 40) {
    console.log(`[Status Calc] Result: YELLOW (40-69)`);
    status = 'yellow';
  } else {
    console.log(`[Status Calc] Result: RED (< 40)`);
    status = 'red';
  }
  
  return { score: roundedScore, status };
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
    status_score: 0,
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
    weight_change: null,
    last_analyzed_session_count: 0 // Cache tracking
  };
}

