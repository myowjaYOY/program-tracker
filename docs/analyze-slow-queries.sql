-- ============================================================
-- ANALYZE SLOW QUERIES - TARGETED FOR LEADS PAGE
-- ============================================================
-- Run this to find queries specifically related to leads
-- and identify optimization opportunities
-- ============================================================

-- 1. Find all queries related to 'leads' table
SELECT 
  LEFT(query, 100) as query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_ms,
  ROUND(max_exec_time::numeric, 2) as max_ms,
  ROUND((mean_exec_time * calls)::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query ILIKE '%leads%'
  AND query NOT ILIKE '%pg_stat_statements%'  -- Exclude this query itself
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 2. Find all queries related to 'lead_notes' table
SELECT 
  LEFT(query, 100) as query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_ms,
  ROUND(max_exec_time::numeric, 2) as max_ms
FROM pg_stat_statements
WHERE query ILIKE '%lead_notes%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 3. Find slow SELECT queries (likely from API routes)
SELECT 
  LEFT(query, 150) as query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_ms,
  ROUND(max_exec_time::numeric, 2) as max_ms,
  ROUND((mean_exec_time * calls)::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query ILIKE 'SELECT%'
  AND mean_exec_time > 100  -- Only queries taking > 100ms
  AND calls > 5  -- Only frequently called queries
ORDER BY mean_exec_time DESC
LIMIT 30;

-- 4. Find queries with JOINs that might be slow
SELECT 
  LEFT(query, 150) as query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_ms,
  ROUND(max_exec_time::numeric, 2) as max_ms
FROM pg_stat_statements
WHERE (query ILIKE '%JOIN%' OR query ILIKE '%LATERAL%')
  AND mean_exec_time > 50
  AND calls > 3
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 5. Check for missing indexes on leads table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'leads'
ORDER BY indexname;

-- 6. Check for missing indexes on lead_notes table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'lead_notes'
ORDER BY indexname;

-- 7. Analyze table statistics (check if ANALYZE needs to be run)
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('leads', 'lead_notes', 'users', 'campaigns', 'status')
ORDER BY tablename;

-- 8. Check for sequential scans on leads table (bad - should use indexes)
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE 
    WHEN seq_scan > 0 THEN ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
    ELSE 0
  END as seq_scan_percentage
FROM pg_stat_user_tables
WHERE tablename IN ('leads', 'lead_notes')
ORDER BY seq_scan_percentage DESC;
