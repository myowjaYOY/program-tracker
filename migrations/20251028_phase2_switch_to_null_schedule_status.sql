-- Phase 2: Switch to NULL for Schedule Status (Run AFTER UI Deployed)
-- IMPORTANT: Only run this migration AFTER the new UI is deployed to production
-- The new UI must be live and working before running this migration

-- This migration:
-- 1. Changes DEFAULT from false to NULL for new items
-- 2. Backfills existing false values to NULL (converts to pending)
-- 3. Keeps true values as-is (already redeemed)

BEGIN;

-- ========================================
-- Step 1: Change DEFAULT to NULL for item schedules
-- ========================================
ALTER TABLE member_program_item_schedule 
  ALTER COLUMN completed_flag SET DEFAULT NULL;

-- ========================================
-- Step 2: Change DEFAULT to NULL for task schedules
-- ========================================
ALTER TABLE member_program_items_task_schedule 
  ALTER COLUMN completed_flag SET DEFAULT NULL;

-- ========================================
-- Step 3: Backfill existing data
-- ========================================

-- Convert all false values to NULL (pending)
-- Rationale: "false" doesn't mean "missed" - it means "not yet decided"
-- The new UI will let users explicitly mark items as missed (false) or redeemed (true)
UPDATE member_program_item_schedule
SET completed_flag = NULL
WHERE completed_flag = false;

UPDATE member_program_items_task_schedule
SET completed_flag = NULL
WHERE completed_flag = false;

-- Keep true values as-is (already redeemed)
-- No action needed - true stays true

COMMIT;

-- ========================================
-- Verification Queries
-- ========================================

-- Verify DEFAULT was changed
SELECT 
  table_name,
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('member_program_item_schedule', 'member_program_items_task_schedule')
  AND column_name = 'completed_flag';

-- Verify data distribution (should have true and NULL, no false)
SELECT 
  'item_schedule' as table_name,
  COUNT(*) FILTER (WHERE completed_flag = true) as redeemed_count,
  COUNT(*) FILTER (WHERE completed_flag = false) as missed_count,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as pending_count,
  COUNT(*) as total
FROM member_program_item_schedule
UNION ALL
SELECT 
  'task_schedule' as table_name,
  COUNT(*) FILTER (WHERE completed_flag = true) as redeemed_count,
  COUNT(*) FILTER (WHERE completed_flag = false) as missed_count,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as pending_count,
  COUNT(*) as total
FROM member_program_items_task_schedule;

-- ========================================
-- Expected Results After This Migration
-- ========================================
-- - DEFAULT is now NULL for both tables
-- - Existing completed items: true (redeemed)
-- - Existing incomplete items: NULL (pending)
-- - No false values (users can set them via UI)
-- 
-- The new UI handles all three states:
-- - NULL (Pending) = No decision made yet
-- - true (Redeemed) = Therapy/task was completed
-- - false (Missed) = Therapy/task did not happen (user decision)

