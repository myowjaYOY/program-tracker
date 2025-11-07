-- =====================================================
-- ANALYTICS DASHBOARD - CACHE TABLE
-- =====================================================
-- This table stores pre-calculated analytics metrics
-- for the research-grade analytics dashboard.
-- 
-- Refresh Strategy:
-- - Triggered after survey imports (optional)
-- - Scheduled daily via pg_cron (optional)
-- - Manual refresh via API endpoint
-- 
-- Created: 2025-11-07
-- =====================================================

CREATE TABLE IF NOT EXISTS member_analytics_cache (
  cache_id SERIAL PRIMARY KEY,
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Metadata
  member_count INTEGER NOT NULL,
  active_member_count INTEGER NOT NULL,
  completed_member_count INTEGER NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  calculation_duration_ms INTEGER, -- Performance tracking
  
  -- ============================================================
  -- TAB 1: COMPLIANCE PATTERNS & PREDICTORS
  -- ============================================================
  
  -- Compliance Distribution (for histogram)
  -- Array of objects: [{range: "0-20%", count: 5}, {range: "20-40%", count: 12}, ...]
  compliance_distribution JSONB,
  
  -- Average compliance by category
  -- {nutrition: 75.5, supplements: 82.3, exercise: 68.1, meditation: 71.2}
  avg_compliance_by_category JSONB,
  
  -- Early warning correlations (correlation matrix)
  -- {days_to_first_miss_vs_final_compliance: 0.65, first_30_day_vs_completion: 0.78, ...}
  early_warning_correlations JSONB,
  
  -- Compliance timeline (average compliance by program day ranges)
  -- [{day_range: "0-30", avg_compliance: 85.2}, {day_range: "31-60", avg_compliance: 78.5}, ...]
  compliance_timeline JSONB,
  
  -- ============================================================
  -- TAB 2: HEALTH OUTCOMES ANALYSIS
  -- ============================================================
  
  -- DEPRECATED: Pearson correlation (too weak for this data type)
  compliance_msq_correlation DECIMAL(5,3), -- R value (-1 to 1) - DEPRECATED
  compliance_msq_r_squared DECIMAL(5,3),   -- R² value - DEPRECATED
  compliance_msq_p_value DECIMAL(10,8),    -- Statistical significance - DEPRECATED
  
  -- Scatter plot data: Compliance vs. MSQ
  -- [{lead_id: 123, compliance: 85.5, msq_change: -45, survey_count: 12, member_name: "John Doe"}, ...]
  compliance_msq_scatter JSONB,
  
  -- DEPRECATED: Pearson correlation (too weak for this data type)
  compliance_promis_correlation DECIMAL(5,3), -- DEPRECATED
  compliance_promis_r_squared DECIMAL(5,3), -- DEPRECATED
  compliance_promis_p_value DECIMAL(10,8), -- DEPRECATED
  
  -- Scatter plot data: Compliance vs. PROMIS
  compliance_promis_scatter JSONB,
  
  -- SUCCESS RATES BY COMPLIANCE TIER (More meaningful than correlation)
  -- [{tier: "Low (0-40%)", total: 15, improved: 5, success_rate: 33.3, avg_change: -5.2}, 
  --  {tier: "Medium (40-70%)", ...}, {tier: "High (70-100%)", ...}]
  compliance_success_rates JSONB,
  
  -- EFFECT SIZE: High vs Low Compliance Comparison
  -- {high_compliance_avg: -25.5, low_compliance_avg: -8.2, effect_size: -17.3, 
  --  interpretation: "High compliance members improve 17.3 points more on average"}
  compliance_effect_size JSONB,
  
  -- ODDS RATIO: Likelihood of improvement with high compliance
  -- {odds_ratio: 8.5, interpretation: "High-compliance members are 8.5x more likely to improve"}
  compliance_odds_ratio JSONB,
  
  -- Health vitals by compliance tier
  -- {high: {energy: {median: 8.2, q1: 7.5, q3: 9.0}, mood: {...}}, medium: {...}, low: {...}}
  health_vitals_by_tier JSONB,
  
  -- MSQ domain improvement by compliance tier
  -- {high: {head: -15.2, eyes: -8.5, ...}, medium: {...}, low: {...}}
  msq_domains_by_tier JSONB,
  
  -- PROMIS domain improvement by compliance tier
  promis_domains_by_tier JSONB,
  
  -- ============================================================
  -- TAB 3: INTERVENTION TARGETING
  -- ============================================================
  
  -- At-risk member segmentation (quadrant analysis)
  -- [{lead_id: 123, name: "John Doe", compliance: 35, outcome_change: -5, quadrant: "high_priority"}, ...]
  at_risk_members JSONB,
  
  -- Bottleneck analysis - modules with low completion rates
  -- [{module_name: "MODULE 8 - ...", completion_rate: 65.2, avg_time_days: 12.5, stuck_count: 8}, ...]
  bottleneck_modules JSONB,
  
  -- Missed items pattern analysis
  -- [{item_name: "Supplement X", miss_rate: 35.2, member_count: 15}, ...]
  missed_items_patterns JSONB,
  
  -- Survey engagement patterns
  -- {avg_completion_rate: 78.5, avg_time_lag_days: 2.3, engagement_vs_compliance_corr: 0.72}
  survey_engagement_patterns JSONB,
  
  -- ============================================================
  -- TAB 4: PROMIS-29 DEEP DIVE
  -- ============================================================
  
  -- T-score distribution by domain
  -- {physical_function: {mean: 45.2, std: 8.5, below_norm_pct: 65}, anxiety: {...}, ...}
  promis_domain_distributions JSONB,
  
  -- Domain improvement trajectories (4 assessment points)
  -- {physical_function: [38.5, 42.1, 45.2, 48.5], anxiety: [...], ...}
  promis_improvement_trajectories JSONB,
  
  -- Responder analysis (% with ≥5 point improvement)
  -- {physical_function: 68.5, anxiety: 72.3, ...}
  promis_responder_rates JSONB,
  
  -- Correlation network (PROMIS domains vs. compliance categories)
  -- [{promis_domain: "anxiety", compliance_category: "meditation", correlation: 0.65}, ...]
  promis_correlation_network JSONB,
  
  -- ============================================================
  -- TAB 5: TEMPORAL TRENDS & FORECASTING
  -- ============================================================
  
  -- Cohort analysis by start month
  -- [{cohort: "2024-01", member_count: 15, avg_compliance: 75.5, completion_rate: 85.2}, ...]
  cohort_analysis JSONB,
  
  -- Time to first compliance issue
  -- {avg_days: 35.2, median_days: 28, distribution: [...]}
  time_to_first_issue JSONB,
  
  -- Program completion statistics
  -- {completion_rate: 78.5, avg_days_to_complete: 125, dropout_rate: 21.5}
  completion_statistics JSONB,
  
  -- Trend over time (is program improving?)
  -- {compliance_trend: "improving", outcome_trend: "stable", monthly_data: [...]}
  program_trends JSONB,
  
  -- ============================================================
  -- INDEXES & CONSTRAINTS
  -- ============================================================
  
  CONSTRAINT valid_correlation_range_msq CHECK (
    compliance_msq_correlation IS NULL 
    OR (compliance_msq_correlation BETWEEN -1 AND 1)
  ),
  CONSTRAINT valid_correlation_range_promis CHECK (
    compliance_promis_correlation IS NULL 
    OR (compliance_promis_correlation BETWEEN -1 AND 1)
  )
);

-- Index for retrieving latest cache
CREATE INDEX IF NOT EXISTS idx_analytics_cache_calculated_at 
  ON member_analytics_cache(calculated_at DESC);

-- Comment on table
COMMENT ON TABLE member_analytics_cache IS 
  'Pre-calculated analytics metrics for research-grade analytics dashboard. Refreshed after survey imports or on schedule.';

-- Comment on key columns
COMMENT ON COLUMN member_analytics_cache.compliance_msq_correlation IS 
  'Pearson correlation coefficient between member compliance score and MSQ improvement (negative MSQ change = improvement)';

COMMENT ON COLUMN member_analytics_cache.compliance_promis_correlation IS 
  'Pearson correlation coefficient between member compliance score and PROMIS mean T-score improvement';

COMMENT ON COLUMN member_analytics_cache.at_risk_members IS 
  'Quadrant analysis: members segmented by compliance (x-axis) and health outcome (y-axis) for intervention targeting';

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE member_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users (full access)
CREATE POLICY "authenticated_access_member_analytics_cache" 
  ON member_analytics_cache 
  FOR ALL 
  TO authenticated 
  USING (true);

-- Policy: service_role (bypass RLS)
CREATE POLICY "service_role_bypass_member_analytics_cache" 
  ON member_analytics_cache 
  FOR ALL 
  TO service_role 
  USING (true);

