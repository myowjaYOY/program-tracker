-- =====================================================
-- Add PROMIS-29 Statistical Analysis Columns
-- =====================================================
-- Run this in Supabase SQL Editor FIRST
-- =====================================================

ALTER TABLE member_analytics_cache
ADD COLUMN IF NOT EXISTS promis_success_rates JSONB,
ADD COLUMN IF NOT EXISTS promis_effect_size JSONB,
ADD COLUMN IF NOT EXISTS promis_odds_ratio JSONB;

-- Add comments
COMMENT ON COLUMN member_analytics_cache.promis_success_rates IS 
  'PROMIS-29 success rates by compliance tier: [{tier: "Low (0-40%)", total: 15, improved: 5, success_rate: 33.3, avg_change: 5.2}, ...]';

COMMENT ON COLUMN member_analytics_cache.promis_effect_size IS 
  'PROMIS-29 effect size comparing high vs low compliance: {high_compliance_avg: 8.5, low_compliance_avg: 3.2, effect_size: 5.3, interpretation: "..."}';

COMMENT ON COLUMN member_analytics_cache.promis_odds_ratio IS 
  'PROMIS-29 odds ratio for improvement with high compliance: {odds_ratio: 6.5, interpretation: "High-compliance members are 6.5x more likely to improve"}';

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'member_analytics_cache' 
  AND column_name LIKE '%promis%'
ORDER BY ordinal_position;



