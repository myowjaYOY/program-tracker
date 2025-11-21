# Phase 0: Current State Backup and Documentation
**Date:** November 20, 2025
**Project:** Adaptive Schedule Adjustment Implementation

---

## Current Function: `generate_member_program_schedule`

### **CRITICAL BUG IDENTIFIED:**
Line in current function:
```sql
AND COALESCE(s.completed_flag, false) = false;
```

**Problem:** This deletes BOTH:
- `completed_flag = NULL` (pending) ✅ CORRECT
- `completed_flag = FALSE` (missed) ❌ BUG - Should preserve missed items!

---

## Complete Current Function Definition

```sql
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
  v_deleted_incomplete integer := 0;
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

  -- Compute accumulated pause days and shift anchor
  BEGIN
    v_pause_days := COALESCE(public.compute_program_total_pause_days(p_program_id), 0);
  EXCEPTION WHEN others THEN
    v_pause_days := 0;
  END;
  v_effective_start := v_start_date + v_pause_days;

  -- 1) Delete all incomplete item schedules for this program (preserve completed)
  -- ⚠️ BUG: This deletes BOTH null AND false (should only delete null)
  DELETE FROM public.member_program_item_schedule s
  USING public.member_program_items i
  WHERE s.member_program_item_id = i.member_program_item_id
    AND i.member_program_id = p_program_id
    AND COALESCE(s.completed_flag, false) = false;
  GET DIAGNOSTICS v_deleted_incomplete = ROW_COUNT;

  -- 2) Generate schedules for active items with quantity > 0, excluding therapies in bucket 'No Show'
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

    FOR v_instance IN 0..(v_qty - 1) LOOP
      -- Calculate occurrence date
      v_occurrence_date := v_effective_start + (v_days_from_start::int) + (v_instance * v_days_between);
      -- Adjust for weekends
      v_occurrence_date := public.adjust_date_for_weekend(v_occurrence_date);

      -- Insert occurrence idempotently; preserve completed rows
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

      -- Insert task schedules; avoid duplicates
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
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_incomplete', v_deleted_incomplete,
    'inserted_items', v_inserted_item_sched,
    'inserted_tasks', v_inserted_task_sched
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$
```

---

## Current Behavior Summary

### **Deletion Logic:**
- Deletes items where `completed_flag` is NULL OR FALSE
- Preserves items where `completed_flag` is TRUE

### **Generation Logic:**
- Always uses: `Program Start Date + Total Pause Days` as anchor
- Always generates all instances from 1 to quantity
- Does NOT respect manually adjusted redeemed dates
- Does NOT anchor to last completed instance

### **Known Issues:**
1. ✅ Preserves REDEEMED items (completed_flag = TRUE)
2. ❌ Deletes MISSED items (completed_flag = FALSE) - **BUG**
3. ❌ No adaptive scheduling based on actual redemption dates
4. ❌ Manual date adjustments lost on regeneration

---

## Backup Instructions

### **Option 1: Supabase Dashboard**
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Run: `SELECT pg_dump -s -t member_program_item_schedule -t member_program_items_task_schedule`
4. Save output to file: `backup_schedule_tables_YYYY-MM-DD.sql`

### **Option 2: Manual Backup Query**
```sql
-- Save this result set before making any changes
SELECT 
  'member_program_item_schedule' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE completed_flag IS NULL) as pending_count,
  COUNT(*) FILTER (WHERE completed_flag = FALSE) as missed_count,
  COUNT(*) FILTER (WHERE completed_flag = TRUE) as redeemed_count
FROM member_program_item_schedule;
```

---

## Rollback Script

Save this as `ROLLBACK_generate_schedule_function.sql`:

```sql
-- ROLLBACK SCRIPT FOR ADAPTIVE SCHEDULE IMPLEMENTATION
-- Run this to restore original function if needed

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
  v_deleted_incomplete integer := 0;
BEGIN
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

  BEGIN
    v_pause_days := COALESCE(public.compute_program_total_pause_days(p_program_id), 0);
  EXCEPTION WHEN others THEN
    v_pause_days := 0;
  END;
  v_effective_start := v_start_date + v_pause_days;

  DELETE FROM public.member_program_item_schedule s
  USING public.member_program_items i
  WHERE s.member_program_item_id = i.member_program_item_id
    AND i.member_program_id = p_program_id
    AND COALESCE(s.completed_flag, false) = false;
  GET DIAGNOSTICS v_deleted_incomplete = ROW_COUNT;

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

    FOR v_instance IN 0..(v_qty - 1) LOOP
      v_occurrence_date := v_effective_start + (v_days_from_start::int) + (v_instance * v_days_between);
      v_occurrence_date := public.adjust_date_for_weekend(v_occurrence_date);

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

      IF v_sched_id IS NULL THEN
        SELECT s.member_program_item_schedule_id
        INTO v_sched_id
        FROM public.member_program_item_schedule s
        WHERE s.member_program_item_id = v_items.member_program_item_id
          AND s.instance_number = v_instance + 1
        LIMIT 1;
      END IF;

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
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_incomplete', v_deleted_incomplete,
    'inserted_items', v_inserted_item_sched,
    'inserted_tasks', v_inserted_task_sched
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

-- Verify rollback
SELECT 'Rollback complete. Function restored to original state.' as status;
```

---

## Pre-Implementation Checklist

- [ ] Current function documented
- [ ] Rollback script created and saved
- [ ] Database backup created (via Supabase dashboard or pg_dump)
- [ ] Test data scenarios prepared
- [ ] Expected outcomes documented
- [ ] Team notified of upcoming changes
- [ ] Change window scheduled (low-traffic time)

---

## Emergency Contact Information

**If critical issues arise during implementation:**
1. Stop deployment immediately
2. Run rollback script: `ROLLBACK_generate_schedule_function.sql`
3. Verify with: `SELECT generate_member_program_schedule(test_program_id)`
4. Notify: [Project lead/Database admin]

**Database Restore (worst case):**
```sql
-- Contact database administrator
-- Provide backup timestamp
-- Request point-in-time restore to before deployment
```

---

**Document Created:** {{ current_timestamp }}
**Next Step:** Proceed to Step 0.2 - Testing Data Preparation

