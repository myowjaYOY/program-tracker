-- YOY Program Tracker Database Schema
-- Generated: 2025-10-11T17:11:04.646Z
-- This file contains the complete database schema for the YOY Program Tracker application

-- Table: audit_event_changes
CREATE TABLE IF NOT EXISTS public.audit_event_changes (
  event_id bigint NOT NULL,
  column_name text NOT NULL,
  old_value jsonb,
  new_value jsonb
);

-- Table: audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
  event_id bigint NOT NULL,
  table_name text NOT NULL,
  record_id bigint,
  record_pk jsonb,
  operation text NOT NULL,
  actor_user_id uuid,
  event_at timestamp with time zone NOT NULL DEFAULT now(),
  scope text NOT NULL DEFAULT 'support'::text,
  related_member_id bigint,
  related_program_id bigint,
  summary text,
  context jsonb,
  old_row jsonb,
  new_row jsonb
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id integer NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
  table_name text NOT NULL,
  record_id integer NOT NULL,
  operation text NOT NULL,
  old_record jsonb,
  new_record jsonb,
  changed_columns ARRAY,
  business_context jsonb,
  changed_by uuid,
  changed_at timestamp with time zone,
  source_audit_log_ids ARRAY,
  migration_notes text
);

-- Table: bodies
CREATE TABLE IF NOT EXISTS public.bodies (
  body_id integer NOT NULL DEFAULT nextval('bodies_body_id_seq'::regclass),
  body_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: buckets
CREATE TABLE IF NOT EXISTS public.buckets (
  bucket_id integer NOT NULL DEFAULT nextval('buckets_bucket_id_seq'::regclass),
  bucket_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  campaign_id integer NOT NULL DEFAULT nextval('campaigns_campaign_id_seq'::regclass),
  campaign_name text NOT NULL,
  campaign_date date NOT NULL,
  description text NOT NULL,
  confirmed_count integer NOT NULL,
  vendor_id integer NOT NULL,
  ad_spend numeric(10,2),
  food_cost numeric(10,2),
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: data_import_errors
CREATE TABLE IF NOT EXISTS public.data_import_errors (
  import_error_id integer NOT NULL,
  import_batch_id integer NOT NULL,
  row_number integer NOT NULL,
  row_data jsonb,
  error_type text NOT NULL,
  error_message text NOT NULL,
  field_name text,
  severity text DEFAULT 'error'::text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: data_import_jobs
CREATE TABLE IF NOT EXISTS public.data_import_jobs (
  import_batch_id integer NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  entity_type text NOT NULL DEFAULT 'survey_responses'::text,
  status text NOT NULL DEFAULT 'uploaded'::text,
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
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  processing_duration interval,
  error_summary text,
  warnings jsonb,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  bucket_name text
);

-- Table: financing_types
CREATE TABLE IF NOT EXISTS public.financing_types (
  financing_type_id integer NOT NULL DEFAULT nextval('financing_types_financing_type_id_seq'::regclass),
  financing_type_name varchar(50) NOT NULL,
  financing_type_description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  financing_source USER-DEFINED NOT NULL DEFAULT 'internal'::financing_source_enum
);

-- Table: lead_notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
  note_id integer NOT NULL,
  lead_id integer NOT NULL,
  note_type varchar(20) NOT NULL,
  note text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: leads
CREATE TABLE IF NOT EXISTS public.leads (
  lead_id integer NOT NULL DEFAULT nextval('leads_lead_id_seq'::regclass),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,
  status_id integer NOT NULL,
  campaign_id integer NOT NULL,
  pmedate date,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: member_program_finances
CREATE TABLE IF NOT EXISTS public.member_program_finances (
  member_program_finance_id integer NOT NULL DEFAULT nextval('member_program_finances_member_program_finance_id_seq'::regclass),
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
  updated_by uuid DEFAULT auth.uid(),
  contracted_at_margin numeric,
  variance numeric DEFAULT 0
);

-- Table: member_program_item_schedule
CREATE TABLE IF NOT EXISTS public.member_program_item_schedule (
  member_program_item_schedule_id integer NOT NULL DEFAULT nextval('member_program_item_schedule_member_program_item_schedule_id_se'::regclass),
  member_program_item_id integer NOT NULL,
  instance_number integer NOT NULL,
  scheduled_date date,
  completed_flag boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: member_program_item_tasks
CREATE TABLE IF NOT EXISTS public.member_program_item_tasks (
  member_program_item_task_id integer NOT NULL DEFAULT nextval('member_program_item_tasks_member_program_item_task_id_seq'::regclass),
  member_program_item_id integer NOT NULL,
  task_id integer NOT NULL,
  task_name text NOT NULL,
  description text,
  task_delay integer NOT NULL,
  completed_flag boolean NOT NULL DEFAULT false,
  completed_date timestamp with time zone,
  completed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: member_program_items
CREATE TABLE IF NOT EXISTS public.member_program_items (
  member_program_item_id integer NOT NULL DEFAULT nextval('member_program_items_member_program_item_id_seq'::regclass),
  member_program_id integer NOT NULL,
  therapy_id integer NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  item_cost numeric(10,2) NOT NULL DEFAULT 0,
  item_charge numeric(10,2) NOT NULL DEFAULT 0,
  days_from_start integer NOT NULL DEFAULT 0,
  days_between integer NOT NULL DEFAULT 0,
  instructions text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: member_program_items_task_schedule
CREATE TABLE IF NOT EXISTS public.member_program_items_task_schedule (
  member_program_item_task_schedule_id integer NOT NULL DEFAULT nextval('member_program_items_task_schedule_member_program_item_task_sch'::regclass),
  member_program_item_schedule_id integer NOT NULL,
  member_program_item_task_id integer NOT NULL,
  due_date date,
  completed_flag boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: member_program_payments
CREATE TABLE IF NOT EXISTS public.member_program_payments (
  member_program_payment_id integer NOT NULL DEFAULT nextval('member_program_payments_member_program_payment_id_seq'::regclass),
  member_program_id integer NOT NULL,
  payment_amount numeric(10,2) NOT NULL,
  payment_due_date date NOT NULL,
  payment_date date,
  payment_status_id integer NOT NULL,
  payment_method_id integer,
  payment_reference varchar(100),
  notes text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: member_programs
CREATE TABLE IF NOT EXISTS public.member_programs (
  member_program_id integer NOT NULL DEFAULT nextval('member_programs_member_program_id_seq'::regclass),
  program_template_name text NOT NULL,
  description text,
  total_cost numeric(9,2),
  total_charge numeric(9,2),
  lead_id integer,
  start_date date,
  active_flag boolean NOT NULL DEFAULT true,
  program_status_id integer,
  source_template_id integer,
  template_version_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  duration integer NOT NULL DEFAULT 30
);

-- Table: menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id integer NOT NULL DEFAULT nextval('menu_items_id_seq'::regclass),
  path varchar(255) NOT NULL,
  label varchar(100) NOT NULL,
  section varchar(50) NOT NULL,
  icon varchar(50),
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- Table: payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  payment_method_id integer NOT NULL DEFAULT nextval('payment_methods_payment_method_id_seq'::regclass),
  payment_method_name varchar(50) NOT NULL,
  payment_method_description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: payment_status
CREATE TABLE IF NOT EXISTS public.payment_status (
  payment_status_id integer NOT NULL DEFAULT nextval('payment_status_payment_status_id_seq'::regclass),
  payment_status_name varchar(50) NOT NULL,
  payment_status_description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: pillars
CREATE TABLE IF NOT EXISTS public.pillars (
  pillar_id integer NOT NULL DEFAULT nextval('pillars_pillar_id_seq'::regclass),
  pillar_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: program_status
CREATE TABLE IF NOT EXISTS public.program_status (
  program_status_id integer NOT NULL DEFAULT nextval('program_status_program_status_id_seq'::regclass),
  status_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: program_template
CREATE TABLE IF NOT EXISTS public.program_template (
  program_template_id integer NOT NULL DEFAULT nextval('program_template_program_template_id_seq'::regclass),
  program_template_name text NOT NULL,
  description text,
  total_cost numeric(9,2),
  total_charge numeric(9,2),
  margin_percentage numeric(5,2),
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: program_template_items
CREATE TABLE IF NOT EXISTS public.program_template_items (
  program_template_items_id integer NOT NULL DEFAULT nextval('program_template_items_program_template_items_id_seq'::regclass),
  program_template_id integer NOT NULL,
  therapy_id integer NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  days_from_start integer NOT NULL DEFAULT 0,
  days_between integer NOT NULL DEFAULT 0,
  instructions text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: status
CREATE TABLE IF NOT EXISTS public.status (
  status_id integer NOT NULL DEFAULT nextval('status_status_id_seq'::regclass),
  status_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: survey_forms
CREATE TABLE IF NOT EXISTS public.survey_forms (
  form_id integer NOT NULL DEFAULT nextval('survey_forms_form_id_seq'::regclass),
  form_name text NOT NULL,
  form_type text,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: survey_modules
CREATE TABLE IF NOT EXISTS public.survey_modules (
  module_id integer NOT NULL DEFAULT nextval('survey_modules_module_id_seq'::regclass),
  program_id integer NOT NULL,
  module_name text NOT NULL,
  module_order integer,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: survey_programs
CREATE TABLE IF NOT EXISTS public.survey_programs (
  program_id integer NOT NULL DEFAULT nextval('survey_programs_program_id_seq'::regclass),
  program_name text NOT NULL,
  description text,
  duration_months integer,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: survey_questions
CREATE TABLE IF NOT EXISTS public.survey_questions (
  question_id integer NOT NULL DEFAULT nextval('survey_questions_question_id_seq'::regclass),
  form_id integer NOT NULL,
  question_text text NOT NULL,
  question_order integer,
  answer_type text NOT NULL DEFAULT 'text'::text,
  valid_values jsonb,
  min_value numeric,
  max_value numeric,
  required boolean DEFAULT false,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: survey_response_sessions
CREATE TABLE IF NOT EXISTS public.survey_response_sessions (
  session_id integer NOT NULL DEFAULT nextval('survey_response_sessions_session_id_seq'::regclass),
  lead_id integer NOT NULL,
  external_user_id integer NOT NULL,
  form_id integer NOT NULL,
  completed_on timestamp with time zone NOT NULL,
  import_batch_id integer,
  session_status text DEFAULT 'completed'::text,
  total_questions integer DEFAULT 0,
  answered_questions integer DEFAULT 0,
  completion_percentage numeric,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: survey_responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  response_id bigint NOT NULL DEFAULT nextval('survey_responses_response_id_seq'::regclass),
  session_id integer NOT NULL,
  question_id integer NOT NULL,
  answer_text text,
  answer_numeric numeric,
  answer_date date,
  answer_boolean boolean,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: survey_session_program_context
CREATE TABLE IF NOT EXISTS public.survey_session_program_context (
  context_id integer NOT NULL DEFAULT nextval('survey_session_program_context_context_id_seq'::regclass),
  session_id integer NOT NULL,
  program_id integer NOT NULL,
  module_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: survey_user_mappings
CREATE TABLE IF NOT EXISTS public.survey_user_mappings (
  mapping_id integer NOT NULL DEFAULT nextval('survey_user_mappings_mapping_id_seq'::regclass),
  external_user_id integer NOT NULL,
  lead_id integer NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  source_system text DEFAULT 'form_export'::text,
  match_confidence text NOT NULL,
  match_method text,
  verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Table: therapies
CREATE TABLE IF NOT EXISTS public.therapies (
  therapy_id integer NOT NULL DEFAULT nextval('therapies_therapy_id_seq'::regclass),
  therapy_name text NOT NULL,
  description text,
  therapy_type_id integer NOT NULL,
  bucket_id integer NOT NULL,
  cost numeric(10,2) NOT NULL,
  charge numeric(10,2) NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  taxable boolean NOT NULL DEFAULT false
);

-- Table: therapies_bodies_pillars
CREATE TABLE IF NOT EXISTS public.therapies_bodies_pillars (
  therapy_id integer NOT NULL,
  body_id integer NOT NULL,
  pillar_id integer NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: therapy_tasks
CREATE TABLE IF NOT EXISTS public.therapy_tasks (
  task_id integer NOT NULL DEFAULT nextval('therapy_tasks_task_id_seq'::regclass),
  task_name text NOT NULL,
  description text,
  therapy_id integer NOT NULL,
  task_delay integer NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: therapytype
CREATE TABLE IF NOT EXISTS public.therapytype (
  therapy_type_id integer NOT NULL DEFAULT nextval('therapy_type_therapy_type_id_seq'::regclass),
  therapy_type_name text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Table: user_menu_permissions
CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
  id integer NOT NULL DEFAULT nextval('user_menu_permissions_id_seq'::regclass),
  user_id uuid,
  menu_path varchar(255) NOT NULL,
  granted_at timestamp without time zone DEFAULT now(),
  granted_by uuid
);

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  is_admin boolean DEFAULT false,
  is_active boolean DEFAULT true
);

-- Table: vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  vendor_id integer NOT NULL DEFAULT nextval('vendors_vendor_id_seq'::regclass),
  vendor_name text NOT NULL,
  contact_person text NOT NULL,
  email text,
  phone text NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Indexes
-- audit_event_changes.audit_event_changes_pkey
CREATE UNIQUE INDEX audit_event_changes_pkey ON public.audit_event_changes USING btree (event_id, column_name);

-- audit_event_changes.idx_aevtchg_col
CREATE INDEX idx_aevtchg_col ON public.audit_event_changes USING btree (column_name);

-- audit_events.audit_events_pkey
CREATE UNIQUE INDEX audit_events_pkey ON public.audit_events USING btree (event_id);

-- audit_events.idx_aevt_member
CREATE INDEX idx_aevt_member ON public.audit_events USING btree (related_member_id, related_program_id);

-- audit_events.idx_aevt_scope
CREATE INDEX idx_aevt_scope ON public.audit_events USING btree (scope);

-- audit_events.idx_aevt_tbl_rec
CREATE INDEX idx_aevt_tbl_rec ON public.audit_events USING btree (table_name, record_id);

-- audit_events.idx_aevt_when
CREATE INDEX idx_aevt_when ON public.audit_events USING btree (event_at);

-- bodies.bodies_pkey
CREATE UNIQUE INDEX bodies_pkey ON public.bodies USING btree (body_id);

-- buckets.buckets_pkey
CREATE UNIQUE INDEX buckets_pkey ON public.buckets USING btree (bucket_id);

-- campaigns.campaigns_pkey
CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (campaign_id);

-- data_import_errors.data_import_errors_pkey
CREATE UNIQUE INDEX data_import_errors_pkey ON public.data_import_errors USING btree (import_error_id);

-- data_import_errors.idx_data_import_errors_batch
CREATE INDEX idx_data_import_errors_batch ON public.data_import_errors USING btree (import_batch_id);

-- data_import_errors.idx_data_import_errors_row
CREATE INDEX idx_data_import_errors_row ON public.data_import_errors USING btree (import_batch_id, row_number);

-- data_import_errors.idx_data_import_errors_severity
CREATE INDEX idx_data_import_errors_severity ON public.data_import_errors USING btree (severity);

-- data_import_errors.idx_data_import_errors_type
CREATE INDEX idx_data_import_errors_type ON public.data_import_errors USING btree (error_type);

-- data_import_jobs.data_import_batches_pkey
CREATE UNIQUE INDEX data_import_batches_pkey ON public.data_import_jobs USING btree (import_batch_id);

-- data_import_jobs.idx_data_import_batches_created_at
CREATE INDEX idx_data_import_batches_created_at ON public.data_import_jobs USING btree (created_at DESC);

-- data_import_jobs.idx_data_import_batches_created_by
CREATE INDEX idx_data_import_batches_created_by ON public.data_import_jobs USING btree (created_by);

-- data_import_jobs.idx_data_import_batches_entity_type
CREATE INDEX idx_data_import_batches_entity_type ON public.data_import_jobs USING btree (entity_type);

-- data_import_jobs.idx_data_import_batches_status
CREATE INDEX idx_data_import_batches_status ON public.data_import_jobs USING btree (status);

-- financing_types.pk_financing_types
CREATE UNIQUE INDEX pk_financing_types ON public.financing_types USING btree (financing_type_id);

-- lead_notes.idx_lead_notes_created_at
CREATE INDEX idx_lead_notes_created_at ON public.lead_notes USING btree (created_at DESC);

-- lead_notes.idx_lead_notes_lead_id
CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes USING btree (lead_id);

-- lead_notes.idx_lead_notes_note_type
CREATE INDEX idx_lead_notes_note_type ON public.lead_notes USING btree (note_type);

-- lead_notes.lead_notes_pkey
CREATE UNIQUE INDEX lead_notes_pkey ON public.lead_notes USING btree (note_id);

-- leads.leads_pkey
CREATE UNIQUE INDEX leads_pkey ON public.leads USING btree (lead_id);

-- member_program_finances.member_program_finances_pkey
CREATE UNIQUE INDEX member_program_finances_pkey ON public.member_program_finances USING btree (member_program_finance_id);

-- member_program_item_schedule.idx_member_program_item_schedule_program_item
CREATE INDEX idx_member_program_item_schedule_program_item ON public.member_program_item_schedule USING btree (member_program_item_id, instance_number);

-- member_program_item_schedule.idx_member_program_item_schedule_scheduled_date
CREATE INDEX idx_member_program_item_schedule_scheduled_date ON public.member_program_item_schedule USING btree (scheduled_date);

-- member_program_item_schedule.member_program_item_schedule_pkey
CREATE UNIQUE INDEX member_program_item_schedule_pkey ON public.member_program_item_schedule USING btree (member_program_item_schedule_id);

-- member_program_item_schedule.uniq_item_schedule_instance
CREATE UNIQUE INDEX uniq_item_schedule_instance ON public.member_program_item_schedule USING btree (member_program_item_id, instance_number);

-- member_program_item_tasks.idx_member_program_item_tasks_completed
CREATE INDEX idx_member_program_item_tasks_completed ON public.member_program_item_tasks USING btree (completed_flag);

-- member_program_item_tasks.idx_member_program_item_tasks_item
CREATE INDEX idx_member_program_item_tasks_item ON public.member_program_item_tasks USING btree (member_program_item_id);

-- member_program_item_tasks.idx_member_program_item_tasks_task
CREATE INDEX idx_member_program_item_tasks_task ON public.member_program_item_tasks USING btree (task_id);

-- member_program_item_tasks.member_program_item_tasks_pkey
CREATE UNIQUE INDEX member_program_item_tasks_pkey ON public.member_program_item_tasks USING btree (member_program_item_task_id);

-- member_program_items.idx_member_program_items_member_program
CREATE INDEX idx_member_program_items_member_program ON public.member_program_items USING btree (member_program_id);

-- member_program_items.idx_member_program_items_therapy
CREATE INDEX idx_member_program_items_therapy ON public.member_program_items USING btree (therapy_id);

-- member_program_items.member_program_items_pkey
CREATE UNIQUE INDEX member_program_items_pkey ON public.member_program_items USING btree (member_program_item_id);

-- member_program_items_task_schedule.idx_member_program_items_task_schedule_due_date
CREATE INDEX idx_member_program_items_task_schedule_due_date ON public.member_program_items_task_schedule USING btree (due_date);

-- member_program_items_task_schedule.idx_member_program_items_task_schedule_fulfillment
CREATE INDEX idx_member_program_items_task_schedule_fulfillment ON public.member_program_items_task_schedule USING btree (member_program_item_schedule_id);

-- member_program_items_task_schedule.idx_member_program_items_task_schedule_task
CREATE INDEX idx_member_program_items_task_schedule_task ON public.member_program_items_task_schedule USING btree (member_program_item_task_id);

-- member_program_items_task_schedule.member_program_items_task_schedule_pkey
CREATE UNIQUE INDEX member_program_items_task_schedule_pkey ON public.member_program_items_task_schedule USING btree (member_program_item_task_schedule_id);

-- member_program_items_task_schedule.uniq_task_schedule_per_occurrence
CREATE UNIQUE INDEX uniq_task_schedule_per_occurrence ON public.member_program_items_task_schedule USING btree (member_program_item_schedule_id, member_program_item_task_id);

-- member_program_payments.idx_member_program_payments_due_date
CREATE INDEX idx_member_program_payments_due_date ON public.member_program_payments USING btree (payment_due_date);

-- member_program_payments.idx_member_program_payments_method_id
CREATE INDEX idx_member_program_payments_method_id ON public.member_program_payments USING btree (payment_method_id);

-- member_program_payments.idx_member_program_payments_payment_date
CREATE INDEX idx_member_program_payments_payment_date ON public.member_program_payments USING btree (payment_date);

-- member_program_payments.idx_member_program_payments_program_id
CREATE INDEX idx_member_program_payments_program_id ON public.member_program_payments USING btree (member_program_id);

-- member_program_payments.idx_member_program_payments_status_id
CREATE INDEX idx_member_program_payments_status_id ON public.member_program_payments USING btree (payment_status_id);

-- member_program_payments.pk_member_program_payments
CREATE UNIQUE INDEX pk_member_program_payments ON public.member_program_payments USING btree (member_program_payment_id);

-- member_programs.idx_member_programs_lead_id
CREATE INDEX idx_member_programs_lead_id ON public.member_programs USING btree (lead_id);

-- member_programs.idx_member_programs_source_template
CREATE INDEX idx_member_programs_source_template ON public.member_programs USING btree (source_template_id);

-- member_programs.idx_member_programs_status
CREATE INDEX idx_member_programs_status ON public.member_programs USING btree (program_status_id);

-- member_programs.member_programs_pkey
CREATE UNIQUE INDEX member_programs_pkey ON public.member_programs USING btree (member_program_id);

-- menu_items.idx_menu_items_section
CREATE INDEX idx_menu_items_section ON public.menu_items USING btree (section);

-- menu_items.menu_items_path_key
CREATE UNIQUE INDEX menu_items_path_key ON public.menu_items USING btree (path);

-- menu_items.menu_items_pkey
CREATE UNIQUE INDEX menu_items_pkey ON public.menu_items USING btree (id);

-- payment_methods.pk_payment_methods
CREATE UNIQUE INDEX pk_payment_methods ON public.payment_methods USING btree (payment_method_id);

-- payment_status.pk_payment_status
CREATE UNIQUE INDEX pk_payment_status ON public.payment_status USING btree (payment_status_id);

-- pillars.pillars_pkey
CREATE UNIQUE INDEX pillars_pkey ON public.pillars USING btree (pillar_id);

-- program_status.program_status_pkey
CREATE UNIQUE INDEX program_status_pkey ON public.program_status USING btree (program_status_id);

-- program_template.program_template_pkey
CREATE UNIQUE INDEX program_template_pkey ON public.program_template USING btree (program_template_id);

-- program_template_items.program_template_items_pkey
CREATE UNIQUE INDEX program_template_items_pkey ON public.program_template_items USING btree (program_template_items_id);

-- status.status_pkey
CREATE UNIQUE INDEX status_pkey ON public.status USING btree (status_id);

-- survey_forms.survey_forms_form_name_key
CREATE UNIQUE INDEX survey_forms_form_name_key ON public.survey_forms USING btree (form_name);

-- survey_forms.survey_forms_pkey
CREATE UNIQUE INDEX survey_forms_pkey ON public.survey_forms USING btree (form_id);

-- survey_modules.idx_survey_modules_program_id
CREATE INDEX idx_survey_modules_program_id ON public.survey_modules USING btree (program_id);

-- survey_modules.survey_modules_pkey
CREATE UNIQUE INDEX survey_modules_pkey ON public.survey_modules USING btree (module_id);

-- survey_modules.survey_modules_program_id_module_name_key
CREATE UNIQUE INDEX survey_modules_program_id_module_name_key ON public.survey_modules USING btree (program_id, module_name);

-- survey_programs.survey_programs_pkey
CREATE UNIQUE INDEX survey_programs_pkey ON public.survey_programs USING btree (program_id);

-- survey_programs.survey_programs_program_name_key
CREATE UNIQUE INDEX survey_programs_program_name_key ON public.survey_programs USING btree (program_name);

-- survey_questions.idx_survey_questions_form_id
CREATE INDEX idx_survey_questions_form_id ON public.survey_questions USING btree (form_id);

-- survey_questions.survey_questions_form_id_question_text_key
CREATE UNIQUE INDEX survey_questions_form_id_question_text_key ON public.survey_questions USING btree (form_id, question_text);

-- survey_questions.survey_questions_pkey
CREATE UNIQUE INDEX survey_questions_pkey ON public.survey_questions USING btree (question_id);

-- survey_response_sessions.idx_survey_response_sessions_completed_on
CREATE INDEX idx_survey_response_sessions_completed_on ON public.survey_response_sessions USING btree (completed_on);

-- survey_response_sessions.idx_survey_response_sessions_form_id
CREATE INDEX idx_survey_response_sessions_form_id ON public.survey_response_sessions USING btree (form_id);

-- survey_response_sessions.idx_survey_response_sessions_import_batch_id
CREATE INDEX idx_survey_response_sessions_import_batch_id ON public.survey_response_sessions USING btree (import_batch_id);

-- survey_response_sessions.idx_survey_response_sessions_lead_id
CREATE INDEX idx_survey_response_sessions_lead_id ON public.survey_response_sessions USING btree (lead_id);

-- survey_response_sessions.survey_response_sessions_pkey
CREATE UNIQUE INDEX survey_response_sessions_pkey ON public.survey_response_sessions USING btree (session_id);

-- survey_responses.idx_survey_responses_question_id
CREATE INDEX idx_survey_responses_question_id ON public.survey_responses USING btree (question_id);

-- survey_responses.idx_survey_responses_session_id
CREATE INDEX idx_survey_responses_session_id ON public.survey_responses USING btree (session_id);

-- survey_responses.survey_responses_pkey
CREATE UNIQUE INDEX survey_responses_pkey ON public.survey_responses USING btree (response_id);

-- survey_session_program_context.idx_survey_session_context_module_id
CREATE INDEX idx_survey_session_context_module_id ON public.survey_session_program_context USING btree (module_id);

-- survey_session_program_context.idx_survey_session_context_program_id
CREATE INDEX idx_survey_session_context_program_id ON public.survey_session_program_context USING btree (program_id);

-- survey_session_program_context.idx_survey_session_context_session_id
CREATE INDEX idx_survey_session_context_session_id ON public.survey_session_program_context USING btree (session_id);

-- survey_session_program_context.survey_session_program_context_pkey
CREATE UNIQUE INDEX survey_session_program_context_pkey ON public.survey_session_program_context USING btree (context_id);

-- survey_session_program_context.survey_session_program_context_session_id_key
CREATE UNIQUE INDEX survey_session_program_context_session_id_key ON public.survey_session_program_context USING btree (session_id);

-- survey_user_mappings.idx_survey_user_mappings_external_user_id
CREATE INDEX idx_survey_user_mappings_external_user_id ON public.survey_user_mappings USING btree (external_user_id);

-- survey_user_mappings.idx_survey_user_mappings_lead_id
CREATE INDEX idx_survey_user_mappings_lead_id ON public.survey_user_mappings USING btree (lead_id);

-- survey_user_mappings.survey_user_mappings_external_user_id_key
CREATE UNIQUE INDEX survey_user_mappings_external_user_id_key ON public.survey_user_mappings USING btree (external_user_id);

-- survey_user_mappings.survey_user_mappings_pkey
CREATE UNIQUE INDEX survey_user_mappings_pkey ON public.survey_user_mappings USING btree (mapping_id);

-- therapies.therapies_pkey
CREATE UNIQUE INDEX therapies_pkey ON public.therapies USING btree (therapy_id);

-- therapies_bodies_pillars.therapies_bodies_pillars_pkey
CREATE UNIQUE INDEX therapies_bodies_pillars_pkey ON public.therapies_bodies_pillars USING btree (therapy_id, body_id, pillar_id);

-- therapy_tasks.therapy_tasks_pkey
CREATE UNIQUE INDEX therapy_tasks_pkey ON public.therapy_tasks USING btree (task_id);

-- therapytype.therapy_type_pkey
CREATE UNIQUE INDEX therapy_type_pkey ON public.therapytype USING btree (therapy_type_id);

-- user_menu_permissions.idx_user_menu_permissions_path
CREATE INDEX idx_user_menu_permissions_path ON public.user_menu_permissions USING btree (menu_path);

-- user_menu_permissions.idx_user_menu_permissions_user_id
CREATE INDEX idx_user_menu_permissions_user_id ON public.user_menu_permissions USING btree (user_id);

-- user_menu_permissions.user_menu_permissions_pkey
CREATE UNIQUE INDEX user_menu_permissions_pkey ON public.user_menu_permissions USING btree (id);

-- user_menu_permissions.user_menu_permissions_user_id_menu_path_key
CREATE UNIQUE INDEX user_menu_permissions_user_id_menu_path_key ON public.user_menu_permissions USING btree (user_id, menu_path);

-- users.users_pkey
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

-- vendors.vendors_pkey
CREATE UNIQUE INDEX vendors_pkey ON public.vendors USING btree (vendor_id);

-- Functions
-- Function: adjust_date_for_weekend
CREATE OR REPLACE FUNCTION public.adjust_date_for_weekend(input_date date)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  CASE EXTRACT(DOW FROM input_date)
    WHEN 0 THEN -- Sunday, move to Monday
      RETURN input_date + INTERVAL '1 day';
    WHEN 6 THEN -- Saturday, move to Friday  
      RETURN input_date - INTERVAL '1 day';
    ELSE -- Monday-Friday, no change
      RETURN input_date;
  END CASE;
END;
$function$


-- Function: apply_member_program_items_changes
CREATE OR REPLACE FUNCTION public.apply_member_program_items_changes(p_program_id integer, p_changes jsonb, p_locked_price numeric, p_locked_margin numeric, p_price_cents_tol integer DEFAULT 1, p_margin_tol numeric DEFAULT 0.1)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: audit_and_fix_margins
CREATE OR REPLACE FUNCTION public.audit_and_fix_margins(p_fix_mode text DEFAULT 'report'::text)
 RETURNS TABLE(program_id integer, program_name text, status_name text, current_margin numeric, correct_margin numeric, difference numeric, total_cost numeric, total_charge numeric, projected_price numeric, locked_price numeric, finance_charges numeric, discounts numeric, taxes_calculated numeric, taxes_stored numeric, is_active boolean, needs_update boolean, was_updated boolean, contracted_at_margin_set boolean)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_program RECORD;
  v_finances RECORD;
  v_items RECORD;
  v_total_cost NUMERIC := 0;
  v_total_charge NUMERIC := 0;
  v_total_taxable_charge NUMERIC := 0;
  v_taxes NUMERIC := 0;
  v_projected_price NUMERIC := 0;
  v_correct_margin NUMERIC := 0;
  v_current_margin NUMERIC := 0;
  v_difference NUMERIC := 0;
  v_is_active BOOLEAN := FALSE;
  v_needs_update BOOLEAN := FALSE;
  v_was_updated BOOLEAN := FALSE;
  v_contracted_at_margin_set BOOLEAN := FALSE;
  v_taxable_percentage NUMERIC := 0;
  v_taxable_discount NUMERIC := 0;
  v_discounted_taxable_charge NUMERIC := 0;
  v_pre_tax_revenue NUMERIC := 0;
  v_adjusted_cost NUMERIC := 0;
  v_locked_price NUMERIC := 0;
  v_pre_tax_locked_price NUMERIC := 0;
  v_tax_rate NUMERIC := 0.0825;
BEGIN
  -- Loop through all programs
  FOR v_program IN 
    SELECT 
      mp.member_program_id,
      mp.program_template_name,
      mp.total_cost as mp_total_cost,
      mp.total_charge as mp_total_charge,
      ps.status_name
    FROM member_programs mp
    LEFT JOIN program_status ps ON mp.program_status_id = ps.program_status_id
    ORDER BY mp.member_program_id
  LOOP
    -- Get finances for this program
    SELECT * INTO v_finances
    FROM member_program_finances
    WHERE member_program_id = v_program.member_program_id;

    -- Skip if no finances record
    IF NOT FOUND THEN
      program_id := v_program.member_program_id;
      program_name := v_program.program_template_name;
      status_name := v_program.status_name;
      current_margin := NULL;
      correct_margin := NULL;
      difference := NULL;
      needs_update := FALSE;
      was_updated := FALSE;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Reset totals for this program
    v_total_cost := 0;
    v_total_charge := 0;
    v_total_taxable_charge := 0;

    -- Calculate totals from items
    FOR v_items IN
      SELECT 
        mpi.quantity,
        mpi.item_cost,
        mpi.item_charge,
        t.taxable
      FROM member_program_items mpi
      LEFT JOIN therapies t ON mpi.therapy_id = t.therapy_id
      WHERE mpi.member_program_id = v_program.member_program_id
        AND mpi.active_flag = TRUE
    LOOP
      v_total_cost := v_total_cost + (COALESCE(v_items.item_cost, 0) * COALESCE(v_items.quantity, 1));
      v_total_charge := v_total_charge + (COALESCE(v_items.item_charge, 0) * COALESCE(v_items.quantity, 1));
      
      IF v_items.taxable = TRUE THEN
        v_total_taxable_charge := v_total_taxable_charge + (COALESCE(v_items.item_charge, 0) * COALESCE(v_items.quantity, 1));
      END IF;
    END LOOP;

    -- Calculate taxes (matching calculateTaxesOnTaxableItems)
    IF v_total_charge > 0 AND v_total_taxable_charge > 0 THEN
      v_taxable_percentage := v_total_taxable_charge / v_total_charge;
      v_taxable_discount := ABS(COALESCE(v_finances.discounts, 0)) * v_taxable_percentage;
      v_discounted_taxable_charge := v_total_taxable_charge - v_taxable_discount;
      v_taxes := v_discounted_taxable_charge * v_tax_rate;
    ELSE
      v_taxes := 0;
    END IF;

    -- Calculate projected price (matching calculateProjectedPrice)
    v_projected_price := v_total_charge + v_taxes + COALESCE(v_finances.finance_charges, 0) + COALESCE(v_finances.discounts, 0);

    -- Determine if program is Active
    v_is_active := LOWER(v_program.status_name) = 'active';

    -- Calculate correct margin based on status
    IF v_is_active THEN
      -- For Active programs: use locked price
      v_locked_price := COALESCE(v_finances.final_total_price, 0);
      v_pre_tax_locked_price := v_locked_price - v_taxes;
      
      -- Adjust cost for negative finance charges
      IF COALESCE(v_finances.finance_charges, 0) < 0 THEN
        v_adjusted_cost := v_total_cost + ABS(v_finances.finance_charges);
      ELSE
        v_adjusted_cost := v_total_cost;
      END IF;
      
      IF v_pre_tax_locked_price > 0 THEN
        v_correct_margin := ((v_pre_tax_locked_price - v_adjusted_cost) / v_pre_tax_locked_price) * 100;
      ELSE
        v_correct_margin := 0;
      END IF;
    ELSE
      -- For Quote programs: use projected price
      v_pre_tax_revenue := v_projected_price - v_taxes;
      
      -- Adjust cost for negative finance charges
      IF COALESCE(v_finances.finance_charges, 0) < 0 THEN
        v_adjusted_cost := v_total_cost + ABS(v_finances.finance_charges);
      ELSE
        v_adjusted_cost := v_total_cost;
      END IF;
      
      IF v_pre_tax_revenue > 0 THEN
        v_correct_margin := ((v_pre_tax_revenue - v_adjusted_cost) / v_pre_tax_revenue) * 100;
      ELSE
        v_correct_margin := 0;
      END IF;
      
      v_locked_price := NULL;
    END IF;

    -- Get current margin
    v_current_margin := COALESCE(v_finances.margin, 0);
    v_difference := ABS(v_correct_margin - v_current_margin);
    v_needs_update := v_difference > 0.01;

    -- Fix if requested and needed
    v_was_updated := FALSE;
    v_contracted_at_margin_set := FALSE;
    
    IF p_fix_mode = 'fix' AND v_needs_update THEN
      -- Update margin
      UPDATE member_program_finances
      SET 
        margin = v_correct_margin,
        updated_at = NOW()
      WHERE member_program_finance_id = v_finances.member_program_finance_id;
      
      v_was_updated := TRUE;
      
      -- For Active programs, also set contracted_at_margin if not set
      IF v_is_active AND v_finances.contracted_at_margin IS NULL THEN
        UPDATE member_program_finances
        SET contracted_at_margin = v_correct_margin
        WHERE member_program_finance_id = v_finances.member_program_finance_id;
        
        v_contracted_at_margin_set := TRUE;
      END IF;
    END IF;

    -- Return row
    program_id := v_program.member_program_id;
    program_name := v_program.program_template_name;
    status_name := v_program.status_name;
    current_margin := v_current_margin;
    correct_margin := v_correct_margin;
    difference := v_difference;
    total_cost := v_total_cost;
    total_charge := v_total_charge;
    projected_price := v_projected_price;
    locked_price := v_locked_price;
    finance_charges := COALESCE(v_finances.finance_charges, 0);
    discounts := COALESCE(v_finances.discounts, 0);
    taxes_calculated := v_taxes;
    taxes_stored := COALESCE(v_finances.taxes, 0);
    is_active := v_is_active;
    needs_update := v_needs_update;
    was_updated := v_was_updated;
    contracted_at_margin_set := v_contracted_at_margin_set;
    
    RETURN NEXT;
  END LOOP;
END;
$function$


-- Function: audit_financing_types
CREATE OR REPLACE FUNCTION public.audit_financing_types()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: audit_member_item_schedule
CREATE OR REPLACE FUNCTION public.audit_member_item_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

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
$function$


-- Function: audit_member_item_task_schedule
CREATE OR REPLACE FUNCTION public.audit_member_item_task_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end $function$


-- Function: audit_member_program_finances
CREATE OR REPLACE FUNCTION public.audit_member_program_finances()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end $function$


-- Function: audit_member_program_item_tasks
CREATE OR REPLACE FUNCTION public.audit_member_program_item_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end $function$


-- Function: audit_member_program_items
CREATE OR REPLACE FUNCTION public.audit_member_program_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end $function$


-- Function: audit_member_program_payments
CREATE OR REPLACE FUNCTION public.audit_member_program_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end $function$


-- Function: audit_member_programs
CREATE OR REPLACE FUNCTION public.audit_member_programs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end $function$


-- Function: audit_payment_methods
CREATE OR REPLACE FUNCTION public.audit_payment_methods()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: audit_payment_status
CREATE OR REPLACE FUNCTION public.audit_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: audit_support_trigger
CREATE OR REPLACE FUNCTION public.audit_support_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
end; $function$


-- Function: audit_trigger_function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$


-- Function: bytea_to_text
CREATE OR REPLACE FUNCTION public.bytea_to_text(data bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE STRICT
AS '$libdir/http', $function$bytea_to_text$function$


-- Function: compute_program_total_pause_days
CREATE OR REPLACE FUNCTION public.compute_program_total_pause_days(p_program_id integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


-- Function: copy_program_template
CREATE OR REPLACE FUNCTION public.copy_program_template(p_source_template_id integer, p_user_id uuid DEFAULT auth.uid())
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_new_template_id INTEGER;
    v_original_name TEXT;
    v_original_description TEXT;
    v_copy_number INTEGER := 1;
    v_new_name TEXT;
    v_new_description TEXT;
    v_template_item RECORD;
    v_total_cost NUMERIC(9,2) := 0;
    v_total_charge NUMERIC(9,2) := 0;
    v_margin_percentage NUMERIC(5,2) := 0;
BEGIN
    -- Verify source template exists
    IF NOT EXISTS (
        SELECT 1 FROM program_template 
        WHERE program_template_id = p_source_template_id
    ) THEN
        RAISE EXCEPTION 'Source template ID % does not exist', p_source_template_id;
    END IF;

    -- Get original template name and description
    SELECT program_template_name, description
    INTO v_original_name, v_original_description
    FROM program_template
    WHERE program_template_id = p_source_template_id;

    -- Find the next available copy number
    -- Check for existing copies with pattern "Original Name - Copy [N]"
    SELECT COALESCE(MAX(
        CASE 
            WHEN program_template_name ~ (v_original_name || ' - Copy \d+$')
            THEN CAST(
                substring(program_template_name from ' - Copy (\d+)$') 
                AS INTEGER
            )
            WHEN program_template_name = v_original_name || ' - Copy'
            THEN 1
            ELSE 0
        END
    ), 0) + 1
    INTO v_copy_number
    FROM program_template
    WHERE program_template_name LIKE v_original_name || ' - Copy%';

    -- Generate new template name
    IF v_copy_number = 1 THEN
        v_new_name := v_original_name || ' - Copy';
    ELSE
        v_new_name := v_original_name || ' - Copy ' || v_copy_number;
    END IF;

    -- Generate new description with copy note
    v_new_description := COALESCE(v_original_description, '') || 
        E'\n\n--- COPY INFO ---' ||
        E'\nCopied from: ' || v_original_name ||
        E'\nSource Template ID: ' || p_source_template_id ||
        E'\nCopied on: ' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS');

    -- Create new template (inactive by default, with zero totals initially)
    INSERT INTO program_template (
        program_template_name,
        description,
        total_cost,
        total_charge,
        margin_percentage,
        active_flag,
        created_by,
        updated_by
    ) VALUES (
        v_new_name,
        v_new_description,
        0,
        0,
        0,
        FALSE, -- Inactive until reviewed
        p_user_id,
        p_user_id
    )
    RETURNING program_template_id INTO v_new_template_id;

    -- Copy all ACTIVE items from source template
    FOR v_template_item IN
        SELECT 
            pti.*,
            t.cost as therapy_cost,
            t.charge as therapy_charge
        FROM program_template_items pti
        JOIN therapies t ON pti.therapy_id = t.therapy_id
        WHERE pti.program_template_id = p_source_template_id
        AND pti.active_flag = TRUE
        ORDER BY pti.days_from_start, pti.program_template_items_id
    LOOP
        -- Insert copied item
        INSERT INTO program_template_items (
            program_template_id,
            therapy_id,
            quantity,
            days_from_start,
            days_between,
            instructions,
            active_flag,
            created_by,
            updated_by
        ) VALUES (
            v_new_template_id,
            v_template_item.therapy_id,
            v_template_item.quantity,
            v_template_item.days_from_start,
            v_template_item.days_between,
            v_template_item.instructions,
            v_template_item.active_flag, -- Preserve active flag from original item
            p_user_id,
            p_user_id
        );

        -- Accumulate totals for recalculation
        v_total_cost := v_total_cost + (
            v_template_item.therapy_cost * v_template_item.quantity
        );
        v_total_charge := v_total_charge + (
            v_template_item.therapy_charge * v_template_item.quantity
        );
    END LOOP;

    -- Calculate margin percentage
    IF v_total_charge > 0 THEN
        v_margin_percentage := ((v_total_charge - v_total_cost) / v_total_charge) * 100;
    ELSE
        v_margin_percentage := 0;
    END IF;

    -- Update template with recalculated totals
    UPDATE program_template
    SET 
        total_cost = v_total_cost,
        total_charge = v_total_charge,
        margin_percentage = v_margin_percentage,
        updated_by = p_user_id
    WHERE program_template_id = v_new_template_id;

    -- Return the new template ID
    RETURN v_new_template_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE NOTICE 'Error copying template %: %', p_source_template_id, SQLERRM;
        RAISE;
END;
$function$


-- Function: create_member_program_from_template
CREATE OR REPLACE FUNCTION public.create_member_program_from_template(p_lead_id integer, p_template_ids integer[], p_program_name text, p_description text, p_start_date date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: example_create_member_program
CREATE OR REPLACE FUNCTION public.example_create_member_program()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: generate_member_program_schedule
CREATE OR REPLACE FUNCTION public.generate_member_program_schedule(p_program_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
      -- Calculate initial occurrence date
      v_occurrence_date := v_effective_start + (v_days_from_start::int) + (v_instance * v_days_between);
      
      -- Adjust occurrence date for weekends
      v_occurrence_date := public.adjust_date_for_weekend(v_occurrence_date);

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
        public.adjust_date_for_weekend((v_occurrence_date + COALESCE(t.task_delay, 0))::date)
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
$function$


-- Function: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.users (id, email, full_name, created_at)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$function$


-- Function: http
CREATE OR REPLACE FUNCTION public.http(request http_request)
 RETURNS http_response
 LANGUAGE c
AS '$libdir/http', $function$http_request$function$


-- Function: http_delete
CREATE OR REPLACE FUNCTION public.http_delete(uri character varying, content character varying, content_type character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('DELETE', $1, NULL, $3, $2)::public.http_request) $function$


-- Function: http_delete
CREATE OR REPLACE FUNCTION public.http_delete(uri character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('DELETE', $1, NULL, NULL, NULL)::public.http_request) $function$


-- Function: http_get
CREATE OR REPLACE FUNCTION public.http_get(uri character varying, data jsonb)
 RETURNS http_response
 LANGUAGE sql
AS $function$
        SELECT public.http(('GET', $1 || '?' || public.urlencode($2), NULL, NULL, NULL)::public.http_request)
    $function$


-- Function: http_get
CREATE OR REPLACE FUNCTION public.http_get(uri character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('GET', $1, NULL, NULL, NULL)::public.http_request) $function$


-- Function: http_head
CREATE OR REPLACE FUNCTION public.http_head(uri character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('HEAD', $1, NULL, NULL, NULL)::public.http_request) $function$


-- Function: http_header
CREATE OR REPLACE FUNCTION public.http_header(field character varying, value character varying)
 RETURNS http_header
 LANGUAGE sql
AS $function$ SELECT $1, $2 $function$


-- Function: http_list_curlopt
CREATE OR REPLACE FUNCTION public.http_list_curlopt()
 RETURNS TABLE(curlopt text, value text)
 LANGUAGE c
AS '$libdir/http', $function$http_list_curlopt$function$


-- Function: http_patch
CREATE OR REPLACE FUNCTION public.http_patch(uri character varying, content character varying, content_type character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('PATCH', $1, NULL, $3, $2)::public.http_request) $function$


-- Function: http_post
CREATE OR REPLACE FUNCTION public.http_post(uri character varying, content character varying, content_type character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('POST', $1, NULL, $3, $2)::public.http_request) $function$


-- Function: http_post
CREATE OR REPLACE FUNCTION public.http_post(uri character varying, data jsonb)
 RETURNS http_response
 LANGUAGE sql
AS $function$
        SELECT public.http(('POST', $1, NULL, 'application/x-www-form-urlencoded', public.urlencode($2))::public.http_request)
    $function$


-- Function: http_put
CREATE OR REPLACE FUNCTION public.http_put(uri character varying, content character varying, content_type character varying)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('PUT', $1, NULL, $3, $2)::public.http_request) $function$


-- Function: http_reset_curlopt
CREATE OR REPLACE FUNCTION public.http_reset_curlopt()
 RETURNS boolean
 LANGUAGE c
AS '$libdir/http', $function$http_reset_curlopt$function$


-- Function: http_set_curlopt
CREATE OR REPLACE FUNCTION public.http_set_curlopt(curlopt character varying, value character varying)
 RETURNS boolean
 LANGUAGE c
AS '$libdir/http', $function$http_set_curlopt$function$


-- Function: lock_contracted_margin
CREATE OR REPLACE FUNCTION public.lock_contracted_margin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_new_status_name TEXT;
  v_old_status_name TEXT;
BEGIN
  -- Only proceed if status is changing
  IF OLD.program_status_id IS DISTINCT FROM NEW.program_status_id THEN
    
    -- Get status names
    SELECT status_name INTO v_new_status_name
    FROM program_status
    WHERE program_status_id = NEW.program_status_id;
    
    SELECT status_name INTO v_old_status_name
    FROM program_status
    WHERE program_status_id = OLD.program_status_id;
    
    -- If transitioning TO Active FROM Quote
    IF LOWER(v_new_status_name) = 'active' 
       AND LOWER(COALESCE(v_old_status_name, '')) = 'quote' THEN
      
      -- Lock the contracted margin (one-time snapshot)
      UPDATE member_program_finances
      SET contracted_at_margin = margin
      WHERE member_program_id = NEW.member_program_id
        AND contracted_at_margin IS NULL;  -- Only set once
        
      RAISE NOTICE 'Locked contracted margin for program %', NEW.member_program_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$


-- Function: pause_member_program
CREATE OR REPLACE FUNCTION public.pause_member_program(p_program_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


-- Function: pgaudit_ddl_command_end
CREATE OR REPLACE FUNCTION public.pgaudit_ddl_command_end()
 RETURNS event_trigger
 LANGUAGE c
 SECURITY DEFINER
 SET search_path TO 'pg_catalog, pg_temp'
AS '$libdir/pgaudit', $function$pgaudit_ddl_command_end$function$


-- Function: pgaudit_sql_drop
CREATE OR REPLACE FUNCTION public.pgaudit_sql_drop()
 RETURNS event_trigger
 LANGUAGE c
 SECURITY DEFINER
 SET search_path TO 'pg_catalog, pg_temp'
AS '$libdir/pgaudit', $function$pgaudit_sql_drop$function$


-- Function: regen_member_program_task_schedule
CREATE OR REPLACE FUNCTION public.regen_member_program_task_schedule(p_member_program_item_task_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$


-- Function: regenerate_member_program_payments
CREATE OR REPLACE FUNCTION public.regenerate_member_program_payments(p_program_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_start_date date;
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

  -- Fetch program start date
  select start_date
  into v_start_date
  from public.member_programs
  where member_program_id = p_program_id;

  -- Validate start date exists
  if v_start_date is null then
    raise exception 'Program must have a start date to generate payments';
  end if;

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

  -- External or Full Payment -> single payment on start date
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
      v_start_date,
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

    -- Monthly due date anchor (day of month from start date)
    v_anchor_day := extract(day from v_start_date)::int;

    if v_count <= 1 then
      -- Single payment on start date for full amount
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
        v_start_date,
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
      -- Month i-1 from start date month
      v_target_month := (date_trunc('month', v_start_date)::date + make_interval(months => (i - 1)))::date;
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
$function$


-- Function: text_to_bytea
CREATE OR REPLACE FUNCTION public.text_to_bytea(data text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE STRICT
AS '$libdir/http', $function$text_to_bytea$function$


-- Function: trigger_survey_import
CREATE OR REPLACE FUNCTION public.trigger_survey_import()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  function_url TEXT := 'https://mxktlbhiknpdauzoitnm.supabase.co/functions/v1/process-survey-import';
  service_role_key TEXT := current_setting('app.settings.service_role_key', true);
  payload JSONB;
BEGIN
  -- Only process .csv files (not .csv.old)
  IF NEW.name LIKE '%.csv' AND NEW.name NOT LIKE '%.csv.old' THEN
    
    payload := jsonb_build_object(
      'file_path', NEW.name,
      'bucket_name', NEW.bucket_id
    );
    
    -- Call the edge function using pg_net extension
    PERFORM
      net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := payload
      );
      
    RAISE NOTICE 'Triggered import for file: %', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$function$


-- Function: update_timestamp_function
CREATE OR REPLACE FUNCTION public.update_timestamp_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$function$


-- Function: urlencode
CREATE OR REPLACE FUNCTION public.urlencode(data jsonb)
 RETURNS text
 LANGUAGE c
 IMMUTABLE STRICT
AS '$libdir/http', $function$urlencode_jsonb$function$


-- Function: urlencode
CREATE OR REPLACE FUNCTION public.urlencode(string bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE STRICT
AS '$libdir/http', $function$urlencode$function$


-- Function: urlencode
CREATE OR REPLACE FUNCTION public.urlencode(string character varying)
 RETURNS text
 LANGUAGE c
 IMMUTABLE STRICT
AS '$libdir/http', $function$urlencode$function$


-- Function: write_audit_change
CREATE OR REPLACE FUNCTION public.write_audit_change(p_event_id bigint, p_column_name text, p_old jsonb, p_new jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  insert into public.audit_event_changes(event_id, column_name, old_value, new_value)
  values (p_event_id, p_column_name, p_old, p_new)
  on conflict (event_id, column_name) do nothing;
$function$


-- Function: write_audit_event
CREATE OR REPLACE FUNCTION public.write_audit_event(p_table_name text, p_record_id bigint, p_operation text, p_actor uuid, p_scope text, p_related_member_id bigint, p_related_program_id bigint, p_summary text, p_context jsonb, p_old jsonb, p_new jsonb, p_record_pk jsonb DEFAULT NULL::jsonb)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  insert into public.audit_events(
    table_name, record_id, record_pk, operation, actor_user_id, scope,
    related_member_id, related_program_id, summary, context, old_row, new_row
  ) values (
    p_table_name, p_record_id, p_record_pk, p_operation, p_actor, coalesce(p_scope,'support'),
    p_related_member_id, p_related_program_id, p_summary, p_context, p_old, p_new
  ) returning event_id;
$function$


-- Triggers
-- Trigger: tr_audit_support_bodies on bodies
CREATE TRIGGER tr_audit_support_bodies AFTER INSERT OR DELETE OR UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('body_id')

-- Trigger: update_bodies_timestamp on bodies
CREATE TRIGGER update_bodies_timestamp BEFORE UPDATE ON public.bodies FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_support_buckets on buckets
CREATE TRIGGER tr_audit_support_buckets AFTER INSERT OR DELETE OR UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('bucket_id')

-- Trigger: update_buckets_timestamp on buckets
CREATE TRIGGER update_buckets_timestamp BEFORE UPDATE ON public.buckets FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_campaigns_timestamp on campaigns
CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: trigger_audit_financing_types on financing_types
CREATE TRIGGER trigger_audit_financing_types BEFORE INSERT OR UPDATE ON public.financing_types FOR EACH ROW EXECUTE FUNCTION audit_financing_types()

-- Trigger: update_leads_timestamp on leads
CREATE TRIGGER update_leads_timestamp BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_member_program_finances on member_program_finances
CREATE TRIGGER tr_audit_member_program_finances AFTER INSERT OR DELETE OR UPDATE ON public.member_program_finances FOR EACH ROW EXECUTE FUNCTION audit_member_program_finances()

-- Trigger: tr_audit_member_item_schedule on member_program_item_schedule
CREATE TRIGGER tr_audit_member_item_schedule AFTER INSERT OR DELETE OR UPDATE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION audit_member_item_schedule()

-- Trigger: update_member_program_item_schedule_timestamp on member_program_item_schedule
CREATE TRIGGER update_member_program_item_schedule_timestamp BEFORE UPDATE ON public.member_program_item_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_member_program_item_tasks on member_program_item_tasks
CREATE TRIGGER tr_audit_member_program_item_tasks AFTER INSERT OR DELETE OR UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION audit_member_program_item_tasks()

-- Trigger: update_member_program_item_tasks_timestamp on member_program_item_tasks
CREATE TRIGGER update_member_program_item_tasks_timestamp BEFORE UPDATE ON public.member_program_item_tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_member_program_items on member_program_items
CREATE TRIGGER tr_audit_member_program_items AFTER INSERT OR DELETE OR UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION audit_member_program_items()

-- Trigger: update_member_program_items_timestamp on member_program_items
CREATE TRIGGER update_member_program_items_timestamp BEFORE UPDATE ON public.member_program_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_member_item_task_schedule on member_program_items_task_schedule
CREATE TRIGGER tr_audit_member_item_task_schedule AFTER INSERT OR DELETE OR UPDATE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION audit_member_item_task_schedule()

-- Trigger: update_member_program_items_task_schedule_timestamp on member_program_items_task_schedule
CREATE TRIGGER update_member_program_items_task_schedule_timestamp BEFORE UPDATE ON public.member_program_items_task_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_member_program_payments on member_program_payments
CREATE TRIGGER tr_audit_member_program_payments AFTER INSERT OR DELETE OR UPDATE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION audit_member_program_payments()

-- Trigger: trigger_audit_member_program_payments on member_program_payments
CREATE TRIGGER trigger_audit_member_program_payments BEFORE INSERT OR UPDATE ON public.member_program_payments FOR EACH ROW EXECUTE FUNCTION audit_member_program_payments()

-- Trigger: tr_audit_member_programs on member_programs
CREATE TRIGGER tr_audit_member_programs AFTER INSERT OR DELETE OR UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION audit_member_programs()

-- Trigger: tr_lock_contracted_margin on member_programs
CREATE TRIGGER tr_lock_contracted_margin AFTER UPDATE ON public.member_programs FOR EACH ROW WHEN ((old.program_status_id IS DISTINCT FROM new.program_status_id)) EXECUTE FUNCTION lock_contracted_margin()

-- Trigger: update_member_programs_timestamp on member_programs
CREATE TRIGGER update_member_programs_timestamp BEFORE UPDATE ON public.member_programs FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_support_payment_methods on payment_methods
CREATE TRIGGER tr_audit_support_payment_methods AFTER INSERT OR DELETE OR UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('payment_method_id')

-- Trigger: trigger_audit_payment_methods on payment_methods
CREATE TRIGGER trigger_audit_payment_methods BEFORE INSERT OR UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION audit_payment_methods()

-- Trigger: tr_audit_support_payment_status on payment_status
CREATE TRIGGER tr_audit_support_payment_status AFTER INSERT OR DELETE OR UPDATE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('program_status_id')

-- Trigger: trigger_audit_payment_status on payment_status
CREATE TRIGGER trigger_audit_payment_status BEFORE INSERT OR UPDATE ON public.payment_status FOR EACH ROW EXECUTE FUNCTION audit_payment_status()

-- Trigger: update_pillars_timestamp on pillars
CREATE TRIGGER update_pillars_timestamp BEFORE UPDATE ON public.pillars FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_program_status_timestamp on program_status
CREATE TRIGGER update_program_status_timestamp BEFORE UPDATE ON public.program_status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_program_template_timestamp on program_template
CREATE TRIGGER update_program_template_timestamp BEFORE UPDATE ON public.program_template FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_program_template_items_timestamp on program_template_items
CREATE TRIGGER update_program_template_items_timestamp BEFORE UPDATE ON public.program_template_items FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_status_timestamp on status
CREATE TRIGGER update_status_timestamp BEFORE UPDATE ON public.status FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_support_therapies on therapies
CREATE TRIGGER tr_audit_support_therapies AFTER INSERT OR DELETE OR UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('therapy_id')

-- Trigger: update_therapies_timestamp on therapies
CREATE TRIGGER update_therapies_timestamp BEFORE UPDATE ON public.therapies FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_therapies_bodies_pillars_timestamp on therapies_bodies_pillars
CREATE TRIGGER update_therapies_bodies_pillars_timestamp BEFORE UPDATE ON public.therapies_bodies_pillars FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_therapy_tasks_timestamp on therapy_tasks
CREATE TRIGGER update_therapy_tasks_timestamp BEFORE UPDATE ON public.therapy_tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: tr_audit_support_therapytype on therapytype
CREATE TRIGGER tr_audit_support_therapytype AFTER INSERT OR DELETE OR UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION audit_support_trigger('therapy_type_id')

-- Trigger: update_therapy_type_timestamp on therapytype
CREATE TRIGGER update_therapy_type_timestamp BEFORE UPDATE ON public.therapytype FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Trigger: update_vendors_timestamp on vendors
CREATE TRIGGER update_vendors_timestamp BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_timestamp_function()

-- Sequences
-- Sequence: audit_logs_id_seq
CREATE SEQUENCE IF NOT EXISTS public.audit_logs_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: bodies_body_id_seq
CREATE SEQUENCE IF NOT EXISTS public.bodies_body_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: buckets_bucket_id_seq
CREATE SEQUENCE IF NOT EXISTS public.buckets_bucket_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: campaigns_campaign_id_seq
CREATE SEQUENCE IF NOT EXISTS public.campaigns_campaign_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: financing_types_financing_type_id_seq
CREATE SEQUENCE IF NOT EXISTS public.financing_types_financing_type_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: leads_lead_id_seq
CREATE SEQUENCE IF NOT EXISTS public.leads_lead_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  NO CYCLE;

-- Sequence: member_program_finances_member_program_finance_id_seq
CREATE SEQUENCE IF NOT EXISTS public.member_program_finances_member_program_finance_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: member_program_item_schedule_member_program_item_schedule_id_se
CREATE SEQUENCE IF NOT EXISTS public.member_program_item_schedule_member_program_item_schedule_id_se
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: member_program_item_tasks_member_program_item_task_id_seq
CREATE SEQUENCE IF NOT EXISTS public.member_program_item_tasks_member_program_item_task_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: member_program_items_member_program_item_id_seq
CREATE SEQUENCE IF NOT EXISTS public.member_program_items_member_program_item_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: member_program_items_task_schedule_member_program_item_task_sch
CREATE SEQUENCE IF NOT EXISTS public.member_program_items_task_schedule_member_program_item_task_sch
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: member_program_payments_member_program_payment_id_seq
CREATE SEQUENCE IF NOT EXISTS public.member_program_payments_member_program_payment_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: member_programs_member_program_id_seq
CREATE SEQUENCE IF NOT EXISTS public.member_programs_member_program_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: menu_items_id_seq
CREATE SEQUENCE IF NOT EXISTS public.menu_items_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: payment_methods_payment_method_id_seq
CREATE SEQUENCE IF NOT EXISTS public.payment_methods_payment_method_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: payment_status_payment_status_id_seq
CREATE SEQUENCE IF NOT EXISTS public.payment_status_payment_status_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: pillars_pillar_id_seq
CREATE SEQUENCE IF NOT EXISTS public.pillars_pillar_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: program_items_program_item_id_seq
CREATE SEQUENCE IF NOT EXISTS public.program_items_program_item_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: program_status_program_status_id_seq
CREATE SEQUENCE IF NOT EXISTS public.program_status_program_status_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: program_template_items_program_template_items_id_seq
CREATE SEQUENCE IF NOT EXISTS public.program_template_items_program_template_items_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: program_template_program_template_id_seq
CREATE SEQUENCE IF NOT EXISTS public.program_template_program_template_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: programs_program_id_seq
CREATE SEQUENCE IF NOT EXISTS public.programs_program_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: status_status_id_seq
CREATE SEQUENCE IF NOT EXISTS public.status_status_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_forms_form_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_forms_form_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_modules_module_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_modules_module_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_programs_program_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_programs_program_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_questions_question_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_questions_question_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_response_sessions_session_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_response_sessions_session_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_responses_response_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_responses_response_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  NO CYCLE;

-- Sequence: survey_session_program_context_context_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_session_program_context_context_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: survey_user_mappings_mapping_id_seq
CREATE SEQUENCE IF NOT EXISTS public.survey_user_mappings_mapping_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: therapies_therapy_id_seq
CREATE SEQUENCE IF NOT EXISTS public.therapies_therapy_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: therapy_tasks_task_id_seq
CREATE SEQUENCE IF NOT EXISTS public.therapy_tasks_task_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: therapy_type_therapy_type_id_seq
CREATE SEQUENCE IF NOT EXISTS public.therapy_type_therapy_type_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: user_menu_permissions_id_seq
CREATE SEQUENCE IF NOT EXISTS public.user_menu_permissions_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Sequence: vendors_vendor_id_seq
CREATE SEQUENCE IF NOT EXISTS public.vendors_vendor_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- Row Level Security Policies
-- Policy: all_access_bodies on bodies
CREATE POLICY "all_access_bodies" ON public.bodies
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_buckets on buckets
CREATE POLICY "all_access_buckets" ON public.buckets
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_campaigns on campaigns
CREATE POLICY "all_access_campaigns" ON public.campaigns
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: Admin full access to data_import_errors on data_import_errors
CREATE POLICY "Admin full access to data_import_errors" ON public.data_import_errors
  FOR ALL
  TO {authenticated}
  USING ((auth.uid() IN ( SELECT users.id
   FROM users
  WHERE (users.is_admin = true))))
;

-- Policy: Service role bypass RLS on data_import_errors on data_import_errors
CREATE POLICY "Service role bypass RLS on data_import_errors" ON public.data_import_errors
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: Admin full access to data_import_batches on data_import_jobs
CREATE POLICY "Admin full access to data_import_batches" ON public.data_import_jobs
  FOR ALL
  TO {authenticated}
  USING ((auth.uid() IN ( SELECT users.id
   FROM users
  WHERE (users.is_admin = true))))
;

-- Policy: Service role bypass RLS on data_import_batches on data_import_jobs
CREATE POLICY "Service role bypass RLS on data_import_batches" ON public.data_import_jobs
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: all_access_financing_types on financing_types
CREATE POLICY "all_access_financing_types" ON public.financing_types
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: financing_types_read on financing_types
CREATE POLICY "financing_types_read" ON public.financing_types
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: Authenticated users can insert lead notes on lead_notes
CREATE POLICY "Authenticated users can insert lead notes" ON public.lead_notes
  FOR INSERT
  TO {authenticated}
  WITH CHECK (true)
;

-- Policy: Authenticated users can view lead notes on lead_notes
CREATE POLICY "Authenticated users can view lead notes" ON public.lead_notes
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: all_access_leads on leads
CREATE POLICY "all_access_leads" ON public.leads
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_member_program_finances on member_program_finances
CREATE POLICY "all_access_member_program_finances" ON public.member_program_finances
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: mp_finances_select_own on member_program_finances
CREATE POLICY "mp_finances_select_own" ON public.member_program_finances
  FOR SELECT
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM member_programs p
  WHERE ((p.member_program_id = member_program_finances.member_program_id) AND (p.created_by = auth.uid())))))
;

-- Policy: all_access_member_program_item_schedule on member_program_item_schedule
CREATE POLICY "all_access_member_program_item_schedule" ON public.member_program_item_schedule
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_member_program_item_tasks on member_program_item_tasks
CREATE POLICY "all_access_member_program_item_tasks" ON public.member_program_item_tasks
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_member_program_items on member_program_items
CREATE POLICY "all_access_member_program_items" ON public.member_program_items
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_member_program_items_task_schedule on member_program_items_task_schedule
CREATE POLICY "all_access_member_program_items_task_schedule" ON public.member_program_items_task_schedule
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_member_program_payments on member_program_payments
CREATE POLICY "all_access_member_program_payments" ON public.member_program_payments
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: mp_payments_delete_unpaid_own on member_program_payments
CREATE POLICY "mp_payments_delete_unpaid_own" ON public.member_program_payments
  FOR DELETE
  TO {authenticated}
  USING (((payment_date IS NULL) AND (EXISTS ( SELECT 1
   FROM member_programs p
  WHERE ((p.member_program_id = member_program_payments.member_program_id) AND (p.created_by = auth.uid()))))))
;

-- Policy: mp_payments_insert_own on member_program_payments
CREATE POLICY "mp_payments_insert_own" ON public.member_program_payments
  FOR INSERT
  TO {authenticated}
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_programs p
  WHERE ((p.member_program_id = member_program_payments.member_program_id) AND (p.created_by = auth.uid())))))
;

-- Policy: mp_payments_select_own on member_program_payments
CREATE POLICY "mp_payments_select_own" ON public.member_program_payments
  FOR SELECT
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM member_programs p
  WHERE ((p.member_program_id = member_program_payments.member_program_id) AND (p.created_by = auth.uid())))))
;

-- Policy: all_access_member_programs on member_programs
CREATE POLICY "all_access_member_programs" ON public.member_programs
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_menu_items on menu_items
CREATE POLICY "all_access_menu_items" ON public.menu_items
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_payment_methods on payment_methods
CREATE POLICY "all_access_payment_methods" ON public.payment_methods
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_payment_status on payment_status
CREATE POLICY "all_access_payment_status" ON public.payment_status
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: payment_status_read on payment_status
CREATE POLICY "payment_status_read" ON public.payment_status
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: all_access_pillars on pillars
CREATE POLICY "all_access_pillars" ON public.pillars
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_program_status on program_status
CREATE POLICY "all_access_program_status" ON public.program_status
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_program_template on program_template
CREATE POLICY "all_access_program_template" ON public.program_template
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_program_template_items on program_template_items
CREATE POLICY "all_access_program_template_items" ON public.program_template_items
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_status on status
CREATE POLICY "all_access_status" ON public.status
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: authenticated_read_access on survey_forms
CREATE POLICY "authenticated_read_access" ON public.survey_forms
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_forms
CREATE POLICY "service_role_full_access" ON public.survey_forms
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_modules
CREATE POLICY "authenticated_read_access" ON public.survey_modules
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_modules
CREATE POLICY "service_role_full_access" ON public.survey_modules
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_programs
CREATE POLICY "authenticated_read_access" ON public.survey_programs
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_programs
CREATE POLICY "service_role_full_access" ON public.survey_programs
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_questions
CREATE POLICY "authenticated_read_access" ON public.survey_questions
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_questions
CREATE POLICY "service_role_full_access" ON public.survey_questions
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_response_sessions
CREATE POLICY "authenticated_read_access" ON public.survey_response_sessions
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_response_sessions
CREATE POLICY "service_role_full_access" ON public.survey_response_sessions
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_responses
CREATE POLICY "authenticated_read_access" ON public.survey_responses
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_responses
CREATE POLICY "service_role_full_access" ON public.survey_responses
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_session_program_context
CREATE POLICY "authenticated_read_access" ON public.survey_session_program_context
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_session_program_context
CREATE POLICY "service_role_full_access" ON public.survey_session_program_context
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: authenticated_read_access on survey_user_mappings
CREATE POLICY "authenticated_read_access" ON public.survey_user_mappings
  FOR SELECT
  TO {authenticated}
  USING (true)
;

-- Policy: service_role_full_access on survey_user_mappings
CREATE POLICY "service_role_full_access" ON public.survey_user_mappings
  FOR ALL
  TO {service_role}
  USING (true)
;

-- Policy: all_access_therapies on therapies
CREATE POLICY "all_access_therapies" ON public.therapies
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_therapies_bodies_pillars on therapies_bodies_pillars
CREATE POLICY "all_access_therapies_bodies_pillars" ON public.therapies_bodies_pillars
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_therapy_tasks on therapy_tasks
CREATE POLICY "all_access_therapy_tasks" ON public.therapy_tasks
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_therapy_type on therapytype
CREATE POLICY "all_access_therapy_type" ON public.therapytype
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_user_menu_permissions on user_menu_permissions
CREATE POLICY "all_access_user_menu_permissions" ON public.user_menu_permissions
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_users on users
CREATE POLICY "all_access_users" ON public.users
  FOR ALL
  TO {public}
  USING (true)
;

-- Policy: all_access_vendors on vendors
CREATE POLICY "all_access_vendors" ON public.vendors
  FOR ALL
  TO {public}
  USING (true)
;


-- Database Views
-- Generated: 2025-10-11T17:12:55.263Z

-- View: pg_stat_statements
CREATE OR REPLACE VIEW extensions.pg_stat_statements AS
null;

-- View: pg_stat_statements_info
CREATE OR REPLACE VIEW extensions.pg_stat_statements_info AS
null;

-- View: vw_audit_logs_with_fullcontext
CREATE OR REPLACE VIEW public.vw_audit_logs_with_fullcontext AS
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
   FROM ((audit_events e
     LEFT JOIN member_programs mp ON ((mp.member_program_id = e.related_program_id)))
     LEFT JOIN leads l ON ((l.lead_id = e.related_member_id)));;

-- View: vw_audit_member_changes
CREATE OR REPLACE VIEW public.vw_audit_member_changes AS
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
           FROM ((audit_events e
             LEFT JOIN member_programs mp ON ((mp.member_program_id = e.related_program_id)))
             LEFT JOIN leads l ON ((l.lead_id = e.related_member_id)))
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
  ORDER BY 6 DESC, 2;;

-- View: vw_member_audit_events
CREATE OR REPLACE VIEW public.vw_member_audit_events AS
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
           FROM audit_event_changes c
          WHERE (c.event_id = e.event_id)) AS changes
   FROM (((audit_events e
     LEFT JOIN member_programs mp ON ((mp.member_program_id = e.related_program_id)))
     LEFT JOIN leads l ON ((l.lead_id = e.related_member_id)))
     LEFT JOIN users u ON ((u.id = e.actor_user_id)))
  WHERE (e.scope = 'member'::text);;

-- View: decrypted_secrets
CREATE OR REPLACE VIEW vault.decrypted_secrets AS
null;


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
-- Updates: one row per changed column
upd AS (
  SELECT
    b.event_id,
    b.event_at,
    b.operation,
    b.program_id,
    b.member_program_item_id,
    b.actor_user_id,
    c.column_name,
    c.old_value #>> '{}' AS from_value,
    c.new_value #>> '{}' AS to_value
  FROM base b
  JOIN audit_event_changes c ON c.event_id = b.event_id
  WHERE b.operation = 'UPDATE'
    AND c.column_name NOT IN (
      'member_program_item_id','member_program_id','created_at','created_by','updated_at','updated_by'
    )
),
-- Inserts: single row per event (no column/from/to)
ins AS (
  SELECT
    b.event_id,
    b.event_at,
    b.operation,
    b.program_id,
    b.member_program_item_id,
    b.actor_user_id,
    NULL::text AS column_name,
    NULL::text AS from_value,
    NULL::text AS to_value
  FROM base b
  WHERE b.operation = 'INSERT'
),
-- Deletes: single row per event (no column/from/to)
del AS (
  SELECT
    b.event_id,
    b.event_at,
    b.operation,
    b.program_id,
    b.member_program_item_id,
    b.actor_user_id,
    NULL::text AS column_name,
    NULL::text AS from_value,
    NULL::text AS to_value
  FROM base b
  WHERE b.operation = 'DELETE'
)
SELECT
  (l.first_name || ' ' || l.last_name)            AS member_name,
  x.operation                                      AS operation,
  mp.program_template_name                         AS program_name,
  COALESCE(
    t.therapy_name,
    'therapy_id=' ||
    COALESCE(b_new.new_row->>'therapy_id', b_old.old_row->>'therapy_id')
  )                                                AS item_name,
  x.column_name                                    AS changed_column,
  x.from_value,
  x.to_value,
  x.event_at,
  COALESCE(u.full_name, u.email, x.actor_user_id::text) AS changed_by_user
FROM (
  SELECT * FROM upd
  UNION ALL
  SELECT * FROM ins
  UNION ALL
  SELECT * FROM del
) x
LEFT JOIN base b_new
  ON b_new.event_id = x.event_id AND x.operation IN ('INSERT','UPDATE')
LEFT JOIN base b_old
  ON b_old.event_id = x.event_id AND x.operation IN ('UPDATE','DELETE')
LEFT JOIN member_programs mp ON mp.member_program_id = x.program_id
LEFT JOIN leads l ON l.lead_id = mp.lead_id
LEFT JOIN therapies t ON t.therapy_id = COALESCE(
  NULLIF(b_new.new_row->>'therapy_id','')::int,
  NULLIF(b_old.old_row->>'therapy_id','')::int
)
LEFT JOIN users u ON u.id = x.actor_user_id
ORDER BY x.event_at DESC, member_name, program_name, x.member_program_item_id, x.column_name;

-- Security: restrict to authenticated and service roles
REVOKE ALL ON VIEW public.vw_audit_member_items FROM PUBLIC;
GRANT SELECT ON VIEW public.vw_audit_member_items TO authenticated, service_role;

