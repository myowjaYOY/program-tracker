--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.5

-- Started on 2025-09-08 10:57:32

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

DROP DATABASE IF EXISTS postgres;
--
-- TOC entry 4029 (class 1262 OID 16979)
-- Name: postgres; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE postgres WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF-8';


ALTER DATABASE postgres OWNER TO postgres;

\connect postgres

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
-- TOC entry 19 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4031 (class 0 OID 0)
-- Dependencies: 19
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 358 (class 1255 OID 17201)
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
-- TOC entry 390 (class 1255 OID 17202)
-- Name: create_member_program_from_template(integer, integer, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_id integer, p_start_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_member_program_id INTEGER;
    template_item RECORD;
    therapy_task RECORD;
    new_member_program_item_id INTEGER;
BEGIN
    -- Create the member program
    INSERT INTO member_programs (
        lead_id, program_template_name, description, start_date,
        total_cost, total_charge, source_template_id, margin_percentage, program_status_id
    )
    SELECT 
        p_lead_id, program_template_name, description, p_start_date,
        total_cost, total_charge, program_template_id, margin_percentage, 1 -- Active status
    FROM program_template 
    WHERE program_template_id = p_template_id
    RETURNING member_program_id INTO new_member_program_id;
    
    -- Copy template items to member program items
    FOR template_item IN 
        SELECT pti.*, t.cost, t.charge 
        FROM program_template_items pti
        JOIN therapies t ON pti.therapy_id = t.therapy_id
        WHERE pti.program_template_id = p_template_id
        AND pti.active_flag = TRUE
    LOOP
        -- Insert the member program item
        INSERT INTO member_program_items (
            member_program_id, therapy_id, quantity,
            item_cost, item_charge, days_from_start, days_between, instructions
        ) VALUES (
            new_member_program_id, template_item.therapy_id, template_item.quantity,
            template_item.cost, template_item.charge, 
            template_item.days_from_start, template_item.days_between, template_item.instructions
        ) RETURNING member_program_item_id INTO new_member_program_item_id;
        
        -- Copy therapy tasks for this therapy to member program item tasks
        FOR therapy_task IN 
            SELECT tt.*
            FROM therapy_tasks tt
            WHERE tt.therapy_id = template_item.therapy_id
            AND tt.active_flag = TRUE
        LOOP
            INSERT INTO member_program_item_tasks (
                member_program_item_id, task_id, task_name, description, 
                task_delay, completed_flag, created_by, updated_by
            ) VALUES (
                new_member_program_item_id, therapy_task.task_id, therapy_task.task_name, 
                therapy_task.description, therapy_task.task_delay, false, -- Not completed initially
                auth.uid(), auth.uid()
            );
        END LOOP;
    END LOOP;
    
    RETURN new_member_program_id;
END;
$$;


ALTER FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_id integer, p_start_date date) OWNER TO postgres;

--
-- TOC entry 391 (class 1255 OID 17203)
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
-- TOC entry 361 (class 1255 OID 17204)
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
-- TOC entry 364 (class 1255 OID 17205)
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 265 (class 1259 OID 17330)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    table_name text NOT NULL,
    record_id integer NOT NULL,
    operation text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    column_name text,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now(),
    changed_fields jsonb
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 17336)
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
-- TOC entry 4039 (class 0 OID 0)
-- Dependencies: 266
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- TOC entry 267 (class 1259 OID 17337)
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
-- TOC entry 268 (class 1259 OID 17338)
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
-- TOC entry 269 (class 1259 OID 17349)
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
-- TOC entry 270 (class 1259 OID 17350)
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
-- TOC entry 271 (class 1259 OID 17361)
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
-- TOC entry 272 (class 1259 OID 17371)
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
-- TOC entry 4046 (class 0 OID 0)
-- Dependencies: 272
-- Name: campaigns_campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.campaigns_campaign_id_seq OWNED BY public.campaigns.campaign_id;


--
-- TOC entry 273 (class 1259 OID 17372)
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
-- TOC entry 274 (class 1259 OID 17382)
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
-- TOC entry 4049 (class 0 OID 0)
-- Dependencies: 274
-- Name: leads_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leads_lead_id_seq OWNED BY public.leads.lead_id;


--
-- TOC entry 275 (class 1259 OID 17383)
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
-- TOC entry 276 (class 1259 OID 17398)
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
-- TOC entry 4052 (class 0 OID 0)
-- Dependencies: 276
-- Name: member_program_items_member_program_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_items_member_program_item_id_seq OWNED BY public.member_program_items.member_program_item_id;


--
-- TOC entry 277.5 (class 1259 OID 17400)
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
-- TOC entry 277.6 (class 1259 OID 17401)
-- Name: member_program_item_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_item_tasks (
    member_program_item_task_id integer DEFAULT nextval('public.member_program_item_tasks_member_program_item_task_id_seq'::regclass) NOT NULL,
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
-- TOC entry 4052.5 (class 0 OID 0)
-- Dependencies: 277.5
-- Name: member_program_item_tasks_member_program_item_task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq OWNED BY public.member_program_item_tasks.member_program_item_task_id;


--
-- TOC entry 277 (class 1259 OID 17399)
-- Name: member_program_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_schedule (
    program_schedule_id integer NOT NULL,
    member_program_item_id integer NOT NULL,
    schedule_type text NOT NULL,
    name text NOT NULL,
    instructions text,
    scheduled_date date NOT NULL,
    actual_date date,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid(),
    CONSTRAINT member_program_schedule_schedule_type_check CHECK ((schedule_type = ANY (ARRAY['Therapy'::text, 'Task'::text])))
);


ALTER TABLE public.member_program_schedule OWNER TO postgres;

--
-- TOC entry 278 (class 1259 OID 17410)
-- Name: member_program_schedule_program_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_schedule_program_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.member_program_schedule_program_schedule_id_seq OWNER TO postgres;

--
-- TOC entry 4055 (class 0 OID 0)
-- Dependencies: 278
-- Name: member_program_schedule_program_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_program_schedule_program_schedule_id_seq OWNED BY public.member_program_schedule.program_schedule_id;


--
-- TOC entry 279 (class 1259 OID 17411)
-- Name: member_programs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_programs (
    member_program_id integer NOT NULL,
    program_template_name text NOT NULL,
    description text,
    total_cost numeric(9,2),
    total_charge numeric(9,2),
    margin_percentage numeric(5,2),
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
-- TOC entry 280 (class 1259 OID 17422)
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
-- TOC entry 4058 (class 0 OID 0)
-- Dependencies: 280
-- Name: member_programs_member_program_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.member_programs_member_program_id_seq OWNED BY public.member_programs.member_program_id;


--
-- TOC entry 315 (class 1259 OID 59417)
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
-- TOC entry 314 (class 1259 OID 59416)
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
-- TOC entry 4061 (class 0 OID 0)
-- Dependencies: 314
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- TOC entry 281 (class 1259 OID 17423)
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
-- TOC entry 282 (class 1259 OID 17424)
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
-- TOC entry 283 (class 1259 OID 17435)
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
-- TOC entry 284 (class 1259 OID 17436)
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
-- TOC entry 285 (class 1259 OID 17437)
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
-- TOC entry 286 (class 1259 OID 17448)
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
-- TOC entry 287 (class 1259 OID 17449)
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
-- TOC entry 288 (class 1259 OID 17460)
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
-- TOC entry 289 (class 1259 OID 17461)
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
-- TOC entry 290 (class 1259 OID 17475)
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
-- TOC entry 291 (class 1259 OID 17476)
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
-- TOC entry 292 (class 1259 OID 17486)
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
-- TOC entry 4074 (class 0 OID 0)
-- Dependencies: 292
-- Name: status_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.status_status_id_seq OWNED BY public.status.status_id;


--
-- TOC entry 293 (class 1259 OID 17487)
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
-- TOC entry 294 (class 1259 OID 17488)
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
    updated_by uuid DEFAULT auth.uid()
);


ALTER TABLE public.therapies OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 17499)
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
-- TOC entry 296 (class 1259 OID 17507)
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
-- TOC entry 297 (class 1259 OID 17508)
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
-- Foreign key constraints for therapy_tasks table
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT therapy_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT therapy_tasks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- TOC entry 298 (class 1259 OID 17519)
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
-- TOC entry 299 (class 1259 OID 17520)
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
-- TOC entry 317 (class 1259 OID 59428)
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
-- TOC entry 316 (class 1259 OID 59427)
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
-- TOC entry 4084 (class 0 OID 0)
-- Dependencies: 316
-- Name: user_menu_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_menu_permissions_id_seq OWNED BY public.user_menu_permissions.id;


--
-- TOC entry 300 (class 1259 OID 17531)
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
-- TOC entry 301 (class 1259 OID 17537)
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
-- TOC entry 302 (class 1259 OID 17550)
-- Name: payment_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_status (
    payment_status_id integer NOT NULL,
    payment_status_name text NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.payment_status OWNER TO postgres;

--
-- TOC entry 303 (class 1259 OID 17563)
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    payment_method_id integer NOT NULL,
    payment_method_name text NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- TOC entry 304 (class 1259 OID 17576)
-- Name: financing_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financing_types (
    financing_type_id integer NOT NULL,
    financing_type_name text NOT NULL,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.financing_types OWNER TO postgres;

--
-- TOC entry 305 (class 1259 OID 17589)
-- Name: member_program_finances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_finances (
    member_program_finance_id integer NOT NULL,
    program_id integer NOT NULL,
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
-- TOC entry 306 (class 1259 OID 17602)
-- Name: member_program_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_program_payments (
    member_program_payment_id integer NOT NULL,
    program_id integer NOT NULL,
    payment_amount numeric(10,2) NOT NULL,
    payment_due_date date NOT NULL,
    payment_status_id integer NOT NULL,
    payment_method_id integer,
    payment_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.member_program_payments OWNER TO postgres;

--
-- TOC entry 312 (class 1259 OID 17547)
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
-- TOC entry 310 (class 1259 OID 17576)
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
-- TOC entry 311 (class 1259 OID 17589)
-- Name: member_program_payments_member_program_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.member_program_payments_member_program_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.member_program_payments_member_program_payment_id_seq OWNER TO postgres;

--
-- TOC entry 307 (class 1259 OID 17615)
-- Name: payment_status_payment_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_status_payment_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.payment_status_payment_status_id_seq OWNER TO postgres;

--
-- TOC entry 308 (class 1259 OID 17628)
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_methods_payment_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNER TO postgres;

--
-- TOC entry 309 (class 1259 OID 17641)
-- Name: financing_types_financing_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.financing_types_financing_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.financing_types_financing_type_id_seq OWNER TO postgres;

--
-- TOC entry 4088 (class 0 OID 0)
-- Dependencies: 312
-- Name: vendors_vendor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendors_vendor_id_seq OWNED BY public.vendors.vendor_id;

ALTER SEQUENCE public.member_program_finances_member_program_finance_id_seq OWNED BY public.member_program_finances.member_program_finance_id;

ALTER SEQUENCE public.member_program_payments_member_program_payment_id_seq OWNED BY public.member_program_payments.member_program_payment_id;

ALTER SEQUENCE public.payment_status_payment_status_id_seq OWNED BY public.payment_status.payment_status_id;

ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNED BY public.payment_methods.payment_method_id;

ALTER SEQUENCE public.financing_types_financing_type_id_seq OWNED BY public.financing_types.financing_type_id;


--
-- TOC entry 3581 (class 2604 OID 17606)
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- TOC entry 3595 (class 2604 OID 17607)
-- Name: campaigns campaign_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN campaign_id SET DEFAULT nextval('public.campaigns_campaign_id_seq'::regclass);


--
-- TOC entry 3601 (class 2604 OID 17608)
-- Name: leads lead_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN lead_id SET DEFAULT nextval('public.leads_lead_id_seq'::regclass);


--
-- TOC entry 3607 (class 2604 OID 17609)
-- Name: member_program_items member_program_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items ALTER COLUMN member_program_item_id SET DEFAULT nextval('public.member_program_items_member_program_item_id_seq'::regclass);


--
-- TOC entry 3618 (class 2604 OID 17610)
-- Name: member_program_schedule program_schedule_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_schedule ALTER COLUMN program_schedule_id SET DEFAULT nextval('public.member_program_schedule_program_schedule_id_seq'::regclass);


--
-- TOC entry 3624 (class 2604 OID 17611)
-- Name: member_programs member_program_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs ALTER COLUMN member_program_id SET DEFAULT nextval('public.member_programs_member_program_id_seq'::regclass);


--
-- TOC entry 3696 (class 2604 OID 59420)
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- TOC entry 3658 (class 2604 OID 17612)
-- Name: status status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status ALTER COLUMN status_id SET DEFAULT nextval('public.status_status_id_seq'::regclass);


--
-- TOC entry 3699 (class 2604 OID 59431)
-- Name: user_menu_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_menu_permissions_id_seq'::regclass);


--
-- TOC entry 3690 (class 2604 OID 17613)
-- Name: vendors vendor_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors ALTER COLUMN vendor_id SET DEFAULT nextval('public.vendors_vendor_id_seq'::regclass);

ALTER TABLE ONLY public.member_program_finances ALTER COLUMN member_program_finance_id SET DEFAULT nextval('public.member_program_finances_member_program_finance_id_seq'::regclass);

ALTER TABLE ONLY public.member_program_payments ALTER COLUMN member_program_payment_id SET DEFAULT nextval('public.member_program_payments_member_program_payment_id_seq'::regclass);

ALTER TABLE ONLY public.payment_status ALTER COLUMN payment_status_id SET DEFAULT nextval('public.payment_status_payment_status_id_seq'::regclass);

ALTER TABLE ONLY public.payment_methods ALTER COLUMN payment_method_id SET DEFAULT nextval('public.payment_methods_payment_method_id_seq'::regclass);

ALTER TABLE ONLY public.financing_types ALTER COLUMN financing_type_id SET DEFAULT nextval('public.financing_types_financing_type_id_seq'::regclass);


--
-- TOC entry 3703 (class 2606 OID 17659)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3705 (class 2606 OID 17661)
-- Name: bodies bodies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bodies
    ADD CONSTRAINT bodies_pkey PRIMARY KEY (body_id);


--
-- TOC entry 3707 (class 2606 OID 17663)
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (bucket_id);


--
-- TOC entry 3709 (class 2606 OID 17665)
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);


--
-- TOC entry 3711 (class 2606 OID 17667)
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (lead_id);


--
-- TOC entry 3715 (class 2606 OID 17669)
-- Name: member_program_items member_program_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items
    ADD CONSTRAINT member_program_items_pkey PRIMARY KEY (member_program_item_id);


--
-- TOC entry 3718.5 (class 2606 OID 17670)
-- Name: member_program_item_tasks member_program_item_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT member_program_item_tasks_pkey PRIMARY KEY (member_program_item_task_id);


--
-- TOC entry 3719 (class 2606 OID 17671)
-- Name: member_program_schedule member_program_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_schedule
    ADD CONSTRAINT member_program_schedule_pkey PRIMARY KEY (program_schedule_id);


--
-- TOC entry 3724 (class 2606 OID 17673)
-- Name: member_programs member_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT member_programs_pkey PRIMARY KEY (member_program_id);


--
-- TOC entry 3749 (class 2606 OID 59426)
-- Name: menu_items menu_items_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_path_key UNIQUE (path);


--
-- TOC entry 3751 (class 2606 OID 59424)
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3726 (class 2606 OID 17675)
-- Name: pillars pillars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pillars
    ADD CONSTRAINT pillars_pkey PRIMARY KEY (pillar_id);


--
-- TOC entry 3728 (class 2606 OID 17677)
-- Name: program_status program_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_status
    ADD CONSTRAINT program_status_pkey PRIMARY KEY (program_status_id);


--
-- TOC entry 3732 (class 2606 OID 17679)
-- Name: program_template_items program_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT program_template_items_pkey PRIMARY KEY (program_template_items_id);


--
-- TOC entry 3730 (class 2606 OID 17681)
-- Name: program_template program_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template
    ADD CONSTRAINT program_template_pkey PRIMARY KEY (program_template_id);


--
-- TOC entry 3734 (class 2606 OID 17683)
-- Name: status status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (status_id);


--
-- TOC entry 3738 (class 2606 OID 17685)
-- Name: therapies_bodies_pillars therapies_bodies_pillars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_pkey PRIMARY KEY (therapy_id, body_id, pillar_id);


--
-- TOC entry 3736 (class 2606 OID 17687)
-- Name: therapies therapies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT therapies_pkey PRIMARY KEY (therapy_id);


--
-- TOC entry 3740 (class 2606 OID 17689)
-- Name: therapy_tasks therapy_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT therapy_tasks_pkey PRIMARY KEY (task_id);


--
-- TOC entry 3742 (class 2606 OID 17691)
-- Name: therapytype therapy_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapytype
    ADD CONSTRAINT therapy_type_pkey PRIMARY KEY (therapy_type_id);


--
-- TOC entry 3755 (class 2606 OID 59434)
-- Name: user_menu_permissions user_menu_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 3757 (class 2606 OID 59436)
-- Name: user_menu_permissions user_menu_permissions_user_id_menu_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_user_id_menu_path_key UNIQUE (user_id, menu_path);


--
-- TOC entry 3744 (class 2606 OID 17693)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3746 (class 2606 OID 17695)
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT member_program_finances_pkey PRIMARY KEY (member_program_finance_id);

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT member_program_payments_pkey PRIMARY KEY (member_program_payment_id);

ALTER TABLE ONLY public.payment_status
    ADD CONSTRAINT payment_status_pkey PRIMARY KEY (payment_status_id);

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (payment_method_id);

ALTER TABLE ONLY public.financing_types
    ADD CONSTRAINT financing_types_pkey PRIMARY KEY (financing_type_id);


--
-- TOC entry 3712 (class 1259 OID 17752)
-- Name: idx_member_program_items_member_program; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_member_program ON public.member_program_items USING btree (member_program_id);


--
-- TOC entry 3713 (class 1259 OID 17753)
-- Name: idx_member_program_items_therapy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_items_therapy ON public.member_program_items USING btree (therapy_id);


--
-- TOC entry 3715.5 (class 1259 OID 17753.5)
-- Name: idx_member_program_item_tasks_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_tasks_item ON public.member_program_item_tasks USING btree (member_program_item_id);


--
-- TOC entry 3715.6 (class 1259 OID 17753.6)
-- Name: idx_member_program_item_tasks_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_tasks_task ON public.member_program_item_tasks USING btree (task_id);


--
-- TOC entry 3715.7 (class 1259 OID 17753.7)
-- Name: idx_member_program_item_tasks_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_item_tasks_completed ON public.member_program_item_tasks USING btree (completed_flag);


--
-- TOC entry 3716 (class 1259 OID 17754)
-- Name: idx_member_program_schedule_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_schedule_date ON public.member_program_schedule USING btree (scheduled_date);


--
-- TOC entry 3717 (class 1259 OID 17755)
-- Name: idx_member_program_schedule_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_program_schedule_item ON public.member_program_schedule USING btree (member_program_item_id);


--
-- TOC entry 3720 (class 1259 OID 17756)
-- Name: idx_member_programs_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_programs_lead_id ON public.member_programs USING btree (lead_id);


--
-- TOC entry 3721 (class 1259 OID 17757)
-- Name: idx_member_programs_source_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_programs_source_template ON public.member_programs USING btree (source_template_id);


--
-- TOC entry 3722 (class 1259 OID 17758)
-- Name: idx_member_programs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_programs_status ON public.member_programs USING btree (program_status_id);


--
-- TOC entry 3747 (class 1259 OID 59451)
-- Name: idx_menu_items_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_items_section ON public.menu_items USING btree (section);


--
-- TOC entry 3752 (class 1259 OID 59450)
-- Name: idx_user_menu_permissions_path; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_menu_permissions_path ON public.user_menu_permissions USING btree (menu_path);


--
-- TOC entry 3753 (class 1259 OID 59449)
-- Name: idx_user_menu_permissions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_menu_permissions_user_id ON public.user_menu_permissions USING btree (user_id);


--
-- TOC entry 3802 (class 2620 OID 17767)
-- Name: bodies audit_bodies_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_bodies_trigger AFTER INSERT OR DELETE OR UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('body_id');


--
-- TOC entry 3804 (class 2620 OID 17768)
-- Name: buckets audit_buckets_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_buckets_trigger AFTER INSERT OR DELETE OR UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('bucket_id');


--
-- TOC entry 3806 (class 2620 OID 17769)
-- Name: campaigns audit_campaigns_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_campaigns_trigger AFTER INSERT OR DELETE OR UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('campaign_id');


--
-- TOC entry 3808 (class 2620 OID 17770)
-- Name: leads audit_leads_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_leads_trigger AFTER INSERT OR DELETE OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('lead_id');


--
-- TOC entry 3810 (class 2620 OID 17771)
-- Name: member_program_items audit_member_program_items_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_member_program_items_trigger AFTER INSERT OR DELETE OR UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('member_program_item_id');


--
-- TOC entry 3811.5 (class 2620 OID 17771.5)
-- Name: member_program_item_tasks audit_member_program_item_tasks_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_member_program_item_tasks_trigger AFTER INSERT OR DELETE OR UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('member_program_item_task_id');


--
-- TOC entry 3812 (class 2620 OID 17772)
-- Name: member_program_schedule audit_member_program_schedule_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_member_program_schedule_trigger AFTER INSERT OR DELETE OR UPDATE ON public.member_program_schedule FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('program_schedule_id');


--
-- TOC entry 3814 (class 2620 OID 17773)
-- Name: member_programs audit_member_programs_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_member_programs_trigger AFTER INSERT OR DELETE OR UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('member_program_id');


--
-- TOC entry 3816 (class 2620 OID 17774)
-- Name: pillars audit_pillars_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_pillars_trigger AFTER INSERT OR DELETE OR UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('pillar_id');


--
-- TOC entry 3818 (class 2620 OID 17775)
-- Name: program_status audit_program_status_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_program_status_trigger AFTER INSERT OR DELETE OR UPDATE ON public.program_status FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('program_status_id');


--
-- TOC entry 3822 (class 2620 OID 17776)
-- Name: program_template_items audit_program_template_items_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_program_template_items_trigger AFTER INSERT OR DELETE OR UPDATE ON public.program_template_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('program_template_items_id');


--
-- TOC entry 3820 (class 2620 OID 17777)
-- Name: program_template audit_program_template_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_program_template_trigger AFTER INSERT OR DELETE OR UPDATE ON public.program_template FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('program_template_id');


--
-- TOC entry 3824 (class 2620 OID 17778)
-- Name: status audit_status_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_status_trigger AFTER INSERT OR DELETE OR UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('status_id');


--
-- TOC entry 3828 (class 2620 OID 17779)
-- Name: therapies_bodies_pillars audit_therapies_bodies_pillars_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_therapies_bodies_pillars_trigger AFTER INSERT OR DELETE OR UPDATE ON public.therapies_bodies_pillars FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('therapy_id', 'body_id', 'pillar_id');


--
-- TOC entry 3826 (class 2620 OID 17780)
-- Name: therapies audit_therapies_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_therapies_trigger AFTER INSERT OR DELETE OR UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('therapy_id');


--
-- TOC entry 3830 (class 2620 OID 17781)
-- Name: therapy_tasks audit_therapy_tasks_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_therapy_tasks_trigger AFTER INSERT OR DELETE OR UPDATE ON public.therapy_tasks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('task_id');


--
-- TOC entry 3832 (class 2620 OID 17782)
-- Name: therapytype audit_therapy_type_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_therapy_type_trigger AFTER INSERT OR DELETE OR UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('therapy_type_id');


--
-- TOC entry 3834 (class 2620 OID 17783)
-- Name: vendors audit_vendors_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_vendors_trigger AFTER INSERT OR DELETE OR UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function('vendor_id');


--
-- TOC entry 3803 (class 2620 OID 17784)
-- Name: bodies update_bodies_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bodies_timestamp BEFORE UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3805 (class 2620 OID 17785)
-- Name: buckets update_buckets_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_buckets_timestamp BEFORE UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3807 (class 2620 OID 17786)
-- Name: campaigns update_campaigns_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3809 (class 2620 OID 17787)
-- Name: leads update_leads_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_leads_timestamp BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3811 (class 2620 OID 17788)
-- Name: member_program_items update_member_program_items_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_items_timestamp BEFORE UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3812.5 (class 2620 OID 17788.5)
-- Name: member_program_item_tasks update_member_program_item_tasks_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_item_tasks_timestamp BEFORE UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3813 (class 2620 OID 17789)
-- Name: member_program_schedule update_member_program_schedule_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_program_schedule_timestamp BEFORE UPDATE ON public.member_program_schedule FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3815 (class 2620 OID 17790)
-- Name: member_programs update_member_programs_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_member_programs_timestamp BEFORE UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3817 (class 2620 OID 17791)
-- Name: pillars update_pillars_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_pillars_timestamp BEFORE UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3819 (class 2620 OID 17792)
-- Name: program_status update_program_status_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_program_status_timestamp BEFORE UPDATE ON public.program_status FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3823 (class 2620 OID 17793)
-- Name: program_template_items update_program_template_items_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_program_template_items_timestamp BEFORE UPDATE ON public.program_template_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3821 (class 2620 OID 17794)
-- Name: program_template update_program_template_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_program_template_timestamp BEFORE UPDATE ON public.program_template FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3825 (class 2620 OID 17795)
-- Name: status update_status_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_status_timestamp BEFORE UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3829 (class 2620 OID 17796)
-- Name: therapies_bodies_pillars update_therapies_bodies_pillars_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapies_bodies_pillars_timestamp BEFORE UPDATE ON public.therapies_bodies_pillars FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3827 (class 2620 OID 17797)
-- Name: therapies update_therapies_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapies_timestamp BEFORE UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3831 (class 2620 OID 17798)
-- Name: therapy_tasks update_therapy_tasks_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapy_tasks_timestamp BEFORE UPDATE ON public.therapy_tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3833 (class 2620 OID 17799)
-- Name: therapytype update_therapy_type_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_therapy_type_timestamp BEFORE UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3835 (class 2620 OID 17800)
-- Name: vendors update_vendors_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendors_timestamp BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_function();


--
-- TOC entry 3758 (class 2606 OID 17858)
-- Name: bodies bodies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bodies
    ADD CONSTRAINT bodies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3759 (class 2606 OID 17863)
-- Name: bodies bodies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bodies
    ADD CONSTRAINT bodies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3760 (class 2606 OID 17868)
-- Name: buckets buckets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT buckets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3761 (class 2606 OID 17873)
-- Name: buckets buckets_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT buckets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3762 (class 2606 OID 17878)
-- Name: campaigns campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3763 (class 2606 OID 17883)
-- Name: campaigns campaigns_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3764 (class 2606 OID 17888)
-- Name: campaigns campaigns_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3786 (class 2606 OID 17893)
-- Name: therapies fk_bucket; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT fk_bucket FOREIGN KEY (bucket_id) REFERENCES public.buckets(bucket_id);


--
-- TOC entry 3770 (class 2606 OID 17898)
-- Name: member_program_schedule fk_member_program_schedule_item; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_schedule
    ADD CONSTRAINT fk_member_program_schedule_item FOREIGN KEY (member_program_item_id) REFERENCES public.member_program_items(member_program_item_id) ON DELETE CASCADE;


--
-- TOC entry 3771 (class 2606 OID 17903)
-- Name: member_programs fk_member_programs_lead; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT fk_member_programs_lead FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id);


--
-- TOC entry 3772 (class 2606 OID 17908)
-- Name: member_programs fk_member_programs_program_status; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT fk_member_programs_program_status FOREIGN KEY (program_status_id) REFERENCES public.program_status(program_status_id);


--
-- TOC entry 3773 (class 2606 OID 17913)
-- Name: member_programs fk_member_programs_source_template; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT fk_member_programs_source_template FOREIGN KEY (source_template_id) REFERENCES public.program_template(program_template_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3774 (class 2606 OID 17918)
-- Name: member_programs member_programs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT member_programs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3775 (class 2606 OID 17923)
-- Name: member_programs member_programs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_programs
    ADD CONSTRAINT member_programs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 3780 (class 2606 OID 17918)
-- Name: program_template_items fk_program_template; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT fk_program_template FOREIGN KEY (program_template_id) REFERENCES public.program_template(program_template_id) ON DELETE CASCADE;


--
-- TOC entry 3795 (class 2606 OID 17923)
-- Name: therapy_tasks fk_therapy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapy_tasks
    ADD CONSTRAINT fk_therapy FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- TOC entry 3781 (class 2606 OID 17928)
-- Name: program_template_items fk_therapy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT fk_therapy FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- TOC entry 3769 (class 2606 OID 17933)
-- Name: member_program_items fk_therapy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_items
    ADD CONSTRAINT fk_therapy FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- TOC entry 3786.5 (class 2606 OID 17937.5)
-- Name: member_program_item_tasks fk_member_program_item_tasks_item; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_item FOREIGN KEY (member_program_item_id) REFERENCES public.member_program_items(member_program_item_id) ON DELETE CASCADE;


--
-- TOC entry 3786.6 (class 2606 OID 17937.6)
-- Name: member_program_item_tasks fk_member_program_item_tasks_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_task FOREIGN KEY (task_id) REFERENCES public.therapy_tasks(task_id);


--
-- TOC entry 3786.7 (class 2606 OID 17937.7)
-- Name: member_program_item_tasks fk_member_program_item_tasks_created_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3786.8 (class 2606 OID 17937.8)
-- Name: member_program_item_tasks fk_member_program_item_tasks_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3786.9 (class 2606 OID 17937.9)
-- Name: member_program_item_tasks fk_member_program_item_tasks_completed_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_program_item_tasks
    ADD CONSTRAINT fk_member_program_item_tasks_completed_by FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3787 (class 2606 OID 17938)
-- Name: therapies fk_therapy_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT fk_therapy_type FOREIGN KEY (therapy_type_id) REFERENCES public.therapytype(therapy_type_id);


--
-- TOC entry 3765 (class 2606 OID 17943)
-- Name: leads leads_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3766 (class 2606 OID 17948)
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3767 (class 2606 OID 17953)
-- Name: leads leads_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status(status_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3768 (class 2606 OID 17958)
-- Name: leads leads_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3774 (class 2606 OID 17963)
-- Name: pillars pillars_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pillars
    ADD CONSTRAINT pillars_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3775 (class 2606 OID 17968)
-- Name: pillars pillars_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pillars
    ADD CONSTRAINT pillars_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3776 (class 2606 OID 17973)
-- Name: program_status program_status_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_status
    ADD CONSTRAINT program_status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3777 (class 2606 OID 17978)
-- Name: program_status program_status_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_status
    ADD CONSTRAINT program_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3778 (class 2606 OID 54902)
-- Name: program_template program_template_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template
    ADD CONSTRAINT program_template_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3782 (class 2606 OID 54912)
-- Name: program_template_items program_template_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT program_template_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3783 (class 2606 OID 54917)
-- Name: program_template_items program_template_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template_items
    ADD CONSTRAINT program_template_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3779 (class 2606 OID 54907)
-- Name: program_template program_template_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program_template
    ADD CONSTRAINT program_template_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3784 (class 2606 OID 17983)
-- Name: status status_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3785 (class 2606 OID 17988)
-- Name: status status_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3790 (class 2606 OID 17993)
-- Name: therapies_bodies_pillars therapies_bodies_pillars_body_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_body_id_fkey FOREIGN KEY (body_id) REFERENCES public.bodies(body_id);


--
-- TOC entry 3791 (class 2606 OID 17998)
-- Name: therapies_bodies_pillars therapies_bodies_pillars_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3792 (class 2606 OID 18003)
-- Name: therapies_bodies_pillars therapies_bodies_pillars_pillar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_pillar_id_fkey FOREIGN KEY (pillar_id) REFERENCES public.pillars(pillar_id);


--
-- TOC entry 3793 (class 2606 OID 18008)
-- Name: therapies_bodies_pillars therapies_bodies_pillars_therapy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_therapy_id_fkey FOREIGN KEY (therapy_id) REFERENCES public.therapies(therapy_id);


--
-- TOC entry 3794 (class 2606 OID 18013)
-- Name: therapies_bodies_pillars therapies_bodies_pillars_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies_bodies_pillars
    ADD CONSTRAINT therapies_bodies_pillars_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3788 (class 2606 OID 18018)
-- Name: therapies therapies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT therapies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3789 (class 2606 OID 18023)
-- Name: therapies therapies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapies
    ADD CONSTRAINT therapies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3796 (class 2606 OID 18028)
-- Name: therapytype therapytype_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapytype
    ADD CONSTRAINT therapytype_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3797 (class 2606 OID 18033)
-- Name: therapytype therapytype_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.therapytype
    ADD CONSTRAINT therapytype_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3800 (class 2606 OID 59442)
-- Name: user_menu_permissions user_menu_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- TOC entry 3801 (class 2606 OID 59437)
-- Name: user_menu_permissions user_menu_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_menu_permissions
    ADD CONSTRAINT user_menu_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3798 (class 2606 OID 18038)
-- Name: vendors vendors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3799 (class 2606 OID 18043)
-- Name: vendors vendors_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 4002 (class 3256 OID 18069)
-- Name: audit_logs all_access_audit_logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_audit_logs ON public.audit_logs FOR SELECT USING (true);


--
-- TOC entry 4003 (class 3256 OID 18070)
-- Name: bodies all_access_bodies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_bodies ON public.bodies USING (true);


--
-- TOC entry 4004 (class 3256 OID 18071)
-- Name: buckets all_access_buckets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_buckets ON public.buckets USING (true);


--
-- TOC entry 4005 (class 3256 OID 18072)
-- Name: campaigns all_access_campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_campaigns ON public.campaigns USING (true);


--
-- TOC entry 4006 (class 3256 OID 18073)
-- Name: leads all_access_leads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_leads ON public.leads USING (true);


--
-- TOC entry 4007 (class 3256 OID 18074)
-- Name: member_program_items all_access_member_program_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_items ON public.member_program_items USING (true);


--
-- TOC entry 4008 (class 3256 OID 18075)
-- Name: member_program_schedule all_access_member_program_schedule; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_program_schedule ON public.member_program_schedule USING (true);


--
-- TOC entry 4009 (class 3256 OID 18076)
-- Name: member_programs all_access_member_programs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_member_programs ON public.member_programs USING (true);


--
-- TOC entry 4020 (class 3256 OID 59738)
-- Name: menu_items all_access_menu_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_menu_items ON public.menu_items USING (true);


--
-- TOC entry 4010 (class 3256 OID 18077)
-- Name: pillars all_access_pillars; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_pillars ON public.pillars USING (true);


--
-- TOC entry 4011 (class 3256 OID 18078)
-- Name: program_status all_access_program_status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_program_status ON public.program_status USING (true);


--
-- TOC entry 4012 (class 3256 OID 18079)
-- Name: program_template all_access_program_template; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_program_template ON public.program_template USING (true);


--
-- TOC entry 4013 (class 3256 OID 18080)
-- Name: program_template_items all_access_program_template_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_program_template_items ON public.program_template_items USING (true);


--
-- TOC entry 4014 (class 3256 OID 18081)
-- Name: status all_access_status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_status ON public.status USING (true);


--
-- TOC entry 4015 (class 3256 OID 18082)
-- Name: therapies all_access_therapies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapies ON public.therapies USING (true);


--
-- TOC entry 4016 (class 3256 OID 18083)
-- Name: therapies_bodies_pillars all_access_therapies_bodies_pillars; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapies_bodies_pillars ON public.therapies_bodies_pillars USING (true);


--
-- TOC entry 4017 (class 3256 OID 18084)
-- Name: therapy_tasks all_access_therapy_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapy_tasks ON public.therapy_tasks USING (true);


--
-- TOC entry 4018 (class 3256 OID 18085)
-- Name: therapytype all_access_therapy_type; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_therapy_type ON public.therapytype USING (true);


--
-- TOC entry 4021 (class 3256 OID 59840)
-- Name: user_menu_permissions all_access_user_menu_permissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_user_menu_permissions ON public.user_menu_permissions USING (true);


--
-- TOC entry 4022 (class 3256 OID 59882)
-- Name: users all_access_users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_users ON public.users USING (true);


--
-- TOC entry 4019 (class 3256 OID 18086)
-- Name: vendors all_access_vendors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY all_access_vendors ON public.vendors USING (true);

-- Create policies for new finance tables (following existing pattern)
CREATE POLICY all_access_payment_status ON public.payment_status USING (true);
CREATE POLICY all_access_payment_methods ON public.payment_methods USING (true);
CREATE POLICY all_access_financing_types ON public.financing_types USING (true);
CREATE POLICY all_access_member_program_finances ON public.member_program_finances USING (true);
CREATE POLICY all_access_member_program_payments ON public.member_program_payments USING (true);


--
-- TOC entry 3981 (class 0 OID 17330)
-- Dependencies: 265
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3982 (class 0 OID 17338)
-- Dependencies: 268
-- Name: bodies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bodies ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3983 (class 0 OID 17350)
-- Dependencies: 270
-- Name: buckets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buckets ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3984 (class 0 OID 17361)
-- Dependencies: 271
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3985 (class 0 OID 17372)
-- Dependencies: 273
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3986 (class 0 OID 17383)
-- Dependencies: 275
-- Name: member_program_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3987 (class 0 OID 17399)
-- Dependencies: 277
-- Name: member_program_schedule; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_program_schedule ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3988 (class 0 OID 17411)
-- Dependencies: 279
-- Name: member_programs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_programs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4000 (class 0 OID 59417)
-- Dependencies: 315
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3989 (class 0 OID 17424)
-- Dependencies: 282
-- Name: pillars; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3990 (class 0 OID 17437)
-- Dependencies: 285
-- Name: program_status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program_status ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3991 (class 0 OID 17449)
-- Dependencies: 287
-- Name: program_template; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program_template ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3992 (class 0 OID 17461)
-- Dependencies: 289
-- Name: program_template_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program_template_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3993 (class 0 OID 17476)
-- Dependencies: 291
-- Name: status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.status ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3994 (class 0 OID 17488)
-- Dependencies: 294
-- Name: therapies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapies ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3995 (class 0 OID 17499)
-- Dependencies: 295
-- Name: therapies_bodies_pillars; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapies_bodies_pillars ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3996 (class 0 OID 17508)
-- Dependencies: 297
-- Name: therapy_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapy_tasks ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3997 (class 0 OID 17520)
-- Dependencies: 299
-- Name: therapytype; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.therapytype ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4001 (class 0 OID 59428)
-- Dependencies: 317
-- Name: user_menu_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3998 (class 0 OID 17531)
-- Dependencies: 300
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3999 (class 0 OID 17537)
-- Dependencies: 301
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security for new finance tables
ALTER TABLE public.payment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_payments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4030 (class 0 OID 0)
-- Dependencies: 4029
-- Name: DATABASE postgres; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON DATABASE postgres TO dashboard_user;


--
-- TOC entry 4032 (class 0 OID 0)
-- Dependencies: 19
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 4033 (class 0 OID 0)
-- Dependencies: 358
-- Name: FUNCTION audit_trigger_function(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_trigger_function() TO anon;
GRANT ALL ON FUNCTION public.audit_trigger_function() TO authenticated;
GRANT ALL ON FUNCTION public.audit_trigger_function() TO service_role;


--
-- TOC entry 4034 (class 0 OID 0)
-- Dependencies: 390
-- Name: FUNCTION create_member_program_from_template(p_lead_id integer, p_template_id integer, p_start_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_id integer, p_start_date date) TO anon;
GRANT ALL ON FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_id integer, p_start_date date) TO authenticated;
GRANT ALL ON FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_id integer, p_start_date date) TO service_role;


--
-- TOC entry 4035 (class 0 OID 0)
-- Dependencies: 391
-- Name: FUNCTION example_create_member_program(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.example_create_member_program() TO anon;
GRANT ALL ON FUNCTION public.example_create_member_program() TO authenticated;
GRANT ALL ON FUNCTION public.example_create_member_program() TO service_role;


--
-- TOC entry 4036 (class 0 OID 0)
-- Dependencies: 361
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- TOC entry 4037 (class 0 OID 0)
-- Dependencies: 364
-- Name: FUNCTION update_timestamp_function(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_timestamp_function() TO anon;
GRANT ALL ON FUNCTION public.update_timestamp_function() TO authenticated;
GRANT ALL ON FUNCTION public.update_timestamp_function() TO service_role;


--
-- TOC entry 4038 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.audit_logs TO PUBLIC;


--
-- TOC entry 4040 (class 0 OID 0)
-- Dependencies: 266
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO service_role;


--
-- TOC entry 4041 (class 0 OID 0)
-- Dependencies: 267
-- Name: SEQUENCE bodies_body_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bodies_body_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bodies_body_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bodies_body_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.bodies_body_id_seq TO PUBLIC;


--
-- TOC entry 4042 (class 0 OID 0)
-- Dependencies: 268
-- Name: TABLE bodies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bodies TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bodies TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bodies TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bodies TO PUBLIC;


--
-- TOC entry 4043 (class 0 OID 0)
-- Dependencies: 269
-- Name: SEQUENCE buckets_bucket_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.buckets_bucket_id_seq TO anon;
GRANT ALL ON SEQUENCE public.buckets_bucket_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.buckets_bucket_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.buckets_bucket_id_seq TO PUBLIC;


--
-- TOC entry 4044 (class 0 OID 0)
-- Dependencies: 270
-- Name: TABLE buckets; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.buckets TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.buckets TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.buckets TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.buckets TO PUBLIC;


--
-- TOC entry 4045 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.campaigns TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.campaigns TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.campaigns TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.campaigns TO PUBLIC;


--
-- TOC entry 4047 (class 0 OID 0)
-- Dependencies: 272
-- Name: SEQUENCE campaigns_campaign_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.campaigns_campaign_id_seq TO anon;
GRANT ALL ON SEQUENCE public.campaigns_campaign_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.campaigns_campaign_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.campaigns_campaign_id_seq TO PUBLIC;


--
-- TOC entry 4048 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leads TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leads TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leads TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leads TO PUBLIC;


--
-- TOC entry 4050 (class 0 OID 0)
-- Dependencies: 274
-- Name: SEQUENCE leads_lead_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.leads_lead_id_seq TO anon;
GRANT ALL ON SEQUENCE public.leads_lead_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.leads_lead_id_seq TO service_role;


--
-- TOC entry 4051 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE member_program_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_items TO PUBLIC;


--
-- TOC entry 4052.5 (class 0 OID 0)
-- Dependencies: 277.6
-- Name: TABLE member_program_item_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_tasks TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_tasks TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_tasks TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_item_tasks TO PUBLIC;


--
-- TOC entry 4053 (class 0 OID 0)
-- Dependencies: 276
-- Name: SEQUENCE member_program_items_member_program_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_items_member_program_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.member_program_items_member_program_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_items_member_program_item_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.member_program_items_member_program_item_id_seq TO PUBLIC;


--
-- TOC entry 4053.5 (class 0 OID 0)
-- Dependencies: 277.5
-- Name: SEQUENCE member_program_item_tasks_member_program_item_task_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq TO anon;
GRANT ALL ON SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.member_program_item_tasks_member_program_item_task_id_seq TO PUBLIC;


--
-- TOC entry 4054 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE member_program_schedule; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_schedule TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_schedule TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_schedule TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_program_schedule TO PUBLIC;


--
-- TOC entry 4056 (class 0 OID 0)
-- Dependencies: 278
-- Name: SEQUENCE member_program_schedule_program_schedule_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_program_schedule_program_schedule_id_seq TO anon;
GRANT ALL ON SEQUENCE public.member_program_schedule_program_schedule_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_schedule_program_schedule_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.member_program_schedule_program_schedule_id_seq TO PUBLIC;


--
-- TOC entry 4057 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE member_programs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_programs TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_programs TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_programs TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.member_programs TO PUBLIC;


--
-- TOC entry 4059 (class 0 OID 0)
-- Dependencies: 280
-- Name: SEQUENCE member_programs_member_program_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.member_programs_member_program_id_seq TO anon;
GRANT ALL ON SEQUENCE public.member_programs_member_program_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_programs_member_program_id_seq TO service_role;


--
-- TOC entry 4060 (class 0 OID 0)
-- Dependencies: 315
-- Name: TABLE menu_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.menu_items TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.menu_items TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.menu_items TO service_role;


--
-- TOC entry 4062 (class 0 OID 0)
-- Dependencies: 314
-- Name: SEQUENCE menu_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.menu_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.menu_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.menu_items_id_seq TO service_role;


--
-- TOC entry 4063 (class 0 OID 0)
-- Dependencies: 281
-- Name: SEQUENCE pillars_pillar_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pillars_pillar_id_seq TO anon;
GRANT ALL ON SEQUENCE public.pillars_pillar_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pillars_pillar_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.pillars_pillar_id_seq TO PUBLIC;


--
-- TOC entry 4064 (class 0 OID 0)
-- Dependencies: 282
-- Name: TABLE pillars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pillars TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pillars TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pillars TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.pillars TO PUBLIC;


--
-- TOC entry 4065 (class 0 OID 0)
-- Dependencies: 283
-- Name: SEQUENCE program_items_program_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_items_program_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.program_items_program_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_items_program_item_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.program_items_program_item_id_seq TO PUBLIC;


--
-- TOC entry 4066 (class 0 OID 0)
-- Dependencies: 284
-- Name: SEQUENCE program_status_program_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_status_program_status_id_seq TO anon;
GRANT ALL ON SEQUENCE public.program_status_program_status_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_status_program_status_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.program_status_program_status_id_seq TO PUBLIC;


--
-- TOC entry 4067 (class 0 OID 0)
-- Dependencies: 285
-- Name: TABLE program_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_status TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_status TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_status TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_status TO PUBLIC;


--
-- TOC entry 4068 (class 0 OID 0)
-- Dependencies: 286
-- Name: SEQUENCE program_template_program_template_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_template_program_template_id_seq TO anon;
GRANT ALL ON SEQUENCE public.program_template_program_template_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_template_program_template_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.program_template_program_template_id_seq TO PUBLIC;


--
-- TOC entry 4069 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE program_template; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template TO PUBLIC;


--
-- TOC entry 4070 (class 0 OID 0)
-- Dependencies: 288
-- Name: SEQUENCE program_template_items_program_template_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.program_template_items_program_template_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.program_template_items_program_template_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.program_template_items_program_template_items_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.program_template_items_program_template_items_id_seq TO PUBLIC;


--
-- TOC entry 4071 (class 0 OID 0)
-- Dependencies: 289
-- Name: TABLE program_template_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template_items TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template_items TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template_items TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.program_template_items TO PUBLIC;


--
-- TOC entry 4072 (class 0 OID 0)
-- Dependencies: 290
-- Name: SEQUENCE programs_program_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.programs_program_id_seq TO anon;
GRANT ALL ON SEQUENCE public.programs_program_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.programs_program_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.programs_program_id_seq TO PUBLIC;


--
-- TOC entry 4073 (class 0 OID 0)
-- Dependencies: 291
-- Name: TABLE status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.status TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.status TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.status TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.status TO PUBLIC;


--
-- TOC entry 4075 (class 0 OID 0)
-- Dependencies: 292
-- Name: SEQUENCE status_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.status_status_id_seq TO anon;
GRANT ALL ON SEQUENCE public.status_status_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.status_status_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.status_status_id_seq TO PUBLIC;


--
-- TOC entry 4076 (class 0 OID 0)
-- Dependencies: 293
-- Name: SEQUENCE therapies_therapy_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.therapies_therapy_id_seq TO anon;
GRANT ALL ON SEQUENCE public.therapies_therapy_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.therapies_therapy_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.therapies_therapy_id_seq TO PUBLIC;


--
-- TOC entry 4077 (class 0 OID 0)
-- Dependencies: 294
-- Name: TABLE therapies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies TO PUBLIC;


--
-- TOC entry 4078 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE therapies_bodies_pillars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies_bodies_pillars TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies_bodies_pillars TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies_bodies_pillars TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapies_bodies_pillars TO PUBLIC;


--
-- TOC entry 4079 (class 0 OID 0)
-- Dependencies: 296
-- Name: SEQUENCE therapy_tasks_task_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.therapy_tasks_task_id_seq TO anon;
GRANT ALL ON SEQUENCE public.therapy_tasks_task_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.therapy_tasks_task_id_seq TO service_role;


--
-- TOC entry 4080 (class 0 OID 0)
-- Dependencies: 297
-- Name: TABLE therapy_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapy_tasks TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapy_tasks TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapy_tasks TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapy_tasks TO PUBLIC;


--
-- TOC entry 4081 (class 0 OID 0)
-- Dependencies: 298
-- Name: SEQUENCE therapy_type_therapy_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.therapy_type_therapy_type_id_seq TO anon;
GRANT ALL ON SEQUENCE public.therapy_type_therapy_type_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.therapy_type_therapy_type_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.therapy_type_therapy_type_id_seq TO PUBLIC;


--
-- TOC entry 4082 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE therapytype; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapytype TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapytype TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapytype TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.therapytype TO PUBLIC;


--
-- TOC entry 4083 (class 0 OID 0)
-- Dependencies: 317
-- Name: TABLE user_menu_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_menu_permissions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_menu_permissions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_menu_permissions TO service_role;


--
-- TOC entry 4085 (class 0 OID 0)
-- Dependencies: 316
-- Name: SEQUENCE user_menu_permissions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_menu_permissions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_menu_permissions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_menu_permissions_id_seq TO service_role;


--
-- TOC entry 4086 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.users TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.users TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.users TO service_role;


--
-- TOC entry 4087 (class 0 OID 0)
-- Dependencies: 301
-- Name: TABLE vendors; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO PUBLIC;


--
-- TOC entry 4089 (class 0 OID 0)
-- Dependencies: 312
-- Name: SEQUENCE vendors_vendor_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.vendors_vendor_id_seq TO anon;
GRANT ALL ON SEQUENCE public.vendors_vendor_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vendors_vendor_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.vendors_vendor_id_seq TO PUBLIC;


--
-- TOC entry 2392 (class 826 OID 18106)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2395 (class 826 OID 18107)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2397 (class 826 OID 18108)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2398 (class 826 OID 18109)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2399 (class 826 OID 18110)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- TOC entry 2400 (class 826 OID 18111)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;

-- Add missing audit foreign key constraints for finance lookup tables
ALTER TABLE public.payment_status 
    ADD CONSTRAINT payment_status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.payment_status 
    ADD CONSTRAINT payment_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.payment_methods 
    ADD CONSTRAINT payment_methods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.payment_methods 
    ADD CONSTRAINT payment_methods_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.financing_types 
    ADD CONSTRAINT financing_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.financing_types 
    ADD CONSTRAINT financing_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Foreign key constraints for member_program_finances
ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT fk_member_program_finances_program FOREIGN KEY (program_id) REFERENCES public.member_programs(member_program_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.member_program_finances
    ADD CONSTRAINT fk_member_program_finances_financing_type FOREIGN KEY (financing_type_id) REFERENCES public.financing_types(financing_type_id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.member_program_finances 
    ADD CONSTRAINT member_program_finances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.member_program_finances 
    ADD CONSTRAINT member_program_finances_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Foreign key constraints for member_program_payments
ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT fk_member_program_payments_program FOREIGN KEY (program_id) REFERENCES public.member_programs(member_program_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT fk_member_program_payments_status FOREIGN KEY (payment_status_id) REFERENCES public.payment_status(payment_status_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.member_program_payments
    ADD CONSTRAINT fk_member_program_payments_method FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(payment_method_id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.member_program_payments 
    ADD CONSTRAINT member_program_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.member_program_payments 
    ADD CONSTRAINT member_program_payments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Default data for lookup tables
INSERT INTO public.payment_status (payment_status_name, active_flag) VALUES
('Pending', true),
('Paid', true),
('Late', true),
('Cancelled', true),
('Refunded', true);

INSERT INTO public.payment_methods (payment_method_name, active_flag) VALUES
('Cash', true),
('Check', true),
('Credit Card', true),
('Bank Transfer', true),
('Financing', true);

INSERT INTO public.financing_types (financing_type_name, active_flag) VALUES
('Cash', true),
('Financing', true),
('Payment Plan', true);

-- Audit functions for member_program_finances
CREATE OR REPLACE FUNCTION audit_member_program_finances()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('member_program_finances', NEW.member_program_finance_id, 'INSERT', NULL, row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('member_program_finances', NEW.member_program_finance_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('member_program_finances', OLD.member_program_finance_id, 'DELETE', row_to_json(OLD), NULL, auth.uid(), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Audit functions for member_program_payments
CREATE OR REPLACE FUNCTION audit_member_program_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('member_program_payments', NEW.member_program_payment_id, 'INSERT', NULL, row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('member_program_payments', NEW.member_program_payment_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('member_program_payments', OLD.member_program_payment_id, 'DELETE', row_to_json(OLD), NULL, auth.uid(), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for audit functions
CREATE TRIGGER audit_member_program_finances_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.member_program_finances
    FOR EACH ROW EXECUTE FUNCTION audit_member_program_finances();

CREATE TRIGGER audit_member_program_payments_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.member_program_payments
    FOR EACH ROW EXECUTE FUNCTION audit_member_program_payments();

-- Audit functions for lookup tables
CREATE OR REPLACE FUNCTION audit_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('payment_status', NEW.payment_status_id, 'INSERT', NULL, row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('payment_status', NEW.payment_status_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('payment_status', OLD.payment_status_id, 'DELETE', row_to_json(OLD), NULL, auth.uid(), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_payment_methods()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('payment_methods', NEW.payment_method_id, 'INSERT', NULL, row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('payment_methods', NEW.payment_method_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('payment_methods', OLD.payment_method_id, 'DELETE', row_to_json(OLD), NULL, auth.uid(), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_financing_types()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('financing_types', NEW.financing_type_id, 'INSERT', NULL, row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('financing_types', NEW.financing_type_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid(), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, timestamp)
        VALUES ('financing_types', OLD.financing_type_id, 'DELETE', row_to_json(OLD), NULL, auth.uid(), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for lookup table audit functions
CREATE TRIGGER audit_payment_status_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.payment_status
    FOR EACH ROW EXECUTE FUNCTION audit_payment_status();

CREATE TRIGGER audit_payment_methods_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION audit_payment_methods();

CREATE TRIGGER audit_financing_types_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.financing_types
    FOR EACH ROW EXECUTE FUNCTION audit_financing_types();

-- Completed on 2025-09-08 10:57:39

--
-- PostgreSQL database dump complete
--

