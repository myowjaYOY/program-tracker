-- Backfill module_sequence for existing member_progress_summary records
-- This updates all existing records with their program's module sequence
-- Migration date: 2025-10-26

-- Create a temporary function to get module sequence for a program
CREATE OR REPLACE FUNCTION get_module_sequence_for_program(p_program_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_module_sequence JSONB;
BEGIN
  -- Get ordered module names for the program
  SELECT jsonb_agg(module_name ORDER BY 
    -- Sort by extracting module number from "MODULE X - ..." pattern
    CAST(SUBSTRING(module_name FROM 'MODULE ([0-9]+)') AS INTEGER)
  )
  INTO v_module_sequence
  FROM survey_modules
  WHERE program_id = p_program_id
    AND active_flag = true;
  
  -- Return empty array if no modules found
  RETURN COALESCE(v_module_sequence, '[]'::jsonb);
END;
$$;

-- Update all existing records with their program's module sequence
UPDATE member_progress_summary mps
SET module_sequence = get_module_sequence_for_program(sup.program_id)
FROM survey_user_mappings sum
JOIN survey_user_progress sup ON sum.mapping_id = sup.mapping_id
WHERE mps.lead_id = sum.lead_id
  AND (mps.module_sequence = '[]'::jsonb OR mps.module_sequence IS NULL);

-- Drop the temporary function
DROP FUNCTION IF EXISTS get_module_sequence_for_program(INTEGER);

-- Show results
SELECT 
  mps.lead_id,
  sup.program_id,
  sp.program_name,
  jsonb_array_length(mps.module_sequence) as module_count,
  mps.module_sequence
FROM member_progress_summary mps
JOIN survey_user_mappings sum ON mps.lead_id = sum.lead_id
JOIN survey_user_progress sup ON sum.mapping_id = sup.mapping_id
JOIN survey_programs sp ON sup.program_id = sp.program_id
WHERE jsonb_array_length(mps.module_sequence) > 0
ORDER BY mps.lead_id;

