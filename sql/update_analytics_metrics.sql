-- =====================================================
-- ANALYTICS DASHBOARD - UPGRADE TO BETTER METRICS
-- =====================================================
-- This script upgrades from weak Pearson correlation to
-- more appropriate statistical measures for this data type.
--
-- What's changing:
-- 1. Add 3 new columns for better metrics
-- 2. Update the calculation function
--
-- Run this in Supabase SQL Editor
-- Execution time: ~5 seconds
-- =====================================================

-- Step 1: Add new columns to cache table
ALTER TABLE member_analytics_cache
ADD COLUMN IF NOT EXISTS compliance_success_rates JSONB,
ADD COLUMN IF NOT EXISTS compliance_effect_size JSONB,
ADD COLUMN IF NOT EXISTS compliance_odds_ratio JSONB;

-- Add comments for new columns
COMMENT ON COLUMN member_analytics_cache.compliance_success_rates IS 
  'Success rates by compliance tier: [{tier: "Low (0-40%)", total: 15, improved: 5, success_rate: 33.3, avg_change: -5.2}, ...]';

COMMENT ON COLUMN member_analytics_cache.compliance_effect_size IS 
  'Effect size comparing high vs low compliance: {high_compliance_avg: -25.5, low_compliance_avg: -8.2, effect_size: -17.3, interpretation: "..."}';

COMMENT ON COLUMN member_analytics_cache.compliance_odds_ratio IS 
  'Odds ratio for improvement with high compliance: {odds_ratio: 8.5, interpretation: "High-compliance members are 8.5x more likely to improve"}';

-- Update comments for deprecated correlation columns
COMMENT ON COLUMN member_analytics_cache.compliance_msq_correlation IS 
  'DEPRECATED: Pearson correlation too weak for this data type. Use compliance_success_rates instead.';

COMMENT ON COLUMN member_analytics_cache.compliance_promis_correlation IS 
  'DEPRECATED: Pearson correlation too weak for this data type. Use compliance_success_rates instead.';

RAISE NOTICE 'Step 1 complete: Added new columns to member_analytics_cache';



