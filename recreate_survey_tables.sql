-- Drop all survey tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS survey_responses CASCADE;
DROP TABLE IF EXISTS survey_response_sessions CASCADE;
DROP TABLE IF EXISTS survey_user_mappings CASCADE;
DROP TABLE IF EXISTS survey_questions CASCADE;
DROP TABLE IF EXISTS survey_forms CASCADE;
DROP TABLE IF EXISTS survey_modules CASCADE;
DROP TABLE IF EXISTS survey_programs CASCADE;

-- =====================================================
-- SURVEY PROGRAMS (Standalone)
-- =====================================================
CREATE TABLE survey_programs (
  program_id SERIAL PRIMARY KEY,
  program_name TEXT NOT NULL UNIQUE,
  description TEXT,
  duration_months INTEGER,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- =====================================================
-- SURVEY MODULES (Belongs to Program)
-- =====================================================
CREATE TABLE survey_modules (
  module_id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES survey_programs(program_id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  module_order INTEGER,
  description TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  UNIQUE(program_id, module_name)  -- Same module name can exist in different programs
);

CREATE INDEX idx_survey_modules_program_id ON survey_modules(program_id);

-- =====================================================
-- SURVEY FORMS (Global - NOT tied to modules)
-- Forms like "MSQ" are the same regardless of which module they're used in
-- =====================================================
CREATE TABLE survey_forms (
  form_id SERIAL PRIMARY KEY,
  form_name TEXT NOT NULL UNIQUE,  -- Form names are unique globally
  form_type TEXT,
  description TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- =====================================================
-- SURVEY QUESTIONS (Belongs to Form)
-- =====================================================
CREATE TABLE survey_questions (
  question_id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES survey_forms(form_id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER,
  answer_type TEXT NOT NULL DEFAULT 'text',  -- text, numeric, date, boolean
  valid_values JSONB,
  min_value NUMERIC,
  max_value NUMERIC,
  required BOOLEAN DEFAULT false,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  UNIQUE(form_id, question_text)  -- Same question text in same form should be unique
);

CREATE INDEX idx_survey_questions_form_id ON survey_questions(form_id);

-- =====================================================
-- SURVEY USER MAPPINGS (Cross-reference external user IDs to internal leads)
-- =====================================================
CREATE TABLE survey_user_mappings (
  mapping_id SERIAL PRIMARY KEY,
  external_user_id INTEGER NOT NULL,
  lead_id INTEGER NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  source_system TEXT DEFAULT 'form_export',
  match_confidence TEXT NOT NULL,  -- high, medium, low
  match_method TEXT,  -- name_match, manual, etc.
  verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  UNIQUE(external_user_id)  -- Each external user ID maps to only one lead
);

CREATE INDEX idx_survey_user_mappings_lead_id ON survey_user_mappings(lead_id);
CREATE INDEX idx_survey_user_mappings_external_user_id ON survey_user_mappings(external_user_id);

-- =====================================================
-- SURVEY RESPONSE SESSIONS
-- Captures: who filled out what form and when
-- =====================================================
CREATE TABLE survey_response_sessions (
  session_id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  external_user_id INTEGER NOT NULL,
  form_id INTEGER NOT NULL REFERENCES survey_forms(form_id) ON DELETE CASCADE,
  completed_on TIMESTAMP WITH TIME ZONE NOT NULL,
  import_batch_id INTEGER REFERENCES data_import_jobs(import_batch_id) ON DELETE SET NULL,
  session_status TEXT DEFAULT 'completed',  -- completed, partial, in_progress
  total_questions INTEGER DEFAULT 0,
  answered_questions INTEGER DEFAULT 0,
  completion_percentage NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_survey_response_sessions_lead_id ON survey_response_sessions(lead_id);
CREATE INDEX idx_survey_response_sessions_form_id ON survey_response_sessions(form_id);
CREATE INDEX idx_survey_response_sessions_completed_on ON survey_response_sessions(completed_on);
CREATE INDEX idx_survey_response_sessions_import_batch_id ON survey_response_sessions(import_batch_id);

-- =====================================================
-- SURVEY SESSION PROGRAM CONTEXT (Cross-reference)
-- Links sessions to the program/module context they were completed in
-- This allows the same form to be tracked across different program phases
-- =====================================================
CREATE TABLE survey_session_program_context (
  context_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES survey_response_sessions(session_id) ON DELETE CASCADE,
  program_id INTEGER NOT NULL REFERENCES survey_programs(program_id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES survey_modules(module_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id)  -- Each session has exactly one program/module context
);

CREATE INDEX idx_survey_session_context_session_id ON survey_session_program_context(session_id);
CREATE INDEX idx_survey_session_context_program_id ON survey_session_program_context(program_id);
CREATE INDEX idx_survey_session_context_module_id ON survey_session_program_context(module_id);

-- =====================================================
-- SURVEY RESPONSES (Individual answers)
-- =====================================================
CREATE TABLE survey_responses (
  response_id BIGSERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES survey_response_sessions(session_id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES survey_questions(question_id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_numeric NUMERIC,
  answer_date DATE,
  answer_boolean BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_survey_responses_session_id ON survey_responses(session_id);
CREATE INDEX idx_survey_responses_question_id ON survey_responses(question_id);

-- =====================================================
-- RLS POLICIES (Read-only for service_role during imports)
-- =====================================================
ALTER TABLE survey_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_response_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_session_program_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (for Edge Function imports)
CREATE POLICY "service_role_full_access" ON survey_programs FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_modules FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_forms FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_questions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_user_mappings FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_response_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_session_program_context FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access" ON survey_responses FOR ALL TO service_role USING (true);

-- Authenticated users: Read-only access to survey data
CREATE POLICY "authenticated_read_access" ON survey_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_user_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_response_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_session_program_context FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_access" ON survey_responses FOR SELECT TO authenticated USING (true);

-- Grant permissions to service_role
GRANT ALL ON survey_programs TO service_role;
GRANT ALL ON survey_modules TO service_role;
GRANT ALL ON survey_forms TO service_role;
GRANT ALL ON survey_questions TO service_role;
GRANT ALL ON survey_user_mappings TO service_role;
GRANT ALL ON survey_response_sessions TO service_role;
GRANT ALL ON survey_session_program_context TO service_role;
GRANT ALL ON survey_responses TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant SELECT permissions to authenticated users
GRANT SELECT ON survey_programs TO authenticated;
GRANT SELECT ON survey_modules TO authenticated;
GRANT SELECT ON survey_forms TO authenticated;
GRANT SELECT ON survey_questions TO authenticated;
GRANT SELECT ON survey_user_mappings TO authenticated;
GRANT SELECT ON survey_response_sessions TO authenticated;
GRANT SELECT ON survey_session_program_context TO authenticated;
GRANT SELECT ON survey_responses TO authenticated;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================
COMMENT ON TABLE survey_programs IS 'Top-level programs (e.g., "6 Month AIP Program")';
COMMENT ON TABLE survey_modules IS 'Program modules/phases (e.g., "MODULE 1 - PRE-PROGRAM") - tied to specific programs';
COMMENT ON TABLE survey_forms IS 'Global forms (e.g., "MSQ", "PROMIS-29 Survey") - NOT tied to specific modules';
COMMENT ON TABLE survey_questions IS 'Questions within forms - tied to specific forms';
COMMENT ON TABLE survey_user_mappings IS 'Maps external user IDs from source system to internal lead_ids';
COMMENT ON TABLE survey_response_sessions IS 'Each form completion session (who filled out what form and when)';
COMMENT ON TABLE survey_session_program_context IS 'Links sessions to the program/module context they were completed in';
COMMENT ON TABLE survey_responses IS 'Individual question answers within a session';

