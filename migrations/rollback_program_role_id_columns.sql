-- ============================================================================
-- ROLLBACK: Remove program_role_id from all tables
-- Date: 2025-10-21
-- Purpose: Rollback the add_program_role_id_columns.sql migration
-- WARNING: This will permanently delete all role assignments!
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP INDEXES (must be dropped before columns)
-- ============================================================================

DROP INDEX IF EXISTS public.idx_member_program_items_task_schedule_program_role_id;
DROP INDEX IF EXISTS public.idx_member_program_item_schedule_program_role_id;
DROP INDEX IF EXISTS public.idx_member_program_item_tasks_program_role_id;
DROP INDEX IF EXISTS public.idx_member_program_items_program_role_id;
DROP INDEX IF EXISTS public.idx_program_template_items_program_role_id;
DROP INDEX IF EXISTS public.idx_therapy_tasks_program_role_id;
DROP INDEX IF EXISTS public.idx_therapies_program_role_id;

-- ============================================================================
-- 2. DROP FOREIGN KEY CONSTRAINTS (must be dropped before columns)
-- ============================================================================

ALTER TABLE public.member_program_items_task_schedule
  DROP CONSTRAINT IF EXISTS member_program_items_task_schedule_program_role_id_fkey;

ALTER TABLE public.member_program_item_schedule
  DROP CONSTRAINT IF EXISTS member_program_item_schedule_program_role_id_fkey;

ALTER TABLE public.member_program_item_tasks
  DROP CONSTRAINT IF EXISTS member_program_item_tasks_program_role_id_fkey;

ALTER TABLE public.member_program_items
  DROP CONSTRAINT IF EXISTS member_program_items_program_role_id_fkey;

ALTER TABLE public.program_template_items
  DROP CONSTRAINT IF EXISTS program_template_items_program_role_id_fkey;

ALTER TABLE public.therapy_tasks
  DROP CONSTRAINT IF EXISTS therapy_tasks_program_role_id_fkey;

ALTER TABLE public.therapies
  DROP CONSTRAINT IF EXISTS therapies_program_role_id_fkey;

-- ============================================================================
-- 3. DROP COLUMNS (in reverse order of addition)
-- ============================================================================

-- Schedule tables (todo and script)
ALTER TABLE public.member_program_items_task_schedule
  DROP COLUMN IF EXISTS program_role_id;

ALTER TABLE public.member_program_item_schedule
  DROP COLUMN IF EXISTS program_role_id;

-- Member program tables
ALTER TABLE public.member_program_item_tasks
  DROP COLUMN IF EXISTS program_role_id;

ALTER TABLE public.member_program_items
  DROP COLUMN IF EXISTS program_role_id;

-- Template tables
ALTER TABLE public.program_template_items
  DROP COLUMN IF EXISTS program_role_id;

-- Master tables
ALTER TABLE public.therapy_tasks
  DROP COLUMN IF EXISTS program_role_id;

ALTER TABLE public.therapies
  DROP COLUMN IF EXISTS program_role_id;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after rollback to verify)
-- ============================================================================

-- Verify columns were removed (should return 0 rows)
-- SELECT 
--   table_name,
--   column_name
-- FROM information_schema.columns
-- WHERE column_name = 'program_role_id'
--   AND table_schema = 'public'
--   AND table_name IN (
--     'therapies',
--     'therapy_tasks',
--     'program_template_items',
--     'member_program_items',
--     'member_program_item_tasks',
--     'member_program_item_schedule',
--     'member_program_items_task_schedule'
--   );

-- Verify foreign keys were removed (should return 0 rows)
-- SELECT
--   tc.table_name,
--   tc.constraint_name
-- FROM information_schema.table_constraints tc
-- WHERE tc.constraint_name LIKE '%program_role_id%'
--   AND tc.table_schema = 'public';

-- Verify indexes were removed (should return 0 rows)
-- SELECT
--   tablename,
--   indexname
-- FROM pg_indexes
-- WHERE indexname LIKE '%program_role_id%'
--   AND schemaname = 'public';


