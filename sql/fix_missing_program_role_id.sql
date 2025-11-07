-- Diagnostic and Fix Script for Missing program_role_id in Tasks
-- This addresses the bug where member_program_item_tasks were created without program_role_id
-- causing schedule tasks to default to "admin" role instead of the intended role

-- ============================================================================
-- STEP 1: Check if columns exist
-- ============================================================================
SELECT 
  'member_program_item_tasks' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'member_program_item_tasks'
  AND column_name = 'program_role_id';

SELECT 
  'member_program_items_task_schedule' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'member_program_items_task_schedule'
  AND column_name = 'program_role_id';

-- ============================================================================
-- STEP 2: Show current program_roles to understand role IDs
-- ============================================================================
SELECT 
  program_role_id,
  role_name,
  display_color,
  display_order,
  active_flag
FROM program_roles
ORDER BY display_order;

-- ============================================================================
-- STEP 3: Find tasks with NULL or incorrect program_role_id
-- ============================================================================
-- Check member_program_item_tasks
SELECT 
  'member_program_item_tasks' as source,
  mpit.member_program_item_task_id,
  mpit.task_name,
  mpit.program_role_id as current_role_id,
  tt.program_role_id as expected_role_id,
  pr_current.role_name as current_role_name,
  pr_expected.role_name as expected_role_name
FROM member_program_item_tasks mpit
LEFT JOIN therapy_tasks tt ON mpit.task_id = tt.task_id
LEFT JOIN program_roles pr_current ON mpit.program_role_id = pr_current.program_role_id
LEFT JOIN program_roles pr_expected ON tt.program_role_id = pr_expected.program_role_id
WHERE mpit.program_role_id IS NULL 
   OR mpit.program_role_id != tt.program_role_id
ORDER BY mpit.member_program_item_task_id DESC
LIMIT 20;

-- Check member_program_items_task_schedule
SELECT 
  'member_program_items_task_schedule' as source,
  mpits.member_program_item_task_schedule_id,
  mpit.task_name,
  mpits.program_role_id as current_role_id,
  tt.program_role_id as expected_role_id,
  pr_current.role_name as current_role_name,
  pr_expected.role_name as expected_role_name
FROM member_program_items_task_schedule mpits
INNER JOIN member_program_item_tasks mpit ON mpits.member_program_item_task_id = mpit.member_program_item_task_id
LEFT JOIN therapy_tasks tt ON mpit.task_id = tt.task_id
LEFT JOIN program_roles pr_current ON mpits.program_role_id = pr_current.program_role_id
LEFT JOIN program_roles pr_expected ON tt.program_role_id = pr_expected.program_role_id
WHERE mpits.program_role_id IS NULL 
   OR mpits.program_role_id != tt.program_role_id
ORDER BY mpits.member_program_item_task_schedule_id DESC
LIMIT 20;

-- ============================================================================
-- STEP 4: Add columns if they don't exist (safe to run if they exist)
-- ============================================================================
DO $$
BEGIN
  -- Add program_role_id to member_program_item_tasks if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'member_program_item_tasks' 
    AND column_name = 'program_role_id'
  ) THEN
    ALTER TABLE member_program_item_tasks 
    ADD COLUMN program_role_id INTEGER 
    REFERENCES program_roles(program_role_id);
    
    RAISE NOTICE 'Added program_role_id column to member_program_item_tasks';
  ELSE
    RAISE NOTICE 'program_role_id column already exists in member_program_item_tasks';
  END IF;

  -- Add program_role_id to member_program_items_task_schedule if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'member_program_items_task_schedule' 
    AND column_name = 'program_role_id'
  ) THEN
    ALTER TABLE member_program_items_task_schedule 
    ADD COLUMN program_role_id INTEGER 
    REFERENCES program_roles(program_role_id);
    
    RAISE NOTICE 'Added program_role_id column to member_program_items_task_schedule';
  ELSE
    RAISE NOTICE 'program_role_id column already exists in member_program_items_task_schedule';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Backfill missing program_role_id in member_program_item_tasks
-- ============================================================================
-- This updates existing tasks to have the correct role from therapy_tasks
UPDATE member_program_item_tasks mpit
SET 
  program_role_id = tt.program_role_id,
  updated_at = NOW(),
  updated_by = auth.uid()
FROM therapy_tasks tt
WHERE mpit.task_id = tt.task_id
  AND (mpit.program_role_id IS NULL OR mpit.program_role_id != tt.program_role_id);

-- ============================================================================
-- STEP 6: Backfill missing program_role_id in member_program_items_task_schedule
-- ============================================================================
-- This updates existing schedule tasks to have the correct role from therapy_tasks
UPDATE member_program_items_task_schedule mpits
SET 
  program_role_id = tt.program_role_id,
  updated_at = NOW()
FROM member_program_item_tasks mpit
INNER JOIN therapy_tasks tt ON mpit.task_id = tt.task_id
WHERE mpits.member_program_item_task_id = mpit.member_program_item_task_id
  AND (mpits.program_role_id IS NULL OR mpits.program_role_id != tt.program_role_id);

-- ============================================================================
-- STEP 7: Verify the fix - should return 0 rows
-- ============================================================================
SELECT 
  'VERIFICATION: member_program_item_tasks with wrong/missing role' as check_name,
  COUNT(*) as count
FROM member_program_item_tasks mpit
LEFT JOIN therapy_tasks tt ON mpit.task_id = tt.task_id
WHERE mpit.program_role_id IS NULL 
   OR mpit.program_role_id != tt.program_role_id;

SELECT 
  'VERIFICATION: member_program_items_task_schedule with wrong/missing role' as check_name,
  COUNT(*) as count
FROM member_program_items_task_schedule mpits
INNER JOIN member_program_item_tasks mpit ON mpits.member_program_item_task_id = mpit.member_program_item_task_id
LEFT JOIN therapy_tasks tt ON mpit.task_id = tt.task_id
WHERE mpits.program_role_id IS NULL 
   OR mpits.program_role_id != tt.program_role_id;

-- ============================================================================
-- STEP 8: Summary Report
-- ============================================================================
SELECT 
  pr.role_name,
  COUNT(DISTINCT mpit.member_program_item_task_id) as task_count,
  COUNT(DISTINCT mpits.member_program_item_task_schedule_id) as schedule_task_count
FROM program_roles pr
LEFT JOIN member_program_item_tasks mpit ON pr.program_role_id = mpit.program_role_id
LEFT JOIN member_program_items_task_schedule mpits ON pr.program_role_id = mpits.program_role_id
GROUP BY pr.role_name, pr.display_order
ORDER BY pr.display_order;

