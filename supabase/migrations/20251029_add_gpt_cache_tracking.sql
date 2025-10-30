-- Add column to track when GPT analysis was last run
-- This enables smart caching to avoid re-running expensive GPT calls on unchanged data

ALTER TABLE member_progress_summary
ADD COLUMN IF NOT EXISTS last_analyzed_session_count INTEGER DEFAULT 0;

COMMENT ON COLUMN member_progress_summary.last_analyzed_session_count 
IS 'Number of surveys that existed when GPT last analyzed this member. Used to determine if re-analysis is needed.';

-- Backfill existing rows to 0 (will trigger GPT on first run)
UPDATE member_progress_summary
SET last_analyzed_session_count = 0
WHERE last_analyzed_session_count IS NULL;


