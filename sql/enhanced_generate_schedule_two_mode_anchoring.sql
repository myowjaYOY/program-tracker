-- ========================================================================================================
-- ENHANCED: generate_member_program_schedule with Two-Mode Anchoring
-- ========================================================================================================
-- Date: 2025-11-20
-- Enhancement: Adaptive scheduling that respects actual completion dates
--
-- NEW FEATURES:
-- 1. MODE 1 (Fresh Start): Used when item has NO completed instances
--    - Anchor: Program start date + total pause days
--    - Generate: All instances from 1 to quantity
--
-- 2. MODE 2 (Continuation): Used when item HAS completed instances
--    - Anchor: Last completed instance's actual scheduled_date
--    - Generate: Only instances after last completed
--    - Includes: Pause days that occurred AFTER the anchor date
--
-- PRESERVES:
-- - Bug fix: Only deletes pending (NULL) items
-- - All redeemed (TRUE) items
-- - All missed (FALSE) items
-- ========================================================================================================

CREATE OR REPLACE FUNCTION public.generate_member_program_schedule(p_program_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start_date date;
  v_status_name text;
  v_pause_days int := 0;
  v_effective_start date;

  v_items RECORD;
  v_occurrence_date date;

  v_inserted_item_sched integer := 0;
  v_inserted_task_sched integer := 0;

  v_days_from_start int;
  v_days_between int;
  v_qty int;
  v_instance int;

  v_sched_id int;
  _ins_count integer := 0;
  v_deleted_pending integer := 0;
  
  -- NEW: Mode 2 variables
  v_last_completed_instance int;
  v_last_completed_date date;
  v_pause_days_since int;
  v_anchor_date date;
  v_start_instance int;
BEGIN
  -- Preconditions: program exists, status Active, start_date present
  SELECT mp.start_date, LOWER(COALESCE(ps.status_name, ''))
  INTO v_start_date, v_status_name
  FROM public.member_programs mp
  LEFT JOIN public.program_status ps ON ps.program_status_id = mp.program_status_id
  WHERE mp.member_program_id = p_program_id;

  IF v_start_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Start Date is required to generate schedule.');
  END IF;

  IF v_status_name <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Program must be Active to generate schedule.');
  END IF;

  -- Compute accumulated pause days for Mode 1
  BEGIN
    v_pause_days := COALESCE(public.compute_program_total_pause_days(p_program_id), 0);
  EXCEPTION WHEN others THEN
    v_pause_days := 0;
  END;
  v_effective_start := v_start_date + v_pause_days;

  -- Delete ONLY pending items (preserves redeemed and missed)
  DELETE FROM public.member_program_item_schedule s
  USING public.member_program_items i
  WHERE s.member_program_item_id = i.member_program_item_id
    AND i.member_program_id = p_program_id
    AND s.completed_flag IS NULL;
  GET DIAGNOSTICS v_deleted_pending = ROW_COUNT;

  -- Generate schedules for active items
  FOR v_items IN
    SELECT
      i.member_program_item_id,
      COALESCE(i.days_from_start, 0) AS d0,
      COALESCE(i.days_between, 0) AS gap,
      COALESCE(i.quantity, 0) AS qty,
      i.program_role_id
    FROM public.member_program_items i
    JOIN public.therapies t ON t.therapy_id = i.therapy_id
    LEFT JOIN public.buckets b ON b.bucket_id = t.bucket_id
    WHERE i.member_program_id = p_program_id
      AND COALESCE(i.active_flag, true) = true
      AND COALESCE(i.quantity, 0) > 0
      AND COALESCE(LOWER(b.bucket_name), '') <> 'no show'
  LOOP
    v_days_from_start := v_items.d0;
    v_days_between := v_items.gap;
    v_qty := v_items.qty;

    -- ========================================================================================================
    -- NEW: ANCHOR DETECTION - Determine Mode 1 or Mode 2
    -- ========================================================================================================
    
    -- Check for completed instances (Mode 2 trigger)
    -- Find last completed instance by ordering and taking top 1
    SELECT instance_number, scheduled_date
    INTO v_last_completed_instance, v_last_completed_date
    FROM public.member_program_item_schedule
    WHERE member_program_item_id = v_items.member_program_item_id
      AND completed_flag = TRUE
    ORDER BY instance_number DESC
    LIMIT 1;
    
    IF v_last_completed_instance IS NOT NULL THEN
      -- ========================================================================================================
      -- MODE 2: CONTINUATION (Has completed instances)
      -- ========================================================================================================
      
      -- Use last completed instance's scheduled_date as anchor
      v_anchor_date := v_last_completed_date;
      
      -- Calculate pause days that occurred AFTER the anchor date
      BEGIN
        v_pause_days_since := COALESCE(
          public.compute_pause_days_since_date(p_program_id, v_anchor_date), 
          0
        );
      EXCEPTION WHEN others THEN
        v_pause_days_since := 0;
      END;
      
      -- Start generating from the instance AFTER last completed
      v_start_instance := v_last_completed_instance + 1;
      
      -- Generate remaining instances
      FOR v_instance IN v_start_instance..v_qty LOOP
        -- Calculate: anchor + (N × days_between) + pause_days_since
        v_occurrence_date := v_anchor_date 
                           + ((v_instance - v_last_completed_instance) * v_days_between)
                           + v_pause_days_since;
        
        -- Adjust for weekends
        v_occurrence_date := public.adjust_date_for_weekend(v_occurrence_date);

        -- Insert occurrence idempotently
        INSERT INTO public.member_program_item_schedule(
          member_program_item_id,
          instance_number,
          scheduled_date,
          program_role_id
        )
        VALUES (
          v_items.member_program_item_id,
          v_instance,
          v_occurrence_date,
          v_items.program_role_id
        )
        ON CONFLICT ON CONSTRAINT uniq_item_schedule_instance DO NOTHING
        RETURNING member_program_item_schedule_id INTO v_sched_id;

        GET DIAGNOSTICS _ins_count = ROW_COUNT;
        v_inserted_item_sched := v_inserted_item_sched + COALESCE(_ins_count, 0);

        -- If it already existed, fetch the existing id
        IF v_sched_id IS NULL THEN
          SELECT s.member_program_item_schedule_id
          INTO v_sched_id
          FROM public.member_program_item_schedule s
          WHERE s.member_program_item_id = v_items.member_program_item_id
            AND s.instance_number = v_instance
          LIMIT 1;
        END IF;

        -- Insert task schedules
        INSERT INTO public.member_program_items_task_schedule(
          member_program_item_schedule_id,
          member_program_item_task_id,
          due_date,
          program_role_id
        )
        SELECT
          v_sched_id,
          t.member_program_item_task_id,
          public.adjust_date_for_weekend((v_occurrence_date + COALESCE(t.task_delay, 0))::date),
          t.program_role_id
        FROM public.member_program_item_tasks t
        WHERE t.member_program_item_id = v_items.member_program_item_id
        ON CONFLICT ON CONSTRAINT uniq_task_schedule_per_occurrence DO NOTHING;

        GET DIAGNOSTICS _ins_count = ROW_COUNT;
        v_inserted_task_sched := v_inserted_task_sched + COALESCE(_ins_count, 0);
      END LOOP;
      
    ELSE
      -- ========================================================================================================
      -- MODE 1: FRESH START (No completed instances)
      -- ========================================================================================================
      
      -- Use program start date + total pause days as anchor
      v_anchor_date := v_effective_start + v_days_from_start;
      
      -- Generate all instances from 1 to quantity
      FOR v_instance IN 0..(v_qty - 1) LOOP
        -- Calculate: anchor + (N × days_between)
        v_occurrence_date := v_anchor_date + (v_instance * v_days_between);
        
        -- Adjust for weekends
        v_occurrence_date := public.adjust_date_for_weekend(v_occurrence_date);

        -- Insert occurrence idempotently
        INSERT INTO public.member_program_item_schedule(
          member_program_item_id,
          instance_number,
          scheduled_date,
          program_role_id
        )
        VALUES (
          v_items.member_program_item_id,
          v_instance + 1,
          v_occurrence_date,
          v_items.program_role_id
        )
        ON CONFLICT ON CONSTRAINT uniq_item_schedule_instance DO NOTHING
        RETURNING member_program_item_schedule_id INTO v_sched_id;

        GET DIAGNOSTICS _ins_count = ROW_COUNT;
        v_inserted_item_sched := v_inserted_item_sched + COALESCE(_ins_count, 0);

        -- If it already existed, fetch the existing id
        IF v_sched_id IS NULL THEN
          SELECT s.member_program_item_schedule_id
          INTO v_sched_id
          FROM public.member_program_item_schedule s
          WHERE s.member_program_item_id = v_items.member_program_item_id
            AND s.instance_number = v_instance + 1
          LIMIT 1;
        END IF;

        -- Insert task schedules
        INSERT INTO public.member_program_items_task_schedule(
          member_program_item_schedule_id,
          member_program_item_task_id,
          due_date,
          program_role_id
        )
        SELECT
          v_sched_id,
          t.member_program_item_task_id,
          public.adjust_date_for_weekend((v_occurrence_date + COALESCE(t.task_delay, 0))::date),
          t.program_role_id
        FROM public.member_program_item_tasks t
        WHERE t.member_program_item_id = v_items.member_program_item_id
        ON CONFLICT ON CONSTRAINT uniq_task_schedule_per_occurrence DO NOTHING;

        GET DIAGNOSTICS _ins_count = ROW_COUNT;
        v_inserted_task_sched := v_inserted_task_sched + COALESCE(_ins_count, 0);
      END LOOP;
      
    END IF;  -- End Mode 1 vs Mode 2
    
  END LOOP;  -- End items loop

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_pending', v_deleted_pending,
    'inserted_items', v_inserted_item_sched,
    'inserted_tasks', v_inserted_task_sched
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

-- ========================================================================================================
-- VERIFICATION
-- ========================================================================================================

SELECT 'SUCCESS: Enhanced generate_member_program_schedule deployed with two-mode anchoring' as status;

-- Verify function was updated
SELECT 
  proname as function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%MODE 1%' 
      AND pg_get_functiondef(oid) LIKE '%MODE 2%'
    THEN '✅ Two-mode anchoring confirmed'
    ELSE '❌ Enhancement not detected'
  END as enhancement_status
FROM pg_proc
WHERE proname = 'generate_member_program_schedule'
  AND pronamespace = 'public'::regnamespace;

-- ========================================================================================================
-- END OF ENHANCEMENT
-- ========================================================================================================

