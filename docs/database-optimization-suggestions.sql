-- ============================================================
-- DATABASE OPTIMIZATION SUGGESTIONS
-- ============================================================
-- These SQL queries can be run to further optimize database
-- performance. Review each suggestion and run as appropriate.
-- ============================================================

-- ============================================================
-- 1. INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================

-- Leads table optimizations
CREATE INDEX IF NOT EXISTS idx_leads_status_id ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_active_flag ON leads(active_flag) WHERE active_flag = true;
CREATE INDEX IF NOT EXISTS idx_leads_status_pmedate ON leads(status_id, pmedate) WHERE status_id = 2 AND pmedate IS NULL;

-- Lead notes optimizations (for note counting and follow-up queries)
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_type_created ON lead_notes(note_type, created_at DESC) WHERE note_type = 'Follow-Up';
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_type ON lead_notes(lead_id, note_type);

-- Member programs optimizations
CREATE INDEX IF NOT EXISTS idx_member_programs_active_flag ON member_programs(active_flag) WHERE active_flag = true;
CREATE INDEX IF NOT EXISTS idx_member_programs_lead_id ON member_programs(lead_id);
CREATE INDEX IF NOT EXISTS idx_member_programs_status_id ON member_programs(program_status_id);

-- Users table optimizations (for created_by/updated_by lookups)
CREATE INDEX IF NOT EXISTS idx_users_id_email_name ON users(id, email, full_name);

-- ============================================================
-- 2. MATERIALIZED VIEW FOR LEAD NOTES SUMMARY
-- ============================================================
-- This view pre-aggregates note counts and last follow-up notes
-- Refresh strategy: Refresh after lead_notes inserts/updates
-- or on a schedule (e.g., every 5 minutes)

CREATE MATERIALIZED VIEW IF NOT EXISTS lead_notes_summary AS
SELECT 
  lead_id,
  COUNT(*) as note_count,
  MAX(CASE 
    WHEN note_type = 'Follow-Up' 
    THEN note 
  END) as last_followup_note,
  MAX(CASE 
    WHEN note_type = 'Follow-Up' 
    THEN created_at 
  END) as last_followup_date
FROM lead_notes
GROUP BY lead_id;

CREATE UNIQUE INDEX ON lead_notes_summary(lead_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_lead_notes_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY lead_notes_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. DATABASE FUNCTION FOR LEAD METADATA
-- ============================================================
-- Alternative approach: Use a function instead of materialized view
-- This is more real-time but slightly slower

CREATE OR REPLACE FUNCTION get_lead_metadata(lead_ids INTEGER[])
RETURNS TABLE (
  lead_id INTEGER,
  note_count BIGINT,
  last_followup_note TEXT,
  last_followup_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ln.lead_id,
    COUNT(*)::BIGINT as note_count,
    (SELECT note FROM lead_notes 
     WHERE lead_id = ln.lead_id 
     AND note_type = 'Follow-Up' 
     ORDER BY created_at DESC LIMIT 1) as last_followup_note,
    (SELECT created_at FROM lead_notes 
     WHERE lead_id = ln.lead_id 
     AND note_type = 'Follow-Up' 
     ORDER BY created_at DESC LIMIT 1) as last_followup_date
  FROM lead_notes ln
  WHERE ln.lead_id = ANY(lead_ids)
  GROUP BY ln.lead_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 4. COMPOSITE INDEXES FOR COMMON FILTER COMBINATIONS
-- ============================================================

-- For leads page filtering
CREATE INDEX IF NOT EXISTS idx_leads_status_active ON leads(status_id, active_flag) WHERE active_flag = true;

-- For member programs filtering
CREATE INDEX IF NOT EXISTS idx_member_programs_status_active ON member_programs(program_status_id, active_flag) WHERE active_flag = true;

-- ============================================================
-- 5. ANALYZE TABLES FOR QUERY PLANNER OPTIMIZATION
-- ============================================================
-- Run ANALYZE to update statistics for the query planner

ANALYZE leads;
ANALYZE lead_notes;
ANALYZE member_programs;
ANALYZE users;
ANALYZE campaigns;
ANALYZE status;

-- ============================================================
-- 6. QUERY PERFORMANCE MONITORING
-- ============================================================
-- Enable query logging to identify slow queries
-- (Run in Supabase dashboard SQL editor)

-- Enable pg_stat_statements extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================================
-- 7. VACUUM AND REINDEX (Maintenance)
-- ============================================================
-- Run periodically to maintain database performance
-- (Usually handled automatically by Supabase, but can run manually)

-- VACUUM ANALYZE leads;
-- VACUUM ANALYZE lead_notes;
-- REINDEX TABLE leads;
-- REINDEX TABLE lead_notes;

-- ============================================================
-- USAGE NOTES
-- ============================================================

-- If using materialized view approach:
-- 1. Update API route to query lead_notes_summary instead of lead_notes
-- 2. Refresh view after lead_notes inserts/updates (via trigger or cron)
-- 3. Or refresh on-demand before queries

-- If using function approach:
-- 1. Update API route to call get_lead_metadata() function
-- 2. More real-time but requires function call overhead
-- 3. Better for frequently changing data

-- Recommended approach:
-- - Use materialized view for lead_notes_summary (refresh every 5 min or on-demand)
-- - Use indexes for all common query patterns
-- - Monitor slow queries and optimize as needed
