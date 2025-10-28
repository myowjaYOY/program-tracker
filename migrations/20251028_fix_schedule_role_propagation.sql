-- Fix generate_member_program_schedule to correctly copy program_role_id
-- This ensures schedule items inherit the correct role from their source items/tasks

CREATE OR REPLACE FUNCTION generate_member_program_schedule(p_program_id INTEGER)
RETURNS TABLE (ok BOOLEAN, error TEXT) AS $$
DECLARE
  v_start_date DATE;
  v_duration INTEGER;
  v_item RECORD;
  v_task RECORD;
  v_instance INTEGER;
  v_scheduled_date DATE;
  v_task_date DATE;
BEGIN
  -- Get program start date and duration
  SELECT start_date, duration INTO v_start_date, v_duration
  FROM member_programs
  WHERE member_program_id = p_program_id;

  IF v_start_date IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Program start date is required';
    RETURN;
  END IF;

  -- Delete existing schedule for this program
  DELETE FROM member_program_items_task_schedule
  WHERE member_program_item_task_id IN (
    SELECT mpit.member_program_item_task_id
    FROM member_program_item_tasks mpit
    JOIN member_program_items mpi ON mpit.member_program_item_id = mpi.member_program_item_id
    WHERE mpi.member_program_id = p_program_id
  );

  DELETE FROM member_program_item_schedule
  WHERE member_program_item_id IN (
    SELECT member_program_item_id
    FROM member_program_items
    WHERE member_program_id = p_program_id
  );

  -- Generate schedule for each item
  FOR v_item IN
    SELECT 
      mpi.member_program_item_id,
      mpi.therapy_id,
      mpi.quantity,
      mpi.days_from_start,
      mpi.days_between,
      mpi.program_role_id,  -- CRITICAL: Get role from item
      t.therapy_name
    FROM member_program_items mpi
    JOIN therapies t ON mpi.therapy_id = t.therapy_id
    WHERE mpi.member_program_id = p_program_id
      AND mpi.active_flag = TRUE
    ORDER BY mpi.days_from_start, mpi.member_program_item_id
  LOOP
    -- Generate schedule instances for this item
    FOR v_instance IN 1..v_item.quantity LOOP
      -- Calculate scheduled date
      IF v_instance = 1 THEN
        v_scheduled_date := v_start_date + v_item.days_from_start;
      ELSE
        v_scheduled_date := v_start_date + v_item.days_from_start + ((v_instance - 1) * v_item.days_between);
      END IF;

      -- Only create schedule if within program duration
      IF v_scheduled_date <= v_start_date + v_duration THEN
        INSERT INTO member_program_item_schedule (
          member_program_item_id,
          instance_number,
          scheduled_date,
          program_role_id,  -- CRITICAL: Copy role from item
          completed_flag,
          created_at,
          updated_at
        ) VALUES (
          v_item.member_program_item_id,
          v_instance,
          v_scheduled_date,
          v_item.program_role_id,  -- CRITICAL: Use item's role
          NULL,  -- Default to NULL (pending)
          NOW(),
          NOW()
        );

        -- Generate task schedule for this item instance
        FOR v_task IN
          SELECT 
            mpit.member_program_item_task_id,
            mpit.task_name,
            mpit.description,
            mpit.task_delay,
            mpit.program_role_id  -- CRITICAL: Get role from task
          FROM member_program_item_tasks mpit
          WHERE mpit.member_program_item_id = v_item.member_program_item_id
          ORDER BY mpit.task_delay, mpit.member_program_item_task_id
        LOOP
          -- Calculate task date relative to item scheduled date
          v_task_date := v_scheduled_date + v_task.task_delay;

          -- Only create task schedule if within program duration
          IF v_task_date <= v_start_date + v_duration THEN
            INSERT INTO member_program_items_task_schedule (
              member_program_item_task_id,
              instance_number,
              scheduled_date,
              program_role_id,  -- CRITICAL: Copy role from task
              completed_flag,
              created_at,
              updated_at
            ) VALUES (
              v_task.member_program_item_task_id,
              v_instance,
              v_task_date,
              v_task.program_role_id,  -- CRITICAL: Use task's role
              NULL,  -- Default to NULL (pending)
              NOW(),
              NOW()
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_member_program_schedule IS 'Generates schedule for program items and tasks, correctly copying program_role_id from source tables';

