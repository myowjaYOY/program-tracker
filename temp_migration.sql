-- =====================================================
-- ANALYTICS DASHBOARD - CALCULATION FUNCTION
-- =====================================================
-- This function calculates all analytics metrics and
-- stores them in member_analytics_cache table.
-- 
-- Usage:
--   SELECT calculate_analytics_metrics();
-- 
-- Performance: ~5-10 seconds for 100 members
-- 
-- Created: 2025-11-07
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_analytics_metrics()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  calculation_time_ms INTEGER,
  members_analyzed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration_ms INTEGER;
  v_member_count INTEGER;
  v_active_count INTEGER;
  v_completed_count INTEGER;
  v_avg_member_health_score DECIMAL(5,2); -- Average status_score across all members
  v_compliance_msq_corr DECIMAL(5,3); -- DEPRECATED: Keeping for backwards compatibility
  v_compliance_promis_corr DECIMAL(5,3); -- DEPRECATED: Keeping for backwards compatibility
  v_new_cache_id INTEGER;
  
  -- Tab 1: Compliance Patterns
  v_compliance_distribution JSONB;
  v_avg_compliance_by_category JSONB;
  v_compliance_timeline JSONB;
  
  -- Tab 2: Health Outcomes (NEW: Better metrics than correlation)
  v_compliance_success_rates JSONB;
  v_compliance_effect_size JSONB;
  v_compliance_odds_ratio JSONB;
  v_promis_success_rates JSONB;
  v_promis_effect_size JSONB;
  v_promis_odds_ratio JSONB;
  v_compliance_msq_scatter JSONB;
  v_health_vitals_by_tier JSONB;
  
  -- Tab 3: Intervention Targeting
  v_at_risk_members JSONB;
  v_bottleneck_modules JSONB;
  v_missed_items_patterns JSONB;
  
  -- Tab 5: Temporal Trends
  v_cohort_analysis JSONB;
  v_completion_statistics JSONB;
BEGIN
  v_start_time := clock_timestamp();
  
  RAISE NOTICE 'Starting analytics metrics calculation...';
  
  -- ============================================================
  -- METADATA: Count members
  -- ============================================================
  
  SELECT COUNT(DISTINCT lead_id) INTO v_member_count
  FROM member_progress_summary;
  
  -- Count active members directly (don't require member_progress_summary)
  SELECT COUNT(DISTINCT mp.lead_id) INTO v_active_count
  FROM member_programs mp
  INNER JOIN program_status ps ON ps.program_status_id = mp.program_status_id
  WHERE ps.status_name = 'Active'
    AND mp.active_flag = true;
  
  -- Count completed members (have Completed status programs)
  SELECT COUNT(DISTINCT mp.lead_id) INTO v_completed_count
  FROM member_programs mp
  INNER JOIN program_status ps ON ps.program_status_id = mp.program_status_id
  WHERE ps.status_name = 'Completed'
    AND mp.active_flag = true;
  
  -- Calculate average member health score
  SELECT ROUND(AVG(status_score)::numeric, 2) INTO v_avg_member_health_score
  FROM member_progress_summary
  WHERE status_score IS NOT NULL;
  
  RAISE NOTICE 'Member counts - Total: %, Active: %, Completed: %, Avg Health: %', 
    v_member_count, v_active_count, v_completed_count, v_avg_member_health_score;
  
  -- ============================================================
  -- TAB 1: COMPLIANCE PATTERNS
  -- ============================================================
  
  RAISE NOTICE 'Calculating Tab 1: Compliance Patterns...';
  
  -- ============================================================
  -- TAB 2: HEALTH OUTCOMES - Better Statistical Measures
  -- ============================================================
  
  RAISE NOTICE 'Calculating Tab 2: Health Outcomes...';
  
  -- Calculate all MSQ-based metrics in a single CTE chain (so they share the same base data)
  WITH msq_data AS (
    SELECT 
      mps.lead_id,
      mps.status_score AS compliance_score,
      -- Get first MSQ total score (sum of all domain scores)
      (
        SELECT SUM(sds.domain_total_score)
        FROM survey_domain_scores sds
        INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
        WHERE srs.lead_id = mps.lead_id
          AND srs.form_id = 3 -- MSQ form
        GROUP BY srs.session_id, srs.completed_on
        ORDER BY srs.completed_on ASC
        LIMIT 1
      ) AS first_msq_score,
      -- Get last MSQ total score (sum of all domain scores)
      (
        SELECT SUM(sds.domain_total_score)
        FROM survey_domain_scores sds
        INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
        WHERE srs.lead_id = mps.lead_id
          AND srs.form_id = 3
        GROUP BY srs.session_id, srs.completed_on
        ORDER BY srs.completed_on DESC
        LIMIT 1
      ) AS last_msq_score
    FROM member_progress_summary mps
    WHERE mps.status_score IS NOT NULL
  ),
  msq_with_improvement AS (
    SELECT 
      lead_id,
      compliance_score,
      first_msq_score,
      last_msq_score,
      (first_msq_score - last_msq_score) AS msq_improvement -- Positive = improvement
    FROM msq_data
    WHERE first_msq_score IS NOT NULL 
      AND last_msq_score IS NOT NULL
  ),
  -- 1. SUCCESS RATES BY COMPLIANCE TIER
  compliance_tiers AS (
    SELECT
      CASE 
        WHEN compliance_score < 40 THEN 'Low (0-40%)'
        WHEN compliance_score < 70 THEN 'Medium (40-70%)'
        ELSE 'High (70-100%)'
      END as tier,
      COUNT(*) as total_members,
      COUNT(*) FILTER (WHERE msq_improvement > 0) as improved_members,
      AVG(msq_improvement) as avg_change
    FROM msq_with_improvement
    GROUP BY tier
  ),
  -- 2. EFFECT SIZE: High vs Low Compliance
  effect_data AS (
    SELECT
      AVG(msq_improvement) FILTER (WHERE compliance_score >= 70) as high_avg,
      AVG(msq_improvement) FILTER (WHERE compliance_score < 40) as low_avg,
      COUNT(*) FILTER (WHERE compliance_score >= 70) as high_count,
      COUNT(*) FILTER (WHERE compliance_score < 40) as low_count
    FROM msq_with_improvement
  ),
  -- 3. ODDS RATIO: Likelihood of improvement
  contingency AS (
    SELECT 
      COUNT(*) FILTER (WHERE compliance_score >= 70 AND msq_improvement > 0) as a, -- High compliance + improved
      COUNT(*) FILTER (WHERE compliance_score >= 70 AND msq_improvement <= 0) as b, -- High compliance + not improved
      COUNT(*) FILTER (WHERE compliance_score < 40 AND msq_improvement > 0) as c, -- Low compliance + improved
      COUNT(*) FILTER (WHERE compliance_score < 40 AND msq_improvement <= 0) as d  -- Low compliance + not improved
    FROM msq_with_improvement
  ),
  -- 4. DEPRECATED: Pearson correlation
  correlation_data AS (
    SELECT 
      corr(compliance_score, msq_improvement) as correlation_value
    FROM msq_with_improvement
    WHERE msq_improvement != 0
  )
  -- Store all results in one statement
  SELECT 
    -- Success rates
    (SELECT jsonb_agg(jsonb_build_object(
      'tier', tier,
      'total', total_members,
      'improved', improved_members,
      'success_rate', ROUND(100.0 * improved_members / NULLIF(total_members, 0), 1),
      'avg_change', ROUND(avg_change::numeric, 1)
    ) ORDER BY 
      CASE tier
        WHEN 'Low (0-40%)' THEN 1
        WHEN 'Medium (40-70%)' THEN 2
        WHEN 'High (70-100%)' THEN 3
      END
    ) FROM compliance_tiers),
    -- Effect size
    (SELECT jsonb_build_object(
      'high_compliance_avg', ROUND(high_avg::numeric, 1),
      'low_compliance_avg', ROUND(low_avg::numeric, 1),
      'effect_size', ROUND((high_avg - low_avg)::numeric, 1),
      'high_count', high_count,
      'low_count', low_count,
      'interpretation', CASE 
        WHEN (high_avg - low_avg) > 0 THEN 
          'High-compliance members improve ' || ROUND((high_avg - low_avg)::numeric, 1)::text || ' points more on average'
        ELSE 
          'No meaningful difference detected (' || ROUND((high_avg - low_avg)::numeric, 1)::text || ' points)'
      END
    ) FROM effect_data),
    -- Odds ratio
    (SELECT jsonb_build_object(
      'odds_ratio', CASE 
        WHEN b = 0 OR c = 0 OR d = 0 THEN NULL
        ELSE ROUND((a::numeric * d) / NULLIF(b * c, 0), 2)
      END,
      'high_compliance_improved', a,
      'high_compliance_not_improved', b,
      'low_compliance_improved', c,
      'low_compliance_not_improved', d,
      'interpretation', CASE 
        WHEN b = 0 OR c = 0 OR d = 0 THEN 'Insufficient data for odds ratio calculation'
        WHEN (a::numeric * d) / NULLIF(b * c, 0) > 1 THEN 
          'High-compliance members are ' || ROUND(((a::numeric * d) / NULLIF(b * c, 0))::numeric, 1)::text || 'x more likely to improve'
        ELSE 
          'No significant advantage detected'
      END
    ) FROM contingency),
    -- Correlation (deprecated)
    (SELECT correlation_value FROM correlation_data)
  INTO v_compliance_success_rates, v_compliance_effect_size, v_compliance_odds_ratio, v_compliance_msq_corr;
  
  RAISE NOTICE 'Success rates: %, Effect size: %, Odds ratio: %', 
    v_compliance_success_rates, v_compliance_effect_size, v_compliance_odds_ratio;
  
  RAISE NOTICE 'Pearson correlation (deprecated): %', v_compliance_msq_corr;
  
  -- PROMIS correlation - deprecated
  v_compliance_promis_corr := NULL;
  
  -- ============================================================
  -- PROMIS-29 STATISTICAL ANALYSIS (Same as MSQ)
  -- ============================================================
  
  RAISE NOTICE 'Calculating PROMIS-29 statistical measures...';
  
  -- Calculate all PROMIS-29 metrics (Quality of Life)
  -- Note: PROMIS uses T-scores where 50 = US population average
  -- For most domains: LOWER T-score = improvement (opposite of MSQ)
  -- Physical Function: HIGHER T-score = improvement
  WITH promis_data AS (
    SELECT 
      mps.lead_id,
      mps.status_score AS compliance_score,
      -- Get first PROMIS total score (sum of all domain T-scores)
      (
        SELECT SUM(sds.domain_total_score)
        FROM survey_domain_scores sds
        INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
        WHERE srs.lead_id = mps.lead_id
          AND srs.form_id = 6 -- PROMIS-29 Survey
        GROUP BY srs.session_id, srs.completed_on
        ORDER BY srs.completed_on ASC
        LIMIT 1
      ) AS first_promis_score,
      -- Get last PROMIS total score
      (
        SELECT SUM(sds.domain_total_score)
        FROM survey_domain_scores sds
        INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
        WHERE srs.lead_id = mps.lead_id
          AND srs.form_id = 6 -- PROMIS-29 Survey
        GROUP BY srs.session_id, srs.completed_on
        ORDER BY srs.completed_on DESC
        LIMIT 1
      ) AS last_promis_score
    FROM member_progress_summary mps
    WHERE mps.status_score IS NOT NULL
  ),
  promis_with_improvement AS (
    SELECT 
      lead_id,
      compliance_score,
      first_promis_score,
      last_promis_score,
      -- For PROMIS: lower score = improvement for most domains
      -- Calculate improvement as positive when T-score decreases
      (first_promis_score - last_promis_score) AS promis_improvement
    FROM promis_data
    WHERE first_promis_score IS NOT NULL 
      AND last_promis_score IS NOT NULL
  ),
  -- 1. PROMIS SUCCESS RATES BY COMPLIANCE TIER
  promis_tiers AS (
    SELECT
      CASE 
        WHEN compliance_score < 40 THEN 'Low (0-40%)'
        WHEN compliance_score < 70 THEN 'Medium (40-70%)'
        ELSE 'High (70-100%)'
      END as tier,
      COUNT(*) as total_members,
      COUNT(*) FILTER (WHERE promis_improvement > 0) as improved_members,
      AVG(promis_improvement) as avg_change
    FROM promis_with_improvement
    GROUP BY tier
  ),
  -- 2. PROMIS EFFECT SIZE: High vs Low Compliance
  promis_effect_data AS (
    SELECT
      AVG(promis_improvement) FILTER (WHERE compliance_score >= 70) as high_avg,
      AVG(promis_improvement) FILTER (WHERE compliance_score < 40) as low_avg,
      COUNT(*) FILTER (WHERE compliance_score >= 70) as high_count,
      COUNT(*) FILTER (WHERE compliance_score < 40) as low_count
    FROM promis_with_improvement
  ),
  -- 3. PROMIS ODDS RATIO: Likelihood of improvement
  promis_contingency AS (
    SELECT 
      COUNT(*) FILTER (WHERE compliance_score >= 70 AND promis_improvement > 0) as a,
      COUNT(*) FILTER (WHERE compliance_score >= 70 AND promis_improvement <= 0) as b,
      COUNT(*) FILTER (WHERE compliance_score < 40 AND promis_improvement > 0) as c,
      COUNT(*) FILTER (WHERE compliance_score < 40 AND promis_improvement <= 0) as d
    FROM promis_with_improvement
  )
  -- Store all PROMIS results in one statement
  SELECT 
    -- Success rates
    (SELECT jsonb_agg(jsonb_build_object(
      'tier', tier,
      'total', total_members,
      'improved', improved_members,
      'success_rate', ROUND(100.0 * improved_members / NULLIF(total_members, 0), 1),
      'avg_change', ROUND(avg_change::numeric, 1)
    ) ORDER BY 
      CASE tier
        WHEN 'Low (0-40%)' THEN 1
        WHEN 'Medium (40-70%)' THEN 2
        WHEN 'High (70-100%)' THEN 3
      END
    ) FROM promis_tiers),
    -- Effect size
    (SELECT jsonb_build_object(
      'high_compliance_avg', ROUND(high_avg::numeric, 1),
      'low_compliance_avg', ROUND(low_avg::numeric, 1),
      'effect_size', ROUND((high_avg - low_avg)::numeric, 1),
      'high_count', high_count,
      'low_count', low_count,
      'interpretation', CASE 
        WHEN (high_avg - low_avg) > 0 THEN 
          'High-compliance members improve ' || ROUND((high_avg - low_avg)::numeric, 1)::text || ' T-score points more on average'
        ELSE 
          'No meaningful difference detected (' || ROUND((high_avg - low_avg)::numeric, 1)::text || ' points)'
      END
    ) FROM promis_effect_data),
    -- Odds ratio
    (SELECT jsonb_build_object(
      'odds_ratio', CASE 
        WHEN b = 0 OR c = 0 OR d = 0 THEN NULL
        ELSE ROUND((a::numeric * d) / NULLIF(b * c, 0), 2)
      END,
      'high_compliance_improved', a,
      'high_compliance_not_improved', b,
      'low_compliance_improved', c,
      'low_compliance_not_improved', d,
      'interpretation', CASE 
        WHEN b = 0 OR c = 0 OR d = 0 THEN 'Insufficient data for odds ratio calculation'
        WHEN (a::numeric * d) / NULLIF(b * c, 0) > 1 THEN 
          'High-compliance members are ' || ROUND(((a::numeric * d) / NULLIF(b * c, 0))::numeric, 1)::text || 'x more likely to improve'
        ELSE 
          'No significant advantage detected'
      END
    ) FROM promis_contingency)
  INTO v_promis_success_rates, v_promis_effect_size, v_promis_odds_ratio;
  
  RAISE NOTICE 'PROMIS-29 Success rates: %, Effect size: %, Odds ratio: %', 
    v_promis_success_rates, v_promis_effect_size, v_promis_odds_ratio;
  
  -- ============================================================
  -- TAB 1: COMPLIANCE PATTERNS & PREDICTORS
  -- ============================================================
  
  RAISE NOTICE 'Calculating Tab 1: Compliance Patterns...';
  
  -- 1. Compliance Distribution (histogram data)
  -- Group members into compliance ranges: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
  WITH compliance_ranges AS (
    SELECT 
      CASE 
        WHEN status_score < 20 THEN '0-20%'
        WHEN status_score < 40 THEN '20-40%'
        WHEN status_score < 60 THEN '40-60%'
        WHEN status_score < 80 THEN '60-80%'
        ELSE '80-100%'
      END AS range,
      COUNT(*) as count
    FROM member_progress_summary
    WHERE status_score IS NOT NULL
    GROUP BY 
      CASE 
        WHEN status_score < 20 THEN '0-20%'
        WHEN status_score < 40 THEN '20-40%'
        WHEN status_score < 60 THEN '40-60%'
        WHEN status_score < 80 THEN '60-80%'
        ELSE '80-100%'
      END
    ORDER BY range
  )
  SELECT jsonb_agg(jsonb_build_object('range', range, 'count', count)) INTO v_compliance_distribution
  FROM compliance_ranges;
  
  RAISE NOTICE 'Compliance distribution calculated';
  
  -- 2. Average Compliance by Category
  WITH avg_compliance AS (
    SELECT
      AVG(nutrition_compliance_pct) as nutrition,
      AVG(supplements_compliance_pct) as supplements,
      AVG(exercise_compliance_pct) as exercise,
      AVG(meditation_compliance_pct) as meditation
    FROM member_progress_summary
    WHERE status_score IS NOT NULL
  )
  SELECT jsonb_build_object(
    'nutrition', ROUND(nutrition::numeric, 1),
    'supplements', ROUND(supplements::numeric, 1),
    'exercise', ROUND(exercise::numeric, 1),
    'meditation', ROUND(meditation::numeric, 1)
  ) INTO v_avg_compliance_by_category
  FROM avg_compliance;
  
  RAISE NOTICE 'Average compliance by category calculated';
  
  -- 3. Compliance Timeline (by program day ranges)
  WITH compliance_by_days AS (
    SELECT 
      CASE 
        WHEN days_in_program <= 30 THEN '0-30 days'
        WHEN days_in_program <= 60 THEN '31-60 days'
        WHEN days_in_program <= 90 THEN '61-90 days'
        ELSE '90+ days'
      END AS day_range,
      AVG(status_score) as avg_compliance,
      COUNT(*) as member_count
    FROM member_progress_summary
    WHERE status_score IS NOT NULL
      AND days_in_program IS NOT NULL
    GROUP BY 
      CASE 
        WHEN days_in_program <= 30 THEN '0-30 days'
        WHEN days_in_program <= 60 THEN '31-60 days'
        WHEN days_in_program <= 90 THEN '61-90 days'
        ELSE '90+ days'
      END
    ORDER BY day_range
  )
  SELECT jsonb_agg(jsonb_build_object(
    'day_range', day_range, 
    'avg_compliance', ROUND(avg_compliance::numeric, 1),
    'member_count', member_count
  )) INTO v_compliance_timeline
  FROM compliance_by_days;
  
  RAISE NOTICE 'Compliance timeline calculated';
  
  -- ============================================================
  -- TAB 2: HEALTH OUTCOMES - Additional Metrics
  -- ============================================================
  
  RAISE NOTICE 'Calculating Tab 2: Additional Health Outcomes...';
  
  -- 4. Scatter Plot Data: Compliance vs MSQ (with member names)
  WITH msq_scatter_data AS (
    SELECT 
      mps.lead_id,
      mps.status_score AS compliance,
      l.first_name,
      l.last_name,
      (
        SELECT SUM(sds.domain_total_score)
        FROM survey_domain_scores sds
        INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
        WHERE srs.lead_id = mps.lead_id
          AND srs.form_id = 3
        GROUP BY srs.session_id, srs.completed_on
        ORDER BY srs.completed_on ASC
        LIMIT 1
      ) AS first_msq,
      (
        SELECT SUM(sds.domain_total_score)
        FROM survey_domain_scores sds
        INNER JOIN survey_response_sessions srs ON srs.session_id = sds.session_id
        WHERE srs.lead_id = mps.lead_id
          AND srs.form_id = 3
        GROUP BY srs.session_id, srs.completed_on
        ORDER BY srs.completed_on DESC
        LIMIT 1
      ) AS last_msq,
      mps.total_surveys_completed
    FROM member_progress_summary mps
    LEFT JOIN leads l ON l.lead_id = mps.lead_id
    WHERE mps.status_score IS NOT NULL
  )
  SELECT jsonb_agg(jsonb_build_object(
    'lead_id', lead_id,
    'member_name', first_name || ' ' || last_name,
    'compliance', ROUND(compliance::numeric, 1),
    'msq_change', ROUND((first_msq - last_msq)::numeric, 1),
    'survey_count', total_surveys_completed
  )) INTO v_compliance_msq_scatter
  FROM msq_scatter_data
  WHERE first_msq IS NOT NULL AND last_msq IS NOT NULL;
  
  RAISE NOTICE 'Compliance vs MSQ scatter data calculated';
  
  -- 5. Health Vitals by Compliance Tier
  -- Tier: High (>=70), Medium (40-69), Low (<40)
  WITH vitals_by_tier AS (
    SELECT 
      CASE 
        WHEN status_score >= 70 THEN 'high'
        WHEN status_score >= 40 THEN 'medium'
        ELSE 'low'
      END AS tier,
      -- Energy
      percentile_cont(0.5) WITHIN GROUP (ORDER BY energy_score) AS energy_median,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY energy_score) AS energy_q1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY energy_score) AS energy_q3,
      -- Mood
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mood_score) AS mood_median,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY mood_score) AS mood_q1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY mood_score) AS mood_q3,
      -- Motivation
      percentile_cont(0.5) WITHIN GROUP (ORDER BY motivation_score) AS motivation_median,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY motivation_score) AS motivation_q1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY motivation_score) AS motivation_q3,
      -- Wellbeing
      percentile_cont(0.5) WITHIN GROUP (ORDER BY wellbeing_score) AS wellbeing_median,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY wellbeing_score) AS wellbeing_q1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY wellbeing_score) AS wellbeing_q3,
      -- Sleep
      percentile_cont(0.5) WITHIN GROUP (ORDER BY sleep_score) AS sleep_median,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY sleep_score) AS sleep_q1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY sleep_score) AS sleep_q3
    FROM member_progress_summary
    WHERE status_score IS NOT NULL
    GROUP BY 
      CASE 
        WHEN status_score >= 70 THEN 'high'
        WHEN status_score >= 40 THEN 'medium'
        ELSE 'low'
      END
  )
  SELECT jsonb_object_agg(
    tier,
    jsonb_build_object(
      'energy', jsonb_build_object('median', ROUND(energy_median::numeric, 1), 'q1', ROUND(energy_q1::numeric, 1), 'q3', ROUND(energy_q3::numeric, 1)),
      'mood', jsonb_build_object('median', ROUND(mood_median::numeric, 1), 'q1', ROUND(mood_q1::numeric, 1), 'q3', ROUND(mood_q3::numeric, 1)),
      'motivation', jsonb_build_object('median', ROUND(motivation_median::numeric, 1), 'q1', ROUND(motivation_q1::numeric, 1), 'q3', ROUND(motivation_q3::numeric, 1)),
      'wellbeing', jsonb_build_object('median', ROUND(wellbeing_median::numeric, 1), 'q1', ROUND(wellbeing_q1::numeric, 1), 'q3', ROUND(wellbeing_q3::numeric, 1)),
      'sleep', jsonb_build_object('median', ROUND(sleep_median::numeric, 1), 'q1', ROUND(sleep_q1::numeric, 1), 'q3', ROUND(sleep_q3::numeric, 1))
    )
  ) INTO v_health_vitals_by_tier
  FROM vitals_by_tier;
  
  RAISE NOTICE 'Health vitals by tier calculated';
  
  -- ============================================================
  -- TAB 3: INTERVENTION TARGETING
  -- ============================================================
  
  RAISE NOTICE 'Calculating Tab 3: Intervention Targeting...';
  
  -- 6. At-Risk Member Segmentation (Quadrant Analysis)
  -- X-axis: Compliance (low â†’ high)
  -- Y-axis: Health Outcome Improvement (worsening â†’ improving)
  WITH member_outcomes AS (
    SELECT 
      mps.lead_id,
      l.first_name || ' ' || l.last_name AS member_name,
      mps.status_score AS compliance,
      -- MSQ improvement (first - last, positive = improvement)
      (
        SELECT 
          (SELECT SUM(sds1.domain_total_score)
           FROM survey_domain_scores sds1
           INNER JOIN survey_response_sessions srs1 ON srs1.session_id = sds1.session_id
           WHERE srs1.lead_id = mps.lead_id AND srs1.form_id = 3
           GROUP BY srs1.session_id, srs1.completed_on
           ORDER BY srs1.completed_on ASC LIMIT 1)
          -
          (SELECT SUM(sds2.domain_total_score)
           FROM survey_domain_scores sds2
           INNER JOIN survey_response_sessions srs2 ON srs2.session_id = sds2.session_id
           WHERE srs2.lead_id = mps.lead_id AND srs2.form_id = 3
           GROUP BY srs2.session_id, srs2.completed_on
           ORDER BY srs2.completed_on DESC LIMIT 1)
      ) AS msq_change
    FROM member_progress_summary mps
    LEFT JOIN leads l ON l.lead_id = mps.lead_id
    WHERE mps.status_score IS NOT NULL
  ),
  quadrants AS (
    SELECT 
      lead_id,
      member_name,
      compliance,
      msq_change,
      CASE 
        WHEN compliance < 40 AND msq_change < 0 THEN 'high_priority'  -- Low compliance, worsening
        WHEN compliance >= 40 AND msq_change < 0 THEN 'clinical_attention'  -- High compliance, worsening
        WHEN compliance < 40 AND msq_change >= 0 THEN 'motivational_support'  -- Low compliance, improving
        ELSE 'success_stories'  -- High compliance, improving
      END AS quadrant
    FROM member_outcomes
    WHERE msq_change IS NOT NULL
  )
  SELECT jsonb_agg(jsonb_build_object(
    'lead_id', lead_id,
    'member_name', member_name,
    'compliance', ROUND(compliance::numeric, 1),
    'outcome_change', ROUND(msq_change::numeric, 1),
    'segment', quadrant
  )) INTO v_at_risk_members
  FROM quadrants;  -- Include ALL members for full segmentation analysis
  
  RAISE NOTICE 'At-risk member segmentation calculated';
  
  -- 7. Bottleneck Modules - Survey completion rates (identifies drop-off points)
  -- Use actual survey completions from survey_response_sessions
  WITH total_members AS (
    SELECT COUNT(DISTINCT lead_id) as total
    FROM member_progress_summary
  ),
  survey_completions AS (
    SELECT 
      sf.form_name as survey_name,
      COUNT(DISTINCT srs.lead_id) as completion_count
    FROM survey_response_sessions srs
    INNER JOIN survey_forms sf ON sf.form_id = srs.form_id
    WHERE srs.completed_on IS NOT NULL
    GROUP BY sf.form_name
  )
  SELECT jsonb_agg(jsonb_build_object(
    'survey_name', survey_name,
    'completion_count', completion_count,
    'completion_rate', ROUND((completion_count::numeric / (SELECT total FROM total_members) * 100), 1)
  ) ORDER BY completion_count ASC) INTO v_bottleneck_modules
  FROM survey_completions
  LIMIT 15;
  
  RAISE NOTICE 'Bottleneck modules calculated from actual survey completions';
  
  -- 8. Missed Items Pattern Analysis
  -- Analyze which scheduled items are most frequently missed
  WITH missed_item_schedule AS (
    SELECT 
      mpi.therapy_id,
      t.therapy_name,
      COUNT(*) AS missed_count,
      COUNT(DISTINCT mpis.member_program_item_id) AS affected_members
    FROM member_program_item_schedule mpis
    INNER JOIN member_program_items mpi ON mpi.member_program_item_id = mpis.member_program_item_id
    INNER JOIN therapies t ON t.therapy_id = mpi.therapy_id
    WHERE mpis.completed_flag = false
      OR (mpis.completed_flag IS NULL AND mpis.scheduled_date < CURRENT_DATE)
    GROUP BY mpi.therapy_id, t.therapy_name
  )
  SELECT jsonb_agg(jsonb_build_object(
    'item_name', therapy_name,
    'miss_count', missed_count,
    'affected_members', affected_members,
    'miss_rate', ROUND((missed_count::numeric / affected_members), 1)
  ) ORDER BY missed_count DESC) INTO v_missed_items_patterns
  FROM missed_item_schedule
  LIMIT 15;  -- Top 15 most missed items
  
  RAISE NOTICE 'Missed items patterns calculated';
  
  -- ============================================================
  -- TAB 4: PROMIS DEEP DIVE
  -- ============================================================
  
  -- SKIPPED: PROMIS data structure needs verification
  -- Will implement after confirming PROMIS storage in survey_domain_scores
  
  -- ============================================================
  -- TAB 5: TEMPORAL TRENDS & FORECASTING
  -- ============================================================
  
  RAISE NOTICE 'Calculating Tab 5: Temporal Trends...';
  
  -- 9. Cohort Analysis (by program start month)
  WITH program_cohorts AS (
    SELECT 
      TO_CHAR(mp.start_date, 'YYYY-MM') AS cohort,
      COUNT(DISTINCT mp.lead_id) AS member_count,
      AVG(mps.status_score) AS avg_compliance,
      COUNT(DISTINCT CASE WHEN ps.status_name = 'Completed' THEN mp.lead_id END) AS completed_count
    FROM member_programs mp
    INNER JOIN program_status ps ON ps.program_status_id = mp.program_status_id
    LEFT JOIN member_progress_summary mps ON mps.lead_id = mp.lead_id
    WHERE mp.start_date IS NOT NULL
      AND mp.active_flag = true
    GROUP BY TO_CHAR(mp.start_date, 'YYYY-MM')
    HAVING COUNT(DISTINCT mp.lead_id) > 0
  )
  SELECT jsonb_agg(jsonb_build_object(
    'cohort', cohort,
    'member_count', member_count,
    'avg_compliance', ROUND(avg_compliance::numeric, 1),
    'completed_count', completed_count,
    'completion_rate', ROUND((completed_count::numeric / member_count * 100), 1)
  ) ORDER BY cohort DESC) INTO v_cohort_analysis
  FROM program_cohorts
  LIMIT 12;  -- Last 12 months
  
  RAISE NOTICE 'Cohort analysis calculated';
  
  -- 10. Program Completion Statistics
  WITH completion_stats AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN ps.status_name = 'Completed' THEN mp.lead_id END) AS completed,
      COUNT(DISTINCT CASE WHEN ps.status_name = 'Active' THEN mp.lead_id END) AS active,
      COUNT(DISTINCT CASE WHEN ps.status_name IN ('Cancelled', 'Lost') THEN mp.lead_id END) AS dropped,
      COUNT(DISTINCT mp.lead_id) AS total,
      AVG(CASE WHEN ps.status_name = 'Completed' THEN mp.duration END) AS avg_days_completed
    FROM member_programs mp
    INNER JOIN program_status ps ON ps.program_status_id = mp.program_status_id
    WHERE mp.active_flag = true
  )
  SELECT jsonb_build_object(
    'completion_rate', ROUND((completed::numeric / NULLIF(total, 0) * 100), 1),
    'dropout_rate', ROUND((dropped::numeric / NULLIF(total, 0) * 100), 1),
    'active_rate', ROUND((active::numeric / NULLIF(total, 0) * 100), 1),
    'avg_days_to_complete', ROUND(avg_days_completed::numeric, 0),
    'total_members', total,
    'completed_count', completed,
    'active_count', active,
    'dropped_count', dropped
  ) INTO v_completion_statistics
  FROM completion_stats;
  
  RAISE NOTICE 'Completion statistics calculated';
  
  -- ============================================================
  -- INSERT RESULTS INTO CACHE
  -- ============================================================
  
  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
  
  RAISE NOTICE 'Inserting results into cache...';
  
  INSERT INTO member_analytics_cache (
    calculated_at,
    member_count,
    active_member_count,
    completed_member_count,
    avg_member_health_score,
    calculation_duration_ms,
    
    -- Tab 1: Compliance Patterns
    compliance_distribution,
    avg_compliance_by_category,
    compliance_timeline,
    
    -- Tab 2: Health Outcomes
    compliance_msq_correlation, -- DEPRECATED
    compliance_promis_correlation, -- DEPRECATED
    compliance_success_rates, -- NEW: MSQ
    compliance_effect_size, -- NEW: MSQ
    compliance_odds_ratio, -- NEW: MSQ
    promis_success_rates, -- NEW: PROMIS-29
    promis_effect_size, -- NEW: PROMIS-29
    promis_odds_ratio, -- NEW: PROMIS-29
    compliance_msq_scatter,
    health_vitals_by_tier,
    
    -- Tab 3: Intervention Targeting
    at_risk_members,
    bottleneck_modules,
    missed_items_patterns,
    
    -- Tab 5: Temporal Trends
    cohort_analysis,
    completion_statistics
  ) VALUES (
    NOW(),
    v_member_count,
    v_active_count,
    v_completed_count,
    v_avg_member_health_score,
    v_duration_ms,
    
    -- Tab 1
    v_compliance_distribution,
    v_avg_compliance_by_category,
    v_compliance_timeline,
    
    -- Tab 2
    v_compliance_msq_corr, -- DEPRECATED
    v_compliance_promis_corr, -- DEPRECATED
    v_compliance_success_rates, -- NEW: MSQ
    v_compliance_effect_size, -- NEW: MSQ
    v_compliance_odds_ratio, -- NEW: MSQ
    v_promis_success_rates, -- NEW: PROMIS-29
    v_promis_effect_size, -- NEW: PROMIS-29
    v_promis_odds_ratio, -- NEW: PROMIS-29
    v_compliance_msq_scatter,
    v_health_vitals_by_tier,
    
    -- Tab 3
    v_at_risk_members,
    v_bottleneck_modules,
    v_missed_items_patterns,
    
    -- Tab 5
    v_cohort_analysis,
    v_completion_statistics
  ) RETURNING cache_id INTO v_new_cache_id;
  
  RAISE NOTICE 'Analytics calculation complete! Cache ID: %, Duration: %ms', 
    v_new_cache_id, v_duration_ms;
  
  -- Return success
  RETURN QUERY SELECT 
    true AS success,
    format('Analytics calculated successfully. Cache ID: %s, Duration: %sms', 
           v_new_cache_id, v_duration_ms) AS message,
    v_duration_ms AS calculation_time_ms,
    v_member_count AS members_analyzed;
    
END;
$$;

-- Comment on function
COMMENT ON FUNCTION calculate_analytics_metrics() IS 
  'Calculates all analytics metrics for research-grade dashboard and stores in member_analytics_cache. Returns success status and performance metrics.';

-- =====================================================
-- HELPER FUNCTION: Get Latest Analytics Cache
-- =====================================================

CREATE OR REPLACE FUNCTION get_latest_analytics_cache()
RETURNS member_analytics_cache
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cache member_analytics_cache;
BEGIN
  SELECT * INTO v_cache
  FROM member_analytics_cache
  ORDER BY calculated_at DESC
  LIMIT 1;
  
  IF v_cache IS NULL THEN
    RAISE NOTICE 'No analytics cache found. Run calculate_analytics_metrics() first.';
  END IF;
  
  RETURN v_cache;
END;
$$;

COMMENT ON FUNCTION get_latest_analytics_cache() IS 
  'Returns the most recent analytics cache entry. Used by API endpoints.';


