-- ========================================================================================================
-- NEW FUNCTION: compute_pause_days_since_date
-- ========================================================================================================
-- Purpose: Calculate total pause days that occurred AFTER a specific date for a program
-- Used by: Adaptive schedule generation to shift future instances after last completed date
-- 
-- Parameters:
--   p_program_id: The member program ID
--   p_since_date: Only count pause days that started on or after this date
--
-- Returns: Integer count of pause days
--
-- Logic:
--   1. Query audit_logs for program_status_id changes to/from "Paused"
--   2. Only include pause periods where pause_start_date >= p_since_date
--   3. Handle ongoing pauses (currently paused with no end date)
--   4. Return total accumulated pause days since the specified date
-- ========================================================================================================

CREATE OR REPLACE FUNCTION public.compute_pause_days_since_date(
  p_program_id integer,
  p_since_date date
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_days int := 0;
  v_open_pause date := NULL;
  rec RECORD;
  old_id int;
  new_id int;
  new_status text;
  pause_start_date date;
  pause_end_date date;
BEGIN
  -- Iterate through all status changes in chronological order
  FOR rec IN
    SELECT changed_at::date AS changed_on,
           old_value AS old_j,
           new_value AS new_j
    FROM public.audit_logs
    WHERE table_name = 'member_programs'
      AND record_id = p_program_id
      AND column_name = 'program_status_id'
    ORDER BY changed_at ASC
  LOOP
    -- Extract old and new status IDs from JSON
    old_id := CASE WHEN jsonb_typeof(rec.old_j) = 'number' THEN (rec.old_j)::text::int ELSE NULL END;
    new_id := CASE WHEN jsonb_typeof(rec.new_j) = 'number' THEN (rec.new_j)::text::int ELSE NULL END;

    IF new_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Look up the status name for the new status
    SELECT LOWER(COALESCE(ps.status_name, '')) INTO new_status
    FROM public.program_status ps
    WHERE ps.program_status_id = new_id
    LIMIT 1;

    -- Detect pause start
    IF new_status = 'paused' AND v_open_pause IS NULL THEN
      pause_start_date := rec.changed_on;
      
      -- Only track this pause if it started on or after the since_date
      IF pause_start_date >= p_since_date THEN
        v_open_pause := pause_start_date;
      END IF;
      
    -- Detect pause end
    ELSIF new_status = 'active' AND v_open_pause IS NOT NULL THEN
      pause_end_date := rec.changed_on;
      
      -- Calculate pause duration and add to total
      v_total_days := v_total_days + GREATEST(0, (pause_end_date - v_open_pause));
      v_open_pause := NULL;
    END IF;
  END LOOP;

  -- Handle ongoing pause (program is currently paused with no end date)
  IF v_open_pause IS NOT NULL THEN
    -- Add days from pause start to today
    v_total_days := v_total_days + GREATEST(0, (CURRENT_DATE - v_open_pause));
  END IF;

  RETURN GREATEST(v_total_days, 0);
END;
$function$;

-- ========================================================================================================
-- VERIFICATION & TESTING
-- ========================================================================================================

-- Verify function was created
SELECT 
  proname as function_name,
  pronargs as parameter_count,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'compute_pause_days_since_date'
  AND pronamespace = 'public'::regnamespace;

-- Test cases (replace XXXXX with actual program_id)
-- Test 1: Program with no pauses, any date
-- Expected: 0
-- SELECT compute_pause_days_since_date(XXXXX, CURRENT_DATE - INTERVAL '30 days');

-- Test 2: Program paused before since_date, resumed before since_date
-- Expected: 0 (pause was entirely before the since_date)
-- SELECT compute_pause_days_since_date(XXXXX, CURRENT_DATE);

-- Test 3: Program paused after since_date, then resumed
-- Expected: Number of days between pause and resume
-- SELECT compute_pause_days_since_date(XXXXX, CURRENT_DATE - INTERVAL '30 days');

-- Test 4: Program currently paused (started after since_date)
-- Expected: Number of days from pause start to today
-- SELECT compute_pause_days_since_date(XXXXX, CURRENT_DATE - INTERVAL '30 days');

-- Compare with total pause days function
-- SELECT 
--   compute_program_total_pause_days(XXXXX) as total_pause_days,
--   compute_pause_days_since_date(XXXXX, CURRENT_DATE - INTERVAL '30 days') as pause_days_since_30_days_ago,
--   compute_pause_days_since_date(XXXXX, CURRENT_DATE) as pause_days_since_today;

COMMENT ON FUNCTION public.compute_pause_days_since_date(integer, date) IS 
'Calculates total pause days that occurred on or after a specific date for a program. Used for adaptive schedule adjustment to shift future instances based on pause periods that happened after the last completed instance.';

-- ========================================================================================================
-- END OF FUNCTION CREATION
-- ========================================================================================================

