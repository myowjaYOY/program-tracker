-- Direct SQL Backfill for Member Progress Dashboards
-- This script manually calculates and inserts dashboard summaries for all members in batch 40
-- Run this to populate member_progress_summary for the 52 members

-- Get the 52 unique lead_ids from batch 40
WITH batch_40_leads AS (
  SELECT DISTINCT lead_id
  FROM survey_response_sessions
  WHERE import_batch_id = 40
)
-- For each lead, create a basic dashboard entry
-- The edge function will properly calculate metrics on next real survey import
INSERT INTO member_progress_summary (
  lead_id,
  total_surveys_completed,
  status_indicator,
  module_sequence,
  completed_milestones,
  overdue_milestones,
  calculated_at,
  last_import_batch_id
)
SELECT 
  bl.lead_id,
  COALESCE((
    SELECT COUNT(DISTINCT srs.session_id)
    FROM survey_response_sessions srs
    WHERE srs.lead_id = bl.lead_id
  ), 0) as total_surveys,
  'green' as status_indicator,
  '[]'::jsonb as module_sequence, -- Will be populated by edge function
  '[]'::jsonb as completed_milestones,
  '[]'::jsonb as overdue_milestones,
  NOW() as calculated_at,
  40 as last_import_batch_id
FROM batch_40_leads bl
ON CONFLICT (lead_id) DO UPDATE SET
  total_surveys_completed = EXCLUDED.total_surveys_completed,
  calculated_at = EXCLUDED.calculated_at,
  last_import_batch_id = EXCLUDED.last_import_batch_id;

-- Verify results
SELECT 
  COUNT(*) as total_dashboards,
  COUNT(CASE WHEN last_import_batch_id = 40 THEN 1 END) as from_batch_40
FROM member_progress_summary;

