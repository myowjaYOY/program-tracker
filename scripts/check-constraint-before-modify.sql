-- ============================================================================
-- Helper Script: Check Constraint Before Modifying
-- ============================================================================
-- Usage: Replace 'YOUR_TABLE_NAME' with the table you're modifying
--        Run this BEFORE writing your migration
-- ============================================================================

-- 1. List ALL constraints on the table
SELECT 
  conname AS constraint_name,
  CASE contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 't' THEN 'TRIGGER'
    WHEN 'x' THEN 'EXCLUSION'
  END AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint 
WHERE conrelid = 'YOUR_TABLE_NAME'::regclass
ORDER BY contype, conname;

-- 2. List ALL triggers on the table
SELECT 
  tgname AS trigger_name,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'YOUR_TABLE_NAME'::regclass
  AND tgisinternal = false
ORDER BY tgname;

-- 3. Find tables that reference this table (foreign keys)
SELECT
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'YOUR_TABLE_NAME'
ORDER BY tc.table_name;

-- 4. Find tables this table references (dependencies)
SELECT
  tc.table_name AS this_table,
  kcu.column_name AS this_column,
  ccu.table_name AS depends_on_table,
  ccu.column_name AS depends_on_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'YOUR_TABLE_NAME'
ORDER BY ccu.table_name;

-- 5. Check for existing data that might violate new constraints
-- (Customize this based on your specific change)
-- Example: If adding a new CHECK constraint value
/*
SELECT DISTINCT column_name, COUNT(*) 
FROM YOUR_TABLE_NAME 
GROUP BY column_name
ORDER BY column_name;
*/

















