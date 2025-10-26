-- Add module_sequence column to member_progress_summary table
-- This stores the complete ordered list of module names for the member's program
-- Allows frontend to display full timeline without querying survey_modules table
-- Migration date: 2025-10-26

-- Add column
ALTER TABLE member_progress_summary 
ADD COLUMN IF NOT EXISTS module_sequence JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN member_progress_summary.module_sequence IS 
'Complete ordered list of module names from survey_modules table for this member''s program. Used by frontend to render full curriculum timeline.';

-- Create index for potential queries (optional, for performance)
-- Not strictly necessary since we're selecting by lead_id (primary key), but helpful if we query by program
-- CREATE INDEX IF NOT EXISTS idx_member_progress_summary_module_sequence ON member_progress_summary USING GIN (module_sequence);

