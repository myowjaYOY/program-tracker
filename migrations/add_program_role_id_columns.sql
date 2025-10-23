-- ============================================================================
-- Migration: Add program_role_id to therapies, items, tasks, and schedules
-- Date: 2025-10-21
-- Purpose: Add responsible role tracking to all therapy-related entities
-- Default: ID 2 (Admin role)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD COLUMNS TO MASTER TABLES (therapies and therapy_tasks)
-- ============================================================================

-- Add program_role_id to therapies (master definition of default role)
ALTER TABLE public.therapies 
  ADD COLUMN program_role_id integer DEFAULT 2 NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.therapies
  ADD CONSTRAINT therapies_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.therapies.program_role_id IS 
  'Default role responsible for this therapy type (e.g., Provider, Coordinator, Admin). Inherits to template items and member program items.';

-- Add program_role_id to therapy_tasks
ALTER TABLE public.therapy_tasks 
  ADD COLUMN program_role_id integer DEFAULT 2;

-- Add foreign key constraint
ALTER TABLE public.therapy_tasks
  ADD CONSTRAINT therapy_tasks_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.therapy_tasks.program_role_id IS 
  'Role responsible for this task (optional). Inherits to member program item tasks when program is instantiated.';

-- ============================================================================
-- 2. ADD COLUMNS TO TEMPLATE TABLES
-- ============================================================================

-- Add program_role_id to program_template_items
ALTER TABLE public.program_template_items 
  ADD COLUMN program_role_id integer DEFAULT 2;

-- Add foreign key constraint
ALTER TABLE public.program_template_items
  ADD CONSTRAINT program_template_items_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.program_template_items.program_role_id IS 
  'Role responsible for items from this template (inherited from therapy, can be overridden). Propagates to member program items.';

-- ============================================================================
-- 3. ADD COLUMNS TO MEMBER PROGRAM TABLES
-- ============================================================================

-- Add program_role_id to member_program_items
ALTER TABLE public.member_program_items 
  ADD COLUMN program_role_id integer DEFAULT 2;

-- Add foreign key constraint
ALTER TABLE public.member_program_items
  ADD CONSTRAINT member_program_items_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.member_program_items.program_role_id IS 
  'Role responsible for this item (inherited from template, can be overridden manually). Copied to schedule for filtering.';

-- Add program_role_id to member_program_item_tasks
ALTER TABLE public.member_program_item_tasks 
  ADD COLUMN program_role_id integer DEFAULT 2;

-- Add foreign key constraint
ALTER TABLE public.member_program_item_tasks
  ADD CONSTRAINT member_program_item_tasks_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.member_program_item_tasks.program_role_id IS 
  'Role responsible for this task (inherited from therapy_tasks). Copied to task schedule for filtering.';

-- ============================================================================
-- 4. ADD COLUMNS TO SCHEDULE TABLES (for coordinator filtering)
-- ============================================================================

-- Add program_role_id to member_program_item_schedule (script items)
ALTER TABLE public.member_program_item_schedule 
  ADD COLUMN program_role_id integer DEFAULT 2;

-- Add foreign key constraint
ALTER TABLE public.member_program_item_schedule
  ADD CONSTRAINT member_program_item_schedule_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.member_program_item_schedule.program_role_id IS 
  'Role responsible for this scheduled item occurrence (copied from member_program_items). Used for coordinator script filtering.';

-- Add program_role_id to member_program_items_task_schedule (todo items)
ALTER TABLE public.member_program_items_task_schedule 
  ADD COLUMN program_role_id integer DEFAULT 2;

-- Add foreign key constraint
ALTER TABLE public.member_program_items_task_schedule
  ADD CONSTRAINT member_program_items_task_schedule_program_role_id_fkey 
  FOREIGN KEY (program_role_id) 
  REFERENCES public.program_roles(program_role_id);

-- Add column comment
COMMENT ON COLUMN public.member_program_items_task_schedule.program_role_id IS 
  'Role responsible for this scheduled task (copied from member_program_item_tasks). Used for coordinator todo filtering.';

-- ============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE (filtered indexes for non-null values)
-- ============================================================================

-- Index on therapies (likely to filter/sort by role)
CREATE INDEX idx_therapies_program_role_id 
  ON public.therapies(program_role_id);

-- Index on therapy_tasks (for filtering tasks by role)
CREATE INDEX idx_therapy_tasks_program_role_id 
  ON public.therapy_tasks(program_role_id) 
  WHERE program_role_id IS NOT NULL;

-- Index on program_template_items (for filtering template items by role)
CREATE INDEX idx_program_template_items_program_role_id 
  ON public.program_template_items(program_role_id) 
  WHERE program_role_id IS NOT NULL;

-- Index on member_program_items (for filtering program items by role)
CREATE INDEX idx_member_program_items_program_role_id 
  ON public.member_program_items(program_role_id) 
  WHERE program_role_id IS NOT NULL;

-- Index on member_program_item_tasks (for filtering tasks by role)
CREATE INDEX idx_member_program_item_tasks_program_role_id 
  ON public.member_program_item_tasks(program_role_id) 
  WHERE program_role_id IS NOT NULL;

-- Index on member_program_item_schedule (CRITICAL - for coordinator script filtering)
CREATE INDEX idx_member_program_item_schedule_program_role_id 
  ON public.member_program_item_schedule(program_role_id) 
  WHERE program_role_id IS NOT NULL;

-- Index on member_program_items_task_schedule (CRITICAL - for coordinator todo filtering)
CREATE INDEX idx_member_program_items_task_schedule_program_role_id 
  ON public.member_program_items_task_schedule(program_role_id) 
  WHERE program_role_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to verify)
-- ============================================================================

-- Verify columns were added
-- SELECT 
--   table_name,
--   column_name,
--   data_type,
--   column_default,
--   is_nullable
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
--   )
-- ORDER BY table_name;

-- Verify foreign keys were created
-- SELECT
--   tc.table_name,
--   tc.constraint_name,
--   tc.constraint_type,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
--   AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
--   AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'program_role_id'
--   AND tc.table_schema = 'public'
-- ORDER BY tc.table_name;

-- Verify indexes were created
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE indexname LIKE '%program_role_id%'
--   AND schemaname = 'public'
-- ORDER BY tablename, indexname;

-- Count records by role (should all be ID 2 - Admin by default)
-- SELECT 'therapies' as table_name, program_role_id, COUNT(*) as count
-- FROM therapies
-- GROUP BY program_role_id
-- UNION ALL
-- SELECT 'therapy_tasks', program_role_id, COUNT(*)
-- FROM therapy_tasks
-- GROUP BY program_role_id
-- UNION ALL
-- SELECT 'program_template_items', program_role_id, COUNT(*)
-- FROM program_template_items
-- GROUP BY program_role_id
-- UNION ALL
-- SELECT 'member_program_items', program_role_id, COUNT(*)
-- FROM member_program_items
-- GROUP BY program_role_id
-- ORDER BY table_name, program_role_id;


