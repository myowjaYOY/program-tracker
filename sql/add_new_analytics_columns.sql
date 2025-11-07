-- =====================================================
-- Add new analytics columns to member_analytics_cache
-- =====================================================
-- Run this FIRST before updating the calculation function
-- =====================================================

ALTER TABLE member_analytics_cache
ADD COLUMN IF NOT EXISTS compliance_success_rates JSONB,
ADD COLUMN IF NOT EXISTS compliance_effect_size JSONB,
ADD COLUMN IF NOT EXISTS compliance_odds_ratio JSONB;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'member_analytics_cache' 
  AND column_name IN ('compliance_success_rates', 'compliance_effect_size', 'compliance_odds_ratio');



