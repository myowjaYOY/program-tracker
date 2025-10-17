-- ============================================
-- RASHA LIST TABLE - COMPLETE WITH AUDIT TRIGGER
-- ============================================

-- Create table (SERIAL auto-creates and manages the sequence)
CREATE TABLE IF NOT EXISTS public.rasha_list (
  rasha_list_id SERIAL PRIMARY KEY,
  name text NOT NULL,
  length integer NOT NULL,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

-- Grant permissions
GRANT ALL ON TABLE public.rasha_list TO authenticated;
GRANT ALL ON TABLE public.rasha_list TO service_role;
GRANT ALL ON SEQUENCE public.rasha_list_rasha_list_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rasha_list_rasha_list_id_seq TO service_role;

-- Enable Row Level Security
ALTER TABLE public.rasha_list ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policy for authenticated users
CREATE POLICY "authenticated_access_rasha_list" ON public.rasha_list
  FOR ALL
  TO authenticated
  USING (true);

-- Row Level Security Policy for service role (bypass RLS)
CREATE POLICY "service_role_bypass_rls_rasha_list" ON public.rasha_list
  FOR ALL
  TO service_role
  USING (true);

-- Add table comment
COMMENT ON TABLE public.rasha_list IS 'Stores rasha list items with name and length attributes';

-- ============================================
-- AUDIT TRIGGER (REQUIRED!)
-- ============================================
-- This trigger automatically updates updated_at and updated_by on every UPDATE
-- The update_timestamp_function() already exists in the database

CREATE TRIGGER update_rasha_list_timestamp 
  BEFORE UPDATE ON public.rasha_list 
  FOR EACH ROW 
  EXECUTE FUNCTION update_timestamp_function();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify table was created
-- SELECT * FROM pg_tables WHERE tablename = 'rasha_list';

-- Verify trigger was created
-- SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgrelid = 'public.rasha_list'::regclass;

-- Verify RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'rasha_list';

-- Test the audit trigger (after creating a record):
-- UPDATE rasha_list SET name = 'Updated Name' WHERE rasha_list_id = 1;
-- SELECT rasha_list_id, name, created_at, created_by, updated_at, updated_by FROM rasha_list;
-- You should see updated_at is different from created_at, and updated_by is set to your user ID

