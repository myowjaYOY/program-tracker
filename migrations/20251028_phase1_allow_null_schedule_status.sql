-- Phase 1: Allow NULL for Schedule Status (Safe, Backward Compatible)
-- This migration allows NULL values but keeps DEFAULT as false
-- Old UI will continue working with false values
-- New UI will be able to work with both false and NULL values

BEGIN;

-- ========================================
-- Step 1: Allow NULL for item schedules
-- ========================================
-- Remove NOT NULL constraint, but keep DEFAULT as false
-- This is backward compatible - existing queries still work
ALTER TABLE member_program_item_schedule 
  ALTER COLUMN completed_flag DROP NOT NULL;

-- Keep DEFAULT as false (do not change yet)
-- New items will still be created as false until Phase 2

-- ========================================
-- Step 2: Allow NULL for task schedules
-- ========================================
ALTER TABLE member_program_items_task_schedule 
  ALTER COLUMN completed_flag DROP NOT NULL;

-- Keep DEFAULT as false (do not change yet)

-- ========================================
-- Verification
-- ========================================
-- Verify constraints were removed
SELECT 
  table_name,
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('member_program_item_schedule', 'member_program_items_task_schedule')
  AND column_name = 'completed_flag';

-- All values should still be true or false (no NULL yet)
SELECT 
  'item_schedule' as table_name,
  COUNT(*) FILTER (WHERE completed_flag = true) as true_count,
  COUNT(*) FILTER (WHERE completed_flag = false) as false_count,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as null_count,
  COUNT(*) as total
FROM member_program_item_schedule
UNION ALL
SELECT 
  'task_schedule' as table_name,
  COUNT(*) FILTER (WHERE completed_flag = true) as true_count,
  COUNT(*) FILTER (WHERE completed_flag = false) as false_count,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as null_count,
  COUNT(*) as total
FROM member_program_items_task_schedule;

COMMIT;

-- ========================================
-- NOTES
-- ========================================
-- This migration is SAFE to run on production with old UI
-- - Allows NULL but doesn't create any NULL values yet
-- - DEFAULT remains false
-- - All existing data unchanged
-- - Old UI queries continue working
-- 
-- After deploying new UI, run Phase 2 migration to:
-- - Change DEFAULT to NULL
-- - Backfill false → NULL

