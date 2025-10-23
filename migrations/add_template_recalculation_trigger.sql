-- ========================================================================================================
-- MIGRATION: Add Trigger to Recalculate Templates on Therapy Price Changes
-- ========================================================================================================
-- Purpose: Automatically update program_template totals when therapy cost/charge changes
-- Date: 2025-10-21
-- Issue: Templates become stale when therapy prices are updated
-- ========================================================================================================

-- ========================================================================================================
-- STEP 1: Create the trigger function
-- ========================================================================================================

CREATE OR REPLACE FUNCTION public.recalculate_templates_on_therapy_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  affected_template_id INTEGER;
  template_total_cost NUMERIC(9,2);
  template_total_charge NUMERIC(9,2);
  template_margin NUMERIC(5,2);
BEGIN
  -- Only proceed if cost or charge actually changed
  IF (OLD.cost IS DISTINCT FROM NEW.cost) OR (OLD.charge IS DISTINCT FROM NEW.charge) THEN
    
    -- Log the change for debugging
    RAISE NOTICE 'Therapy % price changed: cost % -> %, charge % -> %', 
      NEW.therapy_id, OLD.cost, NEW.cost, OLD.charge, NEW.charge;
    
    -- Loop through each template that uses this therapy
    FOR affected_template_id IN
      SELECT DISTINCT program_template_id
      FROM program_template_items
      WHERE therapy_id = NEW.therapy_id
        AND active_flag = true
    LOOP
      -- Calculate new total_cost for this template
      SELECT COALESCE(SUM(pti.quantity * t.cost), 0)
      INTO template_total_cost
      FROM program_template_items pti
      INNER JOIN therapies t ON t.therapy_id = pti.therapy_id
      WHERE pti.program_template_id = affected_template_id
        AND pti.active_flag = true;
      
      -- Calculate new total_charge for this template
      SELECT COALESCE(SUM(pti.quantity * t.charge), 0)
      INTO template_total_charge
      FROM program_template_items pti
      INNER JOIN therapies t ON t.therapy_id = pti.therapy_id
      WHERE pti.program_template_id = affected_template_id
        AND pti.active_flag = true;
      
      -- Calculate margin percentage
      -- Formula: ((charge - cost) / charge) * 100
      -- If charge is 0, margin is 0
      IF template_total_charge > 0 THEN
        template_margin := ((template_total_charge - template_total_cost) / template_total_charge) * 100;
      ELSE
        template_margin := 0;
      END IF;
      
      -- Ensure margin is not negative (per business rule)
      IF template_margin < 0 THEN
        template_margin := 0;
      END IF;
      
      -- Update the template with new calculated values
      UPDATE program_template
      SET 
        total_cost = template_total_cost,
        total_charge = template_total_charge,
        margin_percentage = template_margin,
        updated_at = NOW(),
        updated_by = auth.uid()
      WHERE program_template_id = affected_template_id;
      
      -- Log the update
      RAISE NOTICE 'Updated template % - cost: %, charge: %, margin: %', 
        affected_template_id, template_total_cost, template_total_charge, template_margin;
      
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comment to explain the function
COMMENT ON FUNCTION public.recalculate_templates_on_therapy_change() IS 
'Automatically recalculates program_template totals when therapy cost or charge is updated. 
This ensures templates always reflect current therapy prices.';

-- ========================================================================================================
-- STEP 2: Create the trigger on therapies table
-- ========================================================================================================

DROP TRIGGER IF EXISTS tr_recalculate_templates_on_therapy_change ON public.therapies;

CREATE TRIGGER tr_recalculate_templates_on_therapy_change
  AFTER UPDATE OF cost, charge ON public.therapies
  FOR EACH ROW
  WHEN (
    (OLD.cost IS DISTINCT FROM NEW.cost) OR 
    (OLD.charge IS DISTINCT FROM NEW.charge)
  )
  EXECUTE FUNCTION public.recalculate_templates_on_therapy_change();

-- Add comment to explain the trigger
COMMENT ON TRIGGER tr_recalculate_templates_on_therapy_change ON public.therapies IS 
'Triggers template recalculation when therapy cost or charge is updated';

-- ========================================================================================================
-- STEP 3: Grant necessary permissions
-- ========================================================================================================

-- Grant EXECUTE permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.recalculate_templates_on_therapy_change() TO authenticated;

-- Grant EXECUTE permission to service_role (for admin operations)
GRANT EXECUTE ON FUNCTION public.recalculate_templates_on_therapy_change() TO service_role;

-- Note: The function uses SECURITY DEFINER, so it runs with the privileges of the function owner
-- This allows it to update program_template even if the current user doesn't have direct UPDATE rights

-- ========================================================================================================
-- STEP 4: Verify the trigger was created
-- ========================================================================================================

-- Check that the trigger exists
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO trigger_count
  FROM pg_trigger
  WHERE tgname = 'tr_recalculate_templates_on_therapy_change'
    AND tgrelid = 'therapies'::regclass;
  
  IF trigger_count > 0 THEN
    RAISE NOTICE '✓ Trigger created successfully';
  ELSE
    RAISE EXCEPTION '✗ Trigger creation failed';
  END IF;
END;
$$;

-- ========================================================================================================
-- STEP 5: Test the trigger (optional - comment out if not testing)
-- ========================================================================================================

-- Uncomment below to test the trigger
/*
DO $$
DECLARE
  test_therapy_id INTEGER;
  test_template_id INTEGER;
  old_total_cost NUMERIC(9,2);
  new_total_cost NUMERIC(9,2);
BEGIN
  -- Find a therapy that's used in at least one template
  SELECT t.therapy_id, pti.program_template_id
  INTO test_therapy_id, test_template_id
  FROM therapies t
  INNER JOIN program_template_items pti ON pti.therapy_id = t.therapy_id
  WHERE pti.active_flag = true
  LIMIT 1;
  
  IF test_therapy_id IS NOT NULL THEN
    -- Get current template total
    SELECT total_cost INTO old_total_cost
    FROM program_template
    WHERE program_template_id = test_template_id;
    
    RAISE NOTICE 'Testing trigger with therapy_id: %, template_id: %', test_therapy_id, test_template_id;
    RAISE NOTICE 'Template total_cost before: %', old_total_cost;
    
    -- Update therapy cost (add $1 for testing)
    UPDATE therapies
    SET cost = cost + 1
    WHERE therapy_id = test_therapy_id;
    
    -- Get new template total
    SELECT total_cost INTO new_total_cost
    FROM program_template
    WHERE program_template_id = test_template_id;
    
    RAISE NOTICE 'Template total_cost after: %', new_total_cost;
    
    IF new_total_cost > old_total_cost THEN
      RAISE NOTICE '✓ Trigger test PASSED - template was recalculated';
    ELSE
      RAISE WARNING '✗ Trigger test FAILED - template was not recalculated';
    END IF;
    
    -- Revert the test change
    UPDATE therapies
    SET cost = cost - 1
    WHERE therapy_id = test_therapy_id;
    
    RAISE NOTICE '✓ Test change reverted';
  ELSE
    RAISE NOTICE 'No suitable test data found (need a therapy used in a template)';
  END IF;
END;
$$;
*/

-- ========================================================================================================
-- STEP 6: One-time recalculation of all existing templates (optional)
-- ========================================================================================================

-- Uncomment below to recalculate all existing templates to ensure they're up-to-date
/*
DO $$
DECLARE
  template_record RECORD;
  template_total_cost NUMERIC(9,2);
  template_total_charge NUMERIC(9,2);
  template_margin NUMERIC(5,2);
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting one-time recalculation of all templates...';
  
  FOR template_record IN
    SELECT program_template_id
    FROM program_template
    WHERE active_flag = true
  LOOP
    -- Calculate total_cost
    SELECT COALESCE(SUM(pti.quantity * t.cost), 0)
    INTO template_total_cost
    FROM program_template_items pti
    INNER JOIN therapies t ON t.therapy_id = pti.therapy_id
    WHERE pti.program_template_id = template_record.program_template_id
      AND pti.active_flag = true;
    
    -- Calculate total_charge
    SELECT COALESCE(SUM(pti.quantity * t.charge), 0)
    INTO template_total_charge
    FROM program_template_items pti
    INNER JOIN therapies t ON t.therapy_id = pti.therapy_id
    WHERE pti.program_template_id = template_record.program_template_id
      AND pti.active_flag = true;
    
    -- Calculate margin
    IF template_total_charge > 0 THEN
      template_margin := ((template_total_charge - template_total_cost) / template_total_charge) * 100;
    ELSE
      template_margin := 0;
    END IF;
    
    IF template_margin < 0 THEN
      template_margin := 0;
    END IF;
    
    -- Update template
    UPDATE program_template
    SET 
      total_cost = template_total_cost,
      total_charge = template_total_charge,
      margin_percentage = template_margin,
      updated_at = NOW()
    WHERE program_template_id = template_record.program_template_id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE '✓ Recalculated % templates', updated_count;
END;
$$;
*/

-- ========================================================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ========================================================================================================

/*
-- To remove the trigger and function, run:

DROP TRIGGER IF EXISTS tr_recalculate_templates_on_therapy_change ON public.therapies;
DROP FUNCTION IF EXISTS public.recalculate_templates_on_therapy_change();

-- To verify removal:
SELECT tgname FROM pg_trigger WHERE tgname = 'tr_recalculate_templates_on_therapy_change';
-- Should return 0 rows
*/

-- ========================================================================================================
-- END OF MIGRATION
-- ========================================================================================================



