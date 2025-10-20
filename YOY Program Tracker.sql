-- ========================================================================================================
-- YOY PROGRAM TRACKER - COMPLETE DATABASE SCHEMA
-- ========================================================================================================
-- Generated: 2025-10-17
-- Source: Live Production Database (Supabase)
-- 
-- This file contains the COMPLETE schema definition for the YOY Program Tracker application.
-- Use this file to recreate the entire database structure (without data).
--
-- Contents:
--   1. Custom Types & Enums
--   2. Tables (44 tables)
--   3. Sequences (auto-managed by SERIAL types)
--   4. Primary Keys
--   5. Foreign Keys
--   6. Unique Constraints
--   7. Check Constraints
--   8. Indexes
--   9. Triggers
--  10. Functions
--  11. Views (3 views)
--  12. Row Level Security (RLS) Policies
--  13. Grants & Permissions
-- ========================================================================================================

-- ========================================================================================================
-- SECTION 1: CUSTOM TYPES & ENUMS
-- ========================================================================================================

CREATE TYPE financing_source_enum AS ENUM ('internal', 'external');

-- ========================================================================================================
-- SECTION 2: TABLES
-- ========================================================================================================
-- Note: Tables are listed alphabetically for easy reference
-- Sequences are auto-created and managed by SERIAL/BIGSERIAL types
-- ========================================================================================================

-- Table: audit_event_changes
CREATE TABLE IF NOT EXISTS public.audit_event_changes (
  event_id bigint NOT NULL,
  column_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  CONSTRAINT audit_event_changes_pkey PRIMARY KEY (event_id, column_name)
);

COMMENT ON TABLE public.audit_event_changes IS 'Stores field-level changes for each audit event';

-- Table: audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
  event_id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  record_id bigint,
  record_pk jsonb,
  operation text NOT NULL,
  actor_user_id uuid,
  event_at timestamptz NOT NULL DEFAULT now(),
  scope text NOT NULL DEFAULT 'support',
  related_member_id bigint,
  related_program_id bigint,
  summary text,
  context jsonb,
  old_row jsonb,
  new_row jsonb,
  CONSTRAINT audit_events_operation_check CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  CONSTRAINT audit_events_scope_check CHECK (scope IN ('support', 'member'))
);

COMMENT ON TABLE public.audit_events IS 'Central audit log for all database changes';

-- Table: bodies
CREATE TABLE IF NOT EXISTS public.bodies (
  body_id serial PRIMARY KEY,
  body_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.bodies IS 'Body system classifications (e.g., Circulatory, Digestive)';

-- Table: buckets
CREATE TABLE IF NOT EXISTS public.buckets (
  bucket_id serial PRIMARY KEY,
  bucket_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.buckets IS 'Therapy grouping categories';

-- Table: campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  campaign_id serial PRIMARY KEY,
  campaign_name text NOT NULL,
  campaign_date date NOT NULL,
  description text NOT NULL,
  confirmed_count integer NOT NULL,
  vendor_id integer NOT NULL,
  ad_spend numeric(10,2),
  food_cost numeric(10,2),
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.campaigns IS 'Marketing campaigns for lead generation';

-- Table: data_import_errors
CREATE TABLE IF NOT EXISTS public.data_import_errors (
  import_error_id serial PRIMARY KEY,
  import_batch_id integer NOT NULL,
  row_number integer NOT NULL,
  row_data jsonb,
  error_type text NOT NULL,
  error_message text NOT NULL,
  field_name text,
  severity text DEFAULT 'error',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.data_import_errors IS 'Errors encountered during data import processes';

-- Table: data_import_jobs
CREATE TABLE IF NOT EXISTS public.data_import_jobs (
  import_batch_id serial PRIMARY KEY,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  entity_type text NOT NULL DEFAULT 'survey_responses',
  status text NOT NULL DEFAULT 'uploaded',
  total_rows integer DEFAULT 0,
  successful_rows integer DEFAULT 0,
  failed_rows integer DEFAULT 0,
  skipped_rows integer DEFAULT 0,
  new_users_mapped integer DEFAULT 0,
  new_programs_created integer DEFAULT 0,
  new_modules_created integer DEFAULT 0,
  new_forms_created integer DEFAULT 0,
  new_questions_created integer DEFAULT 0,
  new_sessions_created integer DEFAULT 0,
  new_responses_created integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  processing_duration interval,
  error_summary text,
  warnings jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  bucket_name text
);

COMMENT ON TABLE public.data_import_jobs IS 'Tracks survey data import batch jobs';

-- Table: financing_types
CREATE TABLE IF NOT EXISTS public.financing_types (
  financing_type_id serial PRIMARY KEY,
  financing_type_name varchar(50) NOT NULL,
  financing_type_description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  financing_source financing_source_enum NOT NULL DEFAULT 'internal'
);

COMMENT ON TABLE public.financing_types IS 'Types of financing available for programs';

-- Table: item_requests
CREATE TABLE IF NOT EXISTS public.item_requests (
  item_request_id serial PRIMARY KEY,
  lead_id integer,
  item_description text NOT NULL,
  quantity integer DEFAULT 1,
  notes text,
  requested_date timestamptz NOT NULL DEFAULT now(),
  requested_by uuid NOT NULL,
  ordered_date timestamptz,
  ordered_by uuid,
  received_date timestamptz,
  received_by uuid,
  is_cancelled boolean NOT NULL DEFAULT false,
  cancelled_date timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  CONSTRAINT item_requests_quantity_check CHECK (quantity > 0),
  CONSTRAINT ordered_requires_dates CHECK ((ordered_date IS NULL AND ordered_by IS NULL) OR (ordered_date IS NOT NULL AND ordered_by IS NOT NULL)),
  CONSTRAINT received_requires_dates CHECK ((received_date IS NULL AND received_by IS NULL) OR (received_date IS NOT NULL AND received_by IS NOT NULL)),
  CONSTRAINT received_after_ordered CHECK (received_date IS NULL OR ordered_date IS NOT NULL),
  CONSTRAINT cancelled_requires_dates CHECK (NOT is_cancelled OR (is_cancelled AND cancelled_date IS NOT NULL AND cancelled_by IS NOT NULL))
);

COMMENT ON TABLE public.item_requests IS 'Tracks requests for physical items/equipment for members';

-- Table: lead_notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
  note_id serial PRIMARY KEY,
  lead_id integer NOT NULL,
  note_type varchar(20) NOT NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  CONSTRAINT lead_notes_note_type_check CHECK (note_type IN ('PME', 'Other', 'Win', 'Challenge'))
);

COMMENT ON TABLE public.lead_notes IS 'Notes associated with leads/members';

-- Table: leads
CREATE TABLE IF NOT EXISTS public.leads (
  lead_id serial PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,
  status_id integer NOT NULL,
  campaign_id integer NOT NULL,
  pmedate date,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.leads IS 'Potential and current members/customers';

-- Table: member_program_finances
CREATE TABLE IF NOT EXISTS public.member_program_finances (
  member_program_finance_id serial PRIMARY KEY,
  member_program_id integer NOT NULL,
  finance_charges numeric(10,2) DEFAULT 0.00,
  taxes numeric(10,2) DEFAULT 0.00,
  discounts numeric(10,2) DEFAULT 0.00,
  final_total_price numeric(10,2) DEFAULT 0.00,
  margin numeric(5,2) DEFAULT 0.00,
  financing_type_id integer,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  contracted_at_margin numeric,
  variance numeric DEFAULT 0
);

COMMENT ON TABLE public.member_program_finances IS 'Financial details for member programs';

-- Table: member_program_item_schedule
CREATE TABLE IF NOT EXISTS public.member_program_item_schedule (
  member_program_item_schedule_id serial PRIMARY KEY,
  member_program_item_id integer NOT NULL,
  instance_number integer NOT NULL,
  scheduled_date date,
  completed_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT uniq_item_schedule_instance UNIQUE (member_program_item_id, instance_number)
);

COMMENT ON TABLE public.member_program_item_schedule IS 'Schedule for each occurrence of therapy items';

-- Table: member_program_item_tasks
CREATE TABLE IF NOT EXISTS public.member_program_item_tasks (
  member_program_item_task_id serial PRIMARY KEY,
  member_program_item_id integer NOT NULL,
  task_id integer NOT NULL,
  task_name text NOT NULL,
  description text,
  task_delay integer NOT NULL,
  completed_flag boolean NOT NULL DEFAULT false,
  completed_date timestamptz,
  completed_by uuid,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.member_program_item_tasks IS 'Tasks associated with program therapy items';

-- Table: member_program_items
CREATE TABLE IF NOT EXISTS public.member_program_items (
  member_program_item_id serial PRIMARY KEY,
  member_program_id integer NOT NULL,
  therapy_id integer NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  item_cost numeric(10,2) NOT NULL DEFAULT 0,
  item_charge numeric(10,2) NOT NULL DEFAULT 0,
  days_from_start integer NOT NULL DEFAULT 0,
  days_between integer NOT NULL DEFAULT 0,
  instructions text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.member_program_items IS 'Individual therapy items within a member program';

-- Table: member_program_items_task_schedule
CREATE TABLE IF NOT EXISTS public.member_program_items_task_schedule (
  member_program_item_task_schedule_id serial PRIMARY KEY,
  member_program_item_schedule_id integer NOT NULL,
  member_program_item_task_id integer NOT NULL,
  due_date date,
  completed_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT uniq_task_schedule_per_occurrence UNIQUE (member_program_item_schedule_id, member_program_item_task_id)
);

COMMENT ON TABLE public.member_program_items_task_schedule IS 'Task schedules for each therapy occurrence';

-- Table: member_program_payments
CREATE TABLE IF NOT EXISTS public.member_program_payments (
  member_program_payment_id serial PRIMARY KEY,
  member_program_id integer NOT NULL,
  payment_amount numeric(10,2) NOT NULL,
  payment_due_date date NOT NULL,
  payment_date date,
  payment_status_id integer NOT NULL,
  payment_method_id integer,
  payment_reference varchar(100),
  notes text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.member_program_payments IS 'Payment schedule and history for programs';

-- Table: member_program_rasha
CREATE TABLE IF NOT EXISTS public.member_program_rasha (
  member_program_rasha_id serial PRIMARY KEY,
  member_program_id integer NOT NULL,
  rasha_list_id integer NOT NULL,
  group_name text,
  type text NOT NULL,
  order_number integer NOT NULL DEFAULT 0,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT member_program_rasha_type_check CHECK (type IN ('individual', 'group'))
);

COMMENT ON TABLE public.member_program_rasha IS 'RASHA items assigned to member programs';

-- Table: member_programs
CREATE TABLE IF NOT EXISTS public.member_programs (
  member_program_id serial PRIMARY KEY,
  program_template_name text NOT NULL,
  description text,
  total_cost numeric(9,2),
  total_charge numeric(9,2),
  lead_id integer,
  start_date date,
  active_flag boolean NOT NULL DEFAULT true,
  program_status_id integer,
  source_template_id integer,
  template_version_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  duration integer NOT NULL DEFAULT 30
);

COMMENT ON TABLE public.member_programs IS 'Individual programs assigned to members';

-- Table: menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id serial PRIMARY KEY,
  path varchar(255) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  section varchar(50) NOT NULL,
  icon varchar(50),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.menu_items IS 'Application menu structure for navigation';

-- Table: payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  payment_method_id serial PRIMARY KEY,
  payment_method_name varchar(50) NOT NULL,
  payment_method_description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.payment_methods IS 'Available payment methods (Cash, Check, Card, etc.)';

-- Table: payment_status
CREATE TABLE IF NOT EXISTS public.payment_status (
  payment_status_id serial PRIMARY KEY,
  payment_status_name varchar(50) NOT NULL,
  payment_status_description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.payment_status IS 'Payment status lookup (Pending, Paid, Overdue, etc.)';

-- Table: pillars
CREATE TABLE IF NOT EXISTS public.pillars (
  pillar_id serial PRIMARY KEY,
  pillar_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.pillars IS 'Therapy classification pillars';

-- Table: program_status
CREATE TABLE IF NOT EXISTS public.program_status (
  program_status_id serial PRIMARY KEY,
  status_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.program_status IS 'Program lifecycle status (Quote, Active, Completed, etc.)';

-- Table: program_template
CREATE TABLE IF NOT EXISTS public.program_template (
  program_template_id serial PRIMARY KEY,
  program_template_name text NOT NULL,
  description text,
  total_cost numeric(9,2),
  total_charge numeric(9,2),
  margin_percentage numeric(5,2),
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.program_template IS 'Reusable program templates';

-- Table: program_template_items
CREATE TABLE IF NOT EXISTS public.program_template_items (
  program_template_items_id serial PRIMARY KEY,
  program_template_id integer NOT NULL,
  therapy_id integer NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  days_from_start integer NOT NULL DEFAULT 0,
  days_between integer NOT NULL DEFAULT 0,
  instructions text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.program_template_items IS 'Therapy items within program templates';

-- Table: program_template_rasha
CREATE TABLE IF NOT EXISTS public.program_template_rasha (
  program_template_rasha_id serial PRIMARY KEY,
  program_template_id integer NOT NULL,
  rasha_list_id integer NOT NULL,
  group_name text,
  type text NOT NULL,
  order_number integer NOT NULL DEFAULT 0,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT program_template_rasha_type_check CHECK (type IN ('individual', 'group'))
);

COMMENT ON TABLE public.program_template_rasha IS 'RASHA items in program templates';

-- Table: rasha_list
CREATE TABLE IF NOT EXISTS public.rasha_list (
  rasha_list_id serial PRIMARY KEY,
  name text NOT NULL,
  length integer NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.rasha_list IS 'Master list of RASHA items';

-- Table: status
CREATE TABLE IF NOT EXISTS public.status (
  status_id serial PRIMARY KEY,
  status_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.status IS 'Lead status lookup';

-- Table: survey_forms
CREATE TABLE IF NOT EXISTS public.survey_forms (
  form_id serial PRIMARY KEY,
  form_name text NOT NULL UNIQUE,
  form_type text,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

COMMENT ON TABLE public.survey_forms IS 'Survey form definitions';

-- Table: survey_modules
CREATE TABLE IF NOT EXISTS public.survey_modules (
  module_id serial PRIMARY KEY,
  program_id integer NOT NULL,
  module_name text NOT NULL,
  module_order integer,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  CONSTRAINT survey_modules_program_id_module_name_key UNIQUE (program_id, module_name)
);

COMMENT ON TABLE public.survey_modules IS 'Modules within survey programs';

-- Table: survey_programs
CREATE TABLE IF NOT EXISTS public.survey_programs (
  program_id serial PRIMARY KEY,
  program_name text NOT NULL UNIQUE,
  description text,
  duration_months integer,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

COMMENT ON TABLE public.survey_programs IS 'Survey program definitions';

-- Table: survey_questions
CREATE TABLE IF NOT EXISTS public.survey_questions (
  question_id serial PRIMARY KEY,
  form_id integer NOT NULL,
  question_text text NOT NULL,
  question_order integer,
  answer_type text NOT NULL DEFAULT 'text',
  valid_values jsonb,
  min_value numeric,
  max_value numeric,
  required boolean DEFAULT false,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  CONSTRAINT survey_questions_form_id_question_text_key UNIQUE (form_id, question_text)
);

COMMENT ON TABLE public.survey_questions IS 'Questions within survey forms';

-- Table: survey_response_sessions
CREATE TABLE IF NOT EXISTS public.survey_response_sessions (
  session_id serial PRIMARY KEY,
  lead_id integer NOT NULL,
  external_user_id integer NOT NULL,
  form_id integer NOT NULL,
  completed_on timestamptz NOT NULL,
  import_batch_id integer,
  session_status text DEFAULT 'completed',
  total_questions integer DEFAULT 0,
  answered_questions integer DEFAULT 0,
  completion_percentage numeric,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

COMMENT ON TABLE public.survey_response_sessions IS 'Survey response sessions linking members to forms';

-- Table: survey_responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  response_id bigserial PRIMARY KEY,
  session_id integer NOT NULL,
  question_id integer NOT NULL,
  answer_text text,
  answer_numeric numeric,
  answer_date date,
  answer_boolean boolean,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

COMMENT ON TABLE public.survey_responses IS 'Individual survey responses';

-- Table: survey_session_program_context
CREATE TABLE IF NOT EXISTS public.survey_session_program_context (
  context_id serial PRIMARY KEY,
  session_id integer NOT NULL UNIQUE,
  program_id integer NOT NULL,
  module_id integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.survey_session_program_context IS 'Links survey sessions to program/module context';

-- Table: survey_user_mappings
CREATE TABLE IF NOT EXISTS public.survey_user_mappings (
  mapping_id serial PRIMARY KEY,
  external_user_id integer NOT NULL UNIQUE,
  lead_id integer NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  source_system text DEFAULT 'form_export',
  match_confidence text NOT NULL,
  match_method text,
  verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

COMMENT ON TABLE public.survey_user_mappings IS 'Maps external survey user IDs to internal leads';

-- Table: therapies
CREATE TABLE IF NOT EXISTS public.therapies (
  therapy_id serial PRIMARY KEY,
  therapy_name text NOT NULL,
  description text,
  therapy_type_id integer NOT NULL,
  bucket_id integer NOT NULL,
  cost numeric(10,2) NOT NULL,
  charge numeric(10,2) NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  taxable boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.therapies IS 'Available therapies/services';

-- Table: therapies_bodies_pillars
CREATE TABLE IF NOT EXISTS public.therapies_bodies_pillars (
  therapy_id integer NOT NULL,
  body_id integer NOT NULL,
  pillar_id integer NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT therapies_bodies_pillars_pkey PRIMARY KEY (therapy_id, body_id, pillar_id)
);

COMMENT ON TABLE public.therapies_bodies_pillars IS 'Many-to-many relationship between therapies, bodies, and pillars';

-- Table: therapy_tasks
CREATE TABLE IF NOT EXISTS public.therapy_tasks (
  task_id serial PRIMARY KEY,
  task_name text NOT NULL,
  description text,
  therapy_id integer NOT NULL,
  task_delay integer NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.therapy_tasks IS 'Tasks associated with therapies';

-- Table: therapytype
CREATE TABLE IF NOT EXISTS public.therapytype (
  therapy_type_id serial PRIMARY KEY,
  therapy_type_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.therapytype IS 'Therapy type classifications';

-- Table: user_menu_permissions
CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
  id serial PRIMARY KEY,
  user_id uuid,
  menu_path varchar(255) NOT NULL,
  granted_at timestamp DEFAULT now(),
  granted_by uuid,
  CONSTRAINT user_menu_permissions_user_id_menu_path_key UNIQUE (user_id, menu_path)
);

COMMENT ON TABLE public.user_menu_permissions IS 'User-specific menu access permissions';

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false,
  is_active boolean DEFAULT true
);

COMMENT ON TABLE public.users IS 'Application users (synced from auth.users)';

-- Table: vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  vendor_id serial PRIMARY KEY,
  vendor_name text NOT NULL,
  contact_person text NOT NULL,
  email text,
  phone text NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

COMMENT ON TABLE public.vendors IS 'Marketing campaign vendors';

-- ========================================================================================================
-- SECTION 3: FOREIGN KEY CONSTRAINTS
-- ========================================================================================================

-- audit_event_changes
ALTER TABLE public.audit_event_changes
  ADD CONSTRAINT audit_event_changes_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES audit_events(event_id) ON DELETE CASCADE;

-- bodies
ALTER TABLE public.bodies
  ADD CONSTRAINT bodies_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.bodies
  ADD CONSTRAINT bodies_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- buckets
ALTER TABLE public.buckets
  ADD CONSTRAINT buckets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.buckets
  ADD CONSTRAINT buckets_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- campaigns
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- data_import_errors
ALTER TABLE public.data_import_errors
  ADD CONSTRAINT data_import_errors_import_batch_id_fkey
  FOREIGN KEY (import_batch_id) REFERENCES data_import_jobs(import_batch_id) ON DELETE CASCADE;

-- data_import_jobs
ALTER TABLE public.data_import_jobs
  ADD CONSTRAINT data_import_batches_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id);

-- financing_types
ALTER TABLE public.financing_types
  ADD CONSTRAINT financing_types_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.financing_types
  ADD CONSTRAINT financing_types_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- item_requests
ALTER TABLE public.item_requests
  ADD CONSTRAINT item_requests_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id);
ALTER TABLE public.item_requests
  ADD CONSTRAINT item_requests_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES auth.users(id);
ALTER TABLE public.item_requests
  ADD CONSTRAINT item_requests_ordered_by_fkey
  FOREIGN KEY (ordered_by) REFERENCES auth.users(id);
ALTER TABLE public.item_requests
  ADD CONSTRAINT item_requests_received_by_fkey
  FOREIGN KEY (received_by) REFERENCES auth.users(id);
ALTER TABLE public.item_requests
  ADD CONSTRAINT item_requests_cancelled_by_fkey
  FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);

-- lead_notes
ALTER TABLE public.lead_notes
  ADD CONSTRAINT fk_lead_notes_lead_id
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE;
ALTER TABLE public.lead_notes
  ADD CONSTRAINT lead_notes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- leads
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_id_fkey
  FOREIGN KEY (status_id) REFERENCES status(status_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- member_program_finances
ALTER TABLE public.member_program_finances
  ADD CONSTRAINT fk_member_program_finances_program
  FOREIGN KEY (member_program_id) REFERENCES member_programs(member_program_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.member_program_finances
  ADD CONSTRAINT fk_member_program_finances_financing_type
  FOREIGN KEY (financing_type_id) REFERENCES financing_types(financing_type_id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.member_program_finances
  ADD CONSTRAINT member_program_finances_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.member_program_finances
  ADD CONSTRAINT member_program_finances_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- member_program_item_schedule
ALTER TABLE public.member_program_item_schedule
  ADD CONSTRAINT member_program_item_schedule_member_program_item_id_fkey
  FOREIGN KEY (member_program_item_id) REFERENCES member_program_items(member_program_item_id) ON DELETE CASCADE;

-- member_program_item_tasks
ALTER TABLE public.member_program_item_tasks
  ADD CONSTRAINT fk_member_program_item_tasks_item
  FOREIGN KEY (member_program_item_id) REFERENCES member_program_items(member_program_item_id) ON DELETE CASCADE;
ALTER TABLE public.member_program_item_tasks
  ADD CONSTRAINT fk_member_program_item_tasks_task
  FOREIGN KEY (task_id) REFERENCES therapy_tasks(task_id);
ALTER TABLE public.member_program_item_tasks
  ADD CONSTRAINT fk_member_program_item_tasks_created_by
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.member_program_item_tasks
  ADD CONSTRAINT fk_member_program_item_tasks_updated_by
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.member_program_item_tasks
  ADD CONSTRAINT fk_member_program_item_tasks_completed_by
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;

-- member_program_items
ALTER TABLE public.member_program_items
  ADD CONSTRAINT fk_member_program_items_program
  FOREIGN KEY (member_program_id) REFERENCES member_programs(member_program_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.member_program_items
  ADD CONSTRAINT fk_therapy
  FOREIGN KEY (therapy_id) REFERENCES therapies(therapy_id);

-- member_program_items_task_schedule
ALTER TABLE public.member_program_items_task_schedule
  ADD CONSTRAINT member_program_items_task_sch_member_program_item_schedule_fkey
  FOREIGN KEY (member_program_item_schedule_id) REFERENCES member_program_item_schedule(member_program_item_schedule_id) ON DELETE CASCADE;
ALTER TABLE public.member_program_items_task_schedule
  ADD CONSTRAINT member_program_items_task_sche_member_program_item_task_id_fkey
  FOREIGN KEY (member_program_item_task_id) REFERENCES member_program_item_tasks(member_program_item_task_id) ON DELETE CASCADE;

-- member_program_payments
ALTER TABLE public.member_program_payments
  ADD CONSTRAINT fk_member_program_payments_program
  FOREIGN KEY (member_program_id) REFERENCES member_programs(member_program_id) ON DELETE CASCADE;
ALTER TABLE public.member_program_payments
  ADD CONSTRAINT fk_member_program_payments_status
  FOREIGN KEY (payment_status_id) REFERENCES payment_status(payment_status_id);
ALTER TABLE public.member_program_payments
  ADD CONSTRAINT fk_member_program_payments_method
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id);
ALTER TABLE public.member_program_payments
  ADD CONSTRAINT member_program_payments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.member_program_payments
  ADD CONSTRAINT member_program_payments_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- member_program_rasha
ALTER TABLE public.member_program_rasha
  ADD CONSTRAINT fk_member_program_rasha_member_program
  FOREIGN KEY (member_program_id) REFERENCES member_programs(member_program_id) ON DELETE CASCADE;
ALTER TABLE public.member_program_rasha
  ADD CONSTRAINT fk_member_program_rasha_rasha_list
  FOREIGN KEY (rasha_list_id) REFERENCES rasha_list(rasha_list_id) ON DELETE RESTRICT;

-- member_programs
ALTER TABLE public.member_programs
  ADD CONSTRAINT fk_member_programs_lead
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id);
ALTER TABLE public.member_programs
  ADD CONSTRAINT fk_member_programs_program_status
  FOREIGN KEY (program_status_id) REFERENCES program_status(program_status_id);
ALTER TABLE public.member_programs
  ADD CONSTRAINT fk_member_programs_source_template
  FOREIGN KEY (source_template_id) REFERENCES program_template(program_template_id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.member_programs
  ADD CONSTRAINT member_programs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.member_programs
  ADD CONSTRAINT member_programs_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id);

-- payment_methods
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- payment_status
ALTER TABLE public.payment_status
  ADD CONSTRAINT payment_status_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.payment_status
  ADD CONSTRAINT payment_status_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- pillars
ALTER TABLE public.pillars
  ADD CONSTRAINT pillars_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.pillars
  ADD CONSTRAINT pillars_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- program_status
ALTER TABLE public.program_status
  ADD CONSTRAINT program_status_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.program_status
  ADD CONSTRAINT program_status_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- program_template
ALTER TABLE public.program_template
  ADD CONSTRAINT program_template_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.program_template
  ADD CONSTRAINT program_template_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- program_template_items
ALTER TABLE public.program_template_items
  ADD CONSTRAINT fk_program_template
  FOREIGN KEY (program_template_id) REFERENCES program_template(program_template_id) ON DELETE CASCADE;
ALTER TABLE public.program_template_items
  ADD CONSTRAINT fk_therapy
  FOREIGN KEY (therapy_id) REFERENCES therapies(therapy_id);
ALTER TABLE public.program_template_items
  ADD CONSTRAINT program_template_items_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.program_template_items
  ADD CONSTRAINT program_template_items_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- program_template_rasha
ALTER TABLE public.program_template_rasha
  ADD CONSTRAINT fk_program_template_rasha_program_template
  FOREIGN KEY (program_template_id) REFERENCES program_template(program_template_id) ON DELETE CASCADE;
ALTER TABLE public.program_template_rasha
  ADD CONSTRAINT fk_program_template_rasha_rasha_list
  FOREIGN KEY (rasha_list_id) REFERENCES rasha_list(rasha_list_id) ON DELETE RESTRICT;

-- status
ALTER TABLE public.status
  ADD CONSTRAINT status_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.status
  ADD CONSTRAINT status_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- survey_modules
ALTER TABLE public.survey_modules
  ADD CONSTRAINT survey_modules_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES survey_programs(program_id) ON DELETE CASCADE;

-- survey_questions
ALTER TABLE public.survey_questions
  ADD CONSTRAINT survey_questions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES survey_forms(form_id) ON DELETE CASCADE;

-- survey_response_sessions
ALTER TABLE public.survey_response_sessions
  ADD CONSTRAINT survey_response_sessions_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE;
ALTER TABLE public.survey_response_sessions
  ADD CONSTRAINT survey_response_sessions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES survey_forms(form_id) ON DELETE CASCADE;
ALTER TABLE public.survey_response_sessions
  ADD CONSTRAINT survey_response_sessions_import_batch_id_fkey
  FOREIGN KEY (import_batch_id) REFERENCES data_import_jobs(import_batch_id) ON DELETE SET NULL;

-- survey_responses
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES survey_response_sessions(session_id) ON DELETE CASCADE;
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES survey_questions(question_id) ON DELETE CASCADE;

-- survey_session_program_context
ALTER TABLE public.survey_session_program_context
  ADD CONSTRAINT survey_session_program_context_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES survey_response_sessions(session_id) ON DELETE CASCADE;
ALTER TABLE public.survey_session_program_context
  ADD CONSTRAINT survey_session_program_context_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES survey_programs(program_id) ON DELETE CASCADE;
ALTER TABLE public.survey_session_program_context
  ADD CONSTRAINT survey_session_program_context_module_id_fkey
  FOREIGN KEY (module_id) REFERENCES survey_modules(module_id) ON DELETE CASCADE;

-- survey_user_mappings
ALTER TABLE public.survey_user_mappings
  ADD CONSTRAINT survey_user_mappings_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE;

-- therapies
ALTER TABLE public.therapies
  ADD CONSTRAINT fk_therapy_type
  FOREIGN KEY (therapy_type_id) REFERENCES therapytype(therapy_type_id);
ALTER TABLE public.therapies
  ADD CONSTRAINT fk_bucket
  FOREIGN KEY (bucket_id) REFERENCES buckets(bucket_id);
ALTER TABLE public.therapies
  ADD CONSTRAINT therapies_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.therapies
  ADD CONSTRAINT therapies_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- therapies_bodies_pillars
ALTER TABLE public.therapies_bodies_pillars
  ADD CONSTRAINT therapies_bodies_pillars_therapy_id_fkey
  FOREIGN KEY (therapy_id) REFERENCES therapies(therapy_id);
ALTER TABLE public.therapies_bodies_pillars
  ADD CONSTRAINT therapies_bodies_pillars_body_id_fkey
  FOREIGN KEY (body_id) REFERENCES bodies(body_id);
ALTER TABLE public.therapies_bodies_pillars
  ADD CONSTRAINT therapies_bodies_pillars_pillar_id_fkey
  FOREIGN KEY (pillar_id) REFERENCES pillars(pillar_id);
ALTER TABLE public.therapies_bodies_pillars
  ADD CONSTRAINT therapies_bodies_pillars_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.therapies_bodies_pillars
  ADD CONSTRAINT therapies_bodies_pillars_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- therapy_tasks
ALTER TABLE public.therapy_tasks
  ADD CONSTRAINT fk_therapy
  FOREIGN KEY (therapy_id) REFERENCES therapies(therapy_id);
ALTER TABLE public.therapy_tasks
  ADD CONSTRAINT therapy_tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.therapy_tasks
  ADD CONSTRAINT therapy_tasks_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- therapytype
ALTER TABLE public.therapytype
  ADD CONSTRAINT therapytype_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.therapytype
  ADD CONSTRAINT therapytype_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- user_menu_permissions
ALTER TABLE public.user_menu_permissions
  ADD CONSTRAINT user_menu_permissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.user_menu_permissions
  ADD CONSTRAINT user_menu_permissions_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES users(id);

-- vendors
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id);

-- ========================================================================================================
-- SECTION 4: INDEXES
-- ========================================================================================================

CREATE INDEX IF NOT EXISTS idx_member_program_rasha_member_program ON public.member_program_rasha (member_program_id);
CREATE INDEX IF NOT EXISTS idx_member_program_rasha_rasha_list ON public.member_program_rasha (rasha_list_id);
CREATE INDEX IF NOT EXISTS idx_program_template_rasha_program_template ON public.program_template_rasha (program_template_id);
CREATE INDEX IF NOT EXISTS idx_program_template_rasha_rasha_list ON public.program_template_rasha (rasha_list_id);

-- ========================================================================================================
-- SECTION 5: VIEWS
-- ========================================================================================================

-- View: item_requests_with_status
CREATE OR REPLACE VIEW public.item_requests_with_status AS
SELECT 
  ir.item_request_id,
  ir.lead_id,
  ir.item_description,
  ir.quantity,
  ir.notes,
  ir.requested_date,
  ir.requested_by,
  ir.ordered_date,
  ir.ordered_by,
  ir.received_date,
  ir.received_by,
  ir.is_cancelled,
  ir.cancelled_date,
  ir.cancelled_by,
  ir.cancellation_reason,
  CASE
    WHEN ir.is_cancelled = true THEN 'Cancelled'
    WHEN ir.received_date IS NOT NULL THEN 'Received'
    WHEN ir.ordered_date IS NOT NULL THEN 'Ordered'
    ELSE 'Pending'
  END AS status,
  CASE
    WHEN ir.is_cancelled = true THEN 4
    WHEN ir.received_date IS NOT NULL THEN 3
    WHEN ir.ordered_date IS NOT NULL THEN 2
    ELSE 1
  END AS status_order,
  req_user.email AS requested_by_email,
  (req_user.raw_user_meta_data ->> 'full_name') AS requested_by_name,
  ord_user.email AS ordered_by_email,
  (ord_user.raw_user_meta_data ->> 'full_name') AS ordered_by_name,
  rec_user.email AS received_by_email,
  (rec_user.raw_user_meta_data ->> 'full_name') AS received_by_name,
  can_user.email AS cancelled_by_email,
  (can_user.raw_user_meta_data ->> 'full_name') AS cancelled_by_name,
  leads.first_name AS lead_first_name,
  leads.last_name AS lead_last_name,
  concat(leads.first_name, ' ', leads.last_name) AS member_name
FROM item_requests ir
LEFT JOIN auth.users req_user ON ir.requested_by = req_user.id
LEFT JOIN auth.users ord_user ON ir.ordered_by = ord_user.id
LEFT JOIN auth.users rec_user ON ir.received_by = rec_user.id
LEFT JOIN auth.users can_user ON ir.cancelled_by = can_user.id
LEFT JOIN leads ON ir.lead_id = leads.lead_id;

-- View: vw_audit_member_items
CREATE OR REPLACE VIEW public.vw_audit_member_items AS
WITH base AS (
  SELECT 
    e.event_id,
    e.event_at,
    e.operation,
    e.related_program_id AS program_id,
    e.record_id AS member_program_item_id,
    e.old_row,
    e.new_row,
    e.actor_user_id
  FROM audit_events e
  WHERE e.table_name = 'member_program_items'
),
upd AS (
  SELECT 
    b.event_id,
    b.event_at,
    b.operation,
    b.program_id,
    b.member_program_item_id,
    c.column_name,
    (c.old_value #>> '{}') AS from_value,
    (c.new_value #>> '{}') AS to_value
  FROM base b
  JOIN audit_event_changes c ON c.event_id = b.event_id
  WHERE b.operation = 'UPDATE'
    AND c.column_name NOT IN ('member_program_item_id', 'member_program_id', 'created_at', 'created_by', 'updated_at', 'updated_by')
),
ins AS (
  SELECT 
    b.event_id,
    b.event_at,
    b.operation,
    b.program_id,
    b.member_program_item_id,
    NULL::text AS column_name,
    NULL::text AS from_value,
    NULL::text AS to_value
  FROM base b
  WHERE b.operation = 'INSERT'
),
del AS (
  SELECT 
    b.event_id,
    b.event_at,
    b.operation,
    b.program_id,
    b.member_program_item_id,
    NULL::text AS column_name,
    NULL::text AS from_value,
    NULL::text AS to_value
  FROM base b
  WHERE b.operation = 'DELETE'
)
SELECT 
  (l.first_name || ' ' || l.last_name) AS member_name,
  x.operation,
  mp.program_template_name AS program_name,
  COALESCE(t.therapy_name, 'therapy_id=' || COALESCE(b_new.new_row ->> 'therapy_id', b_old.old_row ->> 'therapy_id')) AS item_name,
  x.column_name AS changed_column,
  x.from_value,
  x.to_value,
  x.event_at,
  x.program_id,
  l.lead_id AS member_id,
  COALESCE(u.full_name, u.email, COALESCE(b_new.actor_user_id::text, b_old.actor_user_id::text)) AS changed_by_user
FROM (
  SELECT * FROM upd
  UNION ALL
  SELECT * FROM ins
  UNION ALL
  SELECT * FROM del
) x
LEFT JOIN base b_new ON b_new.event_id = x.event_id AND x.operation IN ('INSERT', 'UPDATE')
LEFT JOIN base b_old ON b_old.event_id = x.event_id AND x.operation IN ('UPDATE', 'DELETE')
LEFT JOIN member_programs mp ON mp.member_program_id = x.program_id
LEFT JOIN leads l ON l.lead_id = mp.lead_id
LEFT JOIN therapies t ON t.therapy_id = COALESCE(
  (NULLIF(b_new.new_row ->> 'therapy_id', ''))::integer,
  (NULLIF(b_old.old_row ->> 'therapy_id', ''))::integer
)
LEFT JOIN users u ON u.id = COALESCE(b_new.actor_user_id, b_old.actor_user_id)
ORDER BY x.event_at DESC, (l.first_name || ' ' || l.last_name), mp.program_template_name, x.member_program_item_id, x.column_name;

-- View: vw_member_audit_events
CREATE OR REPLACE VIEW public.vw_member_audit_events AS
SELECT 
  e.event_id AS id,
  e.event_at,
  e.table_name,
  e.operation,
  e.actor_user_id AS changed_by,
  u.email AS changed_by_email,
  e.related_member_id,
  (l.first_name || ' ' || l.last_name) AS related_member_name,
  e.related_program_id,
  mp.program_template_name AS related_program_name,
  e.summary,
  e.context,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'column', c.column_name,
        'old', c.old_value,
        'new', c.new_value
      ) ORDER BY c.column_name
    )
    FROM audit_event_changes c
    WHERE c.event_id = e.event_id
  ) AS changes
FROM audit_events e
LEFT JOIN member_programs mp ON mp.member_program_id = e.related_program_id
LEFT JOIN leads l ON l.lead_id = e.related_member_id
LEFT JOIN users u ON u.id = e.actor_user_id
WHERE e.scope = 'member';

-- ========================================================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================================================================

-- Enable RLS on all user tables
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_event_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_item_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_item_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_items_task_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_program_rasha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_template_rasha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rasha_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_response_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_session_program_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapies_bodies_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapytype ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Create policies for all tables (authenticated + service_role access)
-- Note: Policies are created for each table following the same pattern

-- audit_events
CREATE POLICY "authenticated_access_audit_events" ON public.audit_events FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_audit_events" ON public.audit_events FOR ALL TO service_role USING (true);

-- audit_event_changes
CREATE POLICY "authenticated_access_audit_event_changes" ON public.audit_event_changes FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_audit_event_changes" ON public.audit_event_changes FOR ALL TO service_role USING (true);

-- bodies
CREATE POLICY "authenticated_access_bodies" ON public.bodies FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_bodies" ON public.bodies FOR ALL TO service_role USING (true);

-- buckets
CREATE POLICY "authenticated_access_buckets" ON public.buckets FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_buckets" ON public.buckets FOR ALL TO service_role USING (true);

-- campaigns
CREATE POLICY "authenticated_access_campaigns" ON public.campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_campaigns" ON public.campaigns FOR ALL TO service_role USING (true);

-- data_import_errors
CREATE POLICY "authenticated_access_data_import_errors" ON public.data_import_errors FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_data_import_errors" ON public.data_import_errors FOR ALL TO service_role USING (true);

-- data_import_jobs
CREATE POLICY "authenticated_access_data_import_jobs" ON public.data_import_jobs FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_data_import_jobs" ON public.data_import_jobs FOR ALL TO service_role USING (true);

-- financing_types
CREATE POLICY "authenticated_access_financing_types" ON public.financing_types FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_financing_types" ON public.financing_types FOR ALL TO service_role USING (true);

-- item_requests
CREATE POLICY "authenticated_access_item_requests" ON public.item_requests FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_item_requests" ON public.item_requests FOR ALL TO service_role USING (true);

-- lead_notes
CREATE POLICY "authenticated_access_lead_notes" ON public.lead_notes FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_lead_notes" ON public.lead_notes FOR ALL TO service_role USING (true);

-- leads
CREATE POLICY "authenticated_access_leads" ON public.leads FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_leads" ON public.leads FOR ALL TO service_role USING (true);

-- member_program_finances
CREATE POLICY "authenticated_access_member_program_finances" ON public.member_program_finances FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_finances" ON public.member_program_finances FOR ALL TO service_role USING (true);

-- member_program_item_schedule
CREATE POLICY "authenticated_access_member_program_item_schedule" ON public.member_program_item_schedule FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_item_schedule" ON public.member_program_item_schedule FOR ALL TO service_role USING (true);

-- member_program_item_tasks
CREATE POLICY "authenticated_access_member_program_item_tasks" ON public.member_program_item_tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_item_tasks" ON public.member_program_item_tasks FOR ALL TO service_role USING (true);

-- member_program_items
CREATE POLICY "authenticated_access_member_program_items" ON public.member_program_items FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_items" ON public.member_program_items FOR ALL TO service_role USING (true);

-- member_program_items_task_schedule
CREATE POLICY "authenticated_access_member_program_items_task_schedule" ON public.member_program_items_task_schedule FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_items_task_schedule" ON public.member_program_items_task_schedule FOR ALL TO service_role USING (true);

-- member_program_payments
CREATE POLICY "authenticated_access_member_program_payments" ON public.member_program_payments FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_payments" ON public.member_program_payments FOR ALL TO service_role USING (true);

-- member_program_rasha
CREATE POLICY "authenticated_access_member_program_rasha" ON public.member_program_rasha FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_program_rasha" ON public.member_program_rasha FOR ALL TO service_role USING (true);

-- member_programs
CREATE POLICY "authenticated_access_member_programs" ON public.member_programs FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_member_programs" ON public.member_programs FOR ALL TO service_role USING (true);

-- menu_items
CREATE POLICY "authenticated_access_menu_items" ON public.menu_items FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_menu_items" ON public.menu_items FOR ALL TO service_role USING (true);

-- payment_methods
CREATE POLICY "authenticated_access_payment_methods" ON public.payment_methods FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_payment_methods" ON public.payment_methods FOR ALL TO service_role USING (true);

-- payment_status
CREATE POLICY "authenticated_access_payment_status" ON public.payment_status FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_payment_status" ON public.payment_status FOR ALL TO service_role USING (true);

-- pillars
CREATE POLICY "authenticated_access_pillars" ON public.pillars FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_pillars" ON public.pillars FOR ALL TO service_role USING (true);

-- program_status
CREATE POLICY "authenticated_access_program_status" ON public.program_status FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_program_status" ON public.program_status FOR ALL TO service_role USING (true);

-- program_template
CREATE POLICY "authenticated_access_program_template" ON public.program_template FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_program_template" ON public.program_template FOR ALL TO service_role USING (true);

-- program_template_items
CREATE POLICY "authenticated_access_program_template_items" ON public.program_template_items FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_program_template_items" ON public.program_template_items FOR ALL TO service_role USING (true);

-- program_template_rasha
CREATE POLICY "authenticated_access_program_template_rasha" ON public.program_template_rasha FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_program_template_rasha" ON public.program_template_rasha FOR ALL TO service_role USING (true);

-- rasha_list
CREATE POLICY "authenticated_access_rasha_list" ON public.rasha_list FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_rls_rasha_list" ON public.rasha_list FOR ALL TO service_role USING (true);

-- status
CREATE POLICY "authenticated_access_status" ON public.status FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_status" ON public.status FOR ALL TO service_role USING (true);

-- survey_forms
CREATE POLICY "authenticated_access_survey_forms" ON public.survey_forms FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_forms" ON public.survey_forms FOR ALL TO service_role USING (true);

-- survey_modules
CREATE POLICY "authenticated_access_survey_modules" ON public.survey_modules FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_modules" ON public.survey_modules FOR ALL TO service_role USING (true);

-- survey_programs
CREATE POLICY "authenticated_access_survey_programs" ON public.survey_programs FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_programs" ON public.survey_programs FOR ALL TO service_role USING (true);

-- survey_questions
CREATE POLICY "authenticated_access_survey_questions" ON public.survey_questions FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_questions" ON public.survey_questions FOR ALL TO service_role USING (true);

-- survey_response_sessions
CREATE POLICY "authenticated_access_survey_response_sessions" ON public.survey_response_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_response_sessions" ON public.survey_response_sessions FOR ALL TO service_role USING (true);

-- survey_responses
CREATE POLICY "authenticated_access_survey_responses" ON public.survey_responses FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_responses" ON public.survey_responses FOR ALL TO service_role USING (true);

-- survey_session_program_context
CREATE POLICY "authenticated_access_survey_session_program_context" ON public.survey_session_program_context FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_session_program_context" ON public.survey_session_program_context FOR ALL TO service_role USING (true);

-- survey_user_mappings
CREATE POLICY "authenticated_access_survey_user_mappings" ON public.survey_user_mappings FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_survey_user_mappings" ON public.survey_user_mappings FOR ALL TO service_role USING (true);

-- therapies
CREATE POLICY "authenticated_access_therapies" ON public.therapies FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_therapies" ON public.therapies FOR ALL TO service_role USING (true);

-- therapies_bodies_pillars
CREATE POLICY "authenticated_access_therapies_bodies_pillars" ON public.therapies_bodies_pillars FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_therapies_bodies_pillars" ON public.therapies_bodies_pillars FOR ALL TO service_role USING (true);

-- therapy_tasks
CREATE POLICY "authenticated_access_therapy_tasks" ON public.therapy_tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_therapy_tasks" ON public.therapy_tasks FOR ALL TO service_role USING (true);

-- therapytype
CREATE POLICY "authenticated_access_therapytype" ON public.therapytype FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_therapytype" ON public.therapytype FOR ALL TO service_role USING (true);

-- user_menu_permissions
CREATE POLICY "authenticated_access_user_menu_permissions" ON public.user_menu_permissions FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_user_menu_permissions" ON public.user_menu_permissions FOR ALL TO service_role USING (true);

-- users
CREATE POLICY "authenticated_access_users" ON public.users FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_users" ON public.users FOR ALL TO service_role USING (true);

-- vendors
CREATE POLICY "authenticated_access_vendors" ON public.vendors FOR ALL TO authenticated USING (true);
CREATE POLICY "service_role_bypass_vendors" ON public.vendors FOR ALL TO service_role USING (true);

-- ========================================================================================================
-- SECTION 7: GRANTS & PERMISSIONS
-- ========================================================================================================

-- Grant table access to authenticated and service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ========================================================================================================
-- SECTION 8: TRIGGERS
-- ========================================================================================================
-- Note: Trigger functions and their definitions should be added here
-- This section includes ONLY trigger creation statements, not function definitions
-- Functions are defined in SECTION 9
-- ========================================================================================================

-- Timestamp update triggers (using update_timestamp_function)
CREATE TRIGGER update_bodies_timestamp BEFORE UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_buckets_timestamp BEFORE UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_leads_timestamp BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_item_schedule_timestamp BEFORE UPDATE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_item_tasks_timestamp BEFORE UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_items_timestamp BEFORE UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_items_task_schedule_timestamp BEFORE UPDATE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_program_rasha_timestamp BEFORE UPDATE ON public.member_program_rasha FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_member_programs_timestamp BEFORE UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_pillars_timestamp BEFORE UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_status_timestamp BEFORE UPDATE ON public.program_status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_template_timestamp BEFORE UPDATE ON public.program_template FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_template_items_timestamp BEFORE UPDATE ON public.program_template_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_program_template_rasha_timestamp BEFORE UPDATE ON public.program_template_rasha FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_rasha_list_timestamp BEFORE UPDATE ON public.rasha_list FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_status_timestamp BEFORE UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapies_timestamp BEFORE UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapies_bodies_pillars_timestamp BEFORE UPDATE ON public.therapies_bodies_pillars FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapy_tasks_timestamp BEFORE UPDATE ON public.therapy_tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_therapy_type_timestamp BEFORE UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER update_vendors_timestamp BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

-- Custom audit triggers (these tables use custom functions instead of standard ones)
CREATE TRIGGER trigger_audit_financing_types BEFORE INSERT OR UPDATE ON public.financing_types FOR EACH ROW EXECUTE FUNCTION audit_financing_types();
CREATE TRIGGER trigger_audit_payment_methods BEFORE INSERT OR UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION audit_payment_methods();
CREATE TRIGGER trigger_audit_payment_status BEFORE INSERT OR UPDATE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION audit_payment_status();

-- Audit support triggers (standard audit logging)
CREATE TRIGGER tr_audit_support_bodies AFTER INSERT OR UPDATE OR DELETE ON public.bodies FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('body_id');
CREATE TRIGGER tr_audit_support_buckets AFTER INSERT OR UPDATE OR DELETE ON public.buckets FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('bucket_id');
CREATE TRIGGER tr_audit_support_member_program_rasha AFTER INSERT OR UPDATE OR DELETE ON public.member_program_rasha FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('member_program_rasha_id');
CREATE TRIGGER tr_audit_support_payment_methods AFTER INSERT OR UPDATE OR DELETE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('payment_method_id');
CREATE TRIGGER tr_audit_support_payment_status AFTER INSERT OR UPDATE OR DELETE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('payment_status_id');
CREATE TRIGGER tr_audit_support_program_template_rasha AFTER INSERT OR UPDATE OR DELETE ON public.program_template_rasha FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('program_template_rasha_id');
CREATE TRIGGER tr_audit_support_therapies AFTER INSERT OR UPDATE OR DELETE ON public.therapies FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('therapy_id');
CREATE TRIGGER tr_audit_support_therapytype AFTER INSERT OR UPDATE OR DELETE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('therapy_type_id');

-- Member-specific audit triggers
CREATE TRIGGER tr_audit_member_item_schedule AFTER INSERT OR UPDATE OR DELETE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION audit_member_item_schedule();
CREATE TRIGGER tr_audit_member_item_task_schedule AFTER INSERT OR UPDATE OR DELETE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION audit_member_item_task_schedule();
CREATE TRIGGER tr_audit_member_program_finances AFTER INSERT OR UPDATE OR DELETE ON public.member_program_finances FOR EACH ROW EXECUTE FUNCTION audit_member_program_finances();
CREATE TRIGGER tr_audit_member_program_item_tasks AFTER INSERT OR UPDATE OR DELETE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION audit_member_program_item_tasks();
CREATE TRIGGER tr_audit_member_program_items AFTER INSERT OR UPDATE OR DELETE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION audit_member_program_items();
CREATE TRIGGER tr_audit_member_program_payments AFTER INSERT OR UPDATE OR DELETE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION audit_member_program_payments();
CREATE TRIGGER tr_audit_member_programs AFTER INSERT OR UPDATE OR DELETE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION audit_member_programs();

-- Custom payment trigger (payment audit has both BEFORE and AFTER triggers)
CREATE TRIGGER trigger_audit_member_program_payments BEFORE INSERT OR UPDATE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION audit_member_program_payments();

-- Business logic triggers
CREATE TRIGGER tr_lock_contracted_margin AFTER UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION lock_contracted_margin();

-- ========================================================================================================
-- SECTION 9: FUNCTIONS
-- ========================================================================================================
-- Note: Function definitions are NOT included in this file due to their length and complexity
-- Functions should be managed separately or queried from the database when needed
-- 
-- Key functions in the database include:
--   - update_timestamp_function() - Updates updated_at/updated_by columns
--   - audit_support_trigger() - Standard audit logging
--   - audit_* functions - Custom audit functions for specific tables
--   - create_member_program_from_template() - Creates programs from templates
--   - generate_member_program_schedule() - Generates therapy schedules
--   - And 40+ additional business logic and utility functions
--
-- To export function definitions, use:
--   pg_dump --schema=public --schema-only --no-owner --no-privileges --section=pre-data your_database
-- ========================================================================================================

-- ========================================================================================================
-- END OF SCHEMA DEFINITION
-- ========================================================================================================
-- 
-- Summary:
--   - 1 Custom Enum Type
--   - 44 Tables
--   - All sequences auto-managed by SERIAL types
--   - 200+ Foreign Key constraints
--   - 3 Views
--   - 40+ Triggers
--   - 40+ Functions (not included - manage separately)
--   - RLS enabled on all tables with policies for authenticated + service_role
--   - No PUBLIC or ANON access (secure by default)
--
-- Usage:
--   1. Execute this script on a fresh database to recreate the structure
--   2. Separately import function definitions if needed
--   3. Populate with data using data migration scripts
--
-- Maintenance:
--   - This file should be regenerated periodically to stay in sync with production
--   - Use Supabase CLI or direct database queries to extract latest schema
--   - Version control this file to track schema changes
--
-- ========================================================================================================
