-- Fix Program Complete Logic in member_progress_summary
-- 
-- Problem: Members with working_on='Finished' show "Program Complete" even though
-- they haven't actually completed all modules
--
-- Solution: Recalculate next_milestone and overdue_milestones based on ACTUAL completion

-- Step 1: Create a temporary function to recalculate timeline data
CREATE OR REPLACE FUNCTION recalculate_timeline_data()
RETURNS void AS $$
DECLARE
  rec RECORD;
  module_seq JSONB;
  completed_mods JSONB;
  last_completed TEXT;
  working_on_val TEXT;
  last_completed_idx INT;
  total_modules INT;
  new_next_milestone TEXT;
  new_overdue_milestones JSONB;
  i INT;
BEGIN
  -- Loop through all members with progress data
  FOR rec IN 
    SELECT 
      mps.lead_id,
      mps.module_sequence,
      mps.completed_milestones,
      sup.last_completed,
      sup.working_on
    FROM member_progress_summary mps
    JOIN survey_user_mappings sum ON mps.lead_id = sum.lead_id
    LEFT JOIN survey_user_progress sup ON sum.mapping_id = sup.mapping_id
    WHERE mps.module_sequence IS NOT NULL 
      AND mps.module_sequence != '[]'::jsonb
  LOOP
    -- Get data
    module_seq := rec.module_sequence;
    completed_mods := rec.completed_milestones;
    last_completed := rec.last_completed;
    working_on_val := rec.working_on;
    
    -- Skip if no data
    IF module_seq IS NULL OR last_completed IS NULL THEN
      CONTINUE;
    END IF;
    
    total_modules := jsonb_array_length(module_seq);
    
    -- Find last_completed index in module_sequence
    last_completed_idx := -1;
    FOR i IN 0..(total_modules - 1) LOOP
      IF module_seq->i->>0 = last_completed THEN
        last_completed_idx := i;
        EXIT;
      END IF;
    END LOOP;
    
    -- Calculate next_milestone
    -- ONLY show "Program Complete" if they've ACTUALLY finished all modules
    IF last_completed_idx >= 0 AND last_completed_idx = total_modules - 1 THEN
      new_next_milestone := 'Program Complete';
    ELSIF last_completed_idx >= 0 AND last_completed_idx < total_modules - 1 THEN
      new_next_milestone := module_seq->(last_completed_idx + 1)->>0;
    ELSE
      new_next_milestone := NULL;
    END IF;
    
    -- Calculate overdue_milestones
    new_overdue_milestones := '[]'::jsonb;
    
    -- SPECIAL CASE: If working_on = "Finished" but not all modules completed
    IF working_on_val = 'Finished' 
       AND last_completed_idx >= 0 
       AND last_completed_idx < total_modules - 1 THEN
      -- All remaining modules are overdue
      FOR i IN (last_completed_idx + 1)..(total_modules - 1) LOOP
        new_overdue_milestones := new_overdue_milestones || jsonb_build_array(module_seq->i->>0);
      END LOOP;
    ELSE
      -- Normal case: find working_on index and mark modules between as overdue
      DECLARE
        working_on_idx INT := -1;
      BEGIN
        FOR i IN 0..(total_modules - 1) LOOP
          IF module_seq->i->>0 = working_on_val THEN
            working_on_idx := i;
            EXIT;
          END IF;
        END LOOP;
        
        IF last_completed_idx >= 0 
           AND working_on_idx >= 0 
           AND working_on_idx > last_completed_idx THEN
          FOR i IN (last_completed_idx + 1)..working_on_idx LOOP
            IF i < total_modules THEN
              new_overdue_milestones := new_overdue_milestones || jsonb_build_array(module_seq->i->>0);
            END IF;
          END LOOP;
        END IF;
      END;
    END IF;
    
    -- Update the record
    UPDATE member_progress_summary
    SET 
      next_milestone = new_next_milestone,
      overdue_milestones = new_overdue_milestones
    WHERE lead_id = rec.lead_id;
    
    RAISE NOTICE 'Updated lead %: next_milestone=%, overdue_count=%', 
      rec.lead_id, new_next_milestone, jsonb_array_length(new_overdue_milestones);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Run the recalculation
SELECT recalculate_timeline_data();

-- Step 3: Clean up the temporary function
DROP FUNCTION recalculate_timeline_data();

-- Step 4: Verify the fix (show sample results)
SELECT 
  l.first_name,
  l.last_name,
  sup.last_completed,
  sup.working_on,
  mps.next_milestone,
  jsonb_array_length(mps.completed_milestones) as completed_count,
  jsonb_array_length(mps.module_sequence) as total_modules,
  jsonb_array_length(mps.overdue_milestones) as overdue_count
FROM member_progress_summary mps
JOIN leads l ON mps.lead_id = l.lead_id
JOIN survey_user_mappings sum ON l.lead_id = sum.lead_id
JOIN survey_user_progress sup ON sum.mapping_id = sup.mapping_id
WHERE mps.next_milestone = 'Program Complete' 
   OR jsonb_array_length(mps.overdue_milestones) > 0
ORDER BY l.last_name, l.first_name
LIMIT 10;

