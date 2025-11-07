-- =====================================================
-- DEPLOY THIS TO ADD PROMIS-29 ANALYSIS
-- =====================================================
-- Copy this ENTIRE file and run in Supabase SQL Editor
-- This will update the calculate_analytics_metrics() function
-- to include PROMIS-29 statistical analysis
-- =====================================================

-- First, verify you have the required columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'member_analytics_cache' 
      AND column_name = 'promis_success_rates'
  ) THEN
    RAISE EXCEPTION 'Column promis_success_rates does not exist! Run sql/add_promis_analytics_columns.sql first';
  END IF;
  
  RAISE NOTICE 'Column check passed - ready to deploy function';
END $$;

-- Now deploy the updated function with PROMIS-29 logic


