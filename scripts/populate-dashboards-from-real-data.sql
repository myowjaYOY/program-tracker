-- Populate member_progress_summary directly from existing survey data
-- This script calculates dashboards for all members with survey data
-- WITHOUT needing to trigger the edge function or add test data

-- Step 1: Create a temporary function to calculate days in program
CREATE OR REPLACE FUNCTION calculate_days_in_program(p_start_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF p_start_date IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN FLOOR(EXTRACT(EPOCH FROM (NOW() - p_start_date)) / 86400)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Populate member_progress_summary for all members with survey data
INSERT INTO member_progress_summary (
  lead_id,
  last_survey_date,
  last_survey_name,
  total_surveys_completed,
  days_in_program,
  status_indicator,
  current_weight,
  weight_change,
  module_sequence,
  completed_milestones,
  next_milestone,
  overdue_milestones,
  latest_wins,
  latest_concerns,
  goals,
  calculated_at
)
SELECT 
  sum.lead_id,
  
  -- Last survey info
  (SELECT srs.completed_on 
   FROM survey_response_sessions srs 
   WHERE srs.external_user_id = sum.external_user_id 
     AND srs.form_id NOT IN (3, 6)
   ORDER BY srs.completed_on DESC 
   LIMIT 1) as last_survey_date,
  
  (SELECT sf.form_name 
   FROM survey_response_sessions srs 
   JOIN survey_forms sf ON srs.form_id = sf.form_id
   WHERE srs.external_user_id = sum.external_user_id 
     AND srs.form_id NOT IN (3, 6)
   ORDER BY srs.completed_on DESC 
   LIMIT 1) as last_survey_name,
  
  -- Total surveys (excluding MSQ and PROMIS)
  (SELECT COUNT(*) 
   FROM survey_response_sessions srs 
   WHERE srs.external_user_id = sum.external_user_id 
     AND srs.form_id NOT IN (3, 6)) as total_surveys_completed,
  
  -- Days in program
  calculate_days_in_program(mp.start_date) as days_in_program,
  
  -- Status indicator (default to yellow for now, edge function will calculate properly)
  CASE 
    WHEN sup.status = 'Behind' THEN 'red'
    WHEN sup.status = 'Current' THEN 'green'
    ELSE 'yellow'
  END as status_indicator,
  
  -- Current weight (last weight entry)
  (SELECT sr.answer_numeric::NUMERIC
   FROM survey_responses sr
   JOIN survey_questions sq ON sr.question_id = sq.question_id
   JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
   WHERE srs.external_user_id = sum.external_user_id
     AND LOWER(sq.question_text) LIKE '%current weight%'
     AND sr.answer_numeric IS NOT NULL
     AND sr.answer_numeric::NUMERIC > 0
     AND sr.answer_numeric::NUMERIC < 500
   ORDER BY srs.completed_on DESC
   LIMIT 1) as current_weight,
  
  -- Weight change (last - first)
  (SELECT 
     (SELECT sr2.answer_numeric::NUMERIC
      FROM survey_responses sr2
      JOIN survey_questions sq2 ON sr2.question_id = sq2.question_id
      JOIN survey_response_sessions srs2 ON sr2.session_id = srs2.session_id
      WHERE srs2.external_user_id = sum.external_user_id
        AND LOWER(sq2.question_text) LIKE '%current weight%'
        AND sr2.answer_numeric IS NOT NULL
        AND sr2.answer_numeric::NUMERIC > 0
        AND sr2.answer_numeric::NUMERIC < 500
      ORDER BY srs2.completed_on DESC
      LIMIT 1)
     -
     (SELECT sr3.answer_numeric::NUMERIC
      FROM survey_responses sr3
      JOIN survey_questions sq3 ON sr3.question_id = sq3.question_id
      JOIN survey_response_sessions srs3 ON sr3.session_id = srs3.session_id
      WHERE srs3.external_user_id = sum.external_user_id
        AND LOWER(sq3.question_text) LIKE '%current weight%'
        AND sr3.answer_numeric IS NOT NULL
        AND sr3.answer_numeric::NUMERIC > 0
        AND sr3.answer_numeric::NUMERIC < 500
      ORDER BY srs3.completed_on ASC
      LIMIT 1)
  ) as weight_change,
  
  -- Module sequence from survey_modules for this member's program
  COALESCE(
    (SELECT jsonb_agg(sm.module_name ORDER BY 
       COALESCE(sm.module_order, 
         CAST(SUBSTRING(sm.module_name FROM 'MODULE (\d+)') AS INTEGER), 
         9999))
     FROM survey_modules sm
     WHERE sm.program_id = COALESCE(sup.program_id, 2)
       AND sm.active_flag = true),
    '[]'::jsonb
  ) as module_sequence,
  
  -- Completed milestones from survey_user_progress
  CASE 
    WHEN sup.last_completed IS NOT NULL THEN
      (SELECT jsonb_agg(sm.module_name ORDER BY sm.module_order)
       FROM survey_modules sm
       WHERE sm.program_id = sup.program_id
         AND sm.active_flag = true
         AND sm.module_order <= (
           SELECT module_order 
           FROM survey_modules 
           WHERE program_id = sup.program_id 
             AND module_name = sup.last_completed
         ))
    ELSE '[]'::jsonb
  END as completed_milestones,
  
  -- Next milestone
  CASE 
    WHEN sup.working_on = 'Finished' THEN 'Program Complete'
    WHEN sup.last_completed IS NOT NULL THEN
      (SELECT sm.module_name
       FROM survey_modules sm
       WHERE sm.program_id = sup.program_id
         AND sm.active_flag = true
         AND sm.module_order = (
           SELECT module_order + 1
           FROM survey_modules 
           WHERE program_id = sup.program_id 
             AND module_name = sup.last_completed
           LIMIT 1
         )
       LIMIT 1)
    ELSE NULL
  END as next_milestone,
  
  -- Overdue milestones
  CASE 
    WHEN sup.last_completed IS NOT NULL 
     AND sup.working_on IS NOT NULL 
     AND sup.status = 'Behind' THEN
      (SELECT jsonb_agg(sm.module_name ORDER BY sm.module_order)
       FROM survey_modules sm
       WHERE sm.program_id = sup.program_id
         AND sm.active_flag = true
         AND sm.module_order > (
           SELECT module_order 
           FROM survey_modules 
           WHERE program_id = sup.program_id 
             AND module_name = sup.last_completed
           LIMIT 1
         )
         AND sm.module_order <= (
           SELECT module_order 
           FROM survey_modules 
           WHERE program_id = sup.program_id 
             AND module_name = sup.working_on
           LIMIT 1
         ))
    ELSE '[]'::jsonb
  END as overdue_milestones,
  
  -- Placeholders for complex calculations (edge function will fill these properly)
  '[]'::jsonb as latest_wins,
  '[]'::jsonb as latest_concerns,
  '[]'::jsonb as goals,
  
  NOW() as calculated_at

FROM survey_user_mappings sum
LEFT JOIN member_programs mp ON sum.lead_id = mp.lead_id AND mp.active_flag = true
LEFT JOIN survey_user_progress sup ON sum.mapping_id = sup.mapping_id
WHERE EXISTS (
  SELECT 1 
  FROM survey_response_sessions srs 
  WHERE srs.external_user_id = sum.external_user_id
)
ON CONFLICT (lead_id) DO UPDATE SET
  last_survey_date = EXCLUDED.last_survey_date,
  last_survey_name = EXCLUDED.last_survey_name,
  total_surveys_completed = EXCLUDED.total_surveys_completed,
  days_in_program = EXCLUDED.days_in_program,
  status_indicator = EXCLUDED.status_indicator,
  current_weight = EXCLUDED.current_weight,
  weight_change = EXCLUDED.weight_change,
  module_sequence = EXCLUDED.module_sequence,
  completed_milestones = EXCLUDED.completed_milestones,
  next_milestone = EXCLUDED.next_milestone,
  overdue_milestones = EXCLUDED.overdue_milestones,
  calculated_at = EXCLUDED.calculated_at;

-- Step 3: Verify results
SELECT 
  COUNT(*) as total_dashboards,
  COUNT(CASE WHEN days_in_program IS NOT NULL THEN 1 END) as with_days_in_program,
  COUNT(CASE WHEN last_survey_name IS NOT NULL THEN 1 END) as with_last_survey,
  COUNT(CASE WHEN current_weight IS NOT NULL THEN 1 END) as with_weight_data,
  COUNT(CASE WHEN weight_change IS NOT NULL THEN 1 END) as with_weight_change
FROM member_progress_summary;

-- Step 4: Clean up temporary function
DROP FUNCTION IF EXISTS calculate_days_in_program(DATE);

