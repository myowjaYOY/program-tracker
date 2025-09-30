--
-- PostgreSQL database dump
--

\restrict HXy1aZTXyMq53elNl58n2ykBcCGCSccgRx0xGvbi4Z6kqoAz0eB0dPyutVBXPSj

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: financing_source_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.financing_source_enum AS ENUM (
    'internal',
    'external'
);


ALTER TYPE public.financing_source_enum OWNER TO postgres;

--
-- Name: apply_member_program_items_changes(integer, jsonb, numeric, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer DEFAULT 1, p_margin_tol numeric DEFAULT 0.1) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_finances RECORD;
  v_locked_price    numeric := 0;
  v_locked_margin   numeric := 0;
  v_fin_charges     numeric := 0;
  v_discounts       numeric := 0;

  v_change jsonb;
  v_type text;

  v_item_id integer;
  v_therapy_id integer;
  v_qty numeric;
  v_days_from_start integer;
  v_days_between integer;
  v_instructions text;

  v_t RECORD;

  v_charge numeric := 0;
  v_cost   numeric := 0;

  v_projected_price numeric := 0;
  v_projected_margin numeric := 0;

  v_price_delta_cents integer := 0;
  v_margin_delta numeric := 0;

BEGIN
  -- Authoritative locked finance values
  SELECT final_total_price, margin, finance_charges, discounts
  INTO v_finances
  FROM public.member_program_finances
  WHERE member_program_id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Program finances not found');
  END IF;

  v_locked_price  := COALESCE(v_finances.final_total_price, 0);
  v_locked_margin := COALESCE(v_finances.margin, 0);
  v_fin_charges   := COALESCE(v_finances.finance_charges, 0);
  v_discounts     := COALESCE(v_finances.discounts, 0);

  -- Staleness check vs inputs
  IF ROUND((COALESCE(p_locked_price, 0) - v_locked_price) * 100)::int <> 0
     OR abs(COALESCE(p_locked_margin, 0) - v_locked_margin) > 0.0001 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Locked values changed; refresh and preview again.'
    );
  END IF;

  -- Lightweight concurrency guard per program
  PERFORM pg_advisory_xact_lock(p_program_id);

  -- Apply staged changes
  FOR v_change IN SELECT * FROM jsonb_array_elements(COALESCE(p_changes, '[]'::jsonb))
  LOOP
    v_type := COALESCE((v_change->>'type'), '');

    IF v_type = 'remove' THEN
      v_item_id := (v_change->>'itemId')::int;
      DELETE FROM public.member_program_items
      WHERE member_program_item_id = v_item_id
        AND member_program_id = p_program_id;

    ELSIF v_type = 'update' THEN
      v_item_id := (v_change->>'itemId')::int;
      v_qty := NULLIF(v_change->>'quantity','')::numeric;
      v_therapy_id := NULLIF(v_change->>'therapy_id','')::int;
      v_days_from_start := NULLIF(v_change->>'days_from_start','')::int;
      v_days_between := NULLIF(v_change->>'days_between','')::int;
      v_instructions := NULLIF(v_change->>'instructions','')::text;

      IF v_therapy_id IS NOT NULL THEN
        SELECT therapy_id, cost, charge
        INTO v_t
        FROM public.therapies
        WHERE therapy_id = v_therapy_id
        FOR SHARE;

        IF NOT FOUND THEN
          RETURN jsonb_build_object('ok', false, 'error', format('Therapy %s not found', v_therapy_id));
        END IF;

        UPDATE public.member_program_items
        SET therapy_id = v_t.therapy_id,
            item_cost = COALESCE(v_t.cost, 0),
            item_charge = COALESCE(v_t.charge, 0)
        WHERE member_program_item_id = v_item_id
          AND member_program_id = p_program_id;
      END IF;

      UPDATE public.member_program_items
      SET quantity = COALESCE(v_qty, quantity),
          days_from_start = COALESCE(v_days_from_start, days_from_start),
          days_between = COALESCE(v_days_between, days_between),
          instructions = COALESCE(v_instructions, instructions)
      WHERE member_program_item_id = v_item_id
        AND member_program_id = p_program_id;

    ELSIF v_type = 'add' THEN
      v_therapy_id := NULLIF(v_change->>'therapy_id','')::int;
      v_qty := COALESCE(NULLIF(v_change->>'quantity','')::numeric, 0);
      v_days_from_start := COALESCE(NULLIF(v_change->>'days_from_start','')::int, 0);
      v_days_between := COALESCE(NULLIF(v_change->>'days_between','')::int, 0);
      v_instructions := COALESCE(NULLIF(v_change->>'instructions','')::text, '');

      IF v_therapy_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Missing therapy_id for add');
      END IF;

      SELECT therapy_id, cost, charge
      INTO v_t
      FROM public.therapies
      WHERE therapy_id = v_therapy_id
      FOR SHARE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', format('Therapy %s not found', v_therapy_id));
      END IF;

      INSERT INTO public.member_program_items(
        member_program_id, therapy_id, quantity, item_cost, item_charge,
        days_from_start, days_between, instructions
      )
      VALUES (
        p_program_id, v_t.therapy_id, GREATEST(0, v_qty),
        COALESCE(v_t.cost, 0), COALESCE(v_t.charge, 0),
        v_days_from_start, v_days_between, v_instructions
      );
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', format('Unknown change type: %s', v_type));
    END IF;
  END LOOP;

  -- Recompute totals with finance rules
  SELECT
    COALESCE(SUM(item_charge * quantity), 0) AS charge,
    COALESCE(SUM(item_cost * quantity), 0)   AS cost
  INTO v_charge, v_cost
  FROM public.member_program_items
  WHERE member_program_id = p_program_id;

  v_projected_price := v_charge + GREATEST(0, v_fin_charges) + v_discounts;
  v_projected_margin := CASE WHEN v_projected_price > 0
    THEN (v_projected_price - (v_cost + GREATEST(0, -v_fin_charges))) / v_projected_price * 100
    ELSE 0 END;

  v_price_delta_cents := ROUND( (v_projected_price - v_locked_price) * 100 )::int;
  v_margin_delta := v_projected_margin - v_locked_margin;

  IF abs(v_price_delta_cents) > GREATEST(0, p_price_cents_tol)
     OR abs(v_margin_delta) > p_margin_tol THEN
    -- Reject entire batch; no partial state visible outside this xact
    RAISE EXCEPTION 'Locked values would change (Δ price cents: %, Δ margin: %)', v_price_delta_cents, v_margin_delta;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'projected', jsonb_build_object(
      'price', v_projected_price,
      'margin', v_projected_margin,
      'charge', v_charge,
      'cost', v_cost
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Report as structured JSON; error causes xact rollback
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION public.apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer, p_margin_tol numeric) OWNER TO postgres;

--
-- Name: audit_financing_types(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_financing_types() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = now();
        NEW.updated_by = auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.created_at = now();
        NEW.created_by = auth.uid();
        NEW.updated_at = now();
        NEW.updated_by = auth.uid();
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.audit_financing_types() OWNER TO postgres;

--
-- Name: audit_member_item_schedule(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_item_schedule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_item_schedule_id; actor := coalesce(NEW.created_by::uuid, null);

    select mp.lead_id, mp.member_program_id into member_id, program_id
      from member_program_items i
      join member_programs mp on mp.member_program_id = i.member_program_id
      where i.member_program_item_id = NEW.member_program_item_id;

    audit_summary := 'Program item schedule created';
    perform public.write_audit_event('member_program_item_schedule', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, null, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_item_schedule_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);

    select mp.lead_id, mp.member_program_id into member_id, program_id
      from member_program_items i
      join member_programs mp on mp.member_program_id = i.member_program_id
      where i.member_program_item_id = NEW.member_program_item_id;

    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event('member_program_item_schedule', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Program item schedule updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_item_schedule_id','member_program_item_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'scheduled_date' then 'Scheduled Date'
                        when 'instance_number' then 'Instance'
                        when 'completed_flag' then 'Completed Status'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'Script updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'Script updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'Script updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_item_schedule_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);

    select mp.lead_id, mp.member_program_id into member_id, program_id
      from member_program_items i
      join member_programs mp on mp.member_program_id = i.member_program_id
      where i.member_program_item_id = OLD.member_program_item_id;

    audit_summary := 'Program item schedule deleted';
    perform public.write_audit_event('member_program_item_schedule', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, null, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end 
$$;


ALTER FUNCTION public.audit_member_item_schedule() OWNER TO postgres;

--
-- Name: audit_member_item_task_schedule(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_item_task_schedule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_item_task_schedule_id; actor := coalesce(NEW.created_by::uuid, null);

    select mp.lead_id, mp.member_program_id
      into member_id, program_id
      from member_program_item_schedule s
      join member_program_items i on i.member_program_item_id = s.member_program_item_id
      join member_programs mp on mp.member_program_id = i.member_program_id
      where s.member_program_item_schedule_id = NEW.member_program_item_schedule_id;

    audit_summary := 'Task schedule created';
    perform public.write_audit_event('member_program_items_task_schedule', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, null, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_item_task_schedule_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);

    select mp.lead_id, mp.member_program_id
      into member_id, program_id
      from member_program_item_schedule s
      join member_program_items i on i.member_program_item_id = s.member_program_item_id
      join member_programs mp on mp.member_program_id = i.member_program_id
      where s.member_program_item_schedule_id = NEW.member_program_item_schedule_id;

    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event('member_program_items_task_schedule', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Task schedule updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_item_task_schedule_id','member_program_item_schedule_id','member_program_item_task_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'due_date'        then 'Due Date'
                        when 'completed_flag'  then 'Completed Status'
                        when 'notes'           then 'Notes'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'To Do List Updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'To Do List Updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'To Do List Updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_item_task_schedule_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);

    select mp.lead_id, mp.member_program_id
      into member_id, program_id
      from member_program_item_schedule s
      join member_program_items i on i.member_program_item_id = s.member_program_item_id
      join member_programs mp on mp.member_program_id = i.member_program_id
      where s.member_program_item_schedule_id = OLD.member_program_item_schedule_id;

    audit_summary := 'Task schedule deleted';
    perform public.write_audit_event('member_program_items_task_schedule', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, null, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end $$;


ALTER FUNCTION public.audit_member_item_task_schedule() OWNER TO postgres;

--
-- Name: audit_member_program_finances(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_program_finances() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_finance_id; actor := coalesce(NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program finances created';
    perform public.write_audit_event('member_program_finances', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, null, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_finance_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event('member_program_finances', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Program finances updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_finance_id','member_program_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'financing_type_id' then 'Financing Type'
                        when 'final_total_price' then 'Program Price'
                        when 'finance_charges'   then 'Finance Charges'
                        when 'discounts'         then 'Discounts'
                        when 'taxes'             then 'Taxes'
                        when 'margin'            then 'Margin'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'Program finances updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'Program finances updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'Program finances updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_finance_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    program_id := OLD.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program finances deleted';
    perform public.write_audit_event('member_program_finances', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, null, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end $$;


ALTER FUNCTION public.audit_member_program_finances() OWNER TO postgres;

--
-- Name: audit_member_program_item_tasks(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_program_item_tasks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_item_task_id; actor := coalesce(NEW.created_by::uuid, null);
    select mp.lead_id, mp.member_program_id into member_id, program_id
      from member_program_items i join member_programs mp on mp.member_program_id = i.member_program_id
      where i.member_program_item_id = NEW.member_program_item_id;

    audit_summary := 'Program item task created';
    perform public.write_audit_event('member_program_item_tasks', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, null, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_item_task_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    select mp.lead_id, mp.member_program_id into member_id, program_id
      from member_program_items i join member_programs mp on mp.member_program_id = i.member_program_id
      where i.member_program_item_id = NEW.member_program_item_id;

    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event('member_program_item_tasks', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Program item task updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_item_task_id','member_program_item_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'task_delay'      then 'Task Delay'
                        when 'task_name'       then 'Task Name'
                        when 'active_flag'     then 'Active'
                        when 'assigned_to'     then 'Assigned To'
                        when 'notes'           then 'Notes'
                        when 'description'     then 'Description'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'Program item task updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'Program item task updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'Program item task updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_item_task_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    select mp.lead_id, mp.member_program_id into member_id, program_id
      from member_program_items i join member_programs mp on mp.member_program_id = i.member_program_id
      where i.member_program_item_id = OLD.member_program_item_id;

    audit_summary := 'Program item task deleted';
    perform public.write_audit_event('member_program_item_tasks', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, null, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end $$;


ALTER FUNCTION public.audit_member_program_item_tasks() OWNER TO postgres;

--
-- Name: audit_member_program_items(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_program_items() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_item_id; actor := coalesce(NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program item created';
    perform public.write_audit_event('member_program_items', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, null, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_item_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event('member_program_items', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Program item updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_item_id','member_program_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'quantity'          then 'Quantity'
                        when 'days_from_start'   then 'Days From Start'
                        when 'days_between'      then 'Days Between'
                        when 'therapy_id'        then 'Therapy'
                        when 'notes'             then 'Notes'
                        when 'description'       then 'Description'
                        when 'active_flag'       then 'Active'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'Program item updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'Program item updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'Program item updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_item_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    program_id := OLD.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program item deleted';
    perform public.write_audit_event('member_program_items', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, null, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end $$;


ALTER FUNCTION public.audit_member_program_items() OWNER TO postgres;

--
-- Name: audit_member_program_payments(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_program_payments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_payment_id; actor := coalesce(NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program payment created';
    perform public.write_audit_event('member_program_payments', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, null, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_payment_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event('member_program_payments', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Program payment updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_payment_id','member_program_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'payment_amount'     then 'Payment Amount'
                        when 'payment_date'       then 'Payment Date'
                        when 'payment_method_id'  then 'Payment Method'
                        when 'payment_status_id'  then 'Payment Status'
                        when 'notes'              then 'Notes'
                        when 'reference'          then 'Reference'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'Program payment updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'Program payment updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'Program payment updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_payment_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    program_id := OLD.member_program_id; select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program payment deleted';
    perform public.write_audit_event('member_program_payments', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, null, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end $$;


ALTER FUNCTION public.audit_member_program_payments() OWNER TO postgres;

--
-- Name: audit_member_programs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_member_programs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  pk bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint;
  member_id bigint; program_id bigint;
  col text; friendly text; old_txt text; new_txt text;
  old_status text; new_status text;
  changed_labels text[] := '{}';
  labels_count int; audit_summary text; ctx jsonb := null;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_id; actor := coalesce(NEW.created_by::uuid, null);
    member_id := NEW.lead_id; program_id := NEW.member_program_id;

    select lower(coalesce(ps.status_name,'')) into new_status
      from program_status ps
      where ps.program_status_id = NEW.program_status_id;

    audit_summary := 'Member program created';
    ctx := jsonb_build_object('status', nullif(new_status,''), 'start_date', to_char(NEW.start_date, 'YYYY-MM-DD'));

    perform public.write_audit_event('member_programs', pk, 'INSERT', actor, 'member', member_id, program_id, audit_summary, ctx, null, to_jsonb(NEW));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_id; actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    member_id := NEW.lead_id; program_id := NEW.member_program_id;

    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);

    select lower(coalesce(ps1.status_name,'')), lower(coalesce(ps2.status_name,''))
      into old_status, new_status
      from program_status ps1, program_status ps2
      where ps1.program_status_id = coalesce((old_j->>'program_status_id')::int, -1)
        and ps2.program_status_id = coalesce((new_j->>'program_status_id')::int, -1)
      limit 1;

    ev_id := public.write_audit_event('member_programs', pk, 'UPDATE', actor, 'member', member_id, program_id, 'Member program updated', null, old_j, new_j);

    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_id','lead_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          friendly := case col
                        when 'program_status_id'       then 'Status'
                        when 'program_template_name'   then 'Program Name'
                        when 'start_date'              then 'Start Date'
                        when 'end_date'                then 'End Date'
                        when 'description'             then 'Description'
                        when 'notes'                   then 'Notes'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;

          if col = 'program_status_id' and old_status is distinct from new_status then
            ctx := coalesce(ctx, '{}'::jsonb) || jsonb_build_object('from_status', old_status, 'to_status', new_status);
          end if;
        end if;
      end if;
    end loop;

    labels_count := coalesce(array_length(changed_labels, 1), 0);
    if labels_count > 0 then
      if labels_count = 1 then
        audit_summary := 'Member program updated: The ' || changed_labels[1] || ' was changed.';
      elsif labels_count = 2 then
        audit_summary := 'Member program updated: The ' || changed_labels[1] || ' and ' || changed_labels[2] || ' were changed.';
      else
        audit_summary := 'Member program updated: The '
          || array_to_string(changed_labels[1:labels_count-1], ', ')
          || ', and ' || changed_labels[labels_count] || ' were changed.';
      end if;

      if ctx is null then
        update public.audit_events e set summary = audit_summary where e.event_id = ev_id;
      else
        update public.audit_events e set summary = audit_summary, context = ctx where e.event_id = ev_id;
      end if;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_id; actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    member_id := OLD.lead_id; program_id := OLD.member_program_id;

    select lower(coalesce(ps.status_name,'')) into old_status
      from program_status ps
      where ps.program_status_id = OLD.program_status_id;

    audit_summary := 'Member program deleted';
    ctx := jsonb_build_object('status', nullif(old_status,''), 'start_date', to_char(OLD.start_date, 'YYYY-MM-DD'));

    perform public.write_audit_event('member_programs', pk, 'DELETE', actor, 'member', member_id, program_id, audit_summary, ctx, to_jsonb(OLD), null);
    return OLD;
  end if;

  return null;
end $$;


ALTER FUNCTION public.audit_member_programs() OWNER TO postgres;

--
-- Name: audit_payment_methods(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_payment_methods() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = now();
        NEW.updated_by = auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.created_at = now();
        NEW.created_by = auth.uid();
        NEW.updated_at = now();
        NEW.updated_by = auth.uid();
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.audit_payment_methods() OWNER TO postgres;

--
-- Name: audit_payment_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_payment_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = now();
        NEW.updated_by = auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.created_at = now();
        NEW.created_by = auth.uid();
        NEW.updated_at = now();
        NEW.updated_by = auth.uid();
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.audit_payment_status() OWNER TO postgres;

--
-- Name: audit_support_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_support_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
declare
  pk_col text := TG_ARGV[0];
  pk_val bigint; actor uuid; old_j jsonb; new_j jsonb; ev_id bigint; col text;
begin
  if TG_OP = 'DELETE' then
    execute format('select ($1).%I', pk_col) into pk_val using OLD;
    actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    ev_id := public.write_audit_event(TG_TABLE_NAME, pk_val, 'DELETE', actor, 'support', null, null, null, null, to_jsonb(OLD), null);
    return OLD;
  elsif TG_OP = 'INSERT' then
    execute format('select ($1).%I', pk_col) into pk_val using NEW;
    actor := coalesce(NEW.created_by::uuid, null);
    ev_id := public.write_audit_event(TG_TABLE_NAME, pk_val, 'INSERT', actor, 'support', null, null, null, null, null, to_jsonb(NEW));
    return NEW;
  else
    old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);
    execute format('select ($1).%I', pk_col) into pk_val using NEW;
    actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    ev_id := public.write_audit_event(TG_TABLE_NAME, pk_val, 'UPDATE', actor, 'support', null, null, null, null, old_j, new_j);
    for col in select jsonb_object_keys(new_j) loop
      if old_j->col is distinct from new_j->col then
        perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);
      end if;
    end loop;
    return NEW;
  end if;
end; $_$;


ALTER FUNCTION public.audit_support_trigger() OWNER TO postgres;

--
-- Name: audit_trigger_function(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_trigger_function() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  old_value JSONB;
  new_value JSONB;
  changed_fields JSONB := '{}';
  col TEXT;
  pk_col TEXT := TG_ARGV[0];
  pk_val INT;
  user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_value := to_jsonb(OLD);
    EXECUTE format('SELECT ($1).%I', pk_col) INTO pk_val USING OLD;
    user_id := COALESCE(OLD.updated_by::uuid, OLD.created_by::uuid, NULL);
    INSERT INTO audit_logs(table_name, record_id, operation, old_value, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, pk_val, 'DELETE', old_value, user_id, NOW());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    new_value := to_jsonb(NEW);
    EXECUTE format('SELECT ($1).%I', pk_col) INTO pk_val USING NEW;
    user_id := COALESCE(NEW.created_by::uuid, NULL);
    INSERT INTO audit_logs(table_name, record_id, operation, new_value, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, pk_val, 'INSERT', new_value, user_id, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_value := to_jsonb(OLD);
    new_value := to_jsonb(NEW);
    EXECUTE format('SELECT ($1).%I', pk_col) INTO pk_val USING NEW;
    user_id := COALESCE(NEW.updated_by::uuid, NEW.created_by::uuid, NULL);
    
    -- Instead of collecting all changes in one row, insert separate rows for each changed column
    FOR col IN SELECT jsonb_object_keys(new_value)
    LOOP
      IF old_value -> col IS DISTINCT FROM new_value -> col THEN
        -- Create a single-field changed_fields object for this column
        changed_fields := jsonb_build_object(
          col, jsonb_build_object('old', old_value -> col, 'new', new_value -> col)
        );
        
        -- Insert a separate audit log entry for this column change
        INSERT INTO audit_logs(table_name, record_id, operation, column_name, old_value, new_value, changed_by, changed_at)
        VALUES (
          TG_TABLE_NAME, 
          pk_val, 
          'UPDATE', 
          col, 
          old_value -> col, 
          new_value -> col, 
          user_id, 
          NOW()
        );
      END IF;
    END LOOP;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$_$;


ALTER FUNCTION public.audit_trigger_function() OWNER TO postgres;

--
-- Name: compute_program_total_pause_days(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.compute_program_total_pause_days(p_program_id integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total_days int := 0;
  v_open_pause date := NULL;
  rec RECORD;
  old_id int;
  new_id int;
  new_status text;
BEGIN
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
    old_id := CASE WHEN jsonb_typeof(rec.old_j) = 'number' THEN (rec.old_j)::text::int ELSE NULL END;
    new_id := CASE WHEN jsonb_typeof(rec.new_j) = 'number' THEN (rec.new_j)::text::int ELSE NULL END;

    IF new_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT LOWER(COALESCE(ps.status_name, '')) INTO new_status
    FROM public.program_status ps
    WHERE ps.program_status_id = new_id
    LIMIT 1;

    IF new_status = 'paused' AND v_open_pause IS NULL THEN
      v_open_pause := rec.changed_on;
    ELSIF new_status = 'active' AND v_open_pause IS NOT NULL THEN
      v_total_days := v_total_days + GREATEST(0, (rec.changed_on - v_open_pause));
      v_open_pause := NULL;
    END IF;
  END LOOP;

  IF v_open_pause IS NOT NULL THEN
    v_total_days := v_total_days + GREATEST(0, (current_date - v_open_pause));
  END IF;

  RETURN GREATEST(v_total_days, 0);
END;
$$;


ALTER FUNCTION public.compute_program_total_pause_days(p_program_id integer) OWNER TO postgres;

--
-- Name: create_member_program_from_template(integer, integer[], text, text, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_member_program_id INTEGER;
    template_item RECORD;
    therapy_task RECORD;
    new_member_program_item_id INTEGER;
    calculated_margin NUMERIC(5,2);
    total_program_cost NUMERIC(9,2) := 0;
    total_program_charge NUMERIC(9,2) := 0;
    therapy_aggregate RECORD;
    calculated_taxes NUMERIC(10,2) := 0.00;
    item_tax NUMERIC(10,2);
    final_total_price NUMERIC(10,2);
BEGIN
    -- Calculate aggregated costs and charges from all templates
    SELECT 
        SUM(total_cost) as total_cost,
        SUM(total_charge) as total_charge
    INTO total_program_cost, total_program_charge
    FROM program_template 
    WHERE program_template_id = ANY(p_template_ids);
    
    -- Create the member program with user-provided name and description
    INSERT INTO member_programs (
        lead_id, program_template_name, description, start_date,
        total_cost, total_charge, source_template_id, program_status_id
    )
    VALUES (
        p_lead_id, 
        p_program_name,
        p_description,
        p_start_date,
        total_program_cost, 
        total_program_charge, 
        p_template_ids[1],
        1
    )
    RETURNING member_program_id INTO new_member_program_id;
    
    -- Calculate initial margin from aggregated data
    SELECT 
        CASE 
            WHEN total_program_charge > 0 THEN ((total_program_charge - total_program_cost) / total_program_charge) * 100
            ELSE 0
        END
    INTO calculated_margin;
    
    -- Simplified aggregation without tax calculation first
    FOR therapy_aggregate IN 
        SELECT 
            therapy_id,
            SUM(quantity) as total_quantity,
            MAX(item_cost) as item_cost,
            MAX(item_charge) as item_charge,
            MIN(days_from_start) as min_days_from_start,
            AVG(days_between) as avg_days_between,
            (array_agg(instructions ORDER BY program_template_items_id DESC))[1] as last_instructions
        FROM (
            SELECT pti.program_template_items_id, pti.therapy_id, pti.quantity, t.cost as item_cost, t.charge as item_charge,
                   pti.days_from_start, pti.days_between, pti.instructions
            FROM program_template_items pti
            JOIN therapies t ON pti.therapy_id = t.therapy_id
            WHERE pti.program_template_id = ANY(p_template_ids)
            AND pti.active_flag = TRUE
        ) aggregated_items
        GROUP BY therapy_id
    LOOP
        -- Insert the aggregated member program item
        INSERT INTO member_program_items (
            member_program_id, therapy_id, quantity,
            item_cost, item_charge, days_from_start, days_between, instructions
        ) VALUES (
            new_member_program_id, 
            therapy_aggregate.therapy_id, 
            therapy_aggregate.total_quantity,
            therapy_aggregate.item_cost, 
            therapy_aggregate.item_charge, 
            therapy_aggregate.min_days_from_start, 
            therapy_aggregate.avg_days_between, 
            therapy_aggregate.last_instructions
        ) RETURNING member_program_item_id INTO new_member_program_item_id;
        
        -- Copy therapy tasks for this therapy to member program item tasks
        FOR therapy_task IN 
            SELECT tt.*
            FROM therapy_tasks tt
            WHERE tt.therapy_id = therapy_aggregate.therapy_id
            AND tt.active_flag = TRUE
        LOOP
            INSERT INTO member_program_item_tasks (
                member_program_item_id, task_id, task_name, description, 
                task_delay, completed_flag, created_by, updated_by
            ) VALUES (
                new_member_program_item_id, therapy_task.task_id, therapy_task.task_name, 
                therapy_task.description, therapy_task.task_delay, FALSE, 
                auth.uid(), auth.uid()
            );
        END LOOP;
    END LOOP;
    
    -- Calculate taxes separately after items are created
    SELECT COALESCE(SUM(
        CASE 
            WHEN t.taxable = true THEN mpi.item_charge * mpi.quantity * 0.0825
            ELSE 0
        END
    ), 0)
    INTO calculated_taxes
    FROM member_program_items mpi
    JOIN therapies t ON mpi.therapy_id = t.therapy_id
    WHERE mpi.member_program_id = new_member_program_id;
    
    -- Calculate final total price including taxes
    final_total_price := total_program_charge + calculated_taxes;
    
    -- Create initial finances record with calculated margin and taxes
    INSERT INTO member_program_finances (
        member_program_id,
        finance_charges,
        taxes,
        discounts,
        final_total_price,
        margin,
        financing_type_id
    ) VALUES (
        new_member_program_id,
        0.00, -- Default finance charges
        calculated_taxes, -- Calculated taxes from template items
        0.00, -- Default discounts
        final_total_price, -- Final total price including taxes
        calculated_margin, -- Calculated margin from template
        NULL -- No financing type initially
    );
    
    RETURN new_member_program_id;
END;
$$;


ALTER FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date) OWNER TO postgres;

--
-- Name: example_create_member_program(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.example_create_member_program() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    sample_lead_id INTEGER;
    sample_template_id INTEGER;
    new_program_id INTEGER;
    result_text TEXT;
BEGIN
    -- This is just an example - you'll replace with actual IDs
    -- Get a sample lead (first active lead)
    SELECT lead_id INTO sample_lead_id 
    FROM "Leads" 
    WHERE active_flag = TRUE 
    LIMIT 1;
    
    -- Get a sample template (first active template)
    SELECT program_template_id INTO sample_template_id 
    FROM program_template 
    WHERE active_flag = TRUE 
    LIMIT 1;
    
    IF sample_lead_id IS NULL OR sample_template_id IS NULL THEN
        RETURN 'No active leads or templates found for example';
    END IF;
    
    -- Create member program from template
    SELECT create_member_program_from_template(sample_lead_id, sample_template_id) 
    INTO new_program_id;
    
    result_text := 'Successfully created member program ID: ' || new_program_id || 
                   ' for lead ID: ' || sample_lead_id || 
                   ' from template ID: ' || sample_template_id;
    
    RETURN result_text;
END;
$$;


ALTER FUNCTION public.example_create_member_program() OWNER TO postgres;

--
-- Name: generate_member_program_schedule(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_member_program_schedule(p_program_id integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  -- Compute accumulated pause days from audit logs and shift anchor
  BEGIN
    v_pause_days := COALESCE(public.compute_program_total_pause_days(p_program_id), 0);
  EXCEPTION WHEN others THEN
    v_pause_days := 0;
  END;
  v_effective_start := v_start_date + v_pause_days;

  -- Rebuild strategy:
  --   1) Delete all INCOMPLETE item schedules (cascades task schedules via FK ON DELETE CASCADE)
  --   2) Re-insert item schedules from current items and start_date (idempotent with upserts)

  -- 1) Delete all incomplete item schedules for this program (preserve completed)
  DELETE FROM public.member_program_item_schedule s
  USING public.member_program_items i
  WHERE s.member_program_item_id = i.member_program_item_id
    AND i.member_program_id = p_program_id
    AND COALESCE(s.completed_flag, false) = false;

  -- 2) Generate schedules for active items with quantity > 0
  FOR v_items IN
    SELECT
      i.member_program_item_id,
      COALESCE(i.days_from_start, 0) AS d0,
      COALESCE(i.days_between, 0) AS gap,
      COALESCE(i.quantity, 0) AS qty
    FROM public.member_program_items i
    WHERE i.member_program_id = p_program_id
      AND COALESCE(i.active_flag, true) = true
      AND COALESCE(i.quantity, 0) > 0
  LOOP
    v_days_from_start := v_items.d0;
    v_days_between := v_items.gap;
    v_qty := v_items.qty;

    FOR v_instance IN 0..(v_qty - 1) LOOP
      v_occurrence_date := v_effective_start + (v_days_from_start::int) + (v_instance * v_days_between);

      -- Insert occurrence idempotently; preserve completed rows
      INSERT INTO public.member_program_item_schedule(
        member_program_item_id,
        instance_number,
        scheduled_date
      )
      VALUES (
        v_items.member_program_item_id,
        v_instance + 1,
        v_occurrence_date
      )
      ON CONFLICT ON CONSTRAINT uniq_item_schedule_instance
      DO NOTHING
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

      -- Insert task schedules for this occurrence; avoid duplicates
      INSERT INTO public.member_program_items_task_schedule(
        member_program_item_schedule_id,
        member_program_item_task_id,
        due_date
      )
      SELECT
        v_sched_id,
        t.member_program_item_task_id,
        (v_occurrence_date + COALESCE(t.task_delay, 0))::date
      FROM public.member_program_item_tasks t
      WHERE t.member_program_item_id = v_items.member_program_item_id
      ON CONFLICT ON CONSTRAINT uniq_task_schedule_per_occurrence DO NOTHING;

      GET DIAGNOSTICS _ins_count = ROW_COUNT;
      v_inserted_task_sched := v_inserted_task_sched + COALESCE(_ins_count, 0);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted_items', v_inserted_item_sched,
    'inserted_tasks', v_inserted_task_sched
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION public.generate_member_program_schedule(p_program_id integer) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, email, full_name, created_at)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: pause_member_program(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pause_member_program(p_program_id integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Require authenticated caller
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  -- Null scheduled_date for all incomplete item schedules for this program
  update public.member_program_item_schedule s
    set scheduled_date = null,
        updated_at = now(),
        updated_by = auth.uid()
  from public.member_program_items i
  where s.member_program_item_id = i.member_program_item_id
    and i.member_program_id = p_program_id
    and s.completed_flag = false;

  -- Null due_date for all incomplete task schedules tied to those item schedules
  update public.member_program_items_task_schedule ts
    set due_date = null,
        updated_at = now(),
        updated_by = auth.uid()
  from public.member_program_item_schedule s
  join public.member_program_items i on i.member_program_item_id = s.member_program_item_id
  where ts.member_program_item_schedule_id = s.member_program_item_schedule_id
    and i.member_program_id = p_program_id
    and ts.completed_flag = false;
end;
$$;


ALTER FUNCTION public.pause_member_program(p_program_id integer) OWNER TO postgres;

--
-- Name: regen_member_program_task_schedule(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.regen_member_program_task_schedule(p_member_program_item_task_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_task_id integer := p_member_program_item_task_id;
BEGIN
  IF v_task_id IS NULL THEN
    RETURN;
  END IF;

  -- Concurrency control for this task
  PERFORM pg_advisory_lock(v_task_id);

  -- 1) Insert any missing schedule rows for each item occurrence (instance)
  INSERT INTO public.member_program_items_task_schedule (
    member_program_item_schedule_id,
    member_program_item_task_id,
    due_date,
    completed_flag
  )
  SELECT
    mis.member_program_item_schedule_id,
    mpit.member_program_item_task_id,
    (mis.scheduled_date + (COALESCE(mpit.task_delay, 0) || ' days')::interval)::date,
    false
  FROM public.member_program_item_tasks mpit
  JOIN public.member_program_item_schedule mis
    ON mis.member_program_item_id = mpit.member_program_item_id
  WHERE mpit.member_program_item_task_id = v_task_id
  ON CONFLICT (member_program_item_schedule_id, member_program_item_task_id) DO NOTHING;

  -- 2) Update due_date for existing, incomplete schedule rows
  UPDATE public.member_program_items_task_schedule ts
  SET due_date = (mis.scheduled_date + (COALESCE(mpit.task_delay, 0) || ' days')::interval)::date
  FROM public.member_program_item_schedule mis
  JOIN public.member_program_item_tasks mpit
    ON mpit.member_program_item_task_id = ts.member_program_item_task_id
  WHERE ts.member_program_item_schedule_id = mis.member_program_item_schedule_id
    AND ts.member_program_item_task_id = v_task_id
    AND COALESCE(ts.completed_flag, false) = false;

  PERFORM pg_advisory_unlock(v_task_id);
END;
$$;


ALTER FUNCTION public.regen_member_program_task_schedule(p_member_program_item_task_id integer) OWNER TO postgres;

--
-- Name: regenerate_member_program_payments(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.regenerate_member_program_payments(p_program_id integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_has_paid boolean;
  v_final_total numeric(10,2);
  v_financing_type_name text;
  v_financing_source public.financing_source_enum;
  v_pending_status_id int;
  v_count int;
  v_amount_each numeric(10,2);
  -- 25% first-payment rule and monthly date clamping
  v_first_amount numeric(10,2);
  v_remaining numeric(10,2);
  v_base_each numeric(10,2);
  v_residual numeric(10,2);
  v_anchor_day int;
  v_target_month date;
  v_target_last_day date;
  v_due date;
  i int;
begin
  -- Require authenticated caller
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  -- Abort if any payment already paid
  select exists(
    select 1
    from public.member_program_payments
    where member_program_id = p_program_id
      and payment_date is not null
  )
  into v_has_paid;

  if v_has_paid then
    raise exception 'Cannot regenerate payments: at least one payment is already paid.';
  end if;

  -- Clear existing payments
  delete from public.member_program_payments
  where member_program_id = p_program_id;

  -- Gather finance info
  select f.final_total_price,
         ft.financing_type_name,
         ft.financing_source
  into v_final_total, v_financing_type_name, v_financing_source
  from public.member_program_finances f
  left join public.financing_types ft on ft.financing_type_id = f.financing_type_id
  where f.member_program_id = p_program_id;

  -- Pending status id
  select payment_status_id
  into v_pending_status_id
  from public.payment_status
  where payment_status_name ilike 'pending'
  order by payment_status_id
  limit 1;

  if v_pending_status_id is null then
    raise exception 'Pending payment status not found';
  end if;

  -- Do not generate payments for non-positive price
  if coalesce(v_final_total, 0) <= 0 then
    return;
  end if;

  -- External or Full Payment -> single payment today
  if v_financing_source = 'external'::financing_source_enum
     or (v_financing_type_name is not null and v_financing_type_name ilike 'full payment') then
    insert into public.member_program_payments (
      member_program_id,
      payment_amount,
      payment_due_date,
      payment_date,
      payment_status_id,
      payment_method_id,
      payment_reference,
      notes,
      active_flag,
      created_at,
      created_by,
      updated_at,
      updated_by
    ) values (
      p_program_id,
      coalesce(v_final_total, 0),
      current_date,
      null,
      v_pending_status_id,
      null,
      null,
      null,
      true,
      now(),
      auth.uid(),
      now(),
      auth.uid()
    );
    return;
  end if;

  -- Internal financing
  if v_financing_source = 'internal'::financing_source_enum then
    -- Extract first integer from type name; default to 1 if none/invalid
    select coalesce( nullif((regexp_match(coalesce(v_financing_type_name, ''), '\d+'))[1], '')::int, 1 )
    into v_count;

    if v_count is null or v_count <= 0 then
      v_count := 1;
    end if;

    -- Monthly due date anchor (day of month)
    v_anchor_day := extract(day from current_date)::int;

    if v_count <= 1 then
      -- Single payment today for full amount
      insert into public.member_program_payments (
        member_program_id,
        payment_amount,
        payment_due_date,
        payment_date,
        payment_status_id,
        payment_method_id,
        payment_reference,
        notes,
        active_flag,
        created_at,
        created_by,
        updated_at,
        updated_by
      ) values (
        p_program_id,
        coalesce(v_final_total, 0),
        current_date,
        null,
        v_pending_status_id,
        null,
        null,
        null,
        true,
        now(),
        auth.uid(),
        now(),
        auth.uid()
      );
      return;
    end if;

    -- Amount logic:
    --  - If v_count >= 4: 25% as first payment (rounded), remainder split across v_count-1 (trunc) with residual on last
    --  - If v_count = 2 or 3: split all payments equally (trunc) with residual on last
    if v_count >= 4 then
      v_first_amount := round( coalesce(v_final_total, 0) * 0.25, 2 );
      v_remaining := coalesce(v_final_total, 0) - v_first_amount;
      v_base_each := trunc( v_remaining / (v_count - 1), 2 );
      v_residual := round( v_remaining - (v_base_each * ((v_count - 1) - 1)), 2 );
    else
      v_base_each := trunc( coalesce(v_final_total, 0) / v_count, 2 );
      v_residual := round( coalesce(v_final_total, 0) - (v_base_each * (v_count - 1)), 2 );
    end if;

    -- Generate payments with monthly increments and end-of-month clamping
    i := 1;
    while i <= v_count loop
      -- Month i-1 from current month
      v_target_month := (date_trunc('month', current_date)::date + make_interval(months => (i - 1)))::date;
      v_target_last_day := (date_trunc('month', (v_target_month + interval '1 month'))::date - 1);
      v_due := v_target_month + (least(v_anchor_day, extract(day from v_target_last_day)::int) - 1);

      insert into public.member_program_payments (
        member_program_id,
        payment_amount,
        payment_due_date,
        payment_date,
        payment_status_id,
        payment_method_id,
        payment_reference,
        notes,
        active_flag,
        created_at,
        created_by,
        updated_at,
        updated_by
      ) values (
        p_program_id,
        case
          when v_count >= 4 and i = 1 then v_first_amount
          when i < v_count then v_base_each
          else v_residual
        end,
        v_due,
        null,
        v_pending_status_id,
        null,
        null,
        null,
        true,
        now(),
        auth.uid(),
        now(),
        auth.uid()
      );

      i := i + 1;
    end loop;
  end if;
end;
$$;


ALTER FUNCTION public.regenerate_member_program_payments(p_program_id integer) OWNER TO postgres;

--
-- Name: update_timestamp_function(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp_function() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp_function() OWNER TO postgres;

--
-- Name: write_audit_change(bigint, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.write_audit_change(p_event_id bigint, p_column_name text, p_old jsonb, p_new jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  insert into public.audit_event_changes(event_id, column_name, old_value, new_value)
  values (p_event_id, p_column_name, p_old, p_new)
  on conflict (event_id, column_name) do nothing;
$$;


ALTER FUNCTION public.write_audit_change(p_event_id bigint, p_column_name text, p_old jsonb, p_new jsonb) OWNER TO postgres;

--
-- Name: write_audit_event(text, bigint, text, uuid, text, bigint, bigint, text, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.write_audit_event(p_table_name text, p_record_id bigint, p_operation text, p_actor uuid, p_scope text, p_related_member_id bigint, p_related_program_id bigint, p_summary text, p_context jsonb, p_old jsonb, p_new jsonb, p_record_pk jsonb DEFAULT NULL::jsonb) RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    AS $$
  insert into public.audit_events(
    table_name, record_id, record_pk, operation, actor_user_id, scope,
    related_member_id, related_program_id, summary, context, old_row, new_row
  ) values (
    p_table_name, p_record_id, p_record_pk, p_operation, p_actor, coalesce(p_scope,'support'),
    p_related_member_id, p_related_program_id, p_summary, p_context, p_old, p_new
  ) returning event_id;
$$;


ALTER FUNCTION public.write_audit_event(p_table_name text, p_record_id bigint, p_operation text, p_actor uuid, p_scope text, p_related_member_id bigint, p_related_program_id bigint, p_summary text, p_context jsonb, p_old jsonb, p_new jsonb, p_record_pk jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_event_changes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_event_changes (
    event_id bigint NOT NULL,
    column_name text NOT NULL,
    old_value jsonb,
    new_value jsonb
);


ALTER TABLE public.audit_event_changes OWNER TO postgres;

--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_events (
    event_id bigint NOT NULL,
    table_name text NOT NULL,
    record_id bigint,
    record_pk jsonb,
    operation text NOT NULL,
    actor_user_id uuid,
    event_at timestamp with time zone DEFAULT now() NOT NULL,
    scope text DEFAULT 'support'::text NOT NULL,
    related_member_id bigint,
    related_program_id bigint,
    summary text,
    context jsonb,
    old_row jsonb,
    new_row jsonb,
    CONSTRAINT audit_events_operation_check CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
    CONSTRAINT audit_events_scope_check CHECK ((scope = ANY (ARRAY['support'::text, 'member'::text])))
);


ALTER TABLE public.audit_events OWNER TO postgres;

--
-- Name: audit_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_events ALTER COLUMN event_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    table_name text NOT NULL,
    record_id integer NOT NULL,
    operation text NOT NULL,
    old_record jsonb,
    new_record jsonb,
    changed_columns text[],
    business_context jsonb,
    changed_by uuid,
    changed_at timestamp with time zone,
    source_audit_log_ids integer[],
    migration_notes text
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bodies_body_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bodies_body_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.bodies_body_id_seq OWNER TO postgres;

--
-- Name: bodies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bodies (
    body_id integer DEFAULT nextval('public.bodies_body_id_seq'::regclass) NOT NULL,
    body_name text NOT NULL,
    description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.bodies OWNER TO postgres;

--
-- Name: buckets_bucket_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.buckets_bucket_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.buckets_bucket_id_seq OWNER TO postgres;

--
-- Name: buckets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buckets (
    bucket_id integer DEFAULT nextval('public.buckets_bucket_id_seq'::regclass) NOT NULL,
    bucket_name text NOT NULL,
    description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.buckets OWNER TO postgres;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    campaign_id integer NOT NULL,
    campaign_name text NOT NULL,
    campaign_date date NOT NULL,
    description text NOT NULL,
    confirmed_count integer NOT NULL,
    vendor_id integer NOT NULL,
    ad_spend numeric(10,2),
    food_cost numeric(10,2),
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: campaigns_campaign_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.campaigns_campaign_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.campaigns_campaign_id_seq OWNER TO postgres;

--
-- Name: campaigns_campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.campaigns_campaign_id_seq OWNED BY public.campaigns.campaign_id;


--
-- Name: financing_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financing_types (
    financing_type_id integer NOT NULL,
    financing_type_name character varying(50) NOT NULL,
    financing_type_description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid(),
    financing_source public.financing_source_enum DEFAULT 'internal'::public.financing_source_enum NOT NULL
);


ALTER TABLE public.financing_types OWNER TO postgres;

--
-- Name: TABLE financing_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.financing_types IS 'Lookup table for financing types (Full Payment, Financed)';


--
-- Name: financing_types_financing_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.financing_types_financing_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.financing_types_financing_type_id_seq OWNER TO postgres;

--
-- Name: financing_types_financing_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.financing_types_financing_type_id_seq OWNED BY public.financing_types.financing_type_id;


--
-- Name: lead_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_notes (
    note_id integer NOT NULL,
    lead_id integer NOT NULL,
    note_type character varying(20) NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT lead_notes_note_type_check CHECK (((note_type)::text = ANY ((ARRAY['PME'::character varying, 'Other'::character varying, 'Win'::character varying, 'Challenge'::character varying])::text[])))
);


ALTER TABLE public.lead_notes OWNER TO postgres;

--
-- Name: TABLE lead_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lead_notes IS 'Immutable notes associated with leads/members. Notes cannot be updated, only added.';


--
-- Name: COLUMN lead_notes.note_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lead_notes.note_id IS 'Unique identifier for the note (auto-generated)';


--
-- Name: COLUMN lead_notes.lead_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lead_notes.lead_id IS 'Foreign key to leads table - will cascade delete if lead is deleted';


--
-- Name: COLUMN lead_notes.note_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lead_notes.note_type IS 'Type of note: PME, Other, Win, or Challenge';


--
-- Name: COLUMN lead_notes.note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lead_notes.note IS 'The actual note content';


--
-- Name: COLUMN lead_notes.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lead_notes.created_at IS 'When the note was created (immutable)';


--
-- Name: COLUMN lead_notes.created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lead_notes.created_by IS 'User who created the note';


--
-- Name: lead_notes_note_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.lead_notes ALTER COLUMN note_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lead_notes_note_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    lead_id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text NOT NULL,
    status_id integer NOT NULL,
    campaign_id integer NOT NULL,
    pmedate date,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: leads_lead_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leads_lead_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leads_lead_id_seq OWNER TO postgres;

--
-- Name: leads_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leads_lead_id_seq OWNED BY public.leads.lead_id;


--
-- Name: member_program_finances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_finances (
    member_program_finance_id integer NOT NULL,
    member_program_id integer NOT NULL,
    finance_charges numeric(10,2) DEFAULT 0.00,
    taxes numeric(10,2) DEFAULT 0.00,
    discounts numeric(10,2) DEFAULT 0.00,
    final_total_price numeric(10,2) DEFAULT 0.00,
    margin numeric(5,2) DEFAULT 0.00,
    financing_type_id integer,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_program_finances OWNER TO postgres;

--
-- Name: member_program_finances_member_program_finance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_finances_member_program_finance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.member_program_finances_member_program_finance_id_seq OWNER TO postgres;

--
-- Name: member_program_finances_member_program_finance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_finances_member_program_finance_id_seq OWNED BY public.member_program_finances.member_program_finance_id;


--
-- Name: member_program_item_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_item_schedule (
    member_program_item_schedule_id integer NOT NULL,
    member_program_item_id integer NOT NULL,
    instance_number integer NOT NULL,
    scheduled_date date,
    completed_flag boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_program_item_schedule OWNER TO postgres;

--
-- Name: member_program_item_schedule_member_program_item_schedule_id_se; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_item_schedule_member_program_item_schedule_id_se
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.member_program_item_schedule_member_program_item_schedule_id_se OWNER TO postgres;

--
-- Name: member_program_item_schedule_member_program_item_schedule_id_se; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_item_schedule_member_program_item_schedule_id_se OWNED BY public.member_program_item_schedule.member_program_item_schedule_id;


--
-- Name: member_program_item_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_item_tasks (
    member_program_item_task_id integer NOT NULL,
    member_program_item_id integer NOT NULL,
    task_id integer NOT NULL,
    task_name text NOT NULL,
    description text,
    task_delay integer NOT NULL,
    completed_flag boolean DEFAULT false NOT NULL,
    completed_date timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_program_item_tasks OWNER TO postgres;

--
-- Name: member_program_item_tasks_member_program_item_task_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq OWNER TO postgres;

--
-- Name: member_program_item_tasks_member_program_item_task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq OWNED BY public.member_program_item_tasks.member_program_item_task_id;


--
-- Name: member_program_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_items (
    member_program_item_id integer NOT NULL,
    member_program_id integer NOT NULL,
    therapy_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    item_cost numeric(10,2) DEFAULT 0 NOT NULL,
    item_charge numeric(10,2) DEFAULT 0 NOT NULL,
    days_from_start integer DEFAULT 0 NOT NULL,
    days_between integer DEFAULT 0 NOT NULL,
    instructions text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_program_items OWNER TO postgres;

--
-- Name: member_program_items_member_program_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_items_member_program_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.member_program_items_member_program_item_id_seq OWNER TO postgres;

--
-- Name: member_program_items_member_program_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_items_member_program_item_id_seq OWNED BY public.member_program_items.member_program_item_id;


--
-- Name: member_program_items_task_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_items_task_schedule (
    member_program_item_task_schedule_id integer NOT NULL,
    member_program_item_schedule_id integer NOT NULL,
    member_program_item_task_id integer NOT NULL,
    due_date date,
    completed_flag boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_program_items_task_schedule OWNER TO postgres;

--
-- Name: member_program_items_task_schedule_member_program_item_task_sch; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_items_task_schedule_member_program_item_task_sch
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.member_program_items_task_schedule_member_program_item_task_sch OWNER TO postgres;

--
-- Name: member_program_items_task_schedule_member_program_item_task_sch; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_items_task_schedule_member_program_item_task_sch OWNED BY public.member_program_items_task_schedule.member_program_item_task_schedule_id;


--
-- Name: member_program_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_payments (
    member_program_payment_id integer NOT NULL,
    member_program_id integer NOT NULL,
    payment_amount numeric(10,2) NOT NULL,
    payment_due_date date NOT NULL,
    payment_date date,
    payment_status_id integer NOT NULL,
    payment_method_id integer,
    payment_reference character varying(100),
    notes text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_program_payments OWNER TO postgres;

--
-- Name: TABLE member_program_payments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.member_program_payments IS 'Payment schedule and tracking for member programs';


--
-- Name: COLUMN member_program_payments.payment_due_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.member_program_payments.payment_due_date IS 'Date when payment is due';


--
-- Name: COLUMN member_program_payments.payment_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.member_program_payments.payment_date IS 'Date when payment was actually made (NULL until paid)';


--
-- Name: COLUMN member_program_payments.payment_reference; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.member_program_payments.payment_reference IS 'Reference number for payment (check number, transaction ID, etc.)';


--
-- Name: member_program_payments_member_program_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_payments_member_program_payment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.member_program_payments_member_program_payment_id_seq OWNER TO postgres;

--
-- Name: member_program_payments_member_program_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_payments_member_program_payment_id_seq OWNED BY public.member_program_payments.member_program_payment_id;


--
-- Name: member_programs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_programs (
    member_program_id integer NOT NULL,
    program_template_name text NOT NULL,
    description text,
    total_cost numeric(9,2),
    total_charge numeric(9,2),
    lead_id integer,
    start_date date,
    active_flag boolean DEFAULT true NOT NULL,
    program_status_id integer,
    source_template_id integer,
    template_version_date timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.member_programs OWNER TO postgres;

--
-- Name: member_programs_member_program_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_programs_member_program_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.member_programs_member_program_id_seq OWNER TO postgres;

--
-- Name: member_programs_member_program_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_programs_member_program_id_seq OWNED BY public.member_programs.member_program_id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    path character varying(255) NOT NULL,
    label character varying(100) NOT NULL,
    section character varying(50) NOT NULL,
    icon character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.menu_items OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    payment_method_id integer NOT NULL,
    payment_method_name character varying(50) NOT NULL,
    payment_method_description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payment_methods IS 'Lookup table for payment methods (Cash, Check, Credit Card, etc.)';


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_methods_payment_method_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNER TO postgres;

--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNED BY public.payment_methods.payment_method_id;


--
-- Name: payment_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_status (
    payment_status_id integer NOT NULL,
    payment_status_name character varying(50) NOT NULL,
    payment_status_description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.payment_status OWNER TO postgres;

--
-- Name: TABLE payment_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payment_status IS 'Lookup table for payment statuses (Pending, Paid, Late, Cancelled)';


--
-- Name: payment_status_payment_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_status_payment_status_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.payment_status_payment_status_id_seq OWNER TO postgres;

--
-- Name: payment_status_payment_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_status_payment_status_id_seq OWNED BY public.payment_status.payment_status_id;


--
-- Name: pillars_pillar_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pillars_pillar_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.pillars_pillar_id_seq OWNER TO postgres;

--
-- Name: pillars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pillars (
    pillar_id integer DEFAULT nextval('public.pillars_pillar_id_seq'::regclass) NOT NULL,
    pillar_name text NOT NULL,
    description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.pillars OWNER TO postgres;

--
-- Name: program_items_program_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.program_items_program_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.program_items_program_item_id_seq OWNER TO postgres;

--
-- Name: program_status_program_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.program_status_program_status_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.program_status_program_status_id_seq OWNER TO postgres;

--
-- Name: program_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.program_status (
    program_status_id integer DEFAULT nextval('public.program_status_program_status_id_seq'::regclass) NOT NULL,
    status_name text NOT NULL,
    description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.program_status OWNER TO postgres;

--
-- Name: program_template_program_template_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.program_template_program_template_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.program_template_program_template_id_seq OWNER TO postgres;

--
-- Name: program_template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.program_template (
    program_template_id integer DEFAULT nextval('public.program_template_program_template_id_seq'::regclass) NOT NULL,
    program_template_name text NOT NULL,
    description text,
    total_cost numeric(9,2),
    total_charge numeric(9,2),
    margin_percentage numeric(5,2),
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.program_template OWNER TO postgres;

--
-- Name: program_template_items_program_template_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.program_template_items_program_template_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.program_template_items_program_template_items_id_seq OWNER TO postgres;

--
-- Name: program_template_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.program_template_items (
    program_template_items_id integer DEFAULT nextval('public.program_template_items_program_template_items_id_seq'::regclass) NOT NULL,
    program_template_id integer NOT NULL,
    therapy_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    days_from_start integer DEFAULT 0 NOT NULL,
    days_between integer DEFAULT 0 NOT NULL,
    instructions text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.program_template_items OWNER TO postgres;

--
-- Name: programs_program_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.programs_program_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.programs_program_id_seq OWNER TO postgres;

--
-- Name: status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.status (
    status_id integer NOT NULL,
    status_name text NOT NULL,
    description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.status OWNER TO postgres;

--
-- Name: status_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.status_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.status_status_id_seq OWNER TO postgres;

--
-- Name: status_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.status_status_id_seq OWNED BY public.status.status_id;


--
-- Name: therapies_therapy_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.therapies_therapy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.therapies_therapy_id_seq OWNER TO postgres;

--
-- Name: therapies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.therapies (
    therapy_id integer DEFAULT nextval('public.therapies_therapy_id_seq'::regclass) NOT NULL,
    therapy_name text NOT NULL,
    description text,
    therapy_type_id integer NOT NULL,
    bucket_id integer NOT NULL,
    cost numeric(10,2) NOT NULL,
    charge numeric(10,2) NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid(),
    taxable boolean DEFAULT false NOT NULL
);


ALTER TABLE public.therapies OWNER TO postgres;

--
-- Name: therapies_bodies_pillars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.therapies_bodies_pillars (
    therapy_id integer NOT NULL,
    body_id integer NOT NULL,
    pillar_id integer NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.therapies_bodies_pillars OWNER TO postgres;

--
-- Name: therapy_tasks_task_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.therapy_tasks_task_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.therapy_tasks_task_id_seq OWNER TO postgres;

--
-- Name: therapy_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.therapy_tasks (
    task_id integer DEFAULT nextval('public.therapy_tasks_task_id_seq'::regclass) NOT NULL,
    task_name text NOT NULL,
    description text,
    therapy_id integer NOT NULL,
    task_delay integer NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.therapy_tasks OWNER TO postgres;

--
-- Name: therapy_type_therapy_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.therapy_type_therapy_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.therapy_type_therapy_type_id_seq OWNER TO postgres;

--
-- Name: therapytype; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.therapytype (
    therapy_type_id integer DEFAULT nextval('public.therapy_type_therapy_type_id_seq'::regclass) NOT NULL,
    therapy_type_name text NOT NULL,
    description text,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.therapytype OWNER TO postgres;

--
-- Name: user_menu_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_menu_permissions (
    id integer NOT NULL,
    user_id uuid,
    menu_path character varying(255) NOT NULL,
    granted_at timestamp without time zone DEFAULT now(),
    granted_by uuid
);


ALTER TABLE public.user_menu_permissions OWNER TO postgres;

--
-- Name: user_menu_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_menu_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_menu_permissions_id_seq OWNER TO postgres;

--
-- Name: user_menu_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_menu_permissions_id_seq OWNED BY public.user_menu_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT true,
    is_active boolean DEFAULT true
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    vendor_id integer NOT NULL,
    vendor_name text NOT NULL,
    contact_person text NOT NULL,
    email text,
    phone text NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendors_vendor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendors_vendor_id_seq OWNER TO postgres;

--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendors_vendor_id_seq OWNED BY public.vendors.vendor_id;


--
-- Name: vw_audit_logs_with_fullcontext; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_audit_logs_with_fullcontext AS
 SELECT e.event_id AS id,
    e.table_name,
    e.record_id,
    e.operation,
    e.actor_user_id AS changed_by,
    e.event_at AS changed_at,
    e.scope,
    e.related_member_id,
    e.related_program_id,
    ((l.first_name || ' '::text) || l.last_name) AS related_member_name,
    mp.program_template_name AS related_program_name,
    COALESCE(e.summary, concat(e.operation, ' on ', e.table_name)) AS change_description_with_full_context
   FROM ((public.audit_events e
     LEFT JOIN public.member_programs mp ON ((mp.member_program_id = e.related_program_id)))
     LEFT JOIN public.leads l ON ((l.lead_id = e.related_member_id)));


ALTER VIEW public.vw_audit_logs_with_fullcontext OWNER TO postgres;

--
-- Name: vw_audit_member_changes; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_audit_member_changes AS
 WITH base AS (
         SELECT e.event_id,
            e.table_name,
            e.record_id,
            e.operation,
            e.actor_user_id,
            e.event_at,
            e.scope,
            e.related_member_id,
            e.related_program_id,
            ((l.first_name || ' '::text) || l.last_name) AS related_member_name,
            mp.program_template_name AS related_program_name,
            COALESCE(e.summary, concat(e.operation, ' on ', e.table_name)) AS full_desc
           FROM ((public.audit_events e
             LEFT JOIN public.member_programs mp ON ((mp.member_program_id = e.related_program_id)))
             LEFT JOIN public.leads l ON ((l.lead_id = e.related_member_id)))
          WHERE (e.table_name = ANY (ARRAY['member_program_payments'::text, 'member_program_item_schedule'::text, 'member_program_items'::text, 'member_program_item_tasks'::text, 'member_program_finances'::text, 'member_program_items_task_schedule'::text, 'member_programs'::text]))
        ), agg_delete AS (
         SELECT min(base.event_id) AS id,
                CASE base.table_name
                    WHEN 'member_program_payments'::text THEN 'Payments'::text
                    WHEN 'member_program_item_schedule'::text THEN 'Script'::text
                    WHEN 'member_program_items'::text THEN 'Items'::text
                    WHEN 'member_program_item_tasks'::text THEN 'Tasks'::text
                    WHEN 'member_program_finances'::text THEN 'Finance'::text
                    WHEN 'member_program_items_task_schedule'::text THEN 'To Do'::text
                    WHEN 'member_programs'::text THEN 'Information'::text
                    ELSE base.table_name
                END AS source,
            NULL::bigint AS record_id,
            'DELETE'::text AS operation,
            base.actor_user_id AS changed_by,
            base.event_at AS changed_at,
            min(base.scope) AS scope,
            max(base.related_member_id) AS member_id,
            base.related_program_id AS program_id,
            max(base.related_member_name) AS member_name,
            max(base.related_program_name) AS program_name,
            ((count(*))::text || ' rows removed'::text) AS change_description
           FROM base
          WHERE (base.operation = 'DELETE'::text)
          GROUP BY
                CASE base.table_name
                    WHEN 'member_program_payments'::text THEN 'Payments'::text
                    WHEN 'member_program_item_schedule'::text THEN 'Script'::text
                    WHEN 'member_program_items'::text THEN 'Items'::text
                    WHEN 'member_program_item_tasks'::text THEN 'Tasks'::text
                    WHEN 'member_program_finances'::text THEN 'Finance'::text
                    WHEN 'member_program_items_task_schedule'::text THEN 'To Do'::text
                    WHEN 'member_programs'::text THEN 'Information'::text
                    ELSE base.table_name
                END, base.actor_user_id, base.event_at, base.related_program_id
        ), agg_insert AS (
         SELECT min(base.event_id) AS id,
                CASE base.table_name
                    WHEN 'member_program_payments'::text THEN 'Payments'::text
                    WHEN 'member_program_item_schedule'::text THEN 'Script'::text
                    WHEN 'member_program_items'::text THEN 'Items'::text
                    WHEN 'member_program_item_tasks'::text THEN 'Tasks'::text
                    WHEN 'member_program_finances'::text THEN 'Finance'::text
                    WHEN 'member_program_items_task_schedule'::text THEN 'To Do'::text
                    WHEN 'member_programs'::text THEN 'Information'::text
                    ELSE base.table_name
                END AS source,
            NULL::bigint AS record_id,
            'INSERT'::text AS operation,
            base.actor_user_id AS changed_by,
            base.event_at AS changed_at,
            min(base.scope) AS scope,
            max(base.related_member_id) AS member_id,
            base.related_program_id AS program_id,
            max(base.related_member_name) AS member_name,
            max(base.related_program_name) AS program_name,
            ((count(*))::text || ' rows added'::text) AS change_description
           FROM base
          WHERE (base.operation = 'INSERT'::text)
          GROUP BY
                CASE base.table_name
                    WHEN 'member_program_payments'::text THEN 'Payments'::text
                    WHEN 'member_program_item_schedule'::text THEN 'Script'::text
                    WHEN 'member_program_items'::text THEN 'Items'::text
                    WHEN 'member_program_item_tasks'::text THEN 'Tasks'::text
                    WHEN 'member_program_finances'::text THEN 'Finance'::text
                    WHEN 'member_program_items_task_schedule'::text THEN 'To Do'::text
                    WHEN 'member_programs'::text THEN 'Information'::text
                    ELSE base.table_name
                END, base.actor_user_id, base.event_at, base.related_program_id
        ), row_updates AS (
         SELECT base.event_id AS id,
                CASE base.table_name
                    WHEN 'member_program_payments'::text THEN 'Payments'::text
                    WHEN 'member_program_item_schedule'::text THEN 'Script'::text
                    WHEN 'member_program_items'::text THEN 'Items'::text
                    WHEN 'member_program_item_tasks'::text THEN 'Tasks'::text
                    WHEN 'member_program_finances'::text THEN 'Finance'::text
                    WHEN 'member_program_items_task_schedule'::text THEN 'To Do'::text
                    WHEN 'member_programs'::text THEN 'Information'::text
                    ELSE base.table_name
                END AS source,
            base.record_id,
            base.operation,
            base.actor_user_id AS changed_by,
            base.event_at AS changed_at,
            base.scope,
            base.related_member_id AS member_id,
            base.related_program_id AS program_id,
            base.related_member_name AS member_name,
            base.related_program_name AS program_name,
            base.full_desc AS change_description
           FROM base
          WHERE (base.operation = 'UPDATE'::text)
        )
 SELECT agg_delete.id,
    agg_delete.source,
    agg_delete.record_id,
    agg_delete.operation,
    agg_delete.changed_by,
    agg_delete.changed_at,
    agg_delete.scope,
    agg_delete.member_id,
    agg_delete.program_id,
    agg_delete.member_name,
    agg_delete.program_name,
    agg_delete.change_description
   FROM agg_delete
UNION ALL
 SELECT agg_insert.id,
    agg_insert.source,
    agg_insert.record_id,
    agg_insert.operation,
    agg_insert.changed_by,
    agg_insert.changed_at,
    agg_insert.scope,
    agg_insert.member_id,
    agg_insert.program_id,
    agg_insert.member_name,
    agg_insert.program_name,
    agg_insert.change_description
   FROM agg_insert
UNION ALL
 SELECT row_updates.id,
    row_updates.source,
    row_updates.record_id,
    row_updates.operation,
    row_updates.changed_by,
    row_updates.changed_at,
    row_updates.scope,
    row_updates.member_id,
    row_updates.program_id,
    row_updates.member_name,
    row_updates.program_name,
    row_updates.change_description
   FROM row_updates
  ORDER BY 6 DESC, 2;


ALTER VIEW public.vw_audit_member_changes OWNER TO postgres;

--
-- Name: vw_member_audit_events; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_member_audit_events AS
 SELECT e.event_id AS id,
    e.event_at,
    e.table_name,
    e.operation,
    e.actor_user_id AS changed_by,
    u.email AS changed_by_email,
    e.related_member_id,
    ((l.first_name || ' '::text) || l.last_name) AS related_member_name,
    e.related_program_id,
    mp.program_template_name AS related_program_name,
    e.summary,
    e.context,
    ( SELECT jsonb_agg(jsonb_build_object('column', c.column_name, 'old', c.old_value, 'new', c.new_value) ORDER BY c.column_name) AS jsonb_agg
           FROM public.audit_event_changes c
          WHERE (c.event_id = e.event_id)) AS changes
   FROM (((public.audit_events e
     LEFT JOIN public.member_programs mp ON ((mp.member_program_id = e.related_program_id)))
     LEFT JOIN public.leads l ON ((l.lead_id = e.related_member_id)))
     LEFT JOIN public.users u ON ((u.id = e.actor_user_id)))
  WHERE (e.scope = 'member'::text);


ALTER VIEW public.vw_member_audit_events OWNER TO postgres;

--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: campaigns campaign_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN campaign_id SET DEFAULT nextval('public.campaigns_campaign_id_seq'::regclass);


--
-- Name: financing_types financing_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financing_types ALTER COLUMN financing_type_id SET DEFAULT nextval('public.financing_types_financing_type_id_seq'::regclass);


--
-- Name: leads lead_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN lead_id SET DEFAULT nextval('public.leads_lead_id_seq'::regclass);


--
-- Name: member_program_finances member_program_finance_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_finances ALTER COLUMN member_program_finance_id SET DEFAULT nextval('public.member_program_finances_member_program_finance_id_seq'::regclass);


--
-- Name: member_program_item_schedule member_program_item_schedule_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_schedule ALTER COLUMN member_program_item_schedule_id SET DEFAULT nextval('public.member_program_item_schedule_member_program_item_schedule_id_se'::regclass);


--
-- Name: member_program_item_tasks member_program_item_task_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks ALTER COLUMN member_program_item_task_id SET DEFAULT nextval('public.member_program_item_tasks_member_program_item_task_id_seq'::regclass);


--
-- Name: member_program_items member_program_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items ALTER COLUMN member_program_item_id SET DEFAULT nextval('public.member_program_items_member_program_item_id_seq'::regclass);


--
-- Name: member_program_items_task_schedule member_program_item_task_schedule_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items_task_schedule ALTER COLUMN member_program_item_task_schedule_id SET DEFAULT nextval('public.member_program_items_task_schedule_member_program_item_task_sch'::regclass);


--
-- Name: member_program_payments member_program_payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments ALTER COLUMN member_program_payment_id SET DEFAULT nextval('public.member_program_payments_member_program_payment_id_seq'::regclass);


--
-- Name: member_programs member_program_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs ALTER COLUMN member_program_id SET DEFAULT nextval('public.member_programs_member_program_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: payment_methods payment_method_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN payment_method_id SET DEFAULT nextval('public.payment_methods_payment_method_id_seq'::regclass);


--
-- Name: payment_status payment_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_status ALTER COLUMN payment_status_id SET DEFAULT nextval('public.payment_status_payment_status_id_seq'::regclass);


--
-- Name: status status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status ALTER COLUMN status_id SET DEFAULT nextval('public.status_status_id_seq'::regclass);


--
-- Name: user_menu_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_menu_permissions_id_seq'::regclass);


--
-- Name: vendors vendor_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors ALTER COLUMN vendor_id SET DEFAULT nextval('public.vendors_vendor_id_seq'::regclass);


--
-- Data for Name: audit_event_changes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_event_changes (event_id, column_name, old_value, new_value) FROM stdin;
265	program_status_id	1	6
343	days_from_start	7	8
345	taxes	0.00	7.59
345	margin	62.27	62.40
345	final_total_price	2214.70	2222.29
346	quantity	1	2
347	total_cost	835.65	1034.65
347	total_charge	2214.70	3209.70
348	margin	62.40	67.84
348	final_total_price	2222.29	3217.29
349	quantity	2	1
350	total_cost	1034.65	835.65
350	total_charge	3209.70	2214.70
351	margin	67.84	62.40
351	final_total_price	3217.29	2222.29
357	program_status_id	1	6
363	program_status_id	1	6
370	program_status_id	1	6
\.


--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_events (event_id, table_name, record_id, record_pk, operation, actor_user_id, event_at, scope, related_member_id, related_program_id, summary, context, old_row, new_row) FROM stdin;
1	therapies	8	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 51.06, "charge": 255.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 8, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Beauty Drip IV Therapy", "therapy_type_id": 3}	\N
2	therapies	9	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 6.50, "charge": 33.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 9, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Biotin - IM", "therapy_type_id": 3}	\N
3	therapies	10	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 60.97, "charge": 305.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 10, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Blood Pressure Support (3000) IV Therapy", "therapy_type_id": 3}	\N
4	therapies	11	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 70.71, "charge": 354.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 11, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Blood Sugar Blaster IV Therapy", "therapy_type_id": 3}	\N
5	therapies	12	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 80.77, "charge": 404.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 12, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Calcium EDTA 3.0G IV Therapy", "therapy_type_id": 3}	\N
6	therapies	13	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 83.98, "charge": 420.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 13, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Disodium EDTA 3.0G IV Therapy", "therapy_type_id": 3}	\N
7	therapies	14	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 32.15, "charge": 161.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 14, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Energy Booster (Lava Lamp) - IM", "therapy_type_id": 3}	\N
8	therapies	15	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 12.58, "charge": 63.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 15, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Glutathione 1000 IV Push", "therapy_type_id": 3}	\N
9	therapies	16	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 19.25, "charge": 96.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 16, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Glutathione 2000 IV Push", "therapy_type_id": 3}	\N
10	therapies	17	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 38.35, "charge": 192.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 17, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Glutathione 4000 IV Therapy", "therapy_type_id": 3}	\N
11	therapies	18	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 59.24, "charge": 296.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 18, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Healthy Weight IV Therapy", "therapy_type_id": 3}	\N
12	therapies	19	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 12.60, "charge": 63.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 19, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Hydration - Lactated Ringers IV Therapy", "therapy_type_id": 3}	\N
13	therapies	20	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 15.19, "charge": 76.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 20, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Hydration - Normal Saline IV Therapy", "therapy_type_id": 3}	\N
14	therapies	21	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 82.31, "charge": 412.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 21, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Illness Recovery IV Therapy", "therapy_type_id": 3}	\N
15	therapies	22	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 41.43, "charge": 207.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 22, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Immune Booster IV Therapy", "therapy_type_id": 3}	\N
16	therapies	23	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 75.30, "charge": 376.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 23, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Immune Complete IV Therapy", "therapy_type_id": 3}	\N
17	therapies	24	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 13.00, "charge": 65.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 24, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Ketoralac (Toradol) IM/IV", "therapy_type_id": 3}	\N
18	therapies	25	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 11.20, "charge": 56.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 25, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Lipodissolve (Large) ", "therapy_type_id": 3}	\N
19	therapies	26	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 9.60, "charge": 48.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 26, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Lipodissolve (Small)", "therapy_type_id": 3}	\N
20	therapies	27	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 1000.00, "charge": 5000.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 27, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Misc", "therapy_name": "Miscellaneous 1000", "therapy_type_id": 3}	\N
21	therapies	28	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 500.00, "charge": 2500.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 28, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Misc5", "therapy_name": "Miscellaneous 500", "therapy_type_id": 3}	\N
22	therapies	29	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 29.88, "charge": 149.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 29, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Mistletoe (1) 100mg IV Therapy", "therapy_type_id": 3}	\N
23	therapies	30	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 51.75, "charge": 259.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 30, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Mistletoe (2) 200mg IV Therapy", "therapy_type_id": 3}	\N
24	therapies	31	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 95.50, "charge": 478.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 31, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Mistletoe (3) 400mg IV Therapy", "therapy_type_id": 3}	\N
25	therapies	32	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 139.25, "charge": 696.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 32, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Mistletoe (4) 600mg IV Therapy", "therapy_type_id": 3}	\N
26	therapies	33	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 183.00, "charge": 915.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 33, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Mistletoe (5) 800mg IV Therapy", "therapy_type_id": 3}	\N
27	therapies	34	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 31.43, "charge": 157.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 34, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Myers Plus IV Therapy", "therapy_type_id": 3}	\N
28	therapies	35	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 7.50, "charge": 38.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 35, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "NAD+ (100mg) SQ", "therapy_type_id": 3}	\N
29	therapies	36	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 13.00, "charge": 65.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 36, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "NAD+ (200mg) SQ", "therapy_type_id": 3}	\N
30	therapies	37	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 44.50, "charge": 223.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 37, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "NAD+ (500mg) IV Therapy", "therapy_type_id": 3}	\N
31	therapies	38	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 26.94, "charge": 135.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 38, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Ondansetron (Zofran)", "therapy_type_id": 3}	\N
32	therapies	39	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 73.84, "charge": 369.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 39, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Ozone and UBT IV Therapy", "therapy_type_id": 3}	\N
33	therapies	40	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 42.46, "charge": 212.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 40, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Ozone IV Therapy", "therapy_type_id": 3}	\N
34	therapies	41	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 32.80, "charge": 164.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 41, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Ozone Normal Saline IV Therapy", "therapy_type_id": 3}	\N
35	therapies	42	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 57.44, "charge": 287.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 42, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Post Operation IV Therapy", "therapy_type_id": 3}	\N
36	therapies	43	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 31.55, "charge": 158.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 43, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Pre Operation IV Therapy", "therapy_type_id": 3}	\N
37	therapies	44	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 350.00, "charge": 1750.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 44, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Semiglutide 5mg/ml (Vial 1)", "therapy_type_id": 3}	\N
38	therapies	45	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 350.00, "charge": 1750.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 45, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Semiglutide 5mg/ml (Vial 2)", "therapy_type_id": 3}	\N
39	therapies	46	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 350.00, "charge": 1750.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 46, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Semiglutide 5mg/ml (Vial 3)", "therapy_type_id": 3}	\N
40	therapies	47	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 6.77, "charge": 34.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 47, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Slim Shot Turbo IM", "therapy_type_id": 3}	\N
41	therapies	48	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 62.81, "charge": 314.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 48, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Superhero IV Therapy", "therapy_type_id": 3}	\N
42	therapies	49	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 700.00, "charge": 3500.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 49, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Tirzepitide Vile 1", "therapy_type_id": 3}	\N
43	therapies	50	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 700.00, "charge": 3500.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 50, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "Tirzepitide Vile 2", "therapy_type_id": 3}	\N
44	therapies	51	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 7.64, "charge": 38.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 51, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Tri-Immune Booster", "therapy_type_id": 3}	\N
45	therapies	52	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 23.57, "charge": 118.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 52, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Tri-Immune IM", "therapy_type_id": 3}	\N
46	therapies	53	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 151.99, "charge": 760.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 53, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C 100G IV Therapy", "therapy_type_id": 3}	\N
47	therapies	54	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 48.86, "charge": 244.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 54, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C 25G IV Therapy", "therapy_type_id": 3}	\N
48	therapies	55	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 81.99, "charge": 410.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 55, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C 50G IV Therapy", "therapy_type_id": 3}	\N
49	therapies	56	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 116.99, "charge": 585.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 56, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C 75G IV Therapy", "therapy_type_id": 3}	\N
50	therapies	57	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 27.32, "charge": 137.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 57, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Vitamin D3 100,000IU - IM", "therapy_type_id": 3}	\N
51	therapies	59	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 42.98, "charge": 215.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 59, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Vitamin D3 300,000IU - IM", "therapy_type_id": 3}	\N
52	therapies	60	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 15.66, "charge": 78.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 60, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Vitamin D3 50,000IU - IM", "therapy_type_id": 3}	\N
53	therapies	62	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 93.41, "charge": 467.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 62, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Works IV Therapy", "therapy_type_id": 3}	\N
54	therapies	63	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 4.63, "charge": 23.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 63, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Zinc - IV Push", "therapy_type_id": 3}	\N
55	therapies	64	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 31.50, "charge": 158.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 64, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Med", "therapy_name": "Ivermectin (.5mg-40mg)", "therapy_type_id": 3}	\N
56	therapies	65	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 52.50, "charge": 263.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 65, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Med", "therapy_name": "Ivermectin (41mg-90mg)", "therapy_type_id": 3}	\N
57	therapies	66	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 61.50, "charge": 308.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 66, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Med", "therapy_name": "Ivermectin (91mg-150mg)", "therapy_type_id": 3}	\N
58	therapies	67	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 82.50, "charge": 413.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 67, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Med", "therapy_name": "Ivermectin (151mg-250mg)", "therapy_type_id": 3}	\N
59	therapies	68	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 150.00, "charge": 750.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 68, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "Med", "therapy_name": "Mebendozole 1mg-199mg", "therapy_type_id": 3}	\N
60	therapies	69	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 78.00, "charge": 390.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 69, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "med", "therapy_name": "Mebendozole 200mg-499mg 3 Days", "therapy_type_id": 3}	\N
61	therapies	70	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 195.00, "charge": 975.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 70, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "med", "therapy_name": "Mebendozole 200mg-499mg Daily", "therapy_type_id": 3}	\N
62	therapies	71	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 255.00, "charge": 1275.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 71, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "med", "therapy_name": "Mebendozole 500mg-899mg Daily", "therapy_type_id": 3}	\N
63	therapies	72	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 300.00, "charge": 1500.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 72, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "med", "therapy_name": "Mebendozole 900mg-1500mg Daily", "therapy_type_id": 3}	\N
64	therapies	73	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 102.00, "charge": 510.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 73, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "med", "therapy_name": "Mebendozole 500mg-899mg Daily 3 Days", "therapy_type_id": 3}	\N
65	therapies	74	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 120.00, "charge": 600.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 74, "updated_at": "2025-04-28T20:25:18.925523+00:00", "updated_by": null, "active_flag": true, "description": "med", "therapy_name": "Mebendozole 900mg-1500mg 3 Days", "therapy_type_id": 3}	\N
66	therapies	61	\N	DELETE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 31.50, "charge": 158.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 61, "updated_at": "2025-05-05T15:36:18.971009+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": false, "description": "Med", "therapy_name": "Ivermectin (.5mg-40mg)", "therapy_type_id": 3}	\N
67	therapies	58	\N	DELETE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 31.50, "charge": 158.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 58, "updated_at": "2025-05-05T15:36:44.375374+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Med", "therapy_name": "Ivermectin (.5mg-40mg)", "therapy_type_id": 3}	\N
68	therapies	4	\N	DELETE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 80.00, "charge": 401.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 4, "updated_at": "2025-05-13T20:17:49.906032+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Drip", "therapy_name": "ALA 600mg IV Therapy", "therapy_type_id": 3}	\N
69	therapies	78	\N	DELETE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 99.00, "charge": 495.00, "taxable": false, "bucket_id": 16, "created_at": "2025-05-14T17:21:26.580224+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 78, "updated_at": "2025-05-14T17:21:26.580224+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Testing", "therapy_name": "Testing", "therapy_type_id": 3}	\N
70	therapies	6	\N	DELETE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 4.83, "charge": 24.00, "taxable": true, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 6, "updated_at": "2025-09-28T20:50:11.014226+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "IM", "therapy_name": "B-12 Methylcobalamin - IM", "therapy_type_id": 3}	\N
71	therapies	7	\N	DELETE	\N	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 8.90, "charge": 45.00, "taxable": true, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 7, "updated_at": "2025-09-29T20:08:45.074757+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "B5 Injection - IM", "therapy_type_id": 3}	\N
72	therapies	5	\N	DELETE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 01:41:58.382486+00	support	\N	\N	\N	\N	{"cost": 74.55, "charge": 374.00, "taxable": false, "bucket_id": 19, "created_at": "2025-04-28T20:25:18.925523+00:00", "created_by": null, "therapy_id": 5, "updated_at": "2025-09-24T01:25:42.994323+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Drip", "therapy_name": "Anti-Aging IV Therapy", "therapy_type_id": 3}	\N
73	therapies	1	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 16.25, "charge": 41.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 1, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Balance (60ct)", "therapy_type_id": 6}
74	therapies	2	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 69.95, "charge": 87.95, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 2, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Energy Enhancer", "therapy_type_id": 6}
75	therapies	3	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 55.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 3, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Her Creative Fire Tincture", "therapy_type_id": 6}
76	therapies	4	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 40.95, "charge": 102.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 4, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "IgG Protect Powder (30serv)", "therapy_type_id": 6}
77	therapies	5	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 21.10, "charge": 53.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 5, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Inflamma-Blox (60ct)", "therapy_type_id": 6}
78	therapies	6	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 41.60, "charge": 104.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 6, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "InflammaCORE Vanilla Chai (14serv)", "therapy_type_id": 6}
79	therapies	7	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 21.80, "charge": 55.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 7, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "InosiCare (30serv)", "therapy_type_id": 6}
80	therapies	8	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 328.43, "charge": 475.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 8, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Magnetic Pulser", "therapy_type_id": 6}
81	therapies	9	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 175.36, "charge": 350.72, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 9, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Abietis 100mg", "therapy_type_id": 6}
82	therapies	10	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 116.68, "charge": 233.36, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 10, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Abietis 50 (8 vials)", "therapy_type_id": 6}
83	therapies	11	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 87.24, "charge": 174.48, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 11, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Abietis Series 1 (Green Box)", "therapy_type_id": 6}
84	therapies	12	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 93.44, "charge": 186.88, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 12, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Abietis Series 2 (Green Box)", "therapy_type_id": 6}
335	therapies	257	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 25.00, "charge": 25.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 257, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Shipping Fee", "therapy_type_id": 5}
85	therapies	13	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 99.68, "charge": 199.99, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 13, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Abietis Series 4 (Green Box)", "therapy_type_id": 6}
86	therapies	14	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 93.44, "charge": 186.88, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 14, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Mali Series 2", "therapy_type_id": 6}
87	therapies	15	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 99.68, "charge": 199.36, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 15, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Mali Series 4", "therapy_type_id": 6}
88	therapies	16	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 18.95, "charge": 47.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 16, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mitocore (60ct)", "therapy_type_id": 6}
89	therapies	17	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 15.60, "charge": 39.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 17, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Magnesium & Potassium (60ct)", "therapy_type_id": 6}
90	therapies	18	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 39.95, "charge": 100.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 18, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "SBI Protect Capsules (120ct)", "therapy_type_id": 6}
91	therapies	19	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 211.55, "charge": 375.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 19, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Silver Pulser", "therapy_type_id": 6}
92	therapies	20	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 29.70, "charge": 74.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 20, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Silymarin Forte (120ct)", "therapy_type_id": 6}
93	therapies	21	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 299.00, "charge": 525.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 21, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thaena (90ct)", "therapy_type_id": 6}
94	therapies	22	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 35.70, "charge": 89.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 22, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "TruAdapt (120ct)", "therapy_type_id": 6}
95	therapies	23	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 42.00, "charge": 69.95, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 23, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Turkey Tail Extract Powder (45G)", "therapy_type_id": 6}
96	therapies	24	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 30.95, "charge": 46.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 24, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Ultimate Selenium� Capsules (90ct)", "therapy_type_id": 6}
97	therapies	25	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 194.74, "charge": 365.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 25, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Bio Tuner 9", "therapy_type_id": 6}
98	therapies	26	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 34.95, "charge": 87.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 26, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Cerenity PM (120ct)", "therapy_type_id": 6}
99	therapies	27	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 27.65, "charge": 69.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 27, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Cerenity� (90ct)", "therapy_type_id": 6}
100	therapies	28	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 23.30, "charge": 58.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 28, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "DG Protect (60ct)", "therapy_type_id": 6}
101	therapies	29	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 24.45, "charge": 61.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 29, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "GlutaShield-Vanilla (30 Serv)", "therapy_type_id": 6}
102	therapies	30	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 36.85, "charge": 92.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 30, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Inflamma-Blox (120ct)", "therapy_type_id": 6}
103	therapies	31	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 30.85, "charge": 77.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 31, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Intestin-ol (90ct)", "therapy_type_id": 6}
104	therapies	32	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 36.40, "charge": 62.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 32, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lugol's Iodine Liquid (2oz)", "therapy_type_id": 6}
105	therapies	33	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 18.80, "charge": 47.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 33, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Nattokinase (60ct)", "therapy_type_id": 6}
106	therapies	34	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 43.30, "charge": 108.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 34, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Orthomega� 820 (180ct)", "therapy_type_id": 6}
107	therapies	35	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 25.55, "charge": 64.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 35, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Prostatrol Forte (60ct)", "therapy_type_id": 6}
108	therapies	36	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 16.15, "charge": 40.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 36, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Cal-Mag (90ct)", "therapy_type_id": 6}
109	therapies	37	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 35.70, "charge": 89.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 37, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "TruAdapt Plus (120ct)", "therapy_type_id": 6}
110	therapies	38	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 99.95, "charge": 187.95, "taxable": false, "bucket_id": 17, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 38, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "X49", "therapy_type_id": 4}
111	therapies	39	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 69.95, "charge": 87.95, "taxable": false, "bucket_id": 17, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 39, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Y-Age Glutathione", "therapy_type_id": 4}
112	therapies	40	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 28.45, "charge": 71.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 40, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Botanicalm PM (60ct)", "therapy_type_id": 6}
113	therapies	41	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 26.30, "charge": 66.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 41, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CM Core (90ct)", "therapy_type_id": 6}
114	therapies	42	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 69.95, "charge": 87.95, "taxable": false, "bucket_id": 17, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 42, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Icewave", "therapy_type_id": 4}
115	therapies	43	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 111.30, "charge": 159.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 43, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Inner Balance", "therapy_type_id": 6}
116	therapies	44	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 36.90, "charge": 92.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 44, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Orthomega V (60ct)", "therapy_type_id": 6}
117	therapies	45	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 9.35, "charge": 23.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 45, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Pregnenolone Micronized (100ct)", "therapy_type_id": 6}
118	therapies	46	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 46.50, "charge": 116.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 46, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Turiva (120ct)", "therapy_type_id": 6}
119	therapies	47	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 42.00, "charge": 69.95, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 47, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Turkey Tail Extract (200 ct)", "therapy_type_id": 6}
120	therapies	48	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 16.80, "charge": 42.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 48, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Vitamin K2 with D3 (60ct)", "therapy_type_id": 6}
121	therapies	49	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 69.95, "charge": 87.95, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 49, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Y-Age Carnosine", "therapy_type_id": 6}
122	therapies	50	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 29.15, "charge": 73.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 50, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Adren-All (120ct)", "therapy_type_id": 6}
123	therapies	51	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 43.25, "charge": 108.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 51, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Bergamot BPF (120ct)", "therapy_type_id": 6}
124	therapies	52	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 40.85, "charge": 102.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 52, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CDG EstroDIM (60ct)", "therapy_type_id": 6}
125	therapies	53	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 36.70, "charge": 92.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 53, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CereVive (120ct)", "therapy_type_id": 6}
126	therapies	54	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 42.90, "charge": 107.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 54, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CoQ-10 300mg (60ct)", "therapy_type_id": 6}
127	therapies	55	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 18.25, "charge": 46.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 55, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lithium Orotate (60ct)", "therapy_type_id": 6}
128	therapies	56	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 20.95, "charge": 52.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 56, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "L-Theanine (60ct)", "therapy_type_id": 6}
129	therapies	57	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 210.00, "charge": 420.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 57, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "MAF Capsules 300mg (60ct)", "therapy_type_id": 6}
130	therapies	58	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 22.95, "charge": 57.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 58, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Magnesium (180ct)", "therapy_type_id": 6}
131	therapies	59	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 9.70, "charge": 24.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 59, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Zinc (60ct)", "therapy_type_id": 6}
132	therapies	60	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 42.00, "charge": 69.95, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 60, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reishi (200 ct)", "therapy_type_id": 6}
133	therapies	61	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 26.30, "charge": 66.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 61, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CitraNOX� (120ct)", "therapy_type_id": 6}
134	therapies	62	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 14.85, "charge": 37.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 62, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "GABAnol (60ct)", "therapy_type_id": 6}
135	therapies	63	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 14.95, "charge": 37.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 63, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "N-Acetyl Cysteine (60ct)", "therapy_type_id": 6}
136	therapies	64	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 11.90, "charge": 30.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 64, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Selenium (90ct)", "therapy_type_id": 6}
137	therapies	65	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 16.95, "charge": 42.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 65, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Z-Binder (60ct)", "therapy_type_id": 6}
138	therapies	66	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 30.95, "charge": 46.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 66, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Collagen Peptides (10.5oz)", "therapy_type_id": 6}
139	therapies	67	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 59.45, "charge": 149.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 67, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Core Restore Kit - Vanilla (7days)", "therapy_type_id": 6}
140	therapies	68	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 16.00, "charge": 40.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 68, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Methyl B12 (60ct)", "therapy_type_id": 6}
141	therapies	69	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 175.36, "charge": 350.72, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 69, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mistletoe - Viscum Mali 100mg", "therapy_type_id": 6}
142	therapies	70	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 24.40, "charge": 61.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 70, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Natural D-Hist (120ct)", "therapy_type_id": 6}
143	therapies	71	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 46.95, "charge": 70.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 71, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Ultimate Mineral Caps� (64ct)", "therapy_type_id": 6}
144	therapies	72	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 21.65, "charge": 54.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 72, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Motility Pro (60ct)", "therapy_type_id": 6}
145	therapies	73	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 32.95, "charge": 82.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 73, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "OsteoPrev (120ct)", "therapy_type_id": 6}
146	therapies	74	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 32.00, "charge": 42.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 74, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Sovereign Creative Stability", "therapy_type_id": 6}
147	therapies	75	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 22.70, "charge": 57.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 75, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyrotain (120ct)", "therapy_type_id": 6}
148	therapies	76	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 23.95, "charge": 60.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 76, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "L-Glutathione (60ct)", "therapy_type_id": 6}
149	therapies	77	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 44.70, "charge": 112.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 77, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "SAMe (60ct)", "therapy_type_id": 6}
150	therapies	78	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 46.90, "charge": 117.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 78, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Diaxinol (120ct)", "therapy_type_id": 6}
151	therapies	79	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 23.45, "charge": 59.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 79, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Hiphenolic (60ct)", "therapy_type_id": 6}
152	therapies	80	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 33.30, "charge": 83.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 80, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Ortho Biotic (60ct)", "therapy_type_id": 6}
153	therapies	81	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 12.30, "charge": 30.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 81, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Poria 15 Formula GF (Tablets)", "therapy_type_id": 6}
154	therapies	82	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 8.60, "charge": 22.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 82, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Iron (60ct)", "therapy_type_id": 6}
155	therapies	83	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 11.20, "charge": 28.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 83, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "DHEA 25mg (90ct)", "therapy_type_id": 6}
156	therapies	84	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 16.80, "charge": 42.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 84, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reacted Magnesium (120ct)", "therapy_type_id": 6}
157	therapies	85	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 36.95, "charge": 92.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 85, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "SBI Protect Powder 2.6oz (30serv)", "therapy_type_id": 6}
158	therapies	86	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 47.95, "charge": 72.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 86, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Ultimate Daily Capsules (180ct)", "therapy_type_id": 6}
159	therapies	87	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 35.70, "charge": 89.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 87, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Digestzyme-V (180ct)", "therapy_type_id": 6}
160	therapies	88	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 54.95, "charge": 82.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 88, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Gluco-Gel Plus� Liquid (32floz)", "therapy_type_id": 6}
161	therapies	89	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 48.95, "charge": 73.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 89, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Majestic Earth Ultimate Classic� (32floz)", "therapy_type_id": 6}
162	therapies	90	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 27.30, "charge": 55.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 90, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "His Creative Fire Tincture", "therapy_type_id": 6}
163	therapies	91	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 29.95, "charge": 45.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 91, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Slender FX� Sweet Eze� (120ct)", "therapy_type_id": 6}
164	therapies	92	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 4.30, "charge": 15.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 92, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Vitamin D3 50000IU (15ct)", "therapy_type_id": 6}
165	therapies	93	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 33.20, "charge": 83.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 93, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Mitocore (120ct)", "therapy_type_id": 6}
166	therapies	94	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 33.60, "charge": 55.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 94, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thrive Alive", "therapy_type_id": 6}
167	therapies	95	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 30.95, "charge": 77.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 95, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Orthomega� 820 (120ct)", "therapy_type_id": 6}
168	therapies	96	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 28.95, "charge": 44.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 96, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Majestic Earth Strawberry Kiwi-Mins� (32floz)", "therapy_type_id": 6}
169	therapies	97	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 22.00, "charge": 55.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 97, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Methyl CPG (60ct)", "therapy_type_id": 6}
170	therapies	98	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 66.50, "charge": 105.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 98, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Digestive Enzyme Formula (200ct)", "therapy_type_id": 6}
171	therapies	99	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 48.95, "charge": 73.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 99, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Ultimate Tangy Tangerine� (32floz)", "therapy_type_id": 6}
172	therapies	100	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 49.00, "charge": 80.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 100, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lugol's Iodine Plus Capsules (90ct)", "therapy_type_id": 6}
173	therapies	101	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 23.95, "charge": 44.00, "taxable": true, "bucket_id": 20, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 101, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Majestic Earth Plant Derived Minerals � (32floz)", "therapy_type_id": 6}
174	therapies	102	\N	INSERT	\N	2025-09-30 01:55:45.126688+00	support	\N	\N	\N	\N	\N	{"cost": 99.95, "charge": 187.95, "taxable": false, "bucket_id": 17, "created_at": "2025-09-30T01:55:45.126688+00:00", "created_by": null, "therapy_id": 102, "updated_at": "2025-09-30T01:55:45.126688+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "X39", "therapy_type_id": 4}
175	therapies	103	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.00, "charge": 10.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 103, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "ABO GROUPING (006056)", "therapy_type_id": 8}
176	therapies	104	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.30, "charge": 26.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 104, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Apolipoprotein A-1 (016873)", "therapy_type_id": 8}
177	therapies	105	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.30, "charge": 26.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 105, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Apolipoprotein B (167015)", "therapy_type_id": 8}
178	therapies	106	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.60, "charge": 8.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 106, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Bilirubin (Total, Direct, Indirect) (001214)", "therapy_type_id": 8}
179	therapies	107	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 6.00, "charge": 30.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 107, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "C-Peptide (010108)", "therapy_type_id": 8}
180	therapies	108	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 3.80, "charge": 19.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 108, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "C-Reactive Protein (CRP), Quantitative (006627)", "therapy_type_id": 8}
181	therapies	109	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 30.75, "charge": 153.75, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 109, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CANCER PANEL COMPLETE (308401)", "therapy_type_id": 8}
182	therapies	110	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.00, "charge": 10.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 110, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "CBC/Complete Blood Count Lab (005009)", "therapy_type_id": 8}
183	therapies	111	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.30, "charge": 21.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 111, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Cortisol (004051)", "therapy_type_id": 8}
184	therapies	112	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.50, "charge": 7.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 112, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Creatine Kinase,Total (001362)", "therapy_type_id": 8}
185	therapies	113	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 13.80, "charge": 69.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 113, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "D-Dimer (115188)", "therapy_type_id": 8}
186	therapies	114	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.00, "charge": 20.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 114, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "DHEA-S (004020)", "therapy_type_id": 8}
187	therapies	115	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.00, "charge": 25.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 115, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Digoxin Level (007385)", "therapy_type_id": 8}
188	therapies	116	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 199.00, "charge": 995.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 116, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Eat 144 Allergy Test", "therapy_type_id": 8}
189	therapies	117	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 199.00, "charge": 995.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 117, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Eat 144 Allergy Test (Remote)", "therapy_type_id": 8}
190	therapies	118	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 12.00, "charge": 60.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 118, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Epstein-Barr Virus (EBV) Antibodies to Early Antigen-Diffuse [EA(D)], IgG (096248)", "therapy_type_id": 8}
191	therapies	119	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.50, "charge": 27.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 119, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Epstein-Barr Virus (EBV) Antibodies to Viral Capsid Antigen (VCA), IgG (096230)", "therapy_type_id": 8}
192	therapies	120	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 9.00, "charge": 45.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 120, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Epstein-Barr Virus (EBV) Antibodies to Viral Capsid Antigen (VCA), IgM (096735)", "therapy_type_id": 8}
193	therapies	121	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 6.50, "charge": 32.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 121, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Epstein-Barr Virus (EBV) Nuclear Antigen Antibodies, IgG (010272)", "therapy_type_id": 8}
194	therapies	122	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.70, "charge": 28.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 122, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "ESR-Wes+CRP (286617)", "therapy_type_id": 8}
195	therapies	123	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.00, "charge": 10.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 123, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Ferritin (004598)", "therapy_type_id": 8}
196	therapies	124	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.30, "charge": 21.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 124, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Fibrinogen Activity (001610)", "therapy_type_id": 8}
197	therapies	125	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 30.00, "charge": 150.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 125, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Fibrinogen Antigen (117052)", "therapy_type_id": 8}
198	therapies	126	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 8.00, "charge": 40.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 126, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Folate & B12 - RBC (000810)", "therapy_type_id": 8}
199	therapies	127	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.40, "charge": 22.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 127, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Folate - RBC (266015)", "therapy_type_id": 8}
200	therapies	128	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 6.00, "charge": 30.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 128, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Follicle-stimulating Hormone (FSH) and Luteinizing Hormone (LH) (028480)", "therapy_type_id": 8}
201	therapies	129	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.50, "charge": 22.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 129, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Fructosanine (100800)", "therapy_type_id": 8}
202	therapies	130	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 6.40, "charge": 32.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 130, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "G6PD RED CELL COUNT (001917)", "therapy_type_id": 8}
203	therapies	131	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.30, "charge": 26.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 131, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Gastrin (004390)", "therapy_type_id": 8}
204	therapies	132	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.50, "charge": 7.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 132, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "GGT (001958)", "therapy_type_id": 8}
205	therapies	133	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 13.25, "charge": 66.25, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 133, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Glu + A1C + Insulin + C Peptide Lab (305907)", "therapy_type_id": 8}
206	therapies	134	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 103.00, "charge": 515.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 134, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Heavy Metals Profile II, Whole Blood (706200)", "therapy_type_id": 8}
207	therapies	135	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.25, "charge": 11.25, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 135, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "HEMOGLOBIN A1C (001453)", "therapy_type_id": 8}
208	therapies	136	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 12.00, "charge": 60.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 136, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Homocystine (706994)", "therapy_type_id": 8}
209	therapies	137	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.00, "charge": 25.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 137, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "hsCRP (120766)", "therapy_type_id": 8}
210	therapies	138	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 14.00, "charge": 70.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 138, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "IGF-1 (010363)", "therapy_type_id": 8}
211	therapies	139	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 3.50, "charge": 17.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 139, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Insulin (Fasting) (004333)", "therapy_type_id": 8}
212	therapies	140	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.40, "charge": 12.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 140, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Iron Serum & TIBC (001321)", "therapy_type_id": 8}
213	therapies	141	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.50, "charge": 7.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 141, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "LDH (001115)", "therapy_type_id": 8}
214	therapies	142	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 29.50, "charge": 147.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 142, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Leptin, Serum or Plasma (146712)", "therapy_type_id": 8}
215	therapies	143	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 175.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 143, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Levetiracetam, Serum or Plasma (Keppra Level) (716936)", "therapy_type_id": 8}
216	therapies	144	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.50, "charge": 12.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 144, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lipid Panel w/ Chol/HDL Ratio (221010)", "therapy_type_id": 8}
217	therapies	145	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.50, "charge": 12.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 145, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lipid Panel With Total Cholesterol:HDL Ratio (221010)", "therapy_type_id": 8}
218	therapies	146	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 7.50, "charge": 37.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 146, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lipoprotein (a) (120188)", "therapy_type_id": 8}
219	therapies	147	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 156.30, "charge": 781.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 147, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "LYME (B. BURGDORFERI) PCR (138685)", "therapy_type_id": 8}
220	therapies	148	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 10.60, "charge": 53.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 148, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "LYME, IGM, EARLY TEST/REFLEX (160333)", "therapy_type_id": 8}
221	therapies	149	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 13.00, "charge": 65.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 149, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "LYME, TOTAL AB TEST/REFLEX (160325)", "therapy_type_id": 8}
222	therapies	150	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 15.90, "charge": 79.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 150, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Magnesium RBC (080283)", "therapy_type_id": 8}
223	therapies	151	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.00, "charge": 10.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 151, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Magnesium Serum (001537)", "therapy_type_id": 8}
224	therapies	152	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.80, "charge": 14.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 152, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Metabolic Panel (14), Comprehensive (322000)", "therapy_type_id": 8}
225	therapies	153	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 30.00, "charge": 150.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 153, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Osteocalcin, Serum (010249)", "therapy_type_id": 8}
226	therapies	154	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 14.75, "charge": 73.75, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 154, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "PANCREATIC/COLORECTAL CANCER (222752)", "therapy_type_id": 8}
227	therapies	155	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 7.50, "charge": 37.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 155, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Parathyroid Hormone (PTH), Intact (015610)", "therapy_type_id": 8}
228	therapies	156	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.50, "charge": 7.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 156, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Phosphorus (001024)", "therapy_type_id": 8}
229	therapies	157	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 6.00, "charge": 30.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 157, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Progesterone (004317)", "therapy_type_id": 8}
230	therapies	158	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 249.70, "charge": 750.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 158, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "PROGRAM LABS", "therapy_type_id": 8}
231	therapies	159	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 3.50, "charge": 17.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 159, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Prolactin (004465)", "therapy_type_id": 8}
232	therapies	160	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.75, "charge": 23.75, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 160, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Prothrombin Time (PT) and Partial Thromboplastin Time (PTT) (020321)", "therapy_type_id": 8}
233	therapies	161	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 3.50, "charge": 17.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 161, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "PSA TOTAL (Reflex to free) (480772)", "therapy_type_id": 8}
234	therapies	162	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.50, "charge": 12.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 162, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reticulocyte Count (005280)", "therapy_type_id": 8}
235	therapies	163	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 15.90, "charge": 79.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 163, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reverse T3 (070104)", "therapy_type_id": 8}
236	therapies	164	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 36.40, "charge": 182.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 164, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Selenium, Whole Blood (081034)", "therapy_type_id": 8}
237	therapies	165	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 8.00, "charge": 40.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 165, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Sex Horm Binding Glob, Serum (082016)", "therapy_type_id": 8}
238	therapies	166	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 106.00, "charge": 530.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 166, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "SpectraCell Micronutrient & Lipid Plus Panel Lab", "therapy_type_id": 8}
239	therapies	167	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 84.00, "charge": 420.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 167, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "SpectraCell Micronutrient Lab", "therapy_type_id": 8}
240	therapies	168	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.60, "charge": 8.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 168, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "T3 Uptake (001156)", "therapy_type_id": 8}
241	therapies	169	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.00, "charge": 20.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 169, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Testosterone, Total (004226)", "therapy_type_id": 8}
242	therapies	170	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 3.50, "charge": 17.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 170, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyroglobulin Antibody (006685)", "therapy_type_id": 8}
243	therapies	171	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 6.00, "charge": 30.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 171, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyroid Peroxidase (TPO) Antibodies (006676)", "therapy_type_id": 8}
244	therapies	172	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 5.70, "charge": 28.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 172, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyroid Profile With TSH (000620)", "therapy_type_id": 8}
245	therapies	173	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 10.60, "charge": 53.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 173, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyrotropin Receptor Antibody, Serum (010314)", "therapy_type_id": 8}
246	therapies	174	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.75, "charge": 13.75, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 174, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyroxine (T4) Free, Direct (001974)", "therapy_type_id": 8}
247	therapies	175	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.75, "charge": 13.75, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 175, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyroxine (T4), Free, Direct (001974)", "therapy_type_id": 8}
248	therapies	176	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 10.00, "charge": 50.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 176, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Thyroxine-binding Globulin (TBG), Serum (001735)", "therapy_type_id": 8}
249	therapies	177	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 7.70, "charge": 38.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 177, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Transferrin (004937)", "therapy_type_id": 8}
250	therapies	178	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 3.20, "charge": 16.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 178, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Triiodothyronine (T3) (002188)", "therapy_type_id": 8}
251	therapies	179	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 2.80, "charge": 14.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 179, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "UA/M W/RFLX CULTURE, ROUTINE (377036)", "therapy_type_id": 8}
252	therapies	180	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.60, "charge": 8.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 180, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "UIBC (001348)", "therapy_type_id": 8}
253	therapies	181	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 1.50, "charge": 7.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 181, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Uric Acid (001057)", "therapy_type_id": 8}
254	therapies	182	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 4.00, "charge": 20.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 182, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Vitamin B12 (001503)", "therapy_type_id": 8}
255	therapies	183	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 27.00, "charge": 135.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 183, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Vitamin C (with dilution) (123420)", "therapy_type_id": 8}
256	therapies	184	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 11.00, "charge": 55.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 184, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Vitamin D, 25-Hydroxy (081950)", "therapy_type_id": 8}
257	therapies	185	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 8.90, "charge": 44.50, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 185, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "WELLNESS PANEL (387146)", "therapy_type_id": 8}
258	therapies	186	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 34.00, "charge": 170.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 186, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Zinc - RBC (070029)", "therapy_type_id": 8}
259	therapies	187	\N	INSERT	\N	2025-09-30 02:30:22.921321+00	support	\N	\N	\N	\N	\N	{"cost": 7.00, "charge": 35.00, "taxable": false, "bucket_id": 14, "created_at": "2025-09-30T02:30:22.921321+00:00", "created_by": null, "therapy_id": 187, "updated_at": "2025-09-30T02:30:22.921321+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Zinc - Serum or Plasma (001800)", "therapy_type_id": 8}
260	member_programs	1	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	member	609	1	Member program created	{"status": "active", "start_date": null}	\N	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}
261	member_program_finances	1	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	member	609	1	Program finances created	\N	\N	{"taxes": 0.00, "margin": 62.27, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2214.70, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}
262	member_program_items	1	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	member	609	1	Program item created	\N	\N	{"quantity": 1, "item_cost": 36.95, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 85, "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 92.00, "days_between": 0, "instructions": "Take with food twice a day", "days_from_start": 14, "member_program_id": 1, "member_program_item_id": 1}
263	member_program_items	2	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	member	609	1	Program item created	\N	\N	{"quantity": 6, "item_cost": 99.95, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 102, "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 187.95, "days_between": 30, "instructions": "Use one per day", "days_from_start": 0, "member_program_id": 1, "member_program_item_id": 2}
264	member_program_items	3	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	member	609	1	Program item created	\N	\N	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 7, "member_program_id": 1, "member_program_item_id": 3}
280	therapies	202	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 38.85, "charge": 105.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 202, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Hydration - Lactated Ringers IV Therapy", "therapy_type_id": 3}
281	therapies	203	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 41.44, "charge": 105.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 203, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Hydration - Normal Saline IV Therapy", "therapy_type_id": 3}
282	therapies	204	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 128.11, "charge": 385.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 204, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Illness Recovery Therapy", "therapy_type_id": 3}
283	therapies	205	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 65.62, "charge": 220.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 205, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Immunity Booster IV Therapy", "therapy_type_id": 3}
265	member_programs	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.665187+00	member	609	1	Member program updated: The Status was changed.	{"to_status": "quote", "from_status": "active"}	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T02:51:44.665187+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}
266	therapies	188	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 81.44, "charge": 375.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 188, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Acute Illness IV Therapy", "therapy_type_id": 3}
267	therapies	189	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 73.50, "charge": 335.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 189, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "ALA/Alpha Lipoic Acid (600mg) IV Therapy", "therapy_type_id": 3}
268	therapies	190	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 94.21, "charge": 325.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 190, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Anti-Aging Therapy", "therapy_type_id": 3}
269	therapies	191	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 12.58, "charge": 40.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 191, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "B12/Methylcobalamin (5mg) Injection", "therapy_type_id": 3}
270	therapies	192	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 16.25, "charge": 70.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 192, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM55", "therapy_name": "B7/Biotin Injection", "therapy_type_id": 3}
271	therapies	193	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 82.80, "charge": 225.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 193, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Beauty IV Drip", "therapy_type_id": 3}
272	therapies	194	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 129.29, "charge": 325.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 194, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Blood Pressure Support IV Therapy", "therapy_type_id": 3}
273	therapies	195	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 125.64, "charge": 499.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 195, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Blood Sugar Blaster IV Therapy", "therapy_type_id": 3}
274	therapies	196	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 137.11, "charge": 415.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 196, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Chelation (EDTA) Calcium IV Therapy", "therapy_type_id": 3}
275	therapies	197	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 24.98, "charge": 99.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 197, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM75", "therapy_name": "Energy Booster Injection", "therapy_type_id": 3}
276	therapies	198	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 23.83, "charge": 70.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 198, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Glutathione (1000mg) IV Push", "therapy_type_id": 3}
277	therapies	199	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 33.00, "charge": 100.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 199, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Glutathione (2000mg) IV Push", "therapy_type_id": 3}
278	therapies	200	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 65.85, "charge": 165.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 200, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Glutathione (4000mg) IV Therapy", "therapy_type_id": 3}
279	therapies	201	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 103.13, "charge": 299.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 201, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Healthy Weight IV Therapy", "therapy_type_id": 3}
284	therapies	206	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 130.72, "charge": 445.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 206, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Immunity Complete IV Therapy", "therapy_type_id": 3}
285	therapies	207	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 52.58, "charge": 135.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 207, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Magnesium (3000mg) IV Drip", "therapy_type_id": 3}
286	therapies	208	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 61.88, "charge": 155.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 208, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Myers Plus", "therapy_type_id": 3}
287	therapies	209	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 14.00, "charge": 55.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 209, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "NAD+ (100mg) SQ Injection", "therapy_type_id": 3}
288	therapies	210	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.25, "charge": 90.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 210, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "SQ", "therapy_name": "NAD+ (200mg) SQ Injection", "therapy_type_id": 3}
289	therapies	211	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 173.25, "charge": 520.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 211, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "NAD+ (500mg) IV Therapy", "therapy_type_id": 3}
290	therapies	212	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 76.55, "charge": 195.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 212, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Ozone in Normal Saline", "therapy_type_id": 3}
291	therapies	213	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 86.21, "charge": 220.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 213, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Ozone IV Therapy ", "therapy_type_id": 3}
292	therapies	214	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 117.98, "charge": 295.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 214, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Ozone with UltraViolet Blood IV Therapy", "therapy_type_id": 3}
293	therapies	215	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 75.68, "charge": 275.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 215, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Superhero IV Therapy", "therapy_type_id": 3}
294	therapies	216	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.25, "charge": 55.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 216, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Toradol�/Ketorolac (30mg) Injection", "therapy_type_id": 3}
295	therapies	217	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 32.32, "charge": 100.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 217, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Tri-Immune (Injection)", "therapy_type_id": 3}
296	therapies	218	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 231.99, "charge": 580.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 218, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C (100g) with Hydration IV Therapy", "therapy_type_id": 3}
297	therapies	219	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 77.61, "charge": 235.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 219, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C (25g) IV Therapy", "therapy_type_id": 3}
298	therapies	220	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 130.74, "charge": 330.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 220, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C (50g) with Hydration IV Therapy", "therapy_type_id": 3}
299	therapies	221	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 176.99, "charge": 445.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 221, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Vitamin C (75g) IV Therapy", "therapy_type_id": 3}
300	therapies	222	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 21.15, "charge": 65.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 222, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Vitamin D3 (100,000IU) Injection", "therapy_type_id": 3}
301	therapies	223	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 29.35, "charge": 90.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 223, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "IM", "therapy_name": "Vitamin D3 (300,000IU) Injection", "therapy_type_id": 3}
302	therapies	224	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 101.44, "charge": 299.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 224, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Workout Recovery", "therapy_type_id": 3}
303	therapies	225	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 159.14, "charge": 400.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 225, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Drip", "therapy_name": "Works IV Therapy", "therapy_type_id": 3}
304	therapies	226	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 13.38, "charge": 45.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 226, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Zinc (20mg) IV Push", "therapy_type_id": 3}
305	therapies	227	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 31.36, "charge": 95.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 227, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": "Push", "therapy_name": "Zofran�/Ondansetron IV Push", "therapy_type_id": 3}
306	therapies	228	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 199.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 228, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Acupuncture 60 Minutes (Needles)", "therapy_type_id": 5}
307	therapies	229	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 26.25, "charge": 199.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 229, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Acupuncture EAM�- Single Session 30 Minutes", "therapy_type_id": 5}
308	therapies	230	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 199.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 230, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Acupuncture Fire Cupping Treatment", "therapy_type_id": 5}
309	therapies	231	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 599.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 231, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Bio-Optic Holography", "therapy_type_id": 5}
310	therapies	232	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 175.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 232, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "BrainTap� Session Add On", "therapy_type_id": 5}
311	therapies	233	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 5.00, "charge": 25.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 233, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Coaching Session", "therapy_type_id": 5}
312	therapies	234	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 750.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 234, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Custom Treatment Plan", "therapy_type_id": 5}
313	therapies	235	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 235, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Custom Treatment Plan Nutritional Visit", "therapy_type_id": 5}
314	therapies	236	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 236, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Emotion/Body Code Therapy (30 mins)", "therapy_type_id": 5}
315	therapies	237	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 52.50, "charge": 399.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 237, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Energetic Osteopathy Treatment", "therapy_type_id": 5}
316	therapies	238	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 99.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 238, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Cupping Treatment", "therapy_type_id": 5}
317	therapies	239	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 75.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 239, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Food Sensitivity Remote Instruction/Supervision", "therapy_type_id": 5}
318	therapies	240	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 175.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 240, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Food Sensitivity Test Review", "therapy_type_id": 5}
319	therapies	241	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 8.75, "charge": 25.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 241, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Genius Insight Voice Upload ", "therapy_type_id": 5}
320	therapies	242	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 5.00, "charge": 25.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 242, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Group RASHA", "therapy_type_id": 5}
321	therapies	243	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 87.50, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 243, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Initial Nutritional Visit with Initial Supplements", "therapy_type_id": 5}
322	therapies	244	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 375.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 244, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lab Review", "therapy_type_id": 5}
323	therapies	245	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 26.25, "charge": 131.25, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 245, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Lymphatic Drainage 30 Minutes", "therapy_type_id": 5}
324	therapies	246	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 175.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 246, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Physical Exam", "therapy_type_id": 5}
325	therapies	247	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 87.50, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 247, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "PICC Line Dressing Change", "therapy_type_id": 5}
326	therapies	248	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 248, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Program Onboarding 1", "therapy_type_id": 5}
327	therapies	249	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 249, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Program Onboarding 2", "therapy_type_id": 5}
328	therapies	250	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 250, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Program Onboarding 3", "therapy_type_id": 5}
329	therapies	251	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 750.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 251, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Program ReCap and Maintenance Plan", "therapy_type_id": 5}
330	therapies	252	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 600.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 252, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Rasha 120 Minutes ", "therapy_type_id": 5}
331	therapies	253	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 300.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 253, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Rasha 60 Minutes", "therapy_type_id": 5}
332	therapies	254	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 450.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 254, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Rasha 90 Minutes ", "therapy_type_id": 5}
333	therapies	255	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 35.00, "charge": 299.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 255, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Reiki Treatment ", "therapy_type_id": 5}
334	therapies	256	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 199.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 256, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Sacred Body Language Translation 30 Minutes", "therapy_type_id": 5}
336	therapies	258	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 61.25, "charge": 306.25, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 258, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Specialized Body Therapy Massage 90 Minutes", "therapy_type_id": 5}
337	therapies	259	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 115.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 259, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Tuning Fork 30 Minutes Premium", "therapy_type_id": 5}
338	therapies	260	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 52.50, "charge": 195.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 260, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Vibration/Sound Therapy Massage 90 Minutes", "therapy_type_id": 5}
339	therapies	261	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 261, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Weight Loss Check In", "therapy_type_id": 5}
340	therapies	262	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 17.50, "charge": 125.00, "taxable": false, "bucket_id": 19, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 262, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "Weight Loss Orientation", "therapy_type_id": 5}
341	therapies	263	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 179.00, "charge": 1790.00, "taxable": false, "bucket_id": 23, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 263, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "YOY University 3 Month", "therapy_type_id": 5}
342	therapies	264	\N	INSERT	\N	2025-09-30 03:14:39.134091+00	support	\N	\N	\N	\N	\N	{"cost": 229.00, "charge": 2290.00, "taxable": false, "bucket_id": 23, "created_at": "2025-09-30T03:14:39.134091+00:00", "created_by": null, "therapy_id": 264, "updated_at": "2025-09-30T03:14:39.134091+00:00", "updated_by": null, "active_flag": true, "description": null, "therapy_name": "YOY University 4 Month", "therapy_type_id": 5}
343	member_program_items	3	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:00:49.544307+00	member	609	1	Program item updated: The Days From Start was changed.	\N	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 7, "member_program_id": 1, "member_program_item_id": 3}	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:00:49.544307+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 8, "member_program_id": 1, "member_program_item_id": 3}
344	member_programs	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:00:49.692349+00	member	609	1	Member program updated	\N	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T02:51:44.665187+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:00:49.692349+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}
345	member_program_finances	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:00:49.994288+00	member	609	1	Program finances updated: The Taxes, Margin, and Program Price were changed.	\N	{"taxes": 0.00, "margin": 62.27, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2214.70, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}	{"taxes": 7.59, "margin": 62.40, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2222.29, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}
346	member_program_items	3	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:01:13.463677+00	member	609	1	Program item updated: The Quantity was changed.	\N	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:00:49.544307+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 8, "member_program_id": 1, "member_program_item_id": 3}	{"quantity": 2, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:01:13.463677+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 8, "member_program_id": 1, "member_program_item_id": 3}
347	member_programs	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:01:13.651294+00	member	609	1	Member program updated: The Total Cost and Total Charge were changed.	\N	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:00:49.692349+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 1034.65, "updated_at": "2025-09-30T17:01:13.651294+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 3209.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}
348	member_program_finances	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:01:13.932539+00	member	609	1	Program finances updated: The Margin and Program Price were changed.	\N	{"taxes": 7.59, "margin": 62.40, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2222.29, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}	{"taxes": 7.59, "margin": 67.84, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 3217.29, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}
353	member_program_finances	2	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	member	609	2	Program finances created	\N	\N	{"taxes": 0.00, "margin": 62.27, "discounts": 0.00, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T17:06:36.309418+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2214.70, "financing_type_id": null, "member_program_id": 2, "member_program_finance_id": 2}
349	member_program_items	3	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:04:00.21156+00	member	609	1	Program item updated: The Quantity was changed.	\N	{"quantity": 2, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:01:13.463677+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 8, "member_program_id": 1, "member_program_item_id": 3}	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:04:00.21156+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 8, "member_program_id": 1, "member_program_item_id": 3}
350	member_programs	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:04:00.347671+00	member	609	1	Member program updated: The Total Cost and Total Charge were changed.	\N	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 1034.65, "updated_at": "2025-09-30T17:01:13.651294+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 3209.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:04:00.347671+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This is my test program please do not alter the content", "total_charge": 2214.70, "member_program_id": 1, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM", "template_version_date": "2025-09-30T02:51:44.617552+00:00"}
351	member_program_finances	1	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:04:00.552668+00	member	609	1	Program finances updated: The Margin and Program Price were changed.	\N	{"taxes": 7.59, "margin": 67.84, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 3217.29, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}	{"taxes": 7.59, "margin": 62.40, "discounts": 0.00, "created_at": "2025-09-30T02:51:44.617552+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T02:51:44.617552+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2222.29, "financing_type_id": null, "member_program_id": 1, "member_program_finance_id": 1}
352	member_programs	2	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	member	609	2	Member program created	{"status": "active", "start_date": null}	\N	{"lead_id": 609, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:06:36.309418+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Please do not mess with my program", "total_charge": 2214.70, "member_program_id": 2, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM II", "template_version_date": "2025-09-30T17:06:36.309418+00:00"}
354	member_program_items	4	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	member	609	2	Program item created	\N	\N	{"quantity": 1, "item_cost": 36.95, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 85, "updated_at": "2025-09-30T17:06:36.309418+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 92.00, "days_between": 0, "instructions": "Take with food twice a day", "days_from_start": 14, "member_program_id": 2, "member_program_item_id": 4}
355	member_program_items	5	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	member	609	2	Program item created	\N	\N	{"quantity": 6, "item_cost": 99.95, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 102, "updated_at": "2025-09-30T17:06:36.309418+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 187.95, "days_between": 30, "instructions": "Use one per day", "days_from_start": 0, "member_program_id": 2, "member_program_item_id": 5}
356	member_program_items	6	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	member	609	2	Program item created	\N	\N	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:06:36.309418+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 7, "member_program_id": 2, "member_program_item_id": 6}
357	member_programs	2	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.357884+00	member	609	2	Member program updated: The Status was changed.	{"to_status": "quote", "from_status": "active"}	{"lead_id": 609, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:06:36.309418+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Please do not mess with my program", "total_charge": 2214.70, "member_program_id": 2, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM II", "template_version_date": "2025-09-30T17:06:36.309418+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T17:06:36.309418+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:06:36.357884+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Please do not mess with my program", "total_charge": 2214.70, "member_program_id": 2, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM II", "template_version_date": "2025-09-30T17:06:36.309418+00:00"}
358	member_programs	3	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	member	609	3	Member program created	{"status": "active", "start_date": null}	\N	{"lead_id": 609, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:14:43.200876+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Please do not alter the content of my program", "total_charge": 2214.70, "member_program_id": 3, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM III", "template_version_date": "2025-09-30T17:14:43.200876+00:00"}
359	member_program_finances	3	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	member	609	3	Program finances created	\N	\N	{"taxes": 0.00, "margin": 62.27, "discounts": 0.00, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T17:14:43.200876+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2214.70, "financing_type_id": null, "member_program_id": 3, "member_program_finance_id": 3}
360	member_program_items	7	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	member	609	3	Program item created	\N	\N	{"quantity": 1, "item_cost": 36.95, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 85, "updated_at": "2025-09-30T17:14:43.200876+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 92.00, "days_between": 0, "instructions": "Take with food twice a day", "days_from_start": 14, "member_program_id": 3, "member_program_item_id": 7}
361	member_program_items	8	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	member	609	3	Program item created	\N	\N	{"quantity": 6, "item_cost": 99.95, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 102, "updated_at": "2025-09-30T17:14:43.200876+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 187.95, "days_between": 30, "instructions": "Use one per day", "days_from_start": 0, "member_program_id": 3, "member_program_item_id": 8}
362	member_program_items	9	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	member	609	3	Program item created	\N	\N	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:14:43.200876+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 7, "member_program_id": 3, "member_program_item_id": 9}
363	member_programs	3	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.29416+00	member	609	3	Member program updated: The Status was changed.	{"to_status": "quote", "from_status": "active"}	{"lead_id": 609, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:14:43.200876+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Please do not alter the content of my program", "total_charge": 2214.70, "member_program_id": 3, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM III", "template_version_date": "2025-09-30T17:14:43.200876+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T17:14:43.200876+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:14:43.29416+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Please do not alter the content of my program", "total_charge": 2214.70, "member_program_id": 3, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM III", "template_version_date": "2025-09-30T17:14:43.200876+00:00"}
365	member_programs	5	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	member	609	5	Member program created	{"status": "active", "start_date": null}	\N	{"lead_id": 609, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:29:35.456951+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Dont mess with this its mine", "total_charge": 2214.70, "member_program_id": 5, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM IV", "template_version_date": "2025-09-30T17:29:35.456951+00:00"}
366	member_program_items	10	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	member	609	5	Program item created	\N	\N	{"quantity": 1, "item_cost": 36.95, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 85, "updated_at": "2025-09-30T17:29:35.456951+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 92.00, "days_between": 0, "instructions": "Take with food twice a day", "days_from_start": 14, "member_program_id": 5, "member_program_item_id": 10}
367	member_program_items	11	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	member	609	5	Program item created	\N	\N	{"quantity": 6, "item_cost": 99.95, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 102, "updated_at": "2025-09-30T17:29:35.456951+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 187.95, "days_between": 30, "instructions": "Use one per day", "days_from_start": 0, "member_program_id": 5, "member_program_item_id": 11}
368	member_program_items	12	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	member	609	5	Program item created	\N	\N	{"quantity": 1, "item_cost": 199.00, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 116, "updated_at": "2025-09-30T17:29:35.456951+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "item_charge": 995.00, "days_between": 0, "instructions": "", "days_from_start": 7, "member_program_id": 5, "member_program_item_id": 12}
369	member_program_finances	4	\N	INSERT	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	member	609	5	Program finances created	\N	\N	{"taxes": 7.59, "margin": 62.27, "discounts": 0.00, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-30T17:29:35.456951+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "finance_charges": 0.00, "final_total_price": 2222.29, "financing_type_id": null, "member_program_id": 5, "member_program_finance_id": 4}
370	member_programs	5	\N	UPDATE	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.508551+00	member	609	5	Member program updated: The Status was changed.	{"to_status": "quote", "from_status": "active"}	{"lead_id": 609, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:29:35.456951+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Dont mess with this its mine", "total_charge": 2214.70, "member_program_id": 5, "program_status_id": 1, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM IV", "template_version_date": "2025-09-30T17:29:35.456951+00:00"}	{"lead_id": 609, "created_at": "2025-09-30T17:29:35.456951+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "start_date": null, "total_cost": 835.65, "updated_at": "2025-09-30T17:29:35.508551+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Dont mess with this its mine", "total_charge": 2214.70, "member_program_id": 5, "program_status_id": 6, "source_template_id": 1, "program_template_name": "TEST JAMES PROGRAM IV", "template_version_date": "2025-09-30T17:29:35.456951+00:00"}
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, table_name, record_id, operation, old_record, new_record, changed_columns, business_context, changed_by, changed_at, source_audit_log_ids, migration_notes) FROM stdin;
1	campaigns	3	UPDATE	{"updated_at": "2025-05-05T17:53:29.13972+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a"}	{"updated_at": "2025-09-03T17:19:52.632295+00:00", "updated_by": null}	{updated_at,updated_by}	\N	\N	2025-09-03 17:19:52.632295+00	{434,435}	Migrated from 2 granular entries
2	campaigns	24	INSERT	\N	{"ad_spend": 637.00, "food_cost": 750.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 24, "description": "Spring Creek BBQ", "campaign_date": "2024-10-22", "campaign_name": "S 10/22", "confirmed_count": 18}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{436}	Migrated from 1 granular entries
3	campaigns	25	INSERT	\N	{"ad_spend": 408.00, "food_cost": 550.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 25, "description": "Spring Creek BBQ", "campaign_date": "2024-10-29", "campaign_name": "S 10/29", "confirmed_count": 31}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{437}	Migrated from 1 granular entries
4	campaigns	26	INSERT	\N	{"ad_spend": 557.00, "food_cost": 650.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 26, "description": "Lomonte's", "campaign_date": "2024-11-12", "campaign_name": "S 11/12", "confirmed_count": 34}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{438}	Migrated from 1 granular entries
5	campaigns	27	INSERT	\N	{"ad_spend": 1100.00, "food_cost": 875.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 27, "description": "Lomonte's", "campaign_date": "2024-11-19", "campaign_name": "S 11/19", "confirmed_count": 41}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{439}	Migrated from 1 granular entries
6	campaigns	28	INSERT	\N	{"ad_spend": 832.00, "food_cost": 450.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 28, "description": "Spring Creek BBQ", "campaign_date": "2024-12-12", "campaign_name": "S 12/12", "confirmed_count": 13}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{440}	Migrated from 1 granular entries
7	campaigns	29	INSERT	\N	{"ad_spend": 665.00, "food_cost": 575.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 29, "description": "Lomonte's", "campaign_date": "2025-01-07", "campaign_name": "S 01/07", "confirmed_count": 29}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{441}	Migrated from 1 granular entries
8	campaigns	30	INSERT	\N	{"ad_spend": 742.00, "food_cost": 1400.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 30, "description": "Lupe Tortilla", "campaign_date": "2025-01-14", "campaign_name": "S01/14", "confirmed_count": 33}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{442}	Migrated from 1 granular entries
9	campaigns	31	INSERT	\N	{"ad_spend": 637.00, "food_cost": null, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 31, "description": "Demio", "campaign_date": "2025-01-15", "campaign_name": "W 1/15", "confirmed_count": 107}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{443}	Migrated from 1 granular entries
10	campaigns	32	INSERT	\N	{"ad_spend": 750.00, "food_cost": null, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 32, "description": "Demio", "campaign_date": "2025-01-22", "campaign_name": "W 1/22", "confirmed_count": 155}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{444}	Migrated from 1 granular entries
11	campaigns	33	INSERT	\N	{"ad_spend": 748.00, "food_cost": 750.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 33, "description": "Spring Creek BBQ", "campaign_date": "2025-01-28", "campaign_name": "S 01/28", "confirmed_count": 42}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{445}	Migrated from 1 granular entries
12	campaigns	34	INSERT	\N	{"ad_spend": 750.00, "food_cost": null, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 34, "description": "Demio", "campaign_date": "2025-01-29", "campaign_name": "W 1/29", "confirmed_count": 184}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{446}	Migrated from 1 granular entries
13	campaigns	35	INSERT	\N	{"ad_spend": 499.00, "food_cost": 898.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 35, "description": "Spring Creek BBQ", "campaign_date": "2025-02-04", "campaign_name": "S 02/04 ", "confirmed_count": 31}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{447}	Migrated from 1 granular entries
14	campaigns	36	INSERT	\N	{"ad_spend": 745.00, "food_cost": 646.61, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 36, "description": "Spring Creek BBQ", "campaign_date": "2025-02-11", "campaign_name": "S 02/11", "confirmed_count": 23}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{448}	Migrated from 1 granular entries
15	campaigns	37	INSERT	\N	{"ad_spend": 494.00, "food_cost": 577.12, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 37, "description": "Hasta La Pasta ", "campaign_date": "2025-03-04", "campaign_name": "S 03/04", "confirmed_count": 11}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{449}	Migrated from 1 granular entries
16	campaigns	38	INSERT	\N	{"ad_spend": 496.00, "food_cost": 260.38, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 38, "description": "Los Tios ", "campaign_date": "2025-03-18", "campaign_name": "S 03/18", "confirmed_count": 8}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{450}	Migrated from 1 granular entries
17	campaigns	39	INSERT	\N	{"ad_spend": 499.35, "food_cost": 400.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 39, "description": "Spring Creek BBQ", "campaign_date": "2025-04-01", "campaign_name": "S 04/01", "confirmed_count": 17}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{451}	Migrated from 1 granular entries
18	campaigns	40	INSERT	\N	{"ad_spend": 499.67, "food_cost": 175.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 40, "description": "Spring Creek BBQ Richmond", "campaign_date": "2025-04-15", "campaign_name": "S 04/15", "confirmed_count": 12}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{452}	Migrated from 1 granular entries
19	campaigns	41	INSERT	\N	{"ad_spend": 499.78, "food_cost": 200.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 41, "description": "Spring Creek BBQ Katy ", "campaign_date": "2025-04-22", "campaign_name": "S 04/22", "confirmed_count": 12}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{453}	Migrated from 1 granular entries
20	campaigns	42	INSERT	\N	{"ad_spend": 499.17, "food_cost": 463.59, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 42, "description": "Spring Creek BBQ Richmond", "campaign_date": "2025-04-29", "campaign_name": "S 04/29", "confirmed_count": 14}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{454}	Migrated from 1 granular entries
21	campaigns	43	INSERT	\N	{"ad_spend": 499.00, "food_cost": 320.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 43, "description": "Beck's Prime Katy", "campaign_date": "2025-05-06", "campaign_name": "S 05/06", "confirmed_count": 10}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{455}	Migrated from 1 granular entries
22	campaigns	44	INSERT	\N	{"ad_spend": 499.00, "food_cost": 350.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 44, "description": "Spring Creek BBQ Katy ", "campaign_date": "2025-05-13", "campaign_name": "S 05/13", "confirmed_count": 19}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{456}	Migrated from 1 granular entries
23	campaigns	45	INSERT	\N	{"ad_spend": 499.00, "food_cost": 285.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 45, "description": "Spring Creek BBQ Katy ", "campaign_date": "2025-05-20", "campaign_name": "S 05/20", "confirmed_count": 28}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{457}	Migrated from 1 granular entries
24	campaigns	46	INSERT	\N	{"ad_spend": 499.00, "food_cost": 245.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 46, "description": "Spring Creek BBQ Katy ", "campaign_date": "2025-05-27", "campaign_name": "S 05/27", "confirmed_count": 12}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{458}	Migrated from 1 granular entries
25	campaigns	47	INSERT	\N	{"ad_spend": 223.86, "food_cost": 420.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 47, "description": "Lomonte's", "campaign_date": "2025-06-03", "campaign_name": "S 06/03", "confirmed_count": 15}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{459}	Migrated from 1 granular entries
26	campaigns	48	INSERT	\N	{"ad_spend": 499.38, "food_cost": 590.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 48, "description": "Lomonte's", "campaign_date": "2025-06-10", "campaign_name": "S 06/10", "confirmed_count": 14}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{460}	Migrated from 1 granular entries
27	campaigns	49	INSERT	\N	{"ad_spend": 997.00, "food_cost": 510.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 49, "description": "Spring Creek Richmond ", "campaign_date": "2025-06-17", "campaign_name": "S 06/17", "confirmed_count": 22}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{461}	Migrated from 1 granular entries
28	campaigns	50	INSERT	\N	{"ad_spend": 999.00, "food_cost": 500.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 50, "description": "Lomonte's", "campaign_date": "2025-06-24", "campaign_name": "S 06/24", "confirmed_count": 19}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{462}	Migrated from 1 granular entries
29	campaigns	51	INSERT	\N	{"ad_spend": 998.76, "food_cost": 775.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 51, "description": "Lomonte's", "campaign_date": "2025-07-15", "campaign_name": "S 07/15", "confirmed_count": 33}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{463}	Migrated from 1 granular entries
58	program_template	1	UPDATE	{"total_cost": 250.98, "updated_at": "2025-09-04T03:36:18.00266+00:00", "total_charge": 1257.00}	{"total_cost": 225.82, "updated_at": "2025-09-04T03:36:23.95109+00:00", "total_charge": 1131.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:23.95109+00	{1121,1122,1123}	Migrated from 3 granular entries
30	campaigns	52	INSERT	\N	{"ad_spend": 999.00, "food_cost": 752.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 52, "description": "Lomonte's", "campaign_date": "2025-07-01", "campaign_name": "S 07/01", "confirmed_count": 17}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{464}	Migrated from 1 granular entries
31	campaigns	53	INSERT	\N	{"ad_spend": 687.86, "food_cost": 1000.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 53, "description": "Lomonte's ", "campaign_date": "2025-07-22", "campaign_name": "S 07/22 ", "confirmed_count": 31}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{465}	Migrated from 1 granular entries
32	campaigns	54	INSERT	\N	{"ad_spend": 990.75, "food_cost": 700.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 54, "description": "Spring Creek BBQ Richmond", "campaign_date": "2025-07-29", "campaign_name": "S 07/29", "confirmed_count": 31}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{466}	Migrated from 1 granular entries
33	campaigns	55	INSERT	\N	{"ad_spend": 750.00, "food_cost": 758.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 55, "description": "Lomonte's", "campaign_date": "2025-08-05", "campaign_name": "S 08/05", "confirmed_count": 17}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{467}	Migrated from 1 granular entries
34	campaigns	56	INSERT	\N	{"ad_spend": 750.00, "food_cost": 550.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 56, "description": "Lomonte's", "campaign_date": "2025-08-12", "campaign_name": "S 08/12", "confirmed_count": 22}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{468}	Migrated from 1 granular entries
35	campaigns	57	INSERT	\N	{"ad_spend": 750.00, "food_cost": 550.00, "vendor_id": 3, "created_at": "2025-09-03T17:26:47.55908+00:00", "created_by": null, "updated_at": "2025-09-03T17:26:47.55908+00:00", "updated_by": null, "active_flag": true, "campaign_id": 57, "description": "Lomonte's", "campaign_date": "2025-08-26", "campaign_name": "S 08/26", "confirmed_count": 24}	{}	\N	\N	2025-09-03 17:26:47.55908+00	{469}	Migrated from 1 granular entries
36	campaigns	3	DELETE	{"ad_spend": 637.00, "food_cost": 751.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-09-03T17:19:52.632295+00:00", "updated_by": null, "active_flag": true, "campaign_id": 3, "description": "Spring Creek BBQ", "campaign_date": "2024-10-22", "campaign_name": "S 10/22", "confirmed_count": 18}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{489}	Migrated from 1 granular entries
37	campaigns	4	DELETE	{"ad_spend": 408.00, "food_cost": 550.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-07-03T19:58:16.005999+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": false, "campaign_id": 4, "description": "Spring Creek BBQ", "campaign_date": "2024-10-29", "campaign_name": "S 10/29", "confirmed_count": 31}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 17:27:46.358385+00	{492}	Migrated from 1 granular entries
38	campaigns	5	DELETE	{"ad_spend": 557.00, "food_cost": 650.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 5, "description": "Lomonte's", "campaign_date": "2024-11-12", "campaign_name": "S 11/12", "confirmed_count": 34}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{478}	Migrated from 1 granular entries
39	campaigns	6	DELETE	{"ad_spend": 1100.00, "food_cost": 875.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 6, "description": "Lomonte's", "campaign_date": "2024-11-19", "campaign_name": "S 11/19", "confirmed_count": 41}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{479}	Migrated from 1 granular entries
40	campaigns	7	DELETE	{"ad_spend": 832.00, "food_cost": 450.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 7, "description": "Spring Creek BBQ", "campaign_date": "2024-12-12", "campaign_name": "S 12/12", "confirmed_count": 13}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{480}	Migrated from 1 granular entries
41	campaigns	8	DELETE	{"ad_spend": 665.00, "food_cost": 575.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 8, "description": "Lomonte's", "campaign_date": "2025-01-07", "campaign_name": "S 01/07", "confirmed_count": 29}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{481}	Migrated from 1 granular entries
42	campaigns	9	DELETE	{"ad_spend": 742.00, "food_cost": 1400.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 9, "description": "Lupe Tortilla", "campaign_date": "2025-01-14", "campaign_name": "S01/14", "confirmed_count": 33}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{482}	Migrated from 1 granular entries
43	campaigns	10	DELETE	{"ad_spend": 637.00, "food_cost": 0.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 10, "description": "Demio", "campaign_date": "2025-01-15", "campaign_name": "W 1/15", "confirmed_count": 107}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{483}	Migrated from 1 granular entries
89	program_template	1	UPDATE	{"total_cost": 898.10, "updated_at": "2025-09-09T18:29:18.163098+00:00", "total_charge": 4496.00}	{"total_cost": 982.08, "updated_at": "2025-09-09T18:34:13.272446+00:00", "total_charge": 4916.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:34:13.272446+00	{1344,1345,1346}	Migrated from 3 granular entries
44	campaigns	12	DELETE	{"ad_spend": 748.00, "food_cost": 750.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 12, "description": "Spring Creek BBQ", "campaign_date": "2025-01-28", "campaign_name": "S 01/28", "confirmed_count": 42}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{484}	Migrated from 1 granular entries
45	campaigns	13	DELETE	{"ad_spend": 750.00, "food_cost": 0.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 13, "description": "Demio", "campaign_date": "2025-01-29", "campaign_name": "W 1/29", "confirmed_count": 184}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{485}	Migrated from 1 granular entries
46	campaigns	14	DELETE	{"ad_spend": 1.00, "food_cost": 1.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-05-05T18:00:20.847546+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "campaign_id": 14, "description": "Spring Creek Dinner Seminar - Katy", "campaign_date": "2025-05-06", "campaign_name": "S 05/06/25", "confirmed_count": 10}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 17:27:46.358385+00	{491}	Migrated from 1 granular entries
47	campaigns	16	DELETE	{"ad_spend": 493.00, "food_cost": 577.12, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-05-05T17:52:24.402217+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "campaign_id": 16, "description": "Hasta La Pasta ", "campaign_date": "2025-03-04", "campaign_name": "S 03/04", "confirmed_count": 11}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 17:27:46.358385+00	{488}	Migrated from 1 granular entries
48	campaigns	17	DELETE	{"ad_spend": 496.00, "food_cost": 260.38, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 17, "description": "Los Tios ", "campaign_date": "2025-03-18", "campaign_name": "S 03/18", "confirmed_count": 8}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{486}	Migrated from 1 granular entries
49	campaigns	19	DELETE	{"ad_spend": 499.67, "food_cost": 175.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-04-28T19:57:15.342462+00:00", "updated_by": null, "active_flag": true, "campaign_id": 19, "description": "Spring Creek BBQ Richmond", "campaign_date": "2025-04-15", "campaign_name": "S 04/15", "confirmed_count": 12}	\N	{}	\N	\N	2025-09-03 17:27:46.358385+00	{487}	Migrated from 1 granular entries
50	campaigns	20	DELETE	{"ad_spend": 499.78, "food_cost": 200.00, "vendor_id": 3, "created_at": "2025-04-28T19:57:15.342462+00:00", "created_by": null, "updated_at": "2025-05-05T17:56:03.089782+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "campaign_id": 20, "description": "Spring Creek BBQ Katy ", "campaign_date": "2025-04-22", "campaign_name": "S 04/22", "confirmed_count": 12}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 17:27:46.358385+00	{490}	Migrated from 1 granular entries
51	campaigns	58	INSERT	\N	{"ad_spend": 0.00, "food_cost": 0.00, "vendor_id": 4, "created_at": "2025-09-03T17:31:06.966783+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-03T17:31:06.966783+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "campaign_id": 58, "description": "This for all leads that come to us via referrals. ", "campaign_date": "2024-10-01", "campaign_name": "Referrals", "confirmed_count": 0}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 17:31:06.966783+00	{493}	Migrated from 1 granular entries
52	program_status	6	INSERT	\N	{"created_at": "2025-09-09T01:50:01.220511+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-09T01:50:01.220511+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "This should be the first status a program is set to until the customer decides to participate", "status_name": "Quote", "program_status_id": 6}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 01:50:01.220511+00	{1251}	Migrated from 1 granular entries
53	program_status	7	INSERT	\N	{"created_at": "2025-09-15T22:32:39.918114+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-15T22:32:39.918114+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": false, "description": "Draft Mode.  Financial changes can only happen when this state is set", "status_name": "Draft", "program_status_id": 7}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-15 22:32:39.918114+00	{1718}	Migrated from 1 granular entries
54	program_template	1	UPDATE	{"total_cost": 200.66, "updated_at": "2025-06-25T21:58:45.33466+00:00", "total_charge": 1005.00, "margin_percentage": 80.03}	{"total_cost": 250.98, "updated_at": "2025-09-04T03:36:04.036591+00:00", "total_charge": 1257.00, "margin_percentage": 400.84}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:04.036591+00	{1103,1104,1105,1106}	Migrated from 4 granular entries
55	program_template	1	UPDATE	{"updated_at": "2025-09-04T03:36:04.036591+00:00"}	{"updated_at": "2025-09-04T03:36:04.210996+00:00"}	{updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:04.210996+00	{1107}	Migrated from 1 granular entries
56	program_template	1	UPDATE	{"total_cost": 250.98, "updated_at": "2025-09-04T03:36:04.210996+00:00", "total_charge": 1257.00, "margin_percentage": 400.84}	{"total_cost": 276.14, "updated_at": "2025-09-04T03:36:05.186942+00:00", "total_charge": 1383.00, "margin_percentage": 400.83}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:05.186942+00	{1109,1110,1111,1112}	Migrated from 4 granular entries
57	program_template	1	UPDATE	{"total_cost": 276.14, "updated_at": "2025-09-04T03:36:05.186942+00:00", "total_charge": 1383.00, "margin_percentage": 400.83}	{"total_cost": 250.98, "updated_at": "2025-09-04T03:36:18.00266+00:00", "total_charge": 1257.00, "margin_percentage": 400.84}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:18.00266+00	{1115,1116,1117,1118}	Migrated from 4 granular entries
59	program_template	1	UPDATE	{"total_cost": 225.82, "updated_at": "2025-09-04T03:36:23.95109+00:00", "total_charge": 1131.00, "margin_percentage": 400.84}	{"total_cost": 309.80, "updated_at": "2025-09-04T03:55:11.426854+00:00", "total_charge": 1551.00, "margin_percentage": 400.65}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:55:11.426854+00	{1125,1126,1127,1128}	Migrated from 4 granular entries
60	program_template	8	INSERT	\N	{"created_at": "2025-09-04T18:28:32.456833+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "total_cost": 0.00, "updated_at": "2025-09-04T18:28:32.456833+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Test", "total_charge": 0.00, "margin_percentage": 0.00, "program_template_id": 8, "program_template_name": "Just Test one more time"}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 18:28:32.456833+00	{1129}	Migrated from 1 granular entries
61	program_template	1	UPDATE	{"updated_at": "2025-09-04T03:55:11.426854+00:00", "description": "Use this to test member programs"}	{"updated_at": "2025-09-04T19:12:16.198093+00:00", "description": "Use this to test member programs. Just testing again"}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 19:12:16.198093+00	{1130,1131}	Migrated from 2 granular entries
62	program_template	1	UPDATE	{"updated_at": "2025-09-04T19:12:16.198093+00:00", "description": "Use this to test member programs. Just testing again"}	{"updated_at": "2025-09-04T19:19:20.88535+00:00", "description": "Use this to test member programs. Just testing again. one more time"}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 19:19:20.88535+00	{1132,1133}	Migrated from 2 granular entries
63	program_template	1	UPDATE	{"updated_at": "2025-09-04T19:19:20.88535+00:00", "description": "Use this to test member programs. Just testing again. one more time"}	{"updated_at": "2025-09-04T21:48:26.211622+00:00", "description": "Use this to test member programs. Just testing again. one more time. Timing test"}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 21:48:26.211622+00	{1134,1135}	Migrated from 2 granular entries
64	program_template	1	UPDATE	{"updated_at": "2025-09-04T21:48:26.211622+00:00", "description": "Use this to test member programs. Just testing again. one more time. Timing test"}	{"updated_at": "2025-09-04T21:48:50.412939+00:00", "description": "Use this to test member programs. Just testing again. one more time. Timing test. Another test"}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 21:48:50.412939+00	{1136,1137}	Migrated from 2 granular entries
65	program_template	1	UPDATE	{"updated_at": "2025-09-04T21:48:50.412939+00:00", "description": "Use this to test member programs. Just testing again. one more time. Timing test. Another test"}	{"updated_at": "2025-09-04T21:50:00.277049+00:00", "description": "Use this to test member programs. Just testing again. one more time. Timing test. Another test. and another"}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 21:50:00.277049+00	{1138,1139}	Migrated from 2 granular entries
66	program_template	1	UPDATE	{"updated_at": "2025-09-04T21:50:00.277049+00:00", "description": "Use this to test member programs. Just testing again. one more time. Timing test. Another test. and another"}	{"updated_at": "2025-09-04T21:57:28.375565+00:00", "description": "Use this to test member programs. Just testing again. one more time. "}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 21:57:28.375565+00	{1140,1141}	Migrated from 2 granular entries
67	program_template	1	UPDATE	{"updated_at": "2025-09-04T21:57:28.375565+00:00", "description": "Use this to test member programs. Just testing again. one more time. "}	{"updated_at": "2025-09-04T22:08:27.315196+00:00", "description": "Use this to test member programs. Just testing again. one more time. Save and watch for grid update."}	{description,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 22:08:27.315196+00	{1142,1143}	Migrated from 2 granular entries
68	program_template	1	UPDATE	{"total_cost": 309.80, "updated_at": "2025-09-04T22:08:27.315196+00:00", "total_charge": 1551.00, "margin_percentage": 400.65}	{"total_cost": 374.10, "updated_at": "2025-09-05T02:01:54.772409+00:00", "total_charge": 1873.00, "margin_percentage": 400.67}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:01:54.772409+00	{1145,1146,1147,1148}	Migrated from 4 granular entries
69	program_template	1	UPDATE	{"total_cost": 374.10, "updated_at": "2025-09-05T02:01:54.772409+00:00", "total_charge": 1873.00, "margin_percentage": 400.67}	{"total_cost": 427.98, "updated_at": "2025-09-05T02:02:51.997938+00:00", "total_charge": 2143.00, "margin_percentage": 400.72}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:02:51.997938+00	{1150,1151,1152,1153}	Migrated from 4 granular entries
70	program_template	1	UPDATE	{"total_cost": 427.98, "updated_at": "2025-09-05T02:02:51.997938+00:00", "total_charge": 2143.00}	{"total_cost": 402.82, "updated_at": "2025-09-05T02:03:28.270701+00:00", "total_charge": 2017.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:03:28.270701+00	{1156,1157,1158}	Migrated from 3 granular entries
71	program_template	1	UPDATE	{"total_cost": 402.82, "updated_at": "2025-09-05T02:03:28.270701+00:00", "total_charge": 2017.00, "margin_percentage": 400.72}	{"total_cost": 435.62, "updated_at": "2025-09-05T02:35:46.967139+00:00", "total_charge": 2181.00, "margin_percentage": 400.67}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:35:46.967139+00	{1160,1161,1162,1163}	Migrated from 4 granular entries
72	program_template	1	UPDATE	{"total_cost": 435.62, "updated_at": "2025-09-05T02:35:46.967139+00:00", "total_charge": 2181.00, "margin_percentage": 400.67}	{"total_cost": 534.62, "updated_at": "2025-09-05T02:36:49.726401+00:00", "total_charge": 2676.00, "margin_percentage": 400.54}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:36:49.726401+00	{1165,1166,1167,1168}	Migrated from 4 granular entries
73	program_template	1	UPDATE	{"total_cost": 534.62, "updated_at": "2025-09-05T02:36:49.726401+00:00", "total_charge": 2676.00, "margin_percentage": 400.54}	{"total_cost": 609.17, "updated_at": "2025-09-05T02:38:50.111837+00:00", "total_charge": 3049.00, "margin_percentage": 400.52}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:38:50.111837+00	{1170,1171,1172,1173}	Migrated from 4 granular entries
74	program_template	1	UPDATE	{"total_cost": 609.17, "updated_at": "2025-09-05T02:38:50.111837+00:00", "total_charge": 3049.00, "margin_percentage": 400.52}	{"total_cost": 750.59, "updated_at": "2025-09-05T19:36:01.840817+00:00", "total_charge": 3757.00, "margin_percentage": 400.54}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 19:36:01.840817+00	{1175,1176,1177,1178}	Migrated from 4 granular entries
75	program_template	1	UPDATE	{"total_cost": 750.59, "updated_at": "2025-09-05T19:36:01.840817+00:00", "total_charge": 3757.00, "margin_percentage": 400.54}	{"total_cost": 513.15, "updated_at": "2025-09-05T20:14:42.553192+00:00", "total_charge": 2569.00, "margin_percentage": 400.60}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:14:42.553192+00	{1187,1188,1189,1190}	Migrated from 4 granular entries
76	program_template	1	UPDATE	{"total_cost": 513.15, "updated_at": "2025-09-05T20:14:42.553192+00:00", "total_charge": 2569.00}	{"total_cost": 459.27, "updated_at": "2025-09-05T20:18:15.097072+00:00", "total_charge": 2299.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:18:15.097072+00	{1193,1194,1195}	Migrated from 3 granular entries
77	program_template	1	UPDATE	{"total_cost": 459.27, "updated_at": "2025-09-05T20:18:15.097072+00:00", "total_charge": 2299.00, "margin_percentage": 400.60}	{"total_cost": 394.97, "updated_at": "2025-09-05T20:24:35.450934+00:00", "total_charge": 1977.00, "margin_percentage": 400.50}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:24:35.450934+00	{1198,1199,1200,1201}	Migrated from 4 granular entries
78	program_template	1	UPDATE	{"total_cost": 394.97, "updated_at": "2025-09-05T20:24:35.450934+00:00", "total_charge": 1977.00, "margin_percentage": 400.50}	{"total_cost": 295.97, "updated_at": "2025-09-05T20:29:57.143974+00:00", "total_charge": 1482.00, "margin_percentage": 80.00}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:29:57.143974+00	{1204,1205,1206,1207}	Migrated from 4 granular entries
79	program_template	1	UPDATE	{"total_cost": 295.97, "updated_at": "2025-09-05T20:29:57.143974+00:00", "total_charge": 1482.00}	{"total_cost": 421.97, "updated_at": "2025-09-05T20:32:56.561966+00:00", "total_charge": 2114.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:32:56.561966+00	{1209,1210,1211}	Migrated from 3 granular entries
80	program_template	1	UPDATE	{"total_cost": 421.97, "updated_at": "2025-09-05T20:32:56.561966+00:00", "total_charge": 2114.00}	{"total_cost": 295.97, "updated_at": "2025-09-05T20:33:29.927942+00:00", "total_charge": 1482.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:33:29.927942+00	{1214,1215,1216}	Migrated from 3 granular entries
81	program_template	1	UPDATE	{"updated_at": "2025-09-05T20:33:29.927942+00:00"}	{"updated_at": "2025-09-05T20:44:18.155488+00:00"}	{updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:44:18.155488+00	{1218}	Migrated from 1 granular entries
82	program_template	1	UPDATE	{"total_cost": 295.97, "updated_at": "2025-09-05T20:44:18.155488+00:00", "total_charge": 1482.00}	{"total_cost": 861.65, "updated_at": "2025-09-05T20:45:03.109706+00:00", "total_charge": 4314.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:45:03.109706+00	{1223,1224,1225}	Migrated from 3 granular entries
83	program_template	1	UPDATE	{"total_cost": 861.65, "updated_at": "2025-09-05T20:45:03.109706+00:00", "total_charge": 4314.00}	{"total_cost": 884.05, "updated_at": "2025-09-05T20:48:31.27427+00:00", "total_charge": 4426.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:48:31.27427+00	{1227,1228,1229}	Migrated from 3 granular entries
84	program_template	1	UPDATE	{"total_cost": 884.05, "updated_at": "2025-09-05T20:48:31.27427+00:00", "total_charge": 4426.00}	{"total_cost": 1075.05, "updated_at": "2025-09-05T21:09:36.12767+00:00", "total_charge": 5382.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 21:09:36.12767+00	{1231,1232,1233}	Migrated from 3 granular entries
85	program_template	1	UPDATE	{"total_cost": 1075.05, "updated_at": "2025-09-05T21:09:36.12767+00:00", "total_charge": 5382.00}	{"total_cost": 1052.65, "updated_at": "2025-09-05T21:11:04.200832+00:00", "total_charge": 5270.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 21:11:04.200832+00	{1236,1237,1238}	Migrated from 3 granular entries
86	program_template	8	UPDATE	{"updated_at": "2025-09-04T18:28:32.456833+00:00", "active_flag": true}	{"updated_at": "2025-09-09T02:06:22.574674+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 02:06:22.574674+00	{1254,1255}	Migrated from 2 granular entries
87	program_template	1	UPDATE	{"total_cost": 1052.65, "updated_at": "2025-09-05T21:11:04.200832+00:00", "total_charge": 5270.00}	{"total_cost": 978.10, "updated_at": "2025-09-09T18:28:54.24976+00:00", "total_charge": 4897.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:28:54.24976+00	{1334,1335,1336}	Migrated from 3 granular entries
88	program_template	1	UPDATE	{"total_cost": 978.10, "updated_at": "2025-09-09T18:28:54.24976+00:00", "total_charge": 4897.00}	{"total_cost": 898.10, "updated_at": "2025-09-09T18:29:18.163098+00:00", "total_charge": 4496.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:29:18.163098+00	{1339,1340,1341}	Migrated from 3 granular entries
90	program_template	2	UPDATE	{"total_cost": 101.00, "updated_at": "2025-06-26T00:02:41.889553+00:00", "total_charge": 1010.00, "margin_percentage": 2.00}	{"total_cost": 212.13, "updated_at": "2025-09-09T18:46:50.556055+00:00", "total_charge": 1062.00, "margin_percentage": 80.00}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:46:50.556055+00	{1348,1349,1350,1351}	Migrated from 4 granular entries
91	program_template	2	UPDATE	{"total_cost": 212.13, "updated_at": "2025-09-09T18:46:50.556055+00:00", "total_charge": 1062.00}	{"total_cost": 308.58, "updated_at": "2025-09-09T18:47:16.300572+00:00", "total_charge": 1545.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:47:16.300572+00	{1353,1354,1355}	Migrated from 3 granular entries
92	program_template	2	UPDATE	{"total_cost": 308.58, "updated_at": "2025-09-09T18:47:16.300572+00:00", "total_charge": 1545.00}	{"total_cost": 555.51, "updated_at": "2025-09-09T18:47:43.784095+00:00", "total_charge": 2781.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:47:43.784095+00	{1357,1358,1359}	Migrated from 3 granular entries
93	program_template	2	UPDATE	{"total_cost": 555.51, "updated_at": "2025-09-09T18:47:43.784095+00:00", "total_charge": 2781.00}	{"total_cost": 343.38, "updated_at": "2025-09-09T18:51:26.019611+00:00", "total_charge": 1719.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:51:26.019611+00	{1374,1375,1376}	Migrated from 3 granular entries
94	program_template	9	INSERT	\N	{"created_at": "2025-09-09T20:49:35.265323+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "total_cost": 0.00, "updated_at": "2025-09-09T20:49:35.265323+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Testing Copy of tasks", "total_charge": 0.00, "margin_percentage": 0.00, "program_template_id": 9, "program_template_name": "James Test Template"}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 20:49:35.265323+00	{1394}	Migrated from 1 granular entries
95	program_template	9	UPDATE	{"total_cost": 0.00, "updated_at": "2025-09-09T20:49:35.265323+00:00", "total_charge": 0.00, "margin_percentage": 0.00}	{"total_cost": 25.16, "updated_at": "2025-09-09T22:01:01.00705+00:00", "total_charge": 126.00, "margin_percentage": 80.00}	{margin_percentage,total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 22:01:01.00705+00	{1396,1397,1398,1399}	Migrated from 4 granular entries
96	program_template	9	UPDATE	{"total_cost": 25.16, "updated_at": "2025-09-09T22:01:01.00705+00:00", "total_charge": 126.00}	{"total_cost": 216.16, "updated_at": "2025-09-09T22:01:22.745897+00:00", "total_charge": 1082.00}	{total_charge,total_cost,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 22:01:22.745897+00	{1401,1402,1403}	Migrated from 3 granular entries
97	program_template	9	UPDATE	{"updated_at": "2025-09-09T22:01:22.745897+00:00", "program_template_name": "James Test Template"}	{"updated_at": "2025-09-17T00:14:06.763818+00:00", "program_template_name": "James Test Template Saving Test"}	{program_template_name,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-17 00:14:06.763818+00	{1773,1774}	Migrated from 2 granular entries
98	program_template_items	34	INSERT	\N	{"quantity": 2, "created_at": "2025-09-04T03:36:03.56584+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 15, "updated_at": "2025-09-04T03:36:03.56584+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 7, "instructions": "testo", "days_from_start": 7, "program_template_id": 1, "program_template_items_id": 34}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:03.56584+00	{1101}	Migrated from 1 granular entries
99	program_template_items	35	INSERT	\N	{"quantity": 2, "created_at": "2025-09-04T03:36:03.642763+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 15, "updated_at": "2025-09-04T03:36:03.642763+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 7, "instructions": "testo", "days_from_start": 7, "program_template_id": 1, "program_template_items_id": 35}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:03.642763+00	{1102}	Migrated from 1 granular entries
100	program_template_items	36	INSERT	\N	{"quantity": 2, "created_at": "2025-09-04T03:36:04.701572+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 15, "updated_at": "2025-09-04T03:36:04.701572+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 7, "instructions": "testo", "days_from_start": 7, "program_template_id": 1, "program_template_items_id": 36}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:04.701572+00	{1108}	Migrated from 1 granular entries
101	program_template_items	34	UPDATE	{"updated_at": "2025-09-04T03:36:03.56584+00:00", "active_flag": true}	{"updated_at": "2025-09-04T03:36:17.586327+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:17.586327+00	{1113,1114}	Migrated from 2 granular entries
102	program_template_items	35	UPDATE	{"updated_at": "2025-09-04T03:36:03.642763+00:00", "active_flag": true}	{"updated_at": "2025-09-04T03:36:23.497958+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:36:23.497958+00	{1119,1120}	Migrated from 2 granular entries
103	program_template_items	37	INSERT	\N	{"quantity": 1, "created_at": "2025-09-04T03:55:10.882538+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 13, "updated_at": "2025-09-04T03:55:10.882538+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 1, "program_template_items_id": 37}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-04 03:55:10.882538+00	{1124}	Migrated from 1 granular entries
104	program_template_items	38	INSERT	\N	{"quantity": 2, "created_at": "2025-09-05T02:01:54.330976+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 14, "updated_at": "2025-09-05T02:01:54.330976+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 19, "instructions": "Testing", "days_from_start": 2, "program_template_id": 1, "program_template_items_id": 38}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:01:54.330976+00	{1144}	Migrated from 1 granular entries
105	program_template_items	39	INSERT	\N	{"quantity": 2, "created_at": "2025-09-05T02:02:51.556102+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 38, "updated_at": "2025-09-05T02:02:51.556102+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 2, "instructions": "One more save test", "days_from_start": 2, "program_template_id": 1, "program_template_items_id": 39}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:02:51.556102+00	{1149}	Migrated from 1 granular entries
106	program_template_items	36	UPDATE	{"updated_at": "2025-09-04T03:36:04.701572+00:00", "active_flag": true}	{"updated_at": "2025-09-05T02:03:27.604598+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:03:27.604598+00	{1154,1155}	Migrated from 2 granular entries
107	program_template_items	40	INSERT	\N	{"quantity": 1, "created_at": "2025-09-05T02:35:46.36578+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 41, "updated_at": "2025-09-05T02:35:46.36578+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 14, "program_template_id": 1, "program_template_items_id": 40}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:35:46.36578+00	{1159}	Migrated from 1 granular entries
108	program_template_items	41	INSERT	\N	{"quantity": 1, "created_at": "2025-09-05T02:36:49.256529+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 78, "updated_at": "2025-09-05T02:36:49.256529+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "test placment in grid", "days_from_start": 30, "program_template_id": 1, "program_template_items_id": 41}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:36:49.256529+00	{1164}	Migrated from 1 granular entries
109	program_template_items	42	INSERT	\N	{"quantity": 1, "created_at": "2025-09-05T02:38:49.658188+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 5, "updated_at": "2025-09-05T02:38:49.658188+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "sort order test", "days_from_start": 5, "program_template_id": 1, "program_template_items_id": 42}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 02:38:49.658188+00	{1169}	Migrated from 1 granular entries
110	program_template_items	43	INSERT	\N	{"quantity": 2, "created_at": "2025-09-05T19:36:01.343082+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 11, "updated_at": "2025-09-05T19:36:01.343082+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 3, "instructions": "This is now all set and I can move on to edit\\n", "days_from_start": 3, "program_template_id": 1, "program_template_items_id": 43}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 19:36:01.343082+00	{1174}	Migrated from 1 granular entries
111	program_template_items	29	UPDATE	{"updated_at": "2025-05-05T00:53:46.446857+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:05:17.53633+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:05:17.53633+00	{1179,1180}	Migrated from 2 granular entries
112	program_template_items	33	UPDATE	{"updated_at": "2025-06-11T01:28:51.600717+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:05:40.910112+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:05:40.910112+00	{1181,1182}	Migrated from 2 granular entries
113	program_template_items	37	UPDATE	{"updated_at": "2025-09-04T03:55:10.882538+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:08:38.67552+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:08:38.67552+00	{1183,1184}	Migrated from 2 granular entries
114	program_template_items	40	UPDATE	{"updated_at": "2025-09-05T02:35:46.36578+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:14:41.821054+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:14:41.821054+00	{1185,1186}	Migrated from 2 granular entries
115	program_template_items	39	UPDATE	{"updated_at": "2025-09-05T02:02:51.556102+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:18:14.443386+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:18:14.443386+00	{1191,1192}	Migrated from 2 granular entries
116	program_template_items	38	UPDATE	{"updated_at": "2025-09-05T02:01:54.330976+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:24:34.810679+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:24:34.810679+00	{1196,1197}	Migrated from 2 granular entries
117	program_template_items	41	UPDATE	{"updated_at": "2025-09-05T02:36:49.256529+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:29:56.610073+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:29:56.610073+00	{1202,1203}	Migrated from 2 granular entries
118	program_template_items	44	INSERT	\N	{"quantity": 4, "created_at": "2025-09-05T20:32:56.065087+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 58, "updated_at": "2025-09-05T20:32:56.065087+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 30, "instructions": "One more test", "days_from_start": 0, "program_template_id": 1, "program_template_items_id": 44}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:32:56.065087+00	{1208}	Migrated from 1 granular entries
119	program_template_items	44	UPDATE	{"updated_at": "2025-09-05T20:32:56.065087+00:00", "active_flag": true}	{"updated_at": "2025-09-05T20:33:29.564932+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:33:29.564932+00	{1212,1213}	Migrated from 2 granular entries
120	program_template_items	43	UPDATE	{"updated_at": "2025-09-05T19:36:01.343082+00:00"}	{"updated_at": "2025-09-05T20:44:17.647025+00:00"}	{updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:44:17.647025+00	{1217}	Migrated from 1 granular entries
121	program_template_items	43	UPDATE	{"quantity": 2, "updated_at": "2025-09-05T20:44:17.647025+00:00", "days_between": 3, "days_from_start": 3}	{"quantity": 10, "updated_at": "2025-09-05T20:45:02.595418+00:00", "days_between": 10, "days_from_start": 10}	{days_between,days_from_start,quantity,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:45:02.595418+00	{1219,1220,1221,1222}	Migrated from 4 granular entries
122	program_template_items	45	INSERT	\N	{"quantity": 2, "created_at": "2025-09-05T20:48:30.776297+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 25, "updated_at": "2025-09-05T20:48:30.776297+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 1, "program_template_items_id": 45}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 20:48:30.776297+00	{1226}	Migrated from 1 granular entries
123	program_template_items	46	INSERT	\N	{"quantity": 2, "created_at": "2025-09-05T21:09:35.67532+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 31, "updated_at": "2025-09-05T21:09:35.67532+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 4, "instructions": "Just showing off for Kami", "days_from_start": 8, "program_template_id": 1, "program_template_items_id": 46}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 21:09:35.67532+00	{1230}	Migrated from 1 granular entries
124	program_template_items	45	UPDATE	{"updated_at": "2025-09-05T20:48:30.776297+00:00", "active_flag": true}	{"updated_at": "2025-09-05T21:11:03.626658+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 21:11:03.626658+00	{1234,1235}	Migrated from 2 granular entries
125	program_template_items	42	UPDATE	{"updated_at": "2025-09-05T02:38:49.658188+00:00", "active_flag": true}	{"updated_at": "2025-09-09T18:28:53.666582+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:28:53.666582+00	{1332,1333}	Migrated from 2 granular entries
126	program_template_items	26	UPDATE	{"updated_at": "2025-05-05T00:35:22.028112+00:00", "active_flag": true}	{"updated_at": "2025-09-09T18:29:17.909299+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:29:17.909299+00	{1337,1338}	Migrated from 2 granular entries
127	program_template_items	37	UPDATE	{"updated_at": "2025-09-05T20:08:38.67552+00:00", "active_flag": false}	{"updated_at": "2025-09-09T18:34:12.947227+00:00", "active_flag": true}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:34:12.947227+00	{1342,1343}	Migrated from 2 granular entries
128	program_template_items	47	INSERT	\N	{"quantity": 3, "created_at": "2025-09-09T18:46:49.784788+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 11, "updated_at": "2025-09-09T18:46:49.784788+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 2, "program_template_items_id": 47}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:46:49.784788+00	{1347}	Migrated from 1 granular entries
129	program_template_items	48	INSERT	\N	{"quantity": 3, "created_at": "2025-09-09T18:47:15.722582+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 14, "updated_at": "2025-09-09T18:47:15.722582+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 2, "program_template_items_id": 48}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:47:15.722582+00	{1352}	Migrated from 1 granular entries
130	program_template_items	49	INSERT	\N	{"quantity": 3, "created_at": "2025-09-09T18:47:43.47195+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 21, "updated_at": "2025-09-09T18:47:43.47195+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 2, "program_template_items_id": 49}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:47:43.47195+00	{1356}	Migrated from 1 granular entries
131	program_template_items	47	UPDATE	{"updated_at": "2025-09-09T18:46:49.784788+00:00", "active_flag": true}	{"updated_at": "2025-09-09T18:51:25.596198+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 18:51:25.596198+00	{1372,1373}	Migrated from 2 granular entries
132	program_template_items	50	INSERT	\N	{"quantity": 2, "created_at": "2025-09-09T22:01:00.245176+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 15, "updated_at": "2025-09-09T22:01:00.245176+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 9, "program_template_items_id": 50}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 22:01:00.245176+00	{1395}	Migrated from 1 granular entries
133	program_template_items	51	INSERT	\N	{"quantity": 2, "created_at": "2025-09-09T22:01:22.096209+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "therapy_id": 31, "updated_at": "2025-09-09T22:01:22.096209+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "days_between": 0, "instructions": "", "days_from_start": 0, "program_template_id": 9, "program_template_items_id": 51}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 22:01:22.096209+00	{1400}	Migrated from 1 granular entries
134	status	9	DELETE	{"status_id": 9, "created_at": "2025-05-06T17:50:22.890342+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-05-06T17:50:29.018193+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "sadfsdfasd", "status_name": "Another Test"}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 16:46:42.36733+00	{431}	Migrated from 1 granular entries
135	status	8	DELETE	{"status_id": 8, "created_at": "2025-05-04T00:01:49.859316+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-05-04T00:01:49.859316+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "sadfasdfasdfasdf", "status_name": "sdfasdfasdfsdf"}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 16:46:42.457232+00	{432}	Migrated from 1 granular entries
136	status	11	INSERT	\N	{"status_id": 11, "created_at": "2025-09-03T18:01:19.062537+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-03T18:01:19.062537+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Use this status when you intended to follow up with the lead at some future date", "status_name": "Follow Up"}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 18:01:19.062537+00	{494}	Migrated from 1 granular entries
137	status	4	UPDATE	{"updated_at": "2025-04-28T02:56:24.163132+00:00", "status_name": "Member"}	{"updated_at": "2025-09-03T18:04:48.848601+00:00", "status_name": "Won"}	{status_name,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 18:04:48.848601+00	{495,496}	Migrated from 2 granular entries
138	status	12	INSERT	\N	{"status_id": 12, "created_at": "2025-09-03T18:39:43.624216+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-09-03T18:39:43.624216+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Temp status to clean up data", "status_name": "UNK"}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 18:39:43.624216+00	{497}	Migrated from 1 granular entries
139	status	1	UPDATE	{"updated_at": "2025-05-06T17:50:00.872262+00:00", "active_flag": false}	{"updated_at": "2025-09-05T21:30:47.761184+00:00", "active_flag": true}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 21:30:47.761184+00	{1239,1240}	Migrated from 2 granular entries
140	therapy_tasks	15	INSERT	\N	{"task_id": 15, "task_name": "Just a Test", "created_at": "2025-09-08T14:18:50.840959+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "task_delay": 0, "therapy_id": 14, "updated_at": "2025-09-08T14:18:50.840959+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Testing the creation of Therapy Tasks"}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-08 14:18:50.840959+00	{1241}	Migrated from 1 granular entries
141	therapy_tasks	3	UPDATE	{"updated_at": "2025-05-03T16:41:03.000716+00:00", "active_flag": true}	{"updated_at": "2025-09-08T16:55:36.058324+00:00", "active_flag": false}	{active_flag,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-08 16:55:36.058324+00	{1242,1243}	Migrated from 2 granular entries
142	therapy_tasks	16	INSERT	\N	{"task_id": 16, "task_name": "Another Test", "created_at": "2025-09-08T16:56:11.108217+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "task_delay": 6, "therapy_id": 13, "updated_at": "2025-09-08T16:56:11.108217+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "description": "Just testing add one more time"}	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-08 16:56:11.108217+00	{1244}	Migrated from 1 granular entries
143	therapy_tasks	16	UPDATE	{"task_delay": 6, "updated_at": "2025-09-08T16:56:11.108217+00:00"}	{"task_delay": -10, "updated_at": "2025-09-08T16:56:27.697331+00:00"}	{task_delay,updated_at}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-08 16:56:27.697331+00	{1245,1246}	Migrated from 2 granular entries
144	vendors	6	DELETE	{"email": "", "phone": "(281) 755-1799", "vendor_id": 6, "created_at": "2025-05-06T17:53:30.968711+00:00", "created_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "updated_at": "2025-07-03T04:59:59.604344+00:00", "updated_by": "a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a", "active_flag": true, "vendor_name": "asdfsdfsdf", "contact_person": "My Owja"}	\N	{}	\N	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 16:48:13.466869+00	{433}	Migrated from 1 granular entries
\.


--
-- Data for Name: bodies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bodies (body_id, body_name, description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.buckets (bucket_id, bucket_name, description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
16	Evaluation	Evaluation Category	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
17	Home Therapy	Home Therapy	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
18	Other	Other Cost (e.g. Tax)	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
19	Services	Services	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
20	Supplements	Supplments	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
21	Task	Coordinator Task	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
22	Taxes	Taxes for Retail	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
23	Tuition	Tution Costs	t	2025-04-28 20:12:52.566708+00	\N	2025-04-28 20:12:52.566708+00	\N
14	Diagnostics	Diagnostic	t	2025-04-28 20:12:52.566708+00	\N	2025-05-13 20:27:45.187412+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
15	Discount	Discounts	f	2025-04-28 20:12:52.566708+00	\N	2025-07-03 22:17:02.491266+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (campaign_id, campaign_name, campaign_date, description, confirmed_count, vendor_id, ad_spend, food_cost, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
24	S 10/22	2024-10-22	Spring Creek BBQ	18	3	637.00	750.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
25	S 10/29	2024-10-29	Spring Creek BBQ	31	3	408.00	550.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
26	S 11/12	2024-11-12	Lomonte's	34	3	557.00	650.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
27	S 11/19	2024-11-19	Lomonte's	41	3	1100.00	875.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
28	S 12/12	2024-12-12	Spring Creek BBQ	13	3	832.00	450.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
29	S 01/07	2025-01-07	Lomonte's	29	3	665.00	575.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
30	S01/14	2025-01-14	Lupe Tortilla	33	3	742.00	1400.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
31	W 1/15	2025-01-15	Demio	107	3	637.00	\N	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
32	W 1/22	2025-01-22	Demio	155	3	750.00	\N	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
33	S 01/28	2025-01-28	Spring Creek BBQ	42	3	748.00	750.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
34	W 1/29	2025-01-29	Demio	184	3	750.00	\N	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
35	S 02/04 	2025-02-04	Spring Creek BBQ	31	3	499.00	898.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
36	S 02/11	2025-02-11	Spring Creek BBQ	23	3	745.00	646.61	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
37	S 03/04	2025-03-04	Hasta La Pasta 	11	3	494.00	577.12	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
38	S 03/18	2025-03-18	Los Tios 	8	3	496.00	260.38	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
39	S 04/01	2025-04-01	Spring Creek BBQ	17	3	499.35	400.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
40	S 04/15	2025-04-15	Spring Creek BBQ Richmond	12	3	499.67	175.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
41	S 04/22	2025-04-22	Spring Creek BBQ Katy 	12	3	499.78	200.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
42	S 04/29	2025-04-29	Spring Creek BBQ Richmond	14	3	499.17	463.59	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
43	S 05/06	2025-05-06	Beck's Prime Katy	10	3	499.00	320.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
44	S 05/13	2025-05-13	Spring Creek BBQ Katy 	19	3	499.00	350.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
45	S 05/20	2025-05-20	Spring Creek BBQ Katy 	28	3	499.00	285.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
46	S 05/27	2025-05-27	Spring Creek BBQ Katy 	12	3	499.00	245.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
47	S 06/03	2025-06-03	Lomonte's	15	3	223.86	420.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
48	S 06/10	2025-06-10	Lomonte's	14	3	499.38	590.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
49	S 06/17	2025-06-17	Spring Creek Richmond 	22	3	997.00	510.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
50	S 06/24	2025-06-24	Lomonte's	19	3	999.00	500.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
51	S 07/15	2025-07-15	Lomonte's	33	3	998.76	775.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
52	S 07/01	2025-07-01	Lomonte's	17	3	999.00	752.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
53	S 07/22 	2025-07-22	Lomonte's 	31	3	687.86	1000.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
54	S 07/29	2025-07-29	Spring Creek BBQ Richmond	31	3	990.75	700.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
55	S 08/05	2025-08-05	Lomonte's	17	3	750.00	758.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
56	S 08/12	2025-08-12	Lomonte's	22	3	750.00	550.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
57	S 08/26	2025-08-26	Lomonte's	24	3	750.00	550.00	t	2025-09-03 17:26:47.55908+00	\N	2025-09-03 17:26:47.55908+00	\N
58	Referrals	2024-10-01	This for all leads that come to us via referrals. 	0	4	0.00	0.00	t	2025-09-03 17:31:06.966783+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 17:31:06.966783+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: financing_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.financing_types (financing_type_id, financing_type_name, financing_type_description, active_flag, created_at, created_by, updated_at, updated_by, financing_source) FROM stdin;
1	Full Payment	Full payment upfront	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N	internal
2	Financed - 3 Pay	Will make 3 equal payments	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 22:33:18.281148+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	internal
3	Financed - 6 Pay	Will make 6 payments.  The first payment will equal 25% of the total.  The remaining balance will be split between the 5 remaining payments	t	2025-09-10 22:34:41.071155+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-10 22:34:41.071155+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	internal
4	Financed - Patient Fi	Add the different amounts we are charged here	t	2025-09-15 01:17:13.670959+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-15 15:54:54.809796+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	external
5	Financed - Cherry 	Add the different finance charges here	t	2025-09-15 01:17:55.032847+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-15 15:55:04.109868+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	external
\.


--
-- Data for Name: lead_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_notes (note_id, lead_id, note_type, note, created_at, created_by) FROM stdin;
1	260	PME	rescheduled for next week. child is sick	2025-09-24 21:00:01.501445+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
2	260	Win	Really exited about her progress	2025-09-24 21:02:52.701831+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	260	Challenge	This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. This an example of a Challange. 	2025-09-24 21:13:18.238436+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
4	260	Other	Now I have 1 of each type of note\n	2025-09-24 21:20:59.268033+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
5	260	PME	Just one more test for note count	2025-09-24 21:23:45.203813+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
6	260	Other	.... and one more test	2025-09-24 21:29:48.566773+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
7	150	PME	This is a test of Ally Hollas	2025-09-24 21:41:33.693508+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
8	150	PME	Just testing from the Leads grid	2025-09-24 21:49:28.536272+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (lead_id, first_name, last_name, email, phone, status_id, campaign_id, pmedate, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
5	Janet	Cobb	update@later.com	2813334444	2	52	2025-10-01	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
6	Scot	Welch	update@later.com	2813334445	2	57	2025-09-26	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
7	Tammy	Welch	update@later.com	2813334446	2	57	2025-09-26	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
8	Kim	Justice	update@later.com	2813334447	2	57	2025-09-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
9	Vivian	Bell	update@later.com	2813334448	2	57	2025-09-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
10	Andrea	Federico	update@later.com	2813334449	2	57	2025-09-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
11	Tiffany	Maldonado	update@later.com	2813334450	2	55	2025-09-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
12	Mary Katherine	Maldonado	update@later.com	2813334451	2	55	2025-09-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
13	Erin	Deal	update@later.com	2813334452	2	57	2025-09-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
14	Dan	Ajamiseba	update@later.com	2813334453	2	57	2025-09-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
15	Chris	Ajamiseba	update@later.com	2813334454	2	57	2025-09-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
16	Amado	Sanchez	update@later.com	2813334455	2	57	2025-09-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
17	Peter	Schreurs	update@later.com	2813334456	2	57	2025-09-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
18	Giselda	Schreurs	update@later.com	2813334457	2	57	2025-09-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
19	Lucy	Sanchez	update@later.com	2813334458	2	57	2025-09-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
20	Myrna	Owen	update@later.com	2813334459	2	53	2025-09-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
21	Carlisa	Sanders	update@later.com	2813334460	2	56	2025-09-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
22	Yvette	Dillon	update@later.com	2813334461	2	56	2025-09-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
23	Margie	Love	update@later.com	2813334462	2	57	2025-09-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
24	Michael	Baumgarn	update@later.com	2813334463	2	56	2025-09-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
25	Connie	Baumgarn	update@later.com	2813334464	2	56	2025-09-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
26	Beverly	Barbia	update@later.com	2813334465	2	57	2025-09-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
27	Francisco	Rojas	update@later.com	2813334466	2	55	2025-09-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
28	Radja	Rojas	update@later.com	2813334467	2	55	2025-09-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
29	Shelley	Butler	update@later.com	2813334468	2	52	2025-09-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
30	Terril	Butler	update@later.com	2813334469	2	52	2025-09-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
31	Marie	Ely	update@later.com	2813334470	2	54	2025-09-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
32	Terry	Ely	update@later.com	2813334471	2	54	2025-09-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
33	Readri	Epps	update@later.com	2813334472	2	54	2025-09-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
34	Michael	Lincoln	update@later.com	2813334473	2	54	2025-09-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
35	Marisol	Ponce	update@later.com	2813334474	2	56	2025-09-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
36	Amy	Davis	update@later.com	2813334475	2	51	2025-09-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
37	Felicia	Crawford	update@later.com	2813334476	11	54	2025-09-02	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
38	Lorraine	Day	update@later.com	2813334477	11	58	2025-08-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
39	Allison	McKinney	update@later.com	2813334478	4	58	2025-08-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
40	Toni	Whitaker	update@later.com	2813334479	3	56	2025-08-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
41	Brian	Joseph	update@later.com	2813334480	11	46	2025-08-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
42	Pam	Joseph	update@later.com	2813334481	11	46	2025-08-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
43	Lorraine	Day	update@later.com	2813334482	3	55	2025-08-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
44	Douglas	Brown	update@later.com	2813334483	11	53	2025-08-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
45	Susan	Gaddis	update@later.com	2813334484	3	56	2025-08-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
46	Paul	Gopal	update@later.com	2813334485	4	55	2025-08-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
47	Eden	Gopal	update@later.com	2813334486	4	55	2025-08-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
48	Sonia	Murphy	update@later.com	2813334487	3	51	2025-08-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
49	Yolanda	Rahbani	update@later.com	2813334488	11	53	2025-08-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
50	Yvette	Carlisi	update@later.com	2813334489	11	47	2025-08-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
51	Pedro	Torres	update@later.com	2813334490	11	47	2025-08-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
52	Sandra	Murphy	update@later.com	2813334491	11	53	2025-08-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
53	Molly	Plant	update@later.com	2813334492	3	53	2025-08-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
54	Chuck	Strang	update@later.com	2813334493	3	53	2025-08-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
55	Kathi	Murphy	update@later.com	2813334494	11	53	2025-08-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
56	Mary	Ferguson	update@later.com	2813334495	11	54	2025-08-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
57	Valeri	Russell	update@later.com	2813334496	11	53	2025-08-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
58	Jennifer	Williams	update@later.com	2813334497	3	53	2025-08-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
59	Roman	Mejia	update@later.com	2813334498	11	58	2025-08-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
60	Jasmine	Naderi	update@later.com	2813334499	4	51	2025-08-08	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
61	Albert	Savior	update@later.com	2813334500	3	53	2025-08-07	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
62	Minnie	Savior	update@later.com	2813334501	3	53	2025-08-07	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
63	Summer	Howard	update@later.com	2813334502	3	53	2025-08-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
64	Marlene	Lillie	update@later.com	2813334503	3	51	2025-08-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
65	Katrina	Resendez	update@later.com	2813334504	3	53	2025-08-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
66	Neni	Navarrete	update@later.com	2813334505	4	53	2025-08-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
67	Veonica	Lewis Caldwell	update@later.com	2813334506	2	57	2025-09-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
68	Elizabeth	Kirkman	update@later.com	2813334507	11	53	2025-07-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
69	Gary	Kirkman	update@later.com	2813334508	11	53	2025-07-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
70	Cindy	Payne	update@later.com	2813334509	11	54	2025-07-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
71	Raye	Thompson	update@later.com	2813334510	3	49	2025-07-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
72	Erin	Veronie	update@later.com	2813334511	4	58	2025-07-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
73	Sanae	Alexander	update@later.com	2813334512	11	48	2025-07-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
74	Deborah	Olohunfemi	update@later.com	2813334513	3	53	2025-07-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
75	Sharon	Olohunfemi	update@later.com	2813334514	3	53	2025-07-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
76	Terry	Davis	update@later.com	2813334515	3	51	2025-07-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
77	Barbara	Hill	update@later.com	2813334516	3	51	2025-07-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
78	Michael	Khalaf	update@later.com	2813334517	2	57	2025-09-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
79	Hibba	Khalifa	update@later.com	2813334518	3	58	2025-07-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
80	Mary	Broussard	update@later.com	2813334519	3	49	2025-07-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
82	Allison	Droddy	update@later.com	2813334521	11	58	2025-07-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
83	Karen	Harpold	update@later.com	2813334522	3	51	2025-07-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
84	Malka	Shivdasani	update@later.com	2813334523	3	58	2025-07-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
85	Tamara	McFarlane	update@later.com	2813334524	3	58	2025-07-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
86	Brad	McFarlane	update@later.com	2813334525	3	58	2025-07-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
87	Darlene	Green	update@later.com	2813334526	4	58	2025-06-27	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
88	E Chinyere	Nwanna	update@later.com	2813334527	3	50	2025-06-26	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
89	Charlie	Williams	update@later.com	2813334528	4	58	2025-06-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
90	Kim	Williams	update@later.com	2813334529	4	58	2025-06-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
91	Sehar	Javed	update@later.com	2813334530	4	37	2025-06-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
92	Elena	Gomez	update@later.com	2813334531	3	47	2025-06-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
93	Joseph	Latson	update@later.com	2813334532	3	47	2025-06-13	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
94	Bianca	Schoeffling	update@later.com	2813334533	3	46	2025-06-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
95	Anabelle	Peek	update@later.com	2813334534	3	47	2025-06-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
96	Barbara	Haverstock	update@later.com	2813334535	4	46	2025-06-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
97	Brenda	Benavidez	update@later.com	2813334536	3	44	2025-06-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
98	Geneva	Hamilton	update@later.com	2813334537	3	44	2025-06-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
99	Elizabeth	Neal	update@later.com	2813334538	3	44	2025-06-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
100	Mery	Martinez	update@later.com	2813334539	3	43	2025-06-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
101	William	Umanzor	update@later.com	2813334540	3	43	2025-06-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
102	Hope	Lindemann	update@later.com	2813334541	3	44	2025-06-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
103	Chelsea	Engel	update@later.com	2813334542	3	58	2025-06-02	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
104	Jeremy	Engel	update@later.com	2813334543	3	58	2025-06-02	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
105	Pam	Stewart	update@later.com	2813334544	4	58	2025-05-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
106	James	Gregory	update@later.com	2813334545	3	42	2025-05-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
107	Brenna	Gregory	update@later.com	2813334546	3	42	2025-05-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
108	Silva	Nicasio	update@later.com	2813334547	4	58	2025-05-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
109	Susan	Sparling	update@later.com	2813334548	3	45	2025-05-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
110	Pilarita	Villalva	update@later.com	2813334549	4	39	2025-05-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
111	Jane	Moughon	update@later.com	2813334550	3	42	2025-05-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
112	Wendy	Ross	update@later.com	2813334551	3	42	2025-05-20	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
113	Carol	Kostelnik	update@later.com	2813334552	3	58	2025-05-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
114	Nicholas	Kostelnik	update@later.com	2813334553	3	58	2025-05-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
115	Monica	McCune	update@later.com	2813334554	4	58	2025-05-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
116	Carol	Chin	update@later.com	2813334555	3	39	2025-05-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
117	Kirk	Chin	update@later.com	2813334556	3	39	2025-05-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
118	Jenna	Jankowski	update@later.com	2813334557	4	58	2025-05-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
119	Ryan	Jankowski	update@later.com	2813334558	4	58	2025-05-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
120	Cory	Odstrcil	update@later.com	2813334559	3	58	2025-05-01	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
121	Diane	Odstrcil	update@later.com	2813334560	3	58	2025-05-01	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
122	Jacqueline	Hines	update@later.com	2813334561	3	40	2025-04-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
123	Craig	Reiners	update@later.com	2813334562	4	58	2025-04-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
124	Donna	Reiners	update@later.com	2813334563	4	58	2025-04-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
125	Jennie	Sime	update@later.com	2813334564	4	58	2025-04-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
126	Steven	Mondshine	update@later.com	2813334565	3	58	2025-04-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
127	Shelley	Wenzel	update@later.com	2813334566	3	58	2025-04-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
128	Johnnie	Pennie	update@later.com	2813334567	4	39	2025-04-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
129	Grant	Stewart	update@later.com	2813334568	4	58	2025-04-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
130	Ta Shunda	Joiner	update@later.com	2813334569	3	40	2025-04-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
131	Sandra	Buelto	update@later.com	2813334570	3	39	2025-04-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
132	Alice	Alvarado	update@later.com	2813334571	3	39	2025-04-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
133	Marie	Barclay	update@later.com	2813334572	3	40	2025-04-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
134	Shohab	Kurjee	update@later.com	2813334573	3	58	2025-04-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
135	Betty	Baber	update@later.com	2813334574	3	26	2025-04-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
136	Lorraine	Fox	update@later.com	2813334575	3	37	2025-04-08	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
137	Mathea	Volesky	update@later.com	2813334576	3	35	2025-04-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
138	Brittany	Sheffield	update@later.com	2813334577	4	58	2025-04-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
139	Jeff	Denison	update@later.com	2813334578	4	58	2025-04-01	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
140	Kaylen	Denison	update@later.com	2813334579	4	58	2025-04-01	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
141	Erin	Hughes	update@later.com	2813334580	4	58	2025-03-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
142	Frank	Petras	update@later.com	2813334581	4	58	2025-03-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
143	Sharon	Staats	update@later.com	2813334582	3	38	2025-03-27	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
144	Dalmita	Velilla-Turner	update@later.com	2813334583	3	58	2025-03-26	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
145	Linda	Hayes	update@later.com	2813334584	3	36	2025-03-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
146	Sheila	Bernard	update@later.com	2813334585	3	58	2025-03-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
147	Paula	Wooten	update@later.com	2813334586	3	58	2025-03-20	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
148	Andrea	Wooten	update@later.com	2813334587	4	58	2025-03-20	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
149	Abraham	John	update@later.com	2813334588	3	36	2025-03-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
150	Ally	Hollas	update@later.com	2813334589	4	58	2025-03-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
151	Beena	John	update@later.com	2813334590	4	36	2025-03-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
152	Jessica	Coreas	update@later.com	2813334591	3	35	2025-03-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
153	Maria	Coreas	update@later.com	2813334592	3	35	2025-03-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
154	Hein	Edgar	update@later.com	2813334593	3	35	2025-03-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
155	Henry	Edgar	update@later.com	2813334594	3	35	2025-03-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
156	Jautaunne	Mack	update@later.com	2813334595	3	35	2025-03-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
157	Marit	Deipolyi	update@later.com	2813334596	4	37	2025-03-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
158	Veronica	Mabasa	update@later.com	2813334597	4	58	2025-03-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
159	Joseph	Green	update@later.com	2813334598	3	36	2025-02-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
160	Mishe	Nesbitt	update@later.com	2813334599	3	36	2025-02-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
161	Patty	Sanders	update@later.com	2813334600	4	58	2025-02-27	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
162	Russell	Sackett	update@later.com	2813334601	3	35	2025-02-13	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
163	Pam	Sackett	update@later.com	2813334602	4	35	2025-02-13	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
164	Melissa	Farr	update@later.com	2813334603	3	58	2025-02-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
165	Kassia	Reid	update@later.com	2813334604	3	35	2025-02-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
166	Andrea	Beaver	update@later.com	2813334605	3	58	2025-02-07	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
167	Christina	Molina	update@later.com	2813334606	4	58	2025-02-07	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
168	Laxmi	Sandhu	update@later.com	2813334607	3	33	2025-02-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
169	Sandra	Sawyer	update@later.com	2813334608	4	58	2025-02-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
170	Dixie	Sanders	update@later.com	2813334609	3	58	2025-02-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
171	Gary	Somberg	update@later.com	2813334610	3	58	2025-01-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
172	Julian	Lightfoot	update@later.com	2813334611	3	58	2025-01-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
173	Ja'net	Reid- Jones	update@later.com	2813334612	3	28	2025-01-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
174	Sylvia	Rodriquez	update@later.com	2813334613	3	58	2025-01-27	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
175	Adele	Kline	update@later.com	2813334614	3	58	2025-01-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
176	Wilonda	Short	update@later.com	2813334615	3	31	2025-01-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
177	Chamara	Harris	update@later.com	2813334616	3	29	2025-01-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
178	Ann	Sontag	update@later.com	2813334617	4	58	2025-01-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
179	Ron	Sontag	update@later.com	2813334618	4	58	2025-01-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
180	Skip	Woods	update@later.com	2813334619	3	58	2025-01-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
181	Cammie	Mabry	update@later.com	2813334620	4	58	2025-01-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
182	Valerie	Erickson	update@later.com	2813334621	3	58	2025-01-07	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
183	Norma	Gutierez	update@later.com	2813334622	3	27	2025-01-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
184	Suzanne	Scott	update@later.com	2813334623	3	58	2024-12-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
185	Susan	Baca	update@later.com	2813334624	3	58	2024-12-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
186	Michael	Thaxton	update@later.com	2813334625	3	58	2024-12-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
187	Andrea	Villagas	update@later.com	2813334626	3	58	2024-12-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
188	Alisa	Shawn	update@later.com	2813334627	4	58	2024-12-13	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
189	LeeAnn	Moppin	update@later.com	2813334628	3	27	2024-12-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
190	Gregory	Adell	update@later.com	2813334629	3	58	2024-12-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
191	Kim	Alverado	update@later.com	2813334630	3	27	2024-12-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
192	Debbie	Elder	update@later.com	2813334631	4	27	2024-12-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
193	Keith	Elder	update@later.com	2813334632	4	27	2024-12-11	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
194	Stacie	Phillips	update@later.com	2813334633	4	58	2024-12-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
195	Marie	McBride	update@later.com	2813334634	4	58	2024-12-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
196	Christeyne	Althaus	update@later.com	2813334635	3	27	2024-12-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
197	Rick	Myers	update@later.com	2813334636	4	26	2024-12-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
198	Traci	Myers	update@later.com	2813334637	4	26	2024-12-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
199	Lexie	Melancon	update@later.com	2813334638	3	58	2024-12-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
200	Rox-Ann	Batiste	update@later.com	2813334639	4	25	2024-12-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
201	Matthew	Bentley	update@later.com	2813334640	4	58	2024-11-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
202	Mary Jo	Conklin	update@later.com	2813334641	3	58	2024-11-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
203	Niki	Cage	update@later.com	2813334642	3	25	2024-11-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
204	Cynthia	Enriquez	update@later.com	2813334643	4	58	2024-11-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
205	Kathy	Aldredge	update@later.com	2813334644	4	25	2024-11-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
206	Michael	Bohny	update@later.com	2813334645	4	58	2024-11-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
207	Dana	Bentley	update@later.com	2813334646	4	58	2024-11-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
208	Cindy	Pace	update@later.com	2813334647	3	58	2024-11-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
209	Maddison	Hendrickson	update@later.com	2813334648	4	58	2024-11-06	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
210	Suzanne	Itani	update@later.com	2813334649	4	58	2024-11-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
211	Andrea	Reyhons	update@later.com	2813334650	4	25	2024-11-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
212	Jean	Dragoo	update@later.com	2813334651	3	24	2024-10-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
213	Beth	Porlier	update@later.com	2813334652	3	58	2024-10-31	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
214	Derek	Rolle	update@later.com	2813334653	4	24	2024-10-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
215	Kim	Phillips-Rolle	update@later.com	2813334654	4	24	2024-10-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
216	Elizabeth	Estranda	update@later.com	2813334655	3	58	2024-10-28	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
217	Janet	Mahaltic	update@later.com	2813334656	4	58	2024-10-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
218	Daniel	Villarreal	update@later.com	2813334657	4	58	2024-10-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
219	Ailia	Villarreal	update@later.com	2813334658	4	58	2024-10-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
220	Terry	Graham	update@later.com	2813334659	3	58	2024-10-23	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
221	Tamy	Guess	update@later.com	2813334660	3	58	2024-10-21	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
222	Michael	Adam	update@later.com	2813334661	4	58	2024-10-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
223	Rebekkah	Clark	update@later.com	2813334662	4	58	2024-10-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
224	Betty	Tashnek	update@later.com	2813334663	4	58	2024-10-09	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
225	Donna	Hanus	update@later.com	2813334664	4	58	2024-09-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
226	Sophia	Stahl	update@later.com	2813334665	4	58	2024-09-19	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
227	Rhonda	Falgoust	update@later.com	2813334666	4	58	2024-08-15	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
228	Peter	Poranski	update@later.com	2813334667	4	58	2024-08-08	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
229	Susan	Hertlein	update@later.com	2813334668	4	58	2024-08-07	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
230	Bob	Schmidt	update@later.com	2813334669	4	58	2024-08-02	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
231	Lindsay	Wagner	update@later.com	2813334670	4	58	2024-07-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
232	Dan	Sheehy	update@later.com	2813334671	4	58	2024-07-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
233	Elizabeth	Dewey	update@later.com	2813334672	4	58	2024-07-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
234	Grace	Jacob	update@later.com	2813334673	4	58	2024-07-01	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
235	Tara	Copley	update@later.com	2813334674	4	58	2024-06-17	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
236	Holly	Jacob	update@later.com	2813334675	4	58	2024-06-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
237	Aaron A.J.	Mergle	update@later.com	2813334676	4	58	2024-06-10	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
238	Teresa	McCaskill	update@later.com	2813334677	4	58	2024-05-30	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
239	Jacqueline	Sparks	update@later.com	2813334678	4	58	2024-05-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
240	Carlyle	Fraser	update@later.com	2813334679	4	58	2024-05-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
241	Gloria	Bobbitt	update@later.com	2813334680	4	58	2024-05-20	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
242	Linda	Mack	update@later.com	2813334681	4	58	2024-05-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
243	Katrina	Nutt	update@later.com	2813334682	4	58	2024-05-14	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
244	Holly	Robideau	update@later.com	2813334683	4	58	2024-04-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
245	Mike	Robideau	update@later.com	2813334684	4	58	2024-04-29	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
246	Mary Jo	Mercer	update@later.com	2813334685	4	58	2024-04-26	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
247	Charles	Thomas	update@later.com	2813334686	4	58	2024-04-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
248	Stacey	Thomas	update@later.com	2813334687	4	58	2024-04-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
249	Dawn	Maruska	update@later.com	2813334688	4	58	2024-04-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
250	Vincent	Maruska	update@later.com	2813334689	4	58	2024-04-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
251	Mike	Roche	update@later.com	2813334690	4	58	2024-04-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
252	Dee	Fraser	update@later.com	2813334691	4	58	2024-04-16	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
253	Mike	McCaskill	update@later.com	2813334692	4	58	2024-04-05	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
254	Elba/Eddie	McNeill	update@later.com	2813334693	4	58	2024-04-03	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
255	Angerla	Claypool	update@later.com	2813334694	4	58	2024-04-02	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
256	Brenda	Mullinix	update@later.com	2813334695	4	58	2024-03-25	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
257	Marjorie	Pierce	update@later.com	2813334696	4	58	2024-03-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
258	Skye	Smith	update@later.com	2813334697	4	58	2024-03-12	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
259	Chau	Duong	update@later.com	2813334698	3	57	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
260	Donna	Khalaf	update@later.com	2813334699	2	57	2025-09-18	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
261	Janet	Lavong	update@later.com	2813334700	2	53	2025-09-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
262	Veronica	Berry	update@later.com	2813334701	3	57	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
263	Karl	Watson	update@later.com	2813334702	2	53	2025-09-22	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
264	Kate	Duvivier	update@later.com	2813334703	3	57	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
265	Gertrude	Chikweke	update@later.com	2813334704	3	57	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
266	CeAnne	Ochel	update@later.com	2813334705	12	51	2025-07-24	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
267	Julie	Wolf	update@later.com	2813334706	12	56	2025-08-04	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
268	Gayle	Christie	update@later.com	2813334707	11	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
269	Kimberly	Constanzo	update@later.com	2813334708	11	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
270	Nancy	Cottrell	update@later.com	2813334709	11	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
271	Joe	Garza	update@later.com	2813334710	11	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
272	Teresita	Gonzales	update@later.com	2813334711	11	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
273	Andrea	Greak	update@later.com	2813334712	11	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
274	Taylor	Hughes	update@later.com	2813334713	11	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
275	Katie	Knuth	update@later.com	2813334714	11	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
276	Carmen	Leal-Chavez	update@later.com	2813334715	11	40	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
277	Arnette	Morrison	update@later.com	2813334716	11	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
278	Julia	Zimmerman	update@later.com	2813334717	11	38	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
279	Tina	Zoes	update@later.com	2813334718	11	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
280	Annie	Montgomery	update@later.com	2813334719	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
281	Leticia	Rodriquez	update@later.com	2813334720	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
282	Shazia	Zaman	update@later.com	2813334721	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
283	Donna	Schuchardt	update@later.com	2813334722	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
284	Shayla	Thompson	update@later.com	2813334723	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
285	Jeanne	Dazey	update@later.com	2813334724	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
286	Ethna	McBride	update@later.com	2813334725	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
287	Duane	Hemminser	update@later.com	2813334726	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
288	Martha	Hemminser	update@later.com	2813334727	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
289	Terrence	Parker	update@later.com	2813334728	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
290	Rhonda	Perkins	update@later.com	2813334729	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
291	Deborah	Cole	update@later.com	2813334730	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
292	Jason	Murphy	update@later.com	2813334731	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
293	Kathy	Bowlin	update@later.com	2813334732	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
294	Dasia	Coulter	update@later.com	2813334733	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
295	John	Steele	update@later.com	2813334734	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
296	Julie	Steele	update@later.com	2813334735	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
297	Carol	Segova	update@later.com	2813334736	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
298	Elizabeth	Martin	update@later.com	2813334737	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
299	Myra	Faruki	update@later.com	2813334738	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
300	Jessica	Brazda	update@later.com	2813334739	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
301	Jacquelin	Zivley	update@later.com	2813334740	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
302	Marilyn	Taylor	update@later.com	2813334741	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
303	Marisela	Rodriquez	update@later.com	2813334742	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
304	Yemi	Akin	update@later.com	2813334743	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
305	Andy	Casey	update@later.com	2813334744	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
306	Ronald	Reid-Jones	update@later.com	2813334745	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
307	Nancy	Holcomb	update@later.com	2813334746	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
308	April	Vaughan	update@later.com	2813334747	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
309	Delores	Morales	update@later.com	2813334748	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
310	Beliquis	Essa	update@later.com	2813334749	3	47	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
311	Fred	Wenzel	update@later.com	2813334750	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
312	Akil	Kurji	update@later.com	2813334751	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
313	Constance	Owens	update@later.com	2813334752	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
314	Tina	Rigsby	update@later.com	2813334753	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
315	Wonda	W	update@later.com	2813334754	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
316	Vonda	Stokes	update@later.com	2813334755	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
317	Tuyet	Duong	update@later.com	2813334756	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
318	Salma	Katchi	update@later.com	2813334757	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
319	Rosa	Castillo	update@later.com	2813334758	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
320	Meenu	Jacob	update@later.com	2813334759	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
321	Maria	Miranda	update@later.com	2813334760	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
322	Elaine	Demar	update@later.com	2813334761	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
323	Ernestine	Dumaka	update@later.com	2813334762	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
324	Connie	Beckham	update@later.com	2813334763	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
325	Brenda	Duglas	update@later.com	2813334764	3	56	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
326	Madeline	Barrios	update@later.com	2813334765	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
327	Susan	Jackson	update@later.com	2813334766	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
328	Rumki	Dasgupta	update@later.com	2813334767	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
329	Jackie	Green	update@later.com	2813334768	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
330	Earline	Okruhlik	update@later.com	2813334769	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
331	Chinyere	Ogbonna	update@later.com	2813334770	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
332	Alice	Mok	update@later.com	2813334771	3	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
333	Sajida	Abbasi	update@later.com	2813334772	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
334	Tanya	Acosta	update@later.com	2813334773	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
335	Deborah	Adams	update@later.com	2813334774	3	43	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
336	Shane	Addison	update@later.com	2813334775	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
337	Nancy	Aguilera	update@later.com	2813334776	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
338	Anu	Ahluwalia	update@later.com	2813334777	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
339	Claudia	Alaron	update@later.com	2813334778	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
340	Angela	Albert	update@later.com	2813334779	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
341	Leticia	Albright	update@later.com	2813334780	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
342	Wynelle	Alexander	update@later.com	2813334781	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
343	Pamela	Allado	update@later.com	2813334782	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
344	Dr. Evelyn	Altinger	update@later.com	2813334783	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
345	Carroll	Anderson	update@later.com	2813334784	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
346	Pam	Andrews	update@later.com	2813334785	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
347	Catrina	Angel	update@later.com	2813334786	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
348	Lauren	Anne	update@later.com	2813334787	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
349	Amy	Appelt	update@later.com	2813334788	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
350	Anna	Arjumandi	update@later.com	2813334789	3	45	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
351	Bega	Ayala	update@later.com	2813334790	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
352	Jose	Ayala	update@later.com	2813334791	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
353	Jamie	Bakhtiary	update@later.com	2813334792	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
354	Carolina	Baling Raphail	update@later.com	2813334793	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
355	Darlene	Banks	update@later.com	2813334794	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
356	Cynthia	Barefield	update@later.com	2813334795	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
357	Angela	Barlaan	update@later.com	2813334796	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
358	Nekiesha	Barnes	update@later.com	2813334797	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
359	Diana	Barrinuevo	update@later.com	2813334798	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
360	Madona	Barrinuevo	update@later.com	2813334799	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
361	Nadiia	Barrios	update@later.com	2813334800	3	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
362	Tinya	Bassett	update@later.com	2813334801	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
363	Carl	Bates	update@later.com	2813334802	3	43	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
364	Carla	Bates	update@later.com	2813334803	3	43	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
365	Cindy	Baum	update@later.com	2813334804	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
366	Kathy	Bedwell	update@later.com	2813334805	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
367	Portia	Bell	update@later.com	2813334806	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
368	Patricia	Betancourt	update@later.com	2813334807	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
369	Kim	Bissell	update@later.com	2813334808	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
370	Stacey	Black	update@later.com	2813334809	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
371	Deborah	Blake	update@later.com	2813334810	3	45	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
372	Bou	Boeun	update@later.com	2813334811	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
373	Zenaida	Boeun	update@later.com	2813334812	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
374	Diane	Boleware	update@later.com	2813334813	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
375	Florida	Bomongcao	update@later.com	2813334814	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
376	Regina	Bonier	update@later.com	2813334815	3	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
377	Jessica	Boota	update@later.com	2813334816	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
378	Danielle	Bradley	update@later.com	2813334817	3	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
379	Fanny	Briceno	update@later.com	2813334818	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
380	Anne	Brock	update@later.com	2813334819	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
381	Anjela	Byer	update@later.com	2813334820	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
382	Isabel	Byrd	update@later.com	2813334821	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
383	Melinda	Calvin	update@later.com	2813334822	3	37	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
384	Amparo	Camba	update@later.com	2813334823	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
385	Patricia	Campbell	update@later.com	2813334824	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
386	Eve	Cartwright	update@later.com	2813334825	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
387	Julie	Castillo	update@later.com	2813334826	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
388	Hilaria	Cavasos	update@later.com	2813334827	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
389	Kenae	Chatham	update@later.com	2813334828	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
390	Millie	Chatham	update@later.com	2813334829	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
391	Linda	Cherry Chessrt	update@later.com	2813334830	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
392	Ruth	Chin	update@later.com	2813334831	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
393	Megan	Cho	update@later.com	2813334832	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
394	Marvic	Collado	update@later.com	2813334833	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
395	Katie	Coopedge	update@later.com	2813334834	3	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
396	Tonya	Cotton	update@later.com	2813334835	3	40	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
397	Estell	Cunningham	update@later.com	2813334836	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
398	Don	Curtis	update@later.com	2813334837	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
399	Greta	Curtis	update@later.com	2813334838	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
400	Vivek	Dabholkar	update@later.com	2813334839	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
401	Anne	Davis	update@later.com	2813334840	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
402	Lennice	Dawson	update@later.com	2813334841	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
403	Gracie	Deason	update@later.com	2813334842	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
404	Lourdes	DeLeon	update@later.com	2813334843	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
405	Mel	Dmello	update@later.com	2813334844	3	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
406	Nora	Dulfo	update@later.com	2813334845	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
407	Lesley	Durgin	update@later.com	2813334846	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
408	Joe	Ecrette	update@later.com	2813334847	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
409	Nichole	Edwards	update@later.com	2813334848	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
410	Zary	Eghterafi	update@later.com	2813334849	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
411	Luna	Elk	update@later.com	2813334850	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
412	Georgiana	Emereile	update@later.com	2813334851	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
413	Teresita	Enriquez	update@later.com	2813334852	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
414	Barbara	Espinosa	update@later.com	2813334853	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
415	Velda	Faulkner	update@later.com	2813334854	3	45	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
416	Willette	Fears	update@later.com	2813334855	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
417	Laurie	Felske	update@later.com	2813334856	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
418	Maria	Flores	update@later.com	2813334857	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
419	Erma	Franklin Giles	update@later.com	2813334858	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
420	Tenesha	Gill	update@later.com	2813334859	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
421	Victor	Go	update@later.com	2813334860	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
422	Linda	Godfrey	update@later.com	2813334861	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
423	Diamond	Gomez	update@later.com	2813334862	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
424	Lira	Gomez	update@later.com	2813334863	3	44	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
425	Carol	Grant	update@later.com	2813334864	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
426	Robin	Green	update@later.com	2813334865	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
427	Effie	Greer	update@later.com	2813334866	3	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
428	Fred	Gregory	update@later.com	2813334867	3	46	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
429	Katherine	Gregory	update@later.com	2813334868	3	46	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
430	Domitila	Guerra	update@later.com	2813334869	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
431	Jennifer	Gutierrez	update@later.com	2813334870	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
432	Lareque	Hainsworth	update@later.com	2813334871	3	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
433	Omaira	Hanif	update@later.com	2813334872	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
434	Carol	Harris	update@later.com	2813334873	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
435	Patricia	Harris	update@later.com	2813334874	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
436	Terri	Harrison	update@later.com	2813334875	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
437	Uzma	Hashemi	update@later.com	2813334876	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
438	Michelle	Hawkins	update@later.com	2813334877	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
439	Michelle	Hawkins	update@later.com	2813334878	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
440	Rhonda	Heaard	update@later.com	2813334879	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
441	Pamela	Henry	update@later.com	2813334880	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
442	Jacqueline	Hicks	update@later.com	2813334881	3	45	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
443	Hai	Hoang	update@later.com	2813334882	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
444	Linda	Hofman	update@later.com	2813334883	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
445	Duvarra	Hollins	update@later.com	2813334884	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
446	Precious	Hollins	update@later.com	2813334885	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
447	Glenda	Holmes	update@later.com	2813334886	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
448	Misty	Holsinger	update@later.com	2813334887	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
450	Betty	Humphrey	update@later.com	2813334889	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
451	Farazia	Imam	update@later.com	2813334890	3	43	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
452	Kaukab	Jafry	update@later.com	2813334891	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
454	Darlene	Johnson	update@later.com	2813334893	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
455	Lois	Johnson	update@later.com	2813334894	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
456	Susan	Johnson	update@later.com	2813334895	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
457	Belinda	Jones	update@later.com	2813334896	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
458	Billie Joyce	Jones	update@later.com	2813334897	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
459	Diane	Jones	update@later.com	2813334898	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
460	Charlene	Joswaik	update@later.com	2813334899	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
461	Tammy	Kelley	update@later.com	2813334900	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
462	Marilyn	Kern Foxworth	update@later.com	2813334901	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
463	Nazlin	Keshwani	update@later.com	2813334902	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
464	Amal	Khalil	update@later.com	2813334903	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
465	Joyce	Khami	update@later.com	2813334904	3	46	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
466	Wagas	Kurjee	update@later.com	2813334905	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
467	Lynette	Kuznar	update@later.com	2813334906	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
468	Roxanne	LaBeau	update@later.com	2813334907	3	44	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
469	Stacey	Lanza	update@later.com	2813334908	3	40	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
470	Nicholette	LaQua	update@later.com	2813334909	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
471	Cherie	Latham	update@later.com	2813334910	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
472	Velma	Latson	update@later.com	2813334911	3	47	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
473	Angela	Le	update@later.com	2813334912	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
474	Vanessa	Lee	update@later.com	2813334913	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
475	Kimberly	Lewis	update@later.com	2813334914	3	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
476	DaTavion	Lott	update@later.com	2813334915	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
477	Keshaundra	Lott	update@later.com	2813334916	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
478	Chris	M	update@later.com	2813334917	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
479	Kira	M	update@later.com	2813334918	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
480	Doris	Mabiaku	update@later.com	2813334919	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
481	Ivan	Mancera	update@later.com	2813334920	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
482	Jasmine	Markey	update@later.com	2813334921	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
483	Nancy	Martin	update@later.com	2813334922	3	45	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
484	Minny	Martinez	update@later.com	2813334923	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
485	Albert	Matthew	update@later.com	2813334924	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
486	Angela	Mayberry	update@later.com	2813334925	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
487	Lettina	McCloud	update@later.com	2813334926	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
488	Becky	McClure	update@later.com	2813334927	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
489	Ginny	McMillien	update@later.com	2813334928	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
490	Lisa	McNeill	update@later.com	2813334929	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
491	Sharda	Mehdiratta	update@later.com	2813334930	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
492	Melanie	Miller	update@later.com	2813334931	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
493	Helen	Mirzay	update@later.com	2813334932	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
494	Mira	Moby	update@later.com	2813334933	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
495	Deborah	Montz	update@later.com	2813334934	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
496	Carmen	Moreno	update@later.com	2813334935	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
497	Stacy	Morgan	update@later.com	2813334936	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
499	Alla	Muzyka	update@later.com	2813334938	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
500	Sheryl	Myers	update@later.com	2813334939	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
501	Bessie	Neal	update@later.com	2813334940	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
502	Edith	Neveaux	update@later.com	2813334941	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
503	Fe Phillips	Newkirk	update@later.com	2813334942	3	43	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
504	Retina	Ngo	update@later.com	2813334943	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
505	Tiffany	Ngo	update@later.com	2813334944	3	44	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
506	Hadley	Nguyen	update@later.com	2813334945	3	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
507	Anna	Nguyn	update@later.com	2813334946	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
508	Tim	Nguyn	update@later.com	2813334947	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
509	Maria	Novo	update@later.com	2813334948	3	43	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
510	Christine	Oates	update@later.com	2813334949	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
511	Petra	Oghlanian	update@later.com	2813334950	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
512	Sandy	Olive	update@later.com	2813334951	3	47	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
513	Cissi	Oloomi	update@later.com	2813334952	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
514	Nikki	Osude	update@later.com	2813334953	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
515	Kat	Paterno	update@later.com	2813334954	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
516	Adelia	Pavliska	update@later.com	2813334955	3	45	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
518	Sandra	Peeples	update@later.com	2813334957	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
520	Maribel	Pettas	update@later.com	2813334959	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
521	Julie	Pham	update@later.com	2813334960	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
522	Michelle	Pham	update@later.com	2813334961	3	38	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
523	Debra	Polley	update@later.com	2813334962	3	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
524	Prunella	Polson	update@later.com	2813334963	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
525	Lacy	Poth	update@later.com	2813334964	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
526	Dawn	Pounders	update@later.com	2813334965	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
527	Farra	R	update@later.com	2813334966	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
529	Isabel	Rangel	update@later.com	2813334968	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
530	Virginia	Rangel	update@later.com	2813334969	3	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
531	Marla	Rasco	update@later.com	2813334970	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
532	Kristel	Reid	update@later.com	2813334971	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
533	Paula	Roberson	update@later.com	2813334972	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
534	Dr. Troy	Rodriguez	update@later.com	2813334973	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
535	Mary	Rodriguez	update@later.com	2813334974	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
536	Cecilia	Rody	update@later.com	2813334975	3	35	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
537	Jan	Roquemore	update@later.com	2813334976	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
538	Anil	S	update@later.com	2813334977	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
539	Maju	S	update@later.com	2813334978	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
540	Maria	Salinas	update@later.com	2813334979	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
541	Taisir	Sarage	update@later.com	2813334980	3	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
542	Nandini	Sarkar	update@later.com	2813334981	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
543	Jane	Saucedo	update@later.com	2813334982	3	26	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
544	Sheri	Saunders	update@later.com	2813334983	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
545	Cliff	Schoenemann	update@later.com	2813334984	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
546	Phyllis	Sedberry	update@later.com	2813334985	3	24	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
547	Emma	Serano	update@later.com	2813334986	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
548	Aster	Seter	update@later.com	2813334987	3	37	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
549	Sandra	Sheilds	update@later.com	2813334988	3	29	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
550	Siu	Shum	update@later.com	2813334989	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
551	Amenahon	Sidahome	update@later.com	2813334990	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
552	Kee	Singletary	update@later.com	2813334991	3	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
554	Hazel	Smith	update@later.com	2813334993	3	41	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
555	Isaura	Smith	update@later.com	2813334994	3	47	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
556	Lameca	Stewart	update@later.com	2813334995	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
557	Arlynea	Stuckey	update@later.com	2813334996	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
559	May	Tape	update@later.com	2813334998	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
560	Stephanie	Tettleton	update@later.com	2813334999	3	33	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
561	Nichole	Thalji	update@later.com	2813335000	3	48	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
562	Stefani	Theo	update@later.com	2813335001	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
563	Carmen	Torres	update@later.com	2813335002	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
564	Huy	Tran	update@later.com	2813335003	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
565	Kim	Tran	update@later.com	2813335004	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
566	Crystal	Trejo	update@later.com	2813335005	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
567	Stephanie	Trimble	update@later.com	2813335006	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
568	Tran	Tuyet	update@later.com	2813335007	3	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
569	Dolores	Valor	update@later.com	2813335008	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
570	Frances	Vela	update@later.com	2813335009	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
571	Shontrell	Wade	update@later.com	2813335010	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
572	Sam	Wahdawon	update@later.com	2813335011	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
573	Ingrid	Watt Gray	update@later.com	2813335012	3	30	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
574	Kimberly	Welch	update@later.com	2813335013	3	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
575	Shelly	Wells	update@later.com	2813335014	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
576	Bryanne	Wheeler Bicket	update@later.com	2813335015	3	42	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
577	David	Wilkins	update@later.com	2813335016	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
578	Juanita	Williams	update@later.com	2813335017	3	39	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
579	Pam	Williams	update@later.com	2813335018	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
580	Alysa	Wilson	update@later.com	2813335019	3	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
581	Lorie	Wilson	update@later.com	2813335020	3	27	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
582	Brandi	Wolford	update@later.com	2813335021	3	36	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
583	Rose	Young	update@later.com	2813335022	3	28	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
584	Mojgan	Zenoozi	update@later.com	2813335023	3	25	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
585	Carol	Smith	update@later.com	2813335024	2	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
586	Maya	Bourgeois	update@later.com	2813335025	12	57	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
587	Renia	Schlegel	update@later.com	2813335026	12	57	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
588	Meena	Kaji	update@later.com	2813335027	12	50	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
589	Stephanie	McBride	update@later.com	2813335028	12	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
590	Eileen	Davenport	update@later.com	2813335029	12	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
591	Jack	Davenport	update@later.com	2813335030	12	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
592	Elva	Cruz	update@later.com	2813335031	12	55	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
593	Joseph	Norovzion	update@later.com	2813335032	12	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
594	Marci	Brown	update@later.com	2813335033	12	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
595	Neil	Brown	update@later.com	2813335034	12	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
596	Nausha	Bennett	update@later.com	2813335035	12	49	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
597	Mandie	Berck	update@later.com	2813335036	12	58	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
598	Jeng	Liang	update@later.com	2813335037	12	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
599	Yvette	Melgar	update@later.com	2813335038	12	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
600	Zohre	Naderi	update@later.com	2813335039	12	51	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
601	Claudio	Navia	update@later.com	2813335040	12	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
602	Donna	Navia	update@later.com	2813335041	12	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
603	Femi	Orisawayi	update@later.com	2813335042	12	53	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
604	Adela	Rodriquez	update@later.com	2813335043	12	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
605	Candy	Rodriquez	update@later.com	2813335044	12	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
606	Elizabeth	Rose	update@later.com	2813335045	12	54	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
607	Amanda	Williams	update@later.com	2813335046	12	52	\N	t	2025-09-03 18:58:31.554901+00	\N	2025-09-03 18:58:31.554901+00	\N
608	Kami	Owen	kowenfnp@gmail.com	2817551792	4	37	2025-09-30	t	2025-09-29 20:42:10.391728+00	a8ba615f-befc-47c7-9016-4bccfac99e8f	2025-09-29 20:42:10.391728+00	a8ba615f-befc-47c7-9016-4bccfac99e8f
609	Test	James	James.Owen@newo-co.com	2817551793	11	57	2025-09-15	t	2025-09-29 20:52:30.712526+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-29 20:52:30.712526+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
610	Test	Salah	myowja@gmail.com	2817551793	12	43	2025-07-17	t	2025-09-29 20:53:49.45024+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-29 20:53:49.45024+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
611	Test	Kami	kowendnp@gmail.com	2817551792	2	24	2025-09-30	t	2025-09-29 20:55:17.778468+00	a8ba615f-befc-47c7-9016-4bccfac99e8f	2025-09-29 20:55:17.778468+00	a8ba615f-befc-47c7-9016-4bccfac99e8f
\.


--
-- Data for Name: member_program_finances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_program_finances (member_program_finance_id, member_program_id, finance_charges, taxes, discounts, final_total_price, margin, financing_type_id, created_at, created_by, updated_at, updated_by) FROM stdin;
1	1	0.00	7.59	0.00	2222.29	62.40	\N	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
2	2	0.00	0.00	0.00	2214.70	62.27	\N	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	3	0.00	0.00	0.00	2214.70	62.27	\N	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
4	5	0.00	7.59	0.00	2222.29	62.27	\N	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: member_program_item_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_program_item_schedule (member_program_item_schedule_id, member_program_item_id, instance_number, scheduled_date, completed_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: member_program_item_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_program_item_tasks (member_program_item_task_id, member_program_item_id, task_id, task_name, description, task_delay, completed_flag, completed_date, completed_by, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: member_program_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_program_items (member_program_item_id, member_program_id, therapy_id, quantity, item_cost, item_charge, days_from_start, days_between, instructions, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
1	1	85	1	36.95	92.00	14	0	Take with food twice a day	t	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
2	1	102	6	99.95	187.95	0	30	Use one per day	t	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	1	116	1	199.00	995.00	8	0		t	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:04:00.21156+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
4	2	85	1	36.95	92.00	14	0	Take with food twice a day	t	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
5	2	102	6	99.95	187.95	0	30	Use one per day	t	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
6	2	116	1	199.00	995.00	7	0		t	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
7	3	85	1	36.95	92.00	14	0	Take with food twice a day	t	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
8	3	102	6	99.95	187.95	0	30	Use one per day	t	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
9	3	116	1	199.00	995.00	7	0		t	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
10	5	85	1	36.95	92.00	14	0	Take with food twice a day	t	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
11	5	102	6	99.95	187.95	0	30	Use one per day	t	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
12	5	116	1	199.00	995.00	7	0		t	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: member_program_items_task_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_program_items_task_schedule (member_program_item_task_schedule_id, member_program_item_schedule_id, member_program_item_task_id, due_date, completed_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: member_program_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_program_payments (member_program_payment_id, member_program_id, payment_amount, payment_due_date, payment_date, payment_status_id, payment_method_id, payment_reference, notes, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: member_programs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_programs (member_program_id, program_template_name, description, total_cost, total_charge, lead_id, start_date, active_flag, program_status_id, source_template_id, template_version_date, created_at, created_by, updated_at, updated_by) FROM stdin;
1	TEST JAMES PROGRAM	This is my test program please do not alter the content	835.65	2214.70	609	\N	t	6	1	2025-09-30 02:51:44.617552+00	2025-09-30 02:51:44.617552+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:04:00.347671+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
2	TEST JAMES PROGRAM II	Please do not mess with my program	835.65	2214.70	609	\N	t	6	1	2025-09-30 17:06:36.309418+00	2025-09-30 17:06:36.309418+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:06:36.357884+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	TEST JAMES PROGRAM III	Please do not alter the content of my program	835.65	2214.70	609	\N	t	6	1	2025-09-30 17:14:43.200876+00	2025-09-30 17:14:43.200876+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:14:43.29416+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
5	TEST JAMES PROGRAM IV	Dont mess with this its mine	835.65	2214.70	609	\N	t	6	1	2025-09-30 17:29:35.456951+00	2025-09-30 17:29:35.456951+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 17:29:35.508551+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_items (id, path, label, section, icon, created_at, updated_at) FROM stdin;
126	/dashboard	Dashboard	main	Dashboard	2025-09-29 18:47:05.412556	2025-09-29 18:47:05.412556
127	/dashboard/coordinator	Coordinator	main	AssignmentTurnedIn	2025-09-29 18:47:06.394817	2025-09-29 18:47:06.394817
128	/dashboard/campaigns	Campaigns	marketing	Event	2025-09-29 18:47:06.558353	2025-09-29 18:47:06.558353
129	/dashboard/leads	Leads	marketing	GroupAdd	2025-09-29 18:47:06.736971	2025-09-29 18:47:06.736971
130	/dashboard/reports	Reports	marketing	BarChart	2025-09-29 18:47:06.879536	2025-09-29 18:47:06.879536
131	/dashboard/programs	Programs	sales	School	2025-09-29 18:47:07.025544	2025-09-29 18:47:07.025544
132	/documents	Documents	sales	Description	2025-09-29 18:47:07.170273	2025-09-29 18:47:07.170273
133	/dashboard/admin/program-templates	Program Templates	admin	Description	2025-09-29 18:47:07.346165	2025-09-29 18:47:07.346165
134	/dashboard/therapies	Therapies	admin	LocalHospital	2025-09-29 18:47:07.51398	2025-09-29 18:47:07.51398
135	/dashboard/therapy-tasks	Therapy Tasks	admin	Assignment	2025-09-29 18:47:07.650046	2025-09-29 18:47:07.650046
136	/dashboard/admin/users	User Management	admin	AdminPanelSettings	2025-09-29 18:47:07.788077	2025-09-29 18:47:07.788077
137	/dashboard/audit-report	Audit Report	admin	History	2025-09-29 18:47:07.942661	2025-09-29 18:47:07.942661
138	/dashboard/bodies	Bodies	admin	PeopleAlt	2025-09-29 18:47:08.075477	2025-09-29 18:47:08.075477
139	/dashboard/buckets	Buckets	admin	Inventory2	2025-09-29 18:47:08.239462	2025-09-29 18:47:08.239462
140	/dashboard/financing-types	Financing Types	admin	AccountBalance	2025-09-29 18:47:08.372751	2025-09-29 18:47:08.372751
141	/dashboard/status	Lead Status	admin	VerifiedUser	2025-09-29 18:47:08.521386	2025-09-29 18:47:08.521386
142	/dashboard/payment-methods	Pay Methods	admin	Payment	2025-09-29 18:47:08.663373	2025-09-29 18:47:08.663373
143	/dashboard/payment-status	Pay Status	admin	CheckCircle	2025-09-29 18:47:08.796326	2025-09-29 18:47:08.796326
144	/dashboard/pillars	Pillars	admin	AccountTree	2025-09-29 18:47:08.935994	2025-09-29 18:47:08.935994
145	/dashboard/program-status	Program Status	admin	AssignmentTurnedIn	2025-09-29 18:47:09.089857	2025-09-29 18:47:09.089857
146	/dashboard/therapy-type	Therapy Types	admin	LocalHospital	2025-09-29 18:47:09.22685	2025-09-29 18:47:09.22685
147	/dashboard/vendors	Vendors	admin	Store	2025-09-29 18:47:09.392978	2025-09-29 18:47:09.392978
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (payment_method_id, payment_method_name, payment_method_description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
2	Check	Check payment	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
3	Credit Card	Credit card payment	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
4	Bank Transfer	Bank transfer or ACH	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
5	Wire Transfer	Wire transfer	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
6	Other	Other payment method	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
1	Cash	Cash payment.	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 22:38:38.413072+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: payment_status; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_status (payment_status_id, payment_status_name, payment_status_description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
1	Pending	Payment is pending	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
2	Paid	Payment has been received	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
3	Late	Payment is overdue	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
4	Cancelled	Payment has been cancelled	t	2025-09-10 20:46:15.190221+00	\N	2025-09-10 20:46:15.190221+00	\N
\.


--
-- Data for Name: pillars; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pillars (pillar_id, pillar_name, description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: program_status; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.program_status (program_status_id, status_name, description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
1	Active	Program is currently active and in progress	t	2025-06-22 18:14:25.451724+00	\N	2025-06-22 18:14:25.451724+00	\N
2	Completed	Program has been successfully completed	t	2025-06-22 18:14:25.451724+00	\N	2025-06-22 18:14:25.451724+00	\N
3	Paused	Program is temporarily paused	t	2025-06-22 18:14:25.451724+00	\N	2025-06-22 18:14:25.451724+00	\N
4	Cancelled	Program has been cancelled	t	2025-06-22 18:14:25.451724+00	\N	2025-06-22 18:14:25.451724+00	\N
6	Quote	This should be the first status a program is set to until the customer decides to participate	t	2025-09-09 01:50:01.220511+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-09 01:50:01.220511+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: program_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.program_template (program_template_id, program_template_name, description, total_cost, total_charge, margin_percentage, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
1	TEST JAMES	This my test template please do not alter the content	835.65	2214.70	62.30	t	2025-09-30 02:37:49.936248+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:41:24.06433+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: program_template_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.program_template_items (program_template_items_id, program_template_id, therapy_id, quantity, days_from_start, days_between, instructions, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
1	1	116	1	7	0		t	2025-09-30 02:38:41.73475+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:38:41.73475+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
2	1	102	6	0	30	Use one per day	t	2025-09-30 02:40:09.353922+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:40:09.353922+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	1	85	1	14	0	Take with food twice a day	t	2025-09-30 02:41:23.885249+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-30 02:41:23.885249+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: status; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.status (status_id, status_name, description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
5	Confirmed	When a Lead confirms their attendance to an event	t	2025-04-28 17:47:53.838106+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-04-28 17:47:53.838106+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	Lost	Use this if they attended a PME and did not participate	t	2025-04-28 02:55:50.711785+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-05-03 23:25:36.225272+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
2	PME Scheduled	Use this when they are scheduled for a PME	t	2025-04-28 02:55:27.058636+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-05-06 17:50:07.800546+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
11	Follow Up	Use this status when you intended to follow up with the lead at some future date	t	2025-09-03 18:01:19.062537+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 18:01:19.062537+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
4	Won	Use this if they purchased a program	t	2025-04-28 02:56:24.163132+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 18:04:48.848601+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
12	UNK	Temp status to clean up data	t	2025-09-03 18:39:43.624216+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-03 18:39:43.624216+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
1	No PME	Use this if they attended a discovery but did not opt in for a PME	t	2025-04-28 02:54:48.605248+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-05 21:30:47.761184+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
13	No Program	No Program was offered	t	2025-09-29 03:05:45.197731+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-29 03:05:45.197731+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: therapies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.therapies (therapy_id, therapy_name, description, therapy_type_id, bucket_id, cost, charge, active_flag, created_at, created_by, updated_at, updated_by, taxable) FROM stdin;
1	Balance (60ct)	\N	6	20	16.25	41.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
2	Energy Enhancer	\N	6	20	69.95	87.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
3	Her Creative Fire Tincture	\N	6	20	35.00	55.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
4	IgG Protect Powder (30serv)	\N	6	20	40.95	102.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
5	Inflamma-Blox (60ct)	\N	6	20	21.10	53.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
6	InflammaCORE Vanilla Chai (14serv)	\N	6	20	41.60	104.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
7	InosiCare (30serv)	\N	6	20	21.80	55.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
8	Magnetic Pulser	\N	6	20	328.43	475.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
9	Mistletoe - Viscum Abietis 100mg	\N	6	20	175.36	350.72	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
10	Mistletoe - Viscum Abietis 50 (8 vials)	\N	6	20	116.68	233.36	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
11	Mistletoe - Viscum Abietis Series 1 (Green Box)	\N	6	20	87.24	174.48	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
12	Mistletoe - Viscum Abietis Series 2 (Green Box)	\N	6	20	93.44	186.88	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
13	Mistletoe - Viscum Abietis Series 4 (Green Box)	\N	6	20	99.68	199.99	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
14	Mistletoe - Viscum Mali Series 2	\N	6	20	93.44	186.88	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
15	Mistletoe - Viscum Mali Series 4	\N	6	20	99.68	199.36	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
16	Mitocore (60ct)	\N	6	20	18.95	47.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
17	Reacted Magnesium & Potassium (60ct)	\N	6	20	15.60	39.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
18	SBI Protect Capsules (120ct)	\N	6	20	39.95	100.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
19	Silver Pulser	\N	6	20	211.55	375.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
20	Silymarin Forte (120ct)	\N	6	20	29.70	74.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
21	Thaena (90ct)	\N	6	20	299.00	525.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
22	TruAdapt (120ct)	\N	6	20	35.70	89.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
23	Turkey Tail Extract Powder (45G)	\N	6	20	42.00	69.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
24	Ultimate Selenium� Capsules (90ct)	\N	6	20	30.95	46.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
25	Bio Tuner 9	\N	6	20	194.74	365.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
26	Cerenity PM (120ct)	\N	6	20	34.95	87.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
27	Cerenity� (90ct)	\N	6	20	27.65	69.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
28	DG Protect (60ct)	\N	6	20	23.30	58.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
29	GlutaShield-Vanilla (30 Serv)	\N	6	20	24.45	61.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
30	Inflamma-Blox (120ct)	\N	6	20	36.85	92.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
31	Intestin-ol (90ct)	\N	6	20	30.85	77.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
32	Lugol's Iodine Liquid (2oz)	\N	6	20	36.40	62.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
33	Nattokinase (60ct)	\N	6	20	18.80	47.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
34	Orthomega� 820 (180ct)	\N	6	20	43.30	108.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
35	Prostatrol Forte (60ct)	\N	6	20	25.55	64.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
36	Reacted Cal-Mag (90ct)	\N	6	20	16.15	40.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
37	TruAdapt Plus (120ct)	\N	6	20	35.70	89.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
38	X49	\N	4	17	99.95	187.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	f
39	Y-Age Glutathione	\N	4	17	69.95	87.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	f
40	Botanicalm PM (60ct)	\N	6	20	28.45	71.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
41	CM Core (90ct)	\N	6	20	26.30	66.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
42	Icewave	\N	4	17	69.95	87.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	f
43	Inner Balance	\N	6	20	111.30	159.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
44	Orthomega V (60ct)	\N	6	20	36.90	92.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
45	Pregnenolone Micronized (100ct)	\N	6	20	9.35	23.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
46	Turiva (120ct)	\N	6	20	46.50	116.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
47	Turkey Tail Extract (200 ct)	\N	6	20	42.00	69.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
48	Vitamin K2 with D3 (60ct)	\N	6	20	16.80	42.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
49	Y-Age Carnosine	\N	6	20	69.95	87.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
50	Adren-All (120ct)	\N	6	20	29.15	73.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
51	Bergamot BPF (120ct)	\N	6	20	43.25	108.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
52	CDG EstroDIM (60ct)	\N	6	20	40.85	102.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
53	CereVive (120ct)	\N	6	20	36.70	92.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
54	CoQ-10 300mg (60ct)	\N	6	20	42.90	107.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
55	Lithium Orotate (60ct)	\N	6	20	18.25	46.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
56	L-Theanine (60ct)	\N	6	20	20.95	52.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
57	MAF Capsules 300mg (60ct)	\N	6	20	210.00	420.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
58	Reacted Magnesium (180ct)	\N	6	20	22.95	57.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
59	Reacted Zinc (60ct)	\N	6	20	9.70	24.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
60	Reishi (200 ct)	\N	6	20	42.00	69.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
61	CitraNOX� (120ct)	\N	6	20	26.30	66.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
62	GABAnol (60ct)	\N	6	20	14.85	37.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
63	N-Acetyl Cysteine (60ct)	\N	6	20	14.95	37.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
64	Reacted Selenium (90ct)	\N	6	20	11.90	30.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
65	Z-Binder (60ct)	\N	6	20	16.95	42.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
66	Collagen Peptides (10.5oz)	\N	6	20	30.95	46.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
67	Core Restore Kit - Vanilla (7days)	\N	6	20	59.45	149.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
68	Methyl B12 (60ct)	\N	6	20	16.00	40.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
69	Mistletoe - Viscum Mali 100mg	\N	6	20	175.36	350.72	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
70	Natural D-Hist (120ct)	\N	6	20	24.40	61.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
71	Ultimate Mineral Caps� (64ct)	\N	6	20	46.95	70.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
72	Motility Pro (60ct)	\N	6	20	21.65	54.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
73	OsteoPrev (120ct)	\N	6	20	32.95	82.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
74	Sovereign Creative Stability	\N	6	20	32.00	42.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
75	Thyrotain (120ct)	\N	6	20	22.70	57.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
76	L-Glutathione (60ct)	\N	6	20	23.95	60.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
77	SAMe (60ct)	\N	6	20	44.70	112.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
78	Diaxinol (120ct)	\N	6	20	46.90	117.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
79	Hiphenolic (60ct)	\N	6	20	23.45	59.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
80	Ortho Biotic (60ct)	\N	6	20	33.30	83.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
81	Poria 15 Formula GF (Tablets)	\N	6	20	12.30	30.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
82	Reacted Iron (60ct)	\N	6	20	8.60	22.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
83	DHEA 25mg (90ct)	\N	6	20	11.20	28.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
84	Reacted Magnesium (120ct)	\N	6	20	16.80	42.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
85	SBI Protect Powder 2.6oz (30serv)	\N	6	20	36.95	92.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
86	Ultimate Daily Capsules (180ct)	\N	6	20	47.95	72.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
87	Digestzyme-V (180ct)	\N	6	20	35.70	89.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
88	Gluco-Gel Plus� Liquid (32floz)	\N	6	20	54.95	82.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
89	Majestic Earth Ultimate Classic� (32floz)	\N	6	20	48.95	73.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
90	His Creative Fire Tincture	\N	6	20	27.30	55.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
91	Slender FX� Sweet Eze� (120ct)	\N	6	20	29.95	45.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
92	Vitamin D3 50000IU (15ct)	\N	6	20	4.30	15.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
93	Mitocore (120ct)	\N	6	20	33.20	83.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
94	Thrive Alive	\N	6	20	33.60	55.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
95	Orthomega� 820 (120ct)	\N	6	20	30.95	77.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
96	Majestic Earth Strawberry Kiwi-Mins� (32floz)	\N	6	20	28.95	44.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
97	Methyl CPG (60ct)	\N	6	20	22.00	55.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
98	Digestive Enzyme Formula (200ct)	\N	6	20	66.50	105.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
99	Ultimate Tangy Tangerine� (32floz)	\N	6	20	48.95	73.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
100	Lugol's Iodine Plus Capsules (90ct)	\N	6	20	49.00	80.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
101	Majestic Earth Plant Derived Minerals � (32floz)	\N	6	20	23.95	44.00	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	t
102	X39	\N	4	17	99.95	187.95	t	2025-09-30 01:55:45.126688+00	\N	2025-09-30 01:55:45.126688+00	\N	f
103	ABO GROUPING (006056)	\N	8	14	2.00	10.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
104	Apolipoprotein A-1 (016873)	\N	8	14	5.30	26.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
105	Apolipoprotein B (167015)	\N	8	14	5.30	26.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
106	Bilirubin (Total, Direct, Indirect) (001214)	\N	8	14	1.60	8.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
107	C-Peptide (010108)	\N	8	14	6.00	30.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
108	C-Reactive Protein (CRP), Quantitative (006627)	\N	8	14	3.80	19.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
109	CANCER PANEL COMPLETE (308401)	\N	8	14	30.75	153.75	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
110	CBC/Complete Blood Count Lab (005009)	\N	8	14	2.00	10.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
111	Cortisol (004051)	\N	8	14	4.30	21.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
112	Creatine Kinase,Total (001362)	\N	8	14	1.50	7.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
113	D-Dimer (115188)	\N	8	14	13.80	69.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
114	DHEA-S (004020)	\N	8	14	4.00	20.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
115	Digoxin Level (007385)	\N	8	14	5.00	25.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
116	Eat 144 Allergy Test	\N	8	14	199.00	995.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
117	Eat 144 Allergy Test (Remote)	\N	8	14	199.00	995.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
118	Epstein-Barr Virus (EBV) Antibodies to Early Antigen-Diffuse [EA(D)], IgG (096248)	\N	8	14	12.00	60.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
119	Epstein-Barr Virus (EBV) Antibodies to Viral Capsid Antigen (VCA), IgG (096230)	\N	8	14	5.50	27.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
120	Epstein-Barr Virus (EBV) Antibodies to Viral Capsid Antigen (VCA), IgM (096735)	\N	8	14	9.00	45.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
121	Epstein-Barr Virus (EBV) Nuclear Antigen Antibodies, IgG (010272)	\N	8	14	6.50	32.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
122	ESR-Wes+CRP (286617)	\N	8	14	5.70	28.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
123	Ferritin (004598)	\N	8	14	2.00	10.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
124	Fibrinogen Activity (001610)	\N	8	14	4.30	21.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
125	Fibrinogen Antigen (117052)	\N	8	14	30.00	150.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
126	Folate & B12 - RBC (000810)	\N	8	14	8.00	40.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
127	Folate - RBC (266015)	\N	8	14	4.40	22.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
128	Follicle-stimulating Hormone (FSH) and Luteinizing Hormone (LH) (028480)	\N	8	14	6.00	30.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
129	Fructosanine (100800)	\N	8	14	4.50	22.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
130	G6PD RED CELL COUNT (001917)	\N	8	14	6.40	32.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
131	Gastrin (004390)	\N	8	14	5.30	26.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
132	GGT (001958)	\N	8	14	1.50	7.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
133	Glu + A1C + Insulin + C Peptide Lab (305907)	\N	8	14	13.25	66.25	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
134	Heavy Metals Profile II, Whole Blood (706200)	\N	8	14	103.00	515.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
135	HEMOGLOBIN A1C (001453)	\N	8	14	2.25	11.25	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
136	Homocystine (706994)	\N	8	14	12.00	60.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
137	hsCRP (120766)	\N	8	14	5.00	25.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
138	IGF-1 (010363)	\N	8	14	14.00	70.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
139	Insulin (Fasting) (004333)	\N	8	14	3.50	17.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
140	Iron Serum & TIBC (001321)	\N	8	14	2.40	12.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
141	LDH (001115)	\N	8	14	1.50	7.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
142	Leptin, Serum or Plasma (146712)	\N	8	14	29.50	147.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
143	Levetiracetam, Serum or Plasma (Keppra Level) (716936)	\N	8	14	35.00	175.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
144	Lipid Panel w/ Chol/HDL Ratio (221010)	\N	8	14	2.50	12.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
145	Lipid Panel With Total Cholesterol:HDL Ratio (221010)	\N	8	14	2.50	12.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
146	Lipoprotein (a) (120188)	\N	8	14	7.50	37.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
147	LYME (B. BURGDORFERI) PCR (138685)	\N	8	14	156.30	781.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
148	LYME, IGM, EARLY TEST/REFLEX (160333)	\N	8	14	10.60	53.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
149	LYME, TOTAL AB TEST/REFLEX (160325)	\N	8	14	13.00	65.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
150	Magnesium RBC (080283)	\N	8	14	15.90	79.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
151	Magnesium Serum (001537)	\N	8	14	2.00	10.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
152	Metabolic Panel (14), Comprehensive (322000)	\N	8	14	2.80	14.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
153	Osteocalcin, Serum (010249)	\N	8	14	30.00	150.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
154	PANCREATIC/COLORECTAL CANCER (222752)	\N	8	14	14.75	73.75	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
155	Parathyroid Hormone (PTH), Intact (015610)	\N	8	14	7.50	37.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
156	Phosphorus (001024)	\N	8	14	1.50	7.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
157	Progesterone (004317)	\N	8	14	6.00	30.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
158	PROGRAM LABS	\N	8	14	249.70	750.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
159	Prolactin (004465)	\N	8	14	3.50	17.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
160	Prothrombin Time (PT) and Partial Thromboplastin Time (PTT) (020321)	\N	8	14	4.75	23.75	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
161	PSA TOTAL (Reflex to free) (480772)	\N	8	14	3.50	17.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
162	Reticulocyte Count (005280)	\N	8	14	2.50	12.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
163	Reverse T3 (070104)	\N	8	14	15.90	79.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
164	Selenium, Whole Blood (081034)	\N	8	14	36.40	182.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
165	Sex Horm Binding Glob, Serum (082016)	\N	8	14	8.00	40.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
166	SpectraCell Micronutrient & Lipid Plus Panel Lab	\N	8	14	106.00	530.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
167	SpectraCell Micronutrient Lab	\N	8	14	84.00	420.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
168	T3 Uptake (001156)	\N	8	14	1.60	8.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
169	Testosterone, Total (004226)	\N	8	14	4.00	20.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
170	Thyroglobulin Antibody (006685)	\N	8	14	3.50	17.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
171	Thyroid Peroxidase (TPO) Antibodies (006676)	\N	8	14	6.00	30.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
172	Thyroid Profile With TSH (000620)	\N	8	14	5.70	28.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
173	Thyrotropin Receptor Antibody, Serum (010314)	\N	8	14	10.60	53.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
174	Thyroxine (T4) Free, Direct (001974)	\N	8	14	2.75	13.75	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
175	Thyroxine (T4), Free, Direct (001974)	\N	8	14	2.75	13.75	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
176	Thyroxine-binding Globulin (TBG), Serum (001735)	\N	8	14	10.00	50.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
177	Transferrin (004937)	\N	8	14	7.70	38.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
178	Triiodothyronine (T3) (002188)	\N	8	14	3.20	16.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
179	UA/M W/RFLX CULTURE, ROUTINE (377036)	\N	8	14	2.80	14.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
180	UIBC (001348)	\N	8	14	1.60	8.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
181	Uric Acid (001057)	\N	8	14	1.50	7.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
182	Vitamin B12 (001503)	\N	8	14	4.00	20.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
183	Vitamin C (with dilution) (123420)	\N	8	14	27.00	135.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
184	Vitamin D, 25-Hydroxy (081950)	\N	8	14	11.00	55.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
185	WELLNESS PANEL (387146)	\N	8	14	8.90	44.50	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
186	Zinc - RBC (070029)	\N	8	14	34.00	170.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
187	Zinc - Serum or Plasma (001800)	\N	8	14	7.00	35.00	t	2025-09-30 02:30:22.921321+00	\N	2025-09-30 02:30:22.921321+00	\N	f
188	Acute Illness IV Therapy	Drip	3	19	81.44	375.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
189	ALA/Alpha Lipoic Acid (600mg) IV Therapy	Drip	3	19	73.50	335.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
190	Anti-Aging Therapy	Drip	3	19	94.21	325.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
191	B12/Methylcobalamin (5mg) Injection	IM	3	19	12.58	40.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
192	B7/Biotin Injection	IM55	3	19	16.25	70.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
193	Beauty IV Drip	Drip	3	19	82.80	225.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
194	Blood Pressure Support IV Therapy	Drip	3	19	129.29	325.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
195	Blood Sugar Blaster IV Therapy	Drip	3	19	125.64	499.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
196	Chelation (EDTA) Calcium IV Therapy	Drip	3	19	137.11	415.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
197	Energy Booster Injection	IM75	3	19	24.98	99.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
198	Glutathione (1000mg) IV Push	Push	3	19	23.83	70.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
199	Glutathione (2000mg) IV Push	Push	3	19	33.00	100.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
200	Glutathione (4000mg) IV Therapy	Drip	3	19	65.85	165.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
201	Healthy Weight IV Therapy	Drip	3	19	103.13	299.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
202	Hydration - Lactated Ringers IV Therapy	Drip	3	19	38.85	105.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
203	Hydration - Normal Saline IV Therapy	Drip	3	19	41.44	105.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
204	Illness Recovery Therapy	Drip	3	19	128.11	385.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
205	Immunity Booster IV Therapy	Drip	3	19	65.62	220.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
206	Immunity Complete IV Therapy	Drip	3	19	130.72	445.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
207	Magnesium (3000mg) IV Drip	Drip	3	19	52.58	135.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
208	Myers Plus	Drip	3	19	61.88	155.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
209	NAD+ (100mg) SQ Injection	SQ	3	19	14.00	55.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
210	NAD+ (200mg) SQ Injection	SQ	3	19	17.25	90.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
211	NAD+ (500mg) IV Therapy	Drip	3	19	173.25	520.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
212	Ozone in Normal Saline	Drip	3	19	76.55	195.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
213	Ozone IV Therapy 	Drip	3	19	86.21	220.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
214	Ozone with UltraViolet Blood IV Therapy	Drip	3	19	117.98	295.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
215	Superhero IV Therapy	Drip	3	19	75.68	275.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
216	Toradol�/Ketorolac (30mg) Injection	IM	3	19	17.25	55.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
217	Tri-Immune (Injection)	IM	3	19	32.32	100.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
218	Vitamin C (100g) with Hydration IV Therapy	Drip	3	19	231.99	580.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
219	Vitamin C (25g) IV Therapy	Drip	3	19	77.61	235.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
220	Vitamin C (50g) with Hydration IV Therapy	Drip	3	19	130.74	330.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
221	Vitamin C (75g) IV Therapy	Drip	3	19	176.99	445.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
222	Vitamin D3 (100,000IU) Injection	IM	3	19	21.15	65.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
223	Vitamin D3 (300,000IU) Injection	IM	3	19	29.35	90.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
224	Workout Recovery	Drip	3	19	101.44	299.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
225	Works IV Therapy	Drip	3	19	159.14	400.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
226	Zinc (20mg) IV Push	Push	3	19	13.38	45.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
227	Zofran�/Ondansetron IV Push	Push	3	19	31.36	95.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
228	Acupuncture 60 Minutes (Needles)	\N	5	19	35.00	199.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
229	Acupuncture EAM�- Single Session 30 Minutes	\N	5	19	26.25	199.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
230	Acupuncture Fire Cupping Treatment	\N	5	19	35.00	199.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
231	Bio-Optic Holography	\N	5	19	35.00	599.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
232	BrainTap� Session Add On	\N	5	19	35.00	175.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
233	Coaching Session	\N	5	19	5.00	25.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
234	Custom Treatment Plan	\N	5	19	35.00	750.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
235	Custom Treatment Plan Nutritional Visit	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
236	Emotion/Body Code Therapy (30 mins)	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
237	Energetic Osteopathy Treatment	\N	5	19	52.50	399.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
238	Cupping Treatment	\N	5	19	17.50	99.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
239	Food Sensitivity Remote Instruction/Supervision	\N	5	19	17.50	75.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
240	Food Sensitivity Test Review	\N	5	19	35.00	175.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
241	Genius Insight Voice Upload 	\N	5	19	8.75	25.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
242	Group RASHA	\N	5	19	5.00	25.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
243	Initial Nutritional Visit with Initial Supplements	\N	5	19	17.50	87.50	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
244	Lab Review	\N	5	19	17.50	375.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
245	Lymphatic Drainage 30 Minutes	\N	5	19	26.25	131.25	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
246	Physical Exam	\N	5	19	35.00	175.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
247	PICC Line Dressing Change	\N	5	19	17.50	87.50	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
248	Program Onboarding 1	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
249	Program Onboarding 2	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
250	Program Onboarding 3	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
251	Program ReCap and Maintenance Plan	\N	5	19	17.50	750.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
252	Rasha 120 Minutes 	\N	5	19	35.00	600.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
253	Rasha 60 Minutes	\N	5	19	17.50	300.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
254	Rasha 90 Minutes 	\N	5	19	17.50	450.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
255	Reiki Treatment 	\N	5	19	35.00	299.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
256	Sacred Body Language Translation 30 Minutes	\N	5	19	17.50	199.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
257	Shipping Fee	\N	5	19	25.00	25.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
258	Specialized Body Therapy Massage 90 Minutes	\N	5	19	61.25	306.25	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
259	Tuning Fork 30 Minutes Premium	\N	5	19	17.50	115.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
260	Vibration/Sound Therapy Massage 90 Minutes	\N	5	19	52.50	195.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
261	Weight Loss Check In	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
262	Weight Loss Orientation	\N	5	19	17.50	125.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
263	YOY University 3 Month	\N	5	23	179.00	1790.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
264	YOY University 4 Month	\N	5	23	229.00	2290.00	t	2025-09-30 03:14:39.134091+00	\N	2025-09-30 03:14:39.134091+00	\N	f
\.


--
-- Data for Name: therapies_bodies_pillars; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.therapies_bodies_pillars (therapy_id, body_id, pillar_id, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: therapy_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.therapy_tasks (task_id, task_name, description, therapy_id, task_delay, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: therapytype; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.therapytype (therapy_type_id, therapy_type_name, description, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
4	Home Therapy	Examples are Lifewave patches, Mag Pulser etc	t	2025-04-28 20:03:27.536569+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-04-28 20:03:27.536569+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
5	Service	Examples are Tuning Forks, Physical Exam etc.	t	2025-04-28 20:04:15.767858+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-04-28 20:05:36.459887+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
6	Supplement	Examples are DHEA Majestic Earth Minerals etc.	t	2025-04-28 20:05:08.552764+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-04-28 20:05:44.55609+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	Functional Nutrition	Examples are Misletoe, IVs, NAD etc	t	2025-04-28 20:02:15.717938+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-05-06 18:27:22.066173+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
8	Test	Examples Wellness Test, EAT144	t	2025-05-05 14:57:36.699562+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-09-25 01:48:39.727931+00	\N
\.


--
-- Data for Name: user_menu_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_menu_permissions (id, user_id, menu_path, granted_at, granted_by) FROM stdin;
93	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard	2025-09-08 14:06:03.737782	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
94	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/reports	2025-09-08 14:06:03.94421	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
95	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/audit-report	2025-09-08 14:06:04.105445	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
96	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/campaigns	2025-09-08 14:06:04.250832	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
97	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/leads	2025-09-08 14:06:04.656852	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
98	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/programs	2025-09-08 14:06:04.84921	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
99	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/documents	2025-09-08 14:06:05.034956	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
100	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/admin/users	2025-09-08 14:06:05.188606	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
101	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/bodies	2025-09-08 14:06:05.353103	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
102	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/buckets	2025-09-08 14:06:05.50336	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
103	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/status	2025-09-08 14:06:05.660658	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
104	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/pillars	2025-09-08 14:06:05.818327	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
105	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/program-status	2025-09-08 14:06:05.971416	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
106	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/admin/program-templates	2025-09-08 14:06:06.150918	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
107	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/therapy-type	2025-09-08 14:06:06.321735	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
108	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/therapies	2025-09-08 14:06:06.48339	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
109	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/therapy-tasks	2025-09-08 14:06:06.672255	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
110	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/vendors	2025-09-08 14:06:06.821831	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
129	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/programs	2025-09-10 21:00:38.293596	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
130	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/financing-types	2025-09-10 21:00:38.840314	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
131	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/payment-methods	2025-09-10 21:00:39.004169	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
132	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/payment-status	2025-09-10 21:00:39.171209	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
137	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/audit-report	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
138	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
139	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/reports	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
140	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/campaigns	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
141	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/leads	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
142	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/status	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
143	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/vendors	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
144	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/financing-types	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
145	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/payment-methods	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
146	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/payment-status	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
147	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/admin/program-templates	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
148	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/therapies	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
149	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/therapy-tasks	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
150	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/admin/users	2025-09-10 21:01:58.570095	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
152	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	/dashboard/coordinator	2025-09-20 01:20:39.830732	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
153	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/coordinator	2025-09-29 03:12:11.785231	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
154	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/programs	2025-09-29 03:12:12.28886	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
155	d583c051-8c7a-4977-abd5-be15348ca538	/documents	2025-09-29 03:12:12.491192	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
156	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/bodies	2025-09-29 03:12:13.000486	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
157	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/buckets	2025-09-29 03:12:13.158179	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
158	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/pillars	2025-09-29 03:12:13.639036	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
159	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/program-status	2025-09-29 03:12:13.804025	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
160	d583c051-8c7a-4977-abd5-be15348ca538	/dashboard/therapy-type	2025-09-29 03:12:13.959586	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
161	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard	2025-09-29 03:12:14.209068	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
162	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/coordinator	2025-09-29 03:12:14.391427	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
163	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/audit-report	2025-09-29 03:12:14.547058	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
164	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/campaigns	2025-09-29 03:12:14.690769	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
165	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/leads	2025-09-29 03:12:14.868393	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
166	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/reports	2025-09-29 03:12:15.020924	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
167	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/programs	2025-09-29 03:12:15.193875	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
168	a8ba615f-befc-47c7-9016-4bccfac99e8f	/documents	2025-09-29 03:12:15.37357	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
169	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/admin/program-templates	2025-09-29 03:12:15.518783	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
170	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/therapies	2025-09-29 03:12:15.675165	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
171	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/therapy-tasks	2025-09-29 03:12:15.83414	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
172	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/admin/users	2025-09-29 03:12:15.977581	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
173	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/bodies	2025-09-29 03:12:16.127823	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
174	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/buckets	2025-09-29 03:12:16.293031	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
175	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/financing-types	2025-09-29 03:12:16.453624	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
176	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/status	2025-09-29 03:12:16.60492	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
177	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/payment-methods	2025-09-29 03:12:16.76907	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
178	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/payment-status	2025-09-29 03:12:16.924982	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
179	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/pillars	2025-09-29 03:12:17.096946	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
180	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/program-status	2025-09-29 03:12:17.262799	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
181	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/therapy-type	2025-09-29 03:12:17.434468	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
182	a8ba615f-befc-47c7-9016-4bccfac99e8f	/dashboard/vendors	2025-09-29 03:12:17.590869	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
183	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard	2025-09-29 03:12:17.773651	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
184	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/coordinator	2025-09-29 03:12:17.943897	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
185	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/audit-report	2025-09-29 03:12:18.103706	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
186	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/campaigns	2025-09-29 03:12:18.294345	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
187	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/leads	2025-09-29 03:12:18.46297	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
188	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/reports	2025-09-29 03:12:18.642628	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
189	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/programs	2025-09-29 03:12:18.813942	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
190	27886ce5-5117-40ad-b97c-279ed74f8a88	/documents	2025-09-29 03:12:19.000864	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
191	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/admin/program-templates	2025-09-29 03:12:19.168099	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
192	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/therapies	2025-09-29 03:12:19.335373	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
193	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/therapy-tasks	2025-09-29 03:12:19.496224	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
194	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/admin/users	2025-09-29 03:12:19.669832	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
195	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/bodies	2025-09-29 03:12:19.85098	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
196	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/buckets	2025-09-29 03:12:20.076652	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
197	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/financing-types	2025-09-29 03:12:20.263135	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
198	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/status	2025-09-29 03:12:20.427315	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
199	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/payment-methods	2025-09-29 03:12:20.634613	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
200	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/payment-status	2025-09-29 03:12:20.795557	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
201	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/pillars	2025-09-29 03:12:20.989299	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
202	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/program-status	2025-09-29 03:12:21.159053	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
203	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/therapy-type	2025-09-29 03:12:21.32089	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
204	27886ce5-5117-40ad-b97c-279ed74f8a88	/dashboard/vendors	2025-09-29 03:12:21.478955	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
205	9fd60aca-70b4-4c09-a829-557985e421e4	/dashboard	2025-09-29 03:23:48.007476	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
206	9fd60aca-70b4-4c09-a829-557985e421e4	/dashboard/campaigns	2025-09-29 03:23:48.007476	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
207	9fd60aca-70b4-4c09-a829-557985e421e4	/dashboard/leads	2025-09-29 03:23:48.007476	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
208	9fd60aca-70b4-4c09-a829-557985e421e4	/dashboard/reports	2025-09-29 03:23:48.007476	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
209	9fd60aca-70b4-4c09-a829-557985e421e4	/dashboard/vendors	2025-09-29 03:23:48.007476	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
210	9fd60aca-70b4-4c09-a829-557985e421e4	/dashboard/status	2025-09-29 03:23:48.007476	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, full_name, created_at, is_admin, is_active) FROM stdin;
d583c051-8c7a-4977-abd5-be15348ca538	james.owen@newo-co.com	Salah James Owen	2025-09-08 00:28:18.361214+00	t	t
a8ba615f-befc-47c7-9016-4bccfac99e8f	kami@youonlyyounger.com	Kami Owen	2025-09-24 01:20:17.245507+00	t	t
27886ce5-5117-40ad-b97c-279ed74f8a88	aldana@youonlyyounger.com	Aldana Matamoros	2025-09-24 01:20:55.236262+00	t	t
a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	james@youonlyyounger.com	James Owen	2025-04-24 03:18:26.089499+00	t	t
9fd60aca-70b4-4c09-a829-557985e421e4	jennifer@youonlyyounger.com	Jennifer Yager	2025-09-29 03:19:41.237684+00	f	t
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (vendor_id, vendor_name, contact_person, email, phone, active_flag, created_at, created_by, updated_at, updated_by) FROM stdin;
4	Other	Referals	myowja@gmail.com	2817551793	t	2025-04-28 19:36:51.045738+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-07-03 04:26:41.4089+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
3	Blue Wolf	Wade Baumgartner	wade@bluewolf.com	(281) 755-1793	t	2025-04-28 19:36:25.948816+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a	2025-07-03 05:20:07.123564+00	a1ebfe3c-9270-4e2a-89f0-4d5b4e5f033a
\.


--
-- Name: audit_events_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_events_event_id_seq', 370, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 145, false);


--
-- Name: bodies_body_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bodies_body_id_seq', 1, false);


--
-- Name: buckets_bucket_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.buckets_bucket_id_seq', 24, false);


--
-- Name: campaigns_campaign_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.campaigns_campaign_id_seq', 59, false);


--
-- Name: financing_types_financing_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.financing_types_financing_type_id_seq', 6, false);


--
-- Name: lead_notes_note_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lead_notes_note_id_seq', 9, false);


--
-- Name: leads_lead_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leads_lead_id_seq', 612, true);


--
-- Name: member_program_finances_member_program_finance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_program_finances_member_program_finance_id_seq', 4, true);


--
-- Name: member_program_item_schedule_member_program_item_schedule_id_se; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_program_item_schedule_member_program_item_schedule_id_se', 1, false);


--
-- Name: member_program_item_tasks_member_program_item_task_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_program_item_tasks_member_program_item_task_id_seq', 1, false);


--
-- Name: member_program_items_member_program_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_program_items_member_program_item_id_seq', 12, true);


--
-- Name: member_program_items_task_schedule_member_program_item_task_sch; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_program_items_task_schedule_member_program_item_task_sch', 1, false);


--
-- Name: member_program_payments_member_program_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_program_payments_member_program_payment_id_seq', 1, false);


--
-- Name: member_programs_member_program_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.member_programs_member_program_id_seq', 5, true);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 148, false);


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_methods_payment_method_id_seq', 7, false);


--
-- Name: payment_status_payment_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_status_payment_status_id_seq', 5, false);


--
-- Name: pillars_pillar_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pillars_pillar_id_seq', 1, false);


--
-- Name: program_items_program_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.program_items_program_item_id_seq', 1, false);


--
-- Name: program_status_program_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.program_status_program_status_id_seq', 7, false);


--
-- Name: program_template_items_program_template_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.program_template_items_program_template_items_id_seq', 3, true);


--
-- Name: program_template_program_template_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.program_template_program_template_id_seq', 1, true);


--
-- Name: programs_program_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.programs_program_id_seq', 1, false);


--
-- Name: status_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.status_status_id_seq', 14, false);


--
-- Name: therapies_therapy_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.therapies_therapy_id_seq', 264, true);


--
-- Name: therapy_tasks_task_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.therapy_tasks_task_id_seq', 1, false);


--
-- Name: therapy_type_therapy_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.therapy_type_therapy_type_id_seq', 11, false);


--
-- Name: user_menu_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_menu_permissions_id_seq', 211, false);


--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendors_vendor_id_seq', 5, false);


--
-- Name: audit_event_changes audit_event_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_event_changes
    ADD CONSTRAINT audit_event_changes_pkey PRIMARY KEY (event_id, column_name);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (event_id);


--
-- Name: bodies bodies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bodies
    ADD CONSTRAINT bodies_pkey PRIMARY KEY (body_id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (bucket_id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: lead_notes lead_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_pkey PRIMARY KEY (note_id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (lead_id);


--
-- Name: member_program_finances member_program_finances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT member_program_finances_pkey PRIMARY KEY (member_program_finance_id);


--
-- Name: member_program_item_schedule member_program_item_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_schedule
    ADD CONSTRAINT member_program_item_schedule_pkey PRIMARY KEY (member_program_item_schedule_id);


--
-- Name: member_program_item_tasks member_program_item_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT member_program_item_tasks_pkey PRIMARY KEY (member_program_item_task_id);


--
-- Name: member_program_items member_program_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items
    ADD CONSTRAINT member_program_items_pkey PRIMARY KEY (member_program_item_id);


--
-- Name: member_program_items_task_schedule member_program_items_task_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items_task_schedule
    ADD CONSTRAINT member_program_items_task_schedule_pkey PRIMARY KEY (member_program_item_task_schedule_id);


--
-- Name: member_programs member_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT member_programs_pkey PRIMARY KEY (member_program_id);


--
-- Name: menu_items menu_items_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_path_key UNIQUE (path);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: pillars pillars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pillars
    ADD CONSTRAINT pillars_pkey PRIMARY KEY (pillar_id);


--
-- Name: financing_types pk_financing_types; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financing_types
    ADD CONSTRAINT pk_financing_types PRIMARY KEY (financing_type_id);


--
-- Name: member_program_payments pk_member_program_payments; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT pk_member_program_payments PRIMARY KEY (member_program_payment_id);


--
-- Name: payment_methods pk_payment_methods; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT pk_payment_methods PRIMARY KEY (payment_method_id);


--
-- Name: payment_status pk_payment_status; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_status
    ADD CONSTRAINT pk_payment_status PRIMARY KEY (payment_status_id);


--
-- Name: program_status program_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_status
    ADD CONSTRAINT program_status_pkey PRIMARY KEY (program_status_id);


--
-- Name: program_template_items program_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT program_template_items_pkey PRIMARY KEY (program_template_items_id);


--
-- Name: program_template program_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template
    ADD CONSTRAINT program_template_pkey PRIMARY KEY (program_template_id);


--
-- Name: status status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (status_id);


--
-- Name: therapies_bodies_pillars therapies_bodies_pillars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_pkey PRIMARY KEY (therapy_id, body_id, pillar_id);


--
-- Name: therapies therapies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT therapies_pkey PRIMARY KEY (therapy_id);


--
-- Name: therapy_tasks therapy_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT therapy_tasks_pkey PRIMARY KEY (task_id);


--
-- Name: therapytype therapy_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapytype
    ADD CONSTRAINT therapy_type_pkey PRIMARY KEY (therapy_type_id);


--
-- Name: member_program_item_schedule uniq_item_schedule_instance; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_schedule
    ADD CONSTRAINT uniq_item_schedule_instance UNIQUE (member_program_item_id, instance_number);


--
-- Name: member_program_items_task_schedule uniq_task_schedule_per_occurrence; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items_task_schedule
    ADD CONSTRAINT uniq_task_schedule_per_occurrence UNIQUE (member_program_item_schedule_id, member_program_item_task_id);


--
-- Name: user_menu_permissions user_menu_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_menu_permissions user_menu_permissions_user_id_menu_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_user_id_menu_path_key UNIQUE (user_id, menu_path);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: idx_aevt_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aevt_member ON public.audit_events USING btree (related_member_id, related_program_id);


--
-- Name: idx_aevt_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aevt_scope ON public.audit_events USING btree (scope);


--
-- Name: idx_aevt_tbl_rec; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aevt_tbl_rec ON public.audit_events USING btree (table_name, record_id);


--
-- Name: idx_aevt_when; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aevt_when ON public.audit_events USING btree (event_at);


--
-- Name: idx_aevtchg_col; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aevtchg_col ON public.audit_event_changes USING btree (column_name);


--
-- Name: idx_lead_notes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_notes_created_at ON public.lead_notes USING btree (created_at DESC);


--
-- Name: idx_lead_notes_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes USING btree (lead_id);


--
-- Name: idx_lead_notes_note_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_notes_note_type ON public.lead_notes USING btree (note_type);


--
-- Name: idx_member_program_item_schedule_program_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_schedule_program_item ON public.member_program_item_schedule USING btree (member_program_item_id, instance_number);


--
-- Name: idx_member_program_item_schedule_scheduled_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_schedule_scheduled_date ON public.member_program_item_schedule USING btree (scheduled_date);


--
-- Name: idx_member_program_item_tasks_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_tasks_completed ON public.member_program_item_tasks USING btree (completed_flag);


--
-- Name: idx_member_program_item_tasks_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_tasks_item ON public.member_program_item_tasks USING btree (member_program_item_id);


--
-- Name: idx_member_program_item_tasks_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_tasks_task ON public.member_program_item_tasks USING btree (task_id);


--
-- Name: idx_member_program_items_member_program; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_member_program ON public.member_program_items USING btree (member_program_id);


--
-- Name: idx_member_program_items_task_schedule_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_task_schedule_due_date ON public.member_program_items_task_schedule USING btree (due_date);


--
-- Name: idx_member_program_items_task_schedule_fulfillment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_task_schedule_fulfillment ON public.member_program_items_task_schedule USING btree (member_program_item_schedule_id);


--
-- Name: idx_member_program_items_task_schedule_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_task_schedule_task ON public.member_program_items_task_schedule USING btree (member_program_item_task_id);


--
-- Name: idx_member_program_items_therapy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_therapy ON public.member_program_items USING btree (therapy_id);


--
-- Name: idx_member_program_payments_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_payments_due_date ON public.member_program_payments USING btree (payment_due_date);


--
-- Name: idx_member_program_payments_method_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_payments_method_id ON public.member_program_payments USING btree (payment_method_id);


--
-- Name: idx_member_program_payments_payment_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_payments_payment_date ON public.member_program_payments USING btree (payment_date);


--
-- Name: idx_member_program_payments_program_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_payments_program_id ON public.member_program_payments USING btree (member_program_id);


--
-- Name: idx_member_program_payments_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_payments_status_id ON public.member_program_payments USING btree (payment_status_id);


--
-- Name: idx_member_programs_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_programs_lead_id ON public.member_programs USING btree (lead_id);


--
-- Name: idx_member_programs_source_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_programs_source_template ON public.member_programs USING btree (source_template_id);


--
-- Name: idx_member_programs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_programs_status ON public.member_programs USING btree (program_status_id);


--
-- Name: idx_menu_items_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_items_section ON public.menu_items USING btree (section);


--
-- Name: idx_user_menu_permissions_path; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_menu_permissions_path ON public.user_menu_permissions USING btree (menu_path);


--
-- Name: idx_user_menu_permissions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_menu_permissions_user_id ON public.user_menu_permissions USING btree (user_id);


--
-- Name: member_program_item_schedule tr_audit_member_item_schedule; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_item_schedule AFTER INSERT OR DELETE OR UPDATE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION public.audit_member_item_schedule();


--
-- Name: member_program_items_task_schedule tr_audit_member_item_task_schedule; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_item_task_schedule AFTER INSERT OR DELETE OR UPDATE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION public.audit_member_item_task_schedule();


--
-- Name: member_program_finances tr_audit_member_program_finances; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_program_finances AFTER INSERT OR DELETE OR UPDATE ON public.member_program_finances FOR EACH ROW EXECUTE FUNCTION public.audit_member_program_finances();


--
-- Name: member_program_item_tasks tr_audit_member_program_item_tasks; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_program_item_tasks AFTER INSERT OR DELETE OR UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION public.audit_member_program_item_tasks();


--
-- Name: member_program_items tr_audit_member_program_items; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_program_items AFTER INSERT OR DELETE OR UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION public.audit_member_program_items();


--
-- Name: member_program_payments tr_audit_member_program_payments; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_program_payments AFTER INSERT OR DELETE OR UPDATE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION public.audit_member_program_payments();


--
-- Name: member_programs tr_audit_member_programs; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_member_programs AFTER INSERT OR DELETE OR UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION public.audit_member_programs();


--
-- Name: bodies tr_audit_support_bodies; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_support_bodies AFTER INSERT OR DELETE OR UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION public.audit_support_trigger('body_id');


--
-- Name: buckets tr_audit_support_buckets; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_support_buckets AFTER INSERT OR DELETE OR UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION public.audit_support_trigger('bucket_id');


--
-- Name: payment_methods tr_audit_support_payment_methods; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_support_payment_methods AFTER INSERT OR DELETE OR UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.audit_support_trigger('payment_method_id');


--
-- Name: payment_status tr_audit_support_payment_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_support_payment_status AFTER INSERT OR DELETE OR UPDATE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION public.audit_support_trigger('program_status_id');


--
-- Name: therapies tr_audit_support_therapies; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_support_therapies AFTER INSERT OR DELETE OR UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION public.audit_support_trigger('therapy_id');


--
-- Name: therapytype tr_audit_support_therapytype; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_audit_support_therapytype AFTER INSERT OR DELETE OR UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION public.audit_support_trigger('therapy_type_id');


--
-- Name: financing_types trigger_audit_financing_types; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_audit_financing_types BEFORE INSERT OR UPDATE ON public.financing_types FOR EACH ROW EXECUTE FUNCTION public.audit_financing_types();


--
-- Name: member_program_payments trigger_audit_member_program_payments; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_audit_member_program_payments BEFORE INSERT OR UPDATE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION public.audit_member_program_payments();


--
-- Name: payment_methods trigger_audit_payment_methods; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_audit_payment_methods BEFORE INSERT OR UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.audit_payment_methods();


--
-- Name: payment_status trigger_audit_payment_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_audit_payment_status BEFORE INSERT OR UPDATE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION public.audit_payment_status();


--
-- Name: bodies update_bodies_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bodies_timestamp BEFORE UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: buckets update_buckets_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_buckets_timestamp BEFORE UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: campaigns update_campaigns_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: leads update_leads_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_leads_timestamp BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: member_program_item_schedule update_member_program_item_schedule_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_item_schedule_timestamp BEFORE UPDATE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: member_program_item_tasks update_member_program_item_tasks_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_item_tasks_timestamp BEFORE UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: member_program_items_task_schedule update_member_program_items_task_schedule_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_items_task_schedule_timestamp BEFORE UPDATE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: member_program_items update_member_program_items_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_items_timestamp BEFORE UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: member_programs update_member_programs_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_programs_timestamp BEFORE UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: pillars update_pillars_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_pillars_timestamp BEFORE UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: program_status update_program_status_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_program_status_timestamp BEFORE UPDATE ON public.program_status FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: program_template_items update_program_template_items_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_program_template_items_timestamp BEFORE UPDATE ON public.program_template_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: program_template update_program_template_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_program_template_timestamp BEFORE UPDATE ON public.program_template FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: status update_status_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_status_timestamp BEFORE UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: therapies_bodies_pillars update_therapies_bodies_pillars_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapies_bodies_pillars_timestamp BEFORE UPDATE ON public.therapies_bodies_pillars FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: therapies update_therapies_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapies_timestamp BEFORE UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: therapy_tasks update_therapy_tasks_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapy_tasks_timestamp BEFORE UPDATE ON public.therapy_tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: therapytype update_therapy_type_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapy_type_timestamp BEFORE UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: vendors update_vendors_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendors_timestamp BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- Name: audit_event_changes audit_event_changes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_event_changes
    ADD CONSTRAINT audit_event_changes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.audit_events(event_id) ON DELETE CASCADE;


--
-- Name: bodies bodies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bodies
    ADD CONSTRAINT bodies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bodies bodies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bodies
    ADD CONSTRAINT bodies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: buckets buckets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT buckets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: buckets buckets_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT buckets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: campaigns campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: campaigns campaigns_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: campaigns campaigns_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: financing_types financing_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financing_types
    ADD CONSTRAINT financing_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: financing_types financing_types_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financing_types
    ADD CONSTRAINT financing_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapies fk_bucket; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT fk_bucket FOREIGN KEY (bucket_id) REFERENCES public.buckets(bucket_id);


--
-- Name: lead_notes fk_lead_notes_lead_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT fk_lead_notes_lead_id FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id) ON DELETE CASCADE;


--
-- Name: member_program_finances fk_member_program_finances_financing_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT fk_member_program_finances_financing_type FOREIGN KEY (financing_type_id) REFERENCES public.financing_types(financing_type_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_program_finances fk_member_program_finances_program; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT fk_member_program_finances_program FOREIGN KEY (member_program_id) REFERENCES public.member_programs(member_program_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_program_item_tasks fk_member_program_item_tasks_completed_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_completed_by FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: member_program_item_tasks fk_member_program_item_tasks_created_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: member_program_item_tasks fk_member_program_item_tasks_item; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_item FOREIGN KEY (member_program_item_id) REFERENCES public.member_program_items(member_program_item_id) ON DELETE CASCADE;


--
-- Name: member_program_item_tasks fk_member_program_item_tasks_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_task FOREIGN KEY (task_id) REFERENCES public.therapy_tasks(task_id);


--
-- Name: member_program_item_tasks fk_member_program_item_tasks_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: member_program_items fk_member_program_items_program; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items
    ADD CONSTRAINT fk_member_program_items_program FOREIGN KEY (member_program_id) REFERENCES public.member_programs(member_program_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: member_program_payments fk_member_program_payments_method; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT fk_member_program_payments_method FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(payment_method_id);


--
-- Name: member_program_payments fk_member_program_payments_program; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT fk_member_program_payments_program FOREIGN KEY (member_program_id) REFERENCES public.member_programs(member_program_id) ON DELETE CASCADE;


--
-- Name: member_program_payments fk_member_program_payments_status; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT fk_member_program_payments_status FOREIGN KEY (payment_status_id) REFERENCES public.payment_status(payment_status_id);


--
-- Name: member_programs fk_member_programs_lead; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT fk_member_programs_lead FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id);


--
-- Name: member_programs fk_member_programs_program_status; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT fk_member_programs_program_status FOREIGN KEY (program_status_id) REFERENCES public.program_status(program_status_id);


--
-- Name: member_programs fk_member_programs_source_template; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT fk_member_programs_source_template FOREIGN KEY (source_template_id) REFERENCES public.program_template(program_template_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: program_template_items fk_program_template; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT fk_program_template FOREIGN KEY (program_template_id) REFERENCES public.program_template(program_template_id) ON DELETE CASCADE;


--
-- Name: therapy_tasks fk_therapy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT fk_therapy FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- Name: program_template_items fk_therapy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT fk_therapy FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- Name: member_program_items fk_therapy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items
    ADD CONSTRAINT fk_therapy FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- Name: therapies fk_therapy_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT fk_therapy_type FOREIGN KEY (therapy_type_id) REFERENCES public.therapytype(therapy_type_id);


--
-- Name: lead_notes lead_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: leads leads_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status(status_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: leads leads_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_program_finances member_program_finances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT member_program_finances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_program_finances member_program_finances_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT member_program_finances_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_program_item_schedule member_program_item_schedule_member_program_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_schedule
    ADD CONSTRAINT member_program_item_schedule_member_program_item_id_fkey FOREIGN KEY (member_program_item_id) REFERENCES public.member_program_items(member_program_item_id) ON DELETE CASCADE;


--
-- Name: member_program_items_task_schedule member_program_items_task_sch_member_program_item_schedule_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items_task_schedule
    ADD CONSTRAINT member_program_items_task_sch_member_program_item_schedule_fkey FOREIGN KEY (member_program_item_schedule_id) REFERENCES public.member_program_item_schedule(member_program_item_schedule_id) ON DELETE CASCADE;


--
-- Name: member_program_items_task_schedule member_program_items_task_sche_member_program_item_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items_task_schedule
    ADD CONSTRAINT member_program_items_task_sche_member_program_item_task_id_fkey FOREIGN KEY (member_program_item_task_id) REFERENCES public.member_program_item_tasks(member_program_item_task_id) ON DELETE CASCADE;


--
-- Name: member_program_payments member_program_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT member_program_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_program_payments member_program_payments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT member_program_payments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: member_programs member_programs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT member_programs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: member_programs member_programs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT member_programs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: payment_methods payment_methods_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payment_methods payment_methods_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payment_status payment_status_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_status
    ADD CONSTRAINT payment_status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payment_status payment_status_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_status
    ADD CONSTRAINT payment_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pillars pillars_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pillars
    ADD CONSTRAINT pillars_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pillars pillars_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pillars
    ADD CONSTRAINT pillars_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: program_status program_status_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_status
    ADD CONSTRAINT program_status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: program_status program_status_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_status
    ADD CONSTRAINT program_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: program_template program_template_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template
    ADD CONSTRAINT program_template_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_template_items program_template_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT program_template_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_template_items program_template_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT program_template_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_template program_template_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template
    ADD CONSTRAINT program_template_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: status status_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: status status_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapies_bodies_pillars therapies_bodies_pillars_body_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_body_id_fkey FOREIGN KEY (body_id) REFERENCES public.bodies(body_id);


--
-- Name: therapies_bodies_pillars therapies_bodies_pillars_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapies_bodies_pillars therapies_bodies_pillars_pillar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_pillar_id_fkey FOREIGN KEY (pillar_id) REFERENCES public.pillars(pillar_id);


--
-- Name: therapies_bodies_pillars therapies_bodies_pillars_therapy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_therapy_id_fkey FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- Name: therapies_bodies_pillars therapies_bodies_pillars_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapies therapies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT therapies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapies therapies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT therapies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapy_tasks therapy_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT therapy_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapy_tasks therapy_tasks_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT therapy_tasks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapytype therapytype_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapytype
    ADD CONSTRAINT therapytype_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: therapytype therapytype_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapytype
    ADD CONSTRAINT therapytype_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_menu_permissions user_menu_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_menu_permissions user_menu_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: vendors vendors_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: lead_notes Authenticated users can insert lead notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert lead notes" ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lead_notes Authenticated users can view lead notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view lead notes" ON public.lead_notes FOR SELECT TO authenticated USING (true);


--
-- Name: bodies all_access_bodies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_bodies ON public.bodies USING (true);


--
-- Name: buckets all_access_buckets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_buckets ON public.buckets USING (true);


--
-- Name: campaigns all_access_campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_campaigns ON public.campaigns USING (true);


--
-- Name: financing_types all_access_financing_types; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_financing_types ON public.financing_types USING (true);


--
-- Name: leads all_access_leads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_leads ON public.leads USING (true);


--
-- Name: member_program_finances all_access_member_program_finances; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_finances ON public.member_program_finances USING (true);


--
-- Name: member_program_item_schedule all_access_member_program_item_schedule; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_item_schedule ON public.member_program_item_schedule USING (true);


--
-- Name: member_program_item_tasks all_access_member_program_item_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_item_tasks ON public.member_program_item_tasks USING (true);


--
-- Name: member_program_items all_access_member_program_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_items ON public.member_program_items USING (true);


--
-- Name: member_program_items_task_schedule all_access_member_program_items_task_schedule; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_items_task_schedule ON public.member_program_items_task_schedule USING (true);


--
-- Name: member_program_payments all_access_member_program_payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_payments ON public.member_program_payments USING (true);


--
-- Name: member_programs all_access_member_programs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_programs ON public.member_programs USING (true);


--
-- Name: menu_items all_access_menu_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_menu_items ON public.menu_items USING (true);


--
-- Name: payment_methods all_access_payment_methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_payment_methods ON public.payment_methods USING (true);


--
-- Name: payment_status all_access_payment_status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_payment_status ON public.payment_status USING (true);


--
-- Name: pillars all_access_pillars; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_pillars ON public.pillars USING (true);


--
-- Name: program_status all_access_program_status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_program_status ON public.program_status USING (true);


--
-- Name: program_template all_access_program_template; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_program_template ON public.program_template USING (true);


--
-- Name: program_template_items all_access_program_template_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_program_template_items ON public.program_template_items USING (true);


--
-- Name: status all_access_status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_status ON public.status USING (true);


--
-- Name: therapies all_access_therapies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapies ON public.therapies USING (true);


--
-- Name: therapies_bodies_pillars all_access_therapies_bodies_pillars; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapies_bodies_pillars ON public.therapies_bodies_pillars USING (true);


--
-- Name: therapy_tasks all_access_therapy_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapy_tasks ON public.therapy_tasks USING (true);


--
-- Name: therapytype all_access_therapy_type; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapy_type ON public.therapytype USING (true);


--
-- Name: user_menu_permissions all_access_user_menu_permissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_user_menu_permissions ON public.user_menu_permissions USING (true);


--
-- Name: users all_access_users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_users ON public.users USING (true);


--
-- Name: vendors all_access_vendors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_vendors ON public.vendors USING (true);


--
-- Name: bodies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bodies ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: financing_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.financing_types ENABLE ROW LEVEL SECURITY;

--
-- Name: financing_types financing_types_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY financing_types_read ON public.financing_types FOR SELECT TO authenticated USING (true);


--
-- Name: lead_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_finances; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_finances ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_item_schedule; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_item_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_item_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_item_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_items ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_items_task_schedule; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_items_task_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: member_programs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: member_program_finances mp_finances_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_finances_select_own ON public.member_program_finances FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.member_programs p
  WHERE ((p.member_program_id = member_program_finances.member_program_id) AND (p.created_by = auth.uid())))));


--
-- Name: member_program_payments mp_payments_delete_unpaid_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_payments_delete_unpaid_own ON public.member_program_payments FOR DELETE TO authenticated USING (((payment_date IS NULL) AND (EXISTS ( SELECT 1
   FROM public.member_programs p
  WHERE ((p.member_program_id = member_program_payments.member_program_id) AND (p.created_by = auth.uid()))))));


--
-- Name: member_program_payments mp_payments_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_payments_insert_own ON public.member_program_payments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.member_programs p
  WHERE ((p.member_program_id = member_program_payments.member_program_id) AND (p.created_by = auth.uid())))));


--
-- Name: member_program_payments mp_payments_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_payments_select_own ON public.member_program_payments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.member_programs p
  WHERE ((p.member_program_id = member_program_payments.member_program_id) AND (p.created_by = auth.uid())))));


--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_status ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_status payment_status_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payment_status_read ON public.payment_status FOR SELECT TO authenticated USING (true);


--
-- Name: pillars; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;

--
-- Name: program_status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program_status ENABLE ROW LEVEL SECURITY;

--
-- Name: program_template; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program_template ENABLE ROW LEVEL SECURITY;

--
-- Name: program_template_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program_template_items ENABLE ROW LEVEL SECURITY;

--
-- Name: status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.status ENABLE ROW LEVEL SECURITY;

--
-- Name: therapies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapies ENABLE ROW LEVEL SECURITY;

--
-- Name: therapies_bodies_pillars; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapies_bodies_pillars ENABLE ROW LEVEL SECURITY;

--
-- Name: therapy_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapy_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: therapytype; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapytype ENABLE ROW LEVEL SECURITY;

--
-- Name: user_menu_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer, p_margin_tol numeric); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer, p_margin_tol numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer, p_margin_tol numeric) TO authenticated;
GRANT ALL ON FUNCTION public.apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer, p_margin_tol numeric) TO service_role;


--
-- Name: FUNCTION audit_financing_types(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_financing_types() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_financing_types() TO authenticated;
GRANT ALL ON FUNCTION public.audit_financing_types() TO service_role;


--
-- Name: FUNCTION audit_member_item_schedule(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_member_item_schedule() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_item_schedule() TO service_role;


--
-- Name: FUNCTION audit_member_item_task_schedule(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_member_item_task_schedule() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_item_task_schedule() TO service_role;


--
-- Name: FUNCTION audit_member_program_finances(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_member_program_finances() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_member_program_finances() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_program_finances() TO service_role;


--
-- Name: FUNCTION audit_member_program_item_tasks(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_member_program_item_tasks() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_program_item_tasks() TO service_role;


--
-- Name: FUNCTION audit_member_program_items(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_member_program_items() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_program_items() TO service_role;


--
-- Name: FUNCTION audit_member_program_payments(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_member_program_payments() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_member_program_payments() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_program_payments() TO service_role;


--
-- Name: FUNCTION audit_member_programs(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_member_programs() TO authenticated;
GRANT ALL ON FUNCTION public.audit_member_programs() TO service_role;


--
-- Name: FUNCTION audit_payment_methods(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_payment_methods() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_payment_methods() TO authenticated;
GRANT ALL ON FUNCTION public.audit_payment_methods() TO service_role;


--
-- Name: FUNCTION audit_payment_status(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_payment_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_payment_status() TO authenticated;
GRANT ALL ON FUNCTION public.audit_payment_status() TO service_role;


--
-- Name: FUNCTION audit_support_trigger(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_support_trigger() TO authenticated;
GRANT ALL ON FUNCTION public.audit_support_trigger() TO service_role;


--
-- Name: FUNCTION audit_trigger_function(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.audit_trigger_function() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_trigger_function() TO authenticated;
GRANT ALL ON FUNCTION public.audit_trigger_function() TO service_role;


--
-- Name: FUNCTION compute_program_total_pause_days(p_program_id integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.compute_program_total_pause_days(p_program_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.compute_program_total_pause_days(p_program_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.compute_program_total_pause_days(p_program_id integer) TO service_role;


--
-- Name: FUNCTION create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date) TO authenticated;
GRANT ALL ON FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date) TO service_role;


--
-- Name: FUNCTION example_create_member_program(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.example_create_member_program() FROM PUBLIC;
GRANT ALL ON FUNCTION public.example_create_member_program() TO authenticated;
GRANT ALL ON FUNCTION public.example_create_member_program() TO service_role;


--
-- Name: FUNCTION generate_member_program_schedule(p_program_id integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.generate_member_program_schedule(p_program_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_member_program_schedule(p_program_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.generate_member_program_schedule(p_program_id integer) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION pause_member_program(p_program_id integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.pause_member_program(p_program_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pause_member_program(p_program_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.pause_member_program(p_program_id integer) TO service_role;


--
-- Name: FUNCTION regen_member_program_task_schedule(p_member_program_item_task_id integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.regen_member_program_task_schedule(p_member_program_item_task_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regen_member_program_task_schedule(p_member_program_item_task_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.regen_member_program_task_schedule(p_member_program_item_task_id integer) TO service_role;


--
-- Name: FUNCTION regenerate_member_program_payments(p_program_id integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.regenerate_member_program_payments(p_program_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regenerate_member_program_payments(p_program_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.regenerate_member_program_payments(p_program_id integer) TO service_role;


--
-- Name: FUNCTION update_timestamp_function(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.update_timestamp_function() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_timestamp_function() TO authenticated;
GRANT ALL ON FUNCTION public.update_timestamp_function() TO service_role;


--
-- Name: FUNCTION write_audit_change(p_event_id bigint, p_column_name text, p_old jsonb, p_new jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.write_audit_change(p_event_id bigint, p_column_name text, p_old jsonb, p_new jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.write_audit_change(p_event_id bigint, p_column_name text, p_old jsonb, p_new jsonb) TO service_role;


--
-- Name: FUNCTION write_audit_event(p_table_name text, p_record_id bigint, p_operation text, p_actor uuid, p_scope text, p_related_member_id bigint, p_related_program_id bigint, p_summary text, p_context jsonb, p_old jsonb, p_new jsonb, p_record_pk jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.write_audit_event(p_table_name text, p_record_id bigint, p_operation text, p_actor uuid, p_scope text, p_related_member_id bigint, p_related_program_id bigint, p_summary text, p_context jsonb, p_old jsonb, p_new jsonb, p_record_pk jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.write_audit_event(p_table_name text, p_record_id bigint, p_operation text, p_actor uuid, p_scope text, p_related_member_id bigint, p_related_program_id bigint, p_summary text, p_context jsonb, p_old jsonb, p_new jsonb, p_record_pk jsonb) TO service_role;


--
-- Name: TABLE audit_event_changes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_event_changes TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_event_changes TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_event_changes TO service_role;


--
-- Name: TABLE audit_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_events TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_events TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_events TO service_role;


--
-- Name: SEQUENCE audit_events_event_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.audit_events_event_id_seq TO anon;
GRANT ALL ON SEQUENCE public.audit_events_event_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.audit_events_event_id_seq TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO service_role;


--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO service_role;


--
-- Name: SEQUENCE bodies_body_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bodies_body_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bodies_body_id_seq TO service_role;


--
-- Name: TABLE bodies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bodies TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bodies TO service_role;


--
-- Name: SEQUENCE buckets_bucket_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.buckets_bucket_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.buckets_bucket_id_seq TO service_role;


--
-- Name: TABLE buckets; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.buckets TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.buckets TO service_role;


--
-- Name: TABLE campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.campaigns TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.campaigns TO service_role;


--
-- Name: SEQUENCE campaigns_campaign_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.campaigns_campaign_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.campaigns_campaign_id_seq TO service_role;


--
-- Name: TABLE financing_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.financing_types TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.financing_types TO service_role;


--
-- Name: SEQUENCE financing_types_financing_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.financing_types_financing_type_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.financing_types_financing_type_id_seq TO service_role;


--
-- Name: TABLE lead_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.lead_notes TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.lead_notes TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.lead_notes TO service_role;


--
-- Name: SEQUENCE lead_notes_note_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lead_notes_note_id_seq TO anon;
GRANT ALL ON SEQUENCE public.lead_notes_note_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.lead_notes_note_id_seq TO service_role;


--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leads TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leads TO service_role;


--
-- Name: SEQUENCE leads_lead_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.leads_lead_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.leads_lead_id_seq TO service_role;


--
-- Name: TABLE member_program_finances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_finances TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_finances TO service_role;


--
-- Name: SEQUENCE member_program_finances_member_program_finance_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_finances_member_program_finance_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_finances_member_program_finance_id_seq TO service_role;


--
-- Name: TABLE member_program_item_schedule; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_schedule TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_schedule TO service_role;


--
-- Name: SEQUENCE member_program_item_schedule_member_program_item_schedule_id_se; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_item_schedule_member_program_item_schedule_id_se TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_item_schedule_member_program_item_schedule_id_se TO service_role;


--
-- Name: TABLE member_program_item_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_tasks TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_tasks TO service_role;


--
-- Name: SEQUENCE member_program_item_tasks_member_program_item_task_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq TO service_role;


--
-- Name: TABLE member_program_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items TO service_role;


--
-- Name: SEQUENCE member_program_items_member_program_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_items_member_program_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_items_member_program_item_id_seq TO service_role;


--
-- Name: TABLE member_program_items_task_schedule; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items_task_schedule TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items_task_schedule TO service_role;


--
-- Name: SEQUENCE member_program_items_task_schedule_member_program_item_task_sch; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_items_task_schedule_member_program_item_task_sch TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_items_task_schedule_member_program_item_task_sch TO service_role;


--
-- Name: TABLE member_program_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_payments TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_payments TO service_role;


--
-- Name: SEQUENCE member_program_payments_member_program_payment_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_payments_member_program_payment_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_payments_member_program_payment_id_seq TO service_role;


--
-- Name: TABLE member_programs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_programs TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_programs TO service_role;


--
-- Name: SEQUENCE member_programs_member_program_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_programs_member_program_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_programs_member_program_id_seq TO service_role;


--
-- Name: TABLE menu_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.menu_items TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.menu_items TO service_role;


--
-- Name: SEQUENCE menu_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.menu_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.menu_items_id_seq TO service_role;


--
-- Name: TABLE payment_methods; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.payment_methods TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.payment_methods TO service_role;


--
-- Name: SEQUENCE payment_methods_payment_method_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payment_methods_payment_method_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_methods_payment_method_id_seq TO service_role;


--
-- Name: TABLE payment_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.payment_status TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.payment_status TO service_role;


--
-- Name: SEQUENCE payment_status_payment_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payment_status_payment_status_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_status_payment_status_id_seq TO service_role;


--
-- Name: SEQUENCE pillars_pillar_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pillars_pillar_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pillars_pillar_id_seq TO service_role;


--
-- Name: TABLE pillars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pillars TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pillars TO service_role;


--
-- Name: SEQUENCE program_items_program_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_items_program_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_items_program_item_id_seq TO service_role;


--
-- Name: SEQUENCE program_status_program_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_status_program_status_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_status_program_status_id_seq TO service_role;


--
-- Name: TABLE program_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_status TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_status TO service_role;


--
-- Name: SEQUENCE program_template_program_template_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_template_program_template_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_template_program_template_id_seq TO service_role;


--
-- Name: TABLE program_template; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template TO service_role;


--
-- Name: SEQUENCE program_template_items_program_template_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_template_items_program_template_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_template_items_program_template_items_id_seq TO service_role;


--
-- Name: TABLE program_template_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template_items TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template_items TO service_role;


--
-- Name: SEQUENCE programs_program_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.programs_program_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.programs_program_id_seq TO service_role;


--
-- Name: TABLE status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.status TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.status TO service_role;


--
-- Name: SEQUENCE status_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.status_status_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.status_status_id_seq TO service_role;


--
-- Name: SEQUENCE therapies_therapy_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.therapies_therapy_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.therapies_therapy_id_seq TO service_role;


--
-- Name: TABLE therapies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies TO service_role;


--
-- Name: TABLE therapies_bodies_pillars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies_bodies_pillars TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies_bodies_pillars TO service_role;


--
-- Name: SEQUENCE therapy_tasks_task_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.therapy_tasks_task_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.therapy_tasks_task_id_seq TO service_role;


--
-- Name: TABLE therapy_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapy_tasks TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapy_tasks TO service_role;


--
-- Name: SEQUENCE therapy_type_therapy_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.therapy_type_therapy_type_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.therapy_type_therapy_type_id_seq TO service_role;


--
-- Name: TABLE therapytype; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapytype TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapytype TO service_role;


--
-- Name: TABLE user_menu_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_menu_permissions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_menu_permissions TO service_role;


--
-- Name: SEQUENCE user_menu_permissions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_menu_permissions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_menu_permissions_id_seq TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.users TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.users TO service_role;


--
-- Name: TABLE vendors; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO service_role;


--
-- Name: SEQUENCE vendors_vendor_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.vendors_vendor_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vendors_vendor_id_seq TO service_role;


--
-- Name: TABLE vw_audit_logs_with_fullcontext; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_audit_logs_with_fullcontext TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_audit_logs_with_fullcontext TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_audit_logs_with_fullcontext TO service_role;


--
-- Name: TABLE vw_audit_member_changes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_audit_member_changes TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_audit_member_changes TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_audit_member_changes TO service_role;


--
-- Name: TABLE vw_member_audit_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_member_audit_events TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_member_audit_events TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vw_member_audit_events TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict HXy1aZTXyMq53elNl58n2ykBcCGCSccgRx0xGvbi4Z6kqoAz0eB0dPyutVBXPSj

