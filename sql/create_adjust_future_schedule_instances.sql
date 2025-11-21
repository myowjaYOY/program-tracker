-- ========================================================================================================
-- FUNCTION: adjust_future_schedule_instances
-- ========================================================================================================
-- Purpose: Update scheduled dates for future incomplete instances when a user redeems late/early
-- Used by: API when user confirms schedule adjustment (adjust_schedule = true)
--
-- Parameters:
--   p_member_program_item_id: The program item ID
--   p_current_instance_number: The instance just redeemed
--   p_new_scheduled_date: The actual redemption date (new anchor)
--   p_program_id: The program ID (for pause calculation)
--
-- Returns: JSONB with statistics about changes made
--
-- Logic:
--   1. Find all future incomplete (NULL) instances
--   2. Calculate pause days since the new anchor date
--   3. Update each future instance's scheduled_date
--   4. Apply weekend adjustment
--   5. Update associated task schedules
--   6. Return statistics
-- ========================================================================================================

CREATE OR REPLACE FUNCTION public.adjust_future_schedule_instances(
  p_member_program_item_id integer,
  p_current_instance_number integer,
  p_new_scheduled_date date,
  p_program_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_days_between int;
  v_pause_days_since int := 0;
  v_updated_instances int := 0;
  v_updated_tasks int := 0;
  v_task_count int := 0;
  v_future_instance RECORD;
  v_new_date date;
  v_instance_offset int;
BEGIN
  -- Get days_between for this item
  SELECT days_between INTO v_days_between
  FROM public.member_program_items
  WHERE member_program_item_id = p_member_program_item_id;

  IF v_days_between IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Program item not found'
    );
  END IF;

  -- Calculate pause days that occurred after the new anchor date
  BEGIN
    v_pause_days_since := COALESCE(
      public.compute_pause_days_since_date(p_program_id, p_new_scheduled_date),
      0
    );
  EXCEPTION WHEN others THEN
    v_pause_days_since := 0;
  END;

  -- Update all future incomplete instances
  FOR v_future_instance IN
    SELECT 
      member_program_item_schedule_id,
      instance_number
    FROM public.member_program_item_schedule
    WHERE member_program_item_id = p_member_program_item_id
      AND instance_number > p_current_instance_number
      AND completed_flag IS NULL  -- Only pending instances
    ORDER BY instance_number
  LOOP
    -- Calculate offset from current instance
    v_instance_offset := v_future_instance.instance_number - p_current_instance_number;
    
    -- Calculate new date: anchor + (offset × days_between) + pause_days_since
    v_new_date := p_new_scheduled_date + (v_instance_offset * v_days_between) + v_pause_days_since;
    
    -- Apply weekend adjustment
    v_new_date := public.adjust_date_for_weekend(v_new_date);
    
    -- Update the instance's scheduled_date
    UPDATE public.member_program_item_schedule
    SET scheduled_date = v_new_date
    WHERE member_program_item_schedule_id = v_future_instance.member_program_item_schedule_id;
    
    v_updated_instances := v_updated_instances + 1;
    
    -- Update associated task schedules
    UPDATE public.member_program_items_task_schedule ts
    SET due_date = public.adjust_date_for_weekend(
      (v_new_date + COALESCE(t.task_delay, 0))::date
    )
    FROM public.member_program_item_tasks t
    WHERE ts.member_program_item_task_id = t.member_program_item_task_id
      AND ts.member_program_item_schedule_id = v_future_instance.member_program_item_schedule_id;
    
    GET DIAGNOSTICS v_task_count = ROW_COUNT;
    v_updated_tasks := v_updated_tasks + v_task_count;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'updated_instances', v_updated_instances,
    'updated_tasks', v_updated_tasks,
    'pause_days_since', v_pause_days_since,
    'days_between', v_days_between
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
END;
$function$;

-- ========================================================================================================
-- VERIFICATION
-- ========================================================================================================

SELECT 'SUCCESS: adjust_future_schedule_instances function created' as status;

-- Verify function exists
SELECT 
  proname as function_name,
  pronargs as parameter_count,
  prorettype::regtype as return_type,
  pg_get_function_arguments(oid) as parameters
FROM pg_proc
WHERE proname = 'adjust_future_schedule_instances'
  AND pronamespace = 'public'::regnamespace;

COMMENT ON FUNCTION public.adjust_future_schedule_instances(integer, integer, date, integer) IS
'Updates scheduled dates for future incomplete instances and their tasks when a user redeems an item on a different date than scheduled. Used for adaptive schedule adjustment.';

-- ========================================================================================================
-- END OF FUNCTION CREATION
-- ========================================================================================================

