-- ============================================
-- MEMBER PROGRAM RASHA TABLE
-- ============================================
-- This table links member programs to RASHA list items
-- Similar structure to member_program_items but for RASHA tracking

-- ============================================
-- 1. CREATE SEQUENCE
-- ============================================
CREATE SEQUENCE IF NOT EXISTS public.member_program_rasha_member_program_rasha_id_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- ============================================
-- 2. CREATE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.member_program_rasha (
  member_program_rasha_id integer NOT NULL DEFAULT nextval('member_program_rasha_member_program_rasha_id_seq'::regclass),
  member_program_id integer NOT NULL,
  rasha_list_id integer NOT NULL,
  group_name text,
  type text NOT NULL,
  order_number integer NOT NULL DEFAULT 0,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT member_program_rasha_pkey PRIMARY KEY (member_program_rasha_id),
  CONSTRAINT member_program_rasha_type_check CHECK (type IN ('individual', 'group'))
);

-- ============================================
-- 3. CREATE INDEX
-- ============================================
-- Index on member_program_id for faster lookups (same as member_program_items pattern)
CREATE INDEX IF NOT EXISTS idx_member_program_rasha_member_program 
  ON public.member_program_rasha USING btree (member_program_id);

-- Index on rasha_list_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_program_rasha_rasha_list 
  ON public.member_program_rasha USING btree (rasha_list_id);

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
GRANT ALL ON TABLE public.member_program_rasha TO authenticated;
GRANT ALL ON TABLE public.member_program_rasha TO service_role;
GRANT ALL ON SEQUENCE public.member_program_rasha_member_program_rasha_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.member_program_rasha_member_program_rasha_id_seq TO service_role;

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.member_program_rasha ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all access (same pattern as member_program_items)
CREATE POLICY "all_access_member_program_rasha" ON public.member_program_rasha
  FOR ALL
  TO public
  USING (true);

-- ============================================
-- 6. ADD TABLE COMMENT
-- ============================================
COMMENT ON TABLE public.member_program_rasha IS 'Links member programs to RASHA list items with group and type information';

-- ============================================
-- 7. CREATE AUDIT FUNCTION
-- ============================================
-- This function writes detailed audit logs for member_program_rasha changes
-- Following the exact same pattern as audit_member_program_items()

CREATE OR REPLACE FUNCTION public.audit_member_program_rasha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  pk bigint; 
  actor uuid; 
  old_j jsonb; 
  new_j jsonb; 
  ev_id bigint;
  member_id bigint; 
  program_id bigint;
  col text; 
  friendly text;
  changed_labels text[] := '{}';
  labels_count int;
  audit_summary text;
begin
  if TG_OP = 'INSERT' then
    pk := NEW.member_program_rasha_id; 
    actor := coalesce(NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; 
    select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program RASHA item created';
    perform public.write_audit_event(
      'member_program_rasha', 
      pk, 
      'INSERT', 
      actor, 
      'member', 
      member_id, 
      program_id, 
      audit_summary, 
      null, 
      null, 
      to_jsonb(NEW)
    );
    return NEW;

  elsif TG_OP = 'UPDATE' then
    pk := NEW.member_program_rasha_id; 
    actor := coalesce(NEW.updated_by::uuid, NEW.created_by::uuid, null);
    program_id := NEW.member_program_id; 
    select lead_id into member_id from member_programs where member_program_id = program_id;
    old_j := to_jsonb(OLD); 
    new_j := to_jsonb(NEW);

    ev_id := public.write_audit_event(
      'member_program_rasha', 
      pk, 
      'UPDATE', 
      actor, 
      'member', 
      member_id, 
      program_id, 
      'Program RASHA item updated', 
      null, 
      old_j, 
      new_j
    );

    -- Track specific field changes
    for col in select jsonb_object_keys(new_j)
    loop
      if col not in ('member_program_rasha_id','member_program_id','created_at','created_by','updated_at','updated_by') then
        if old_j->col is distinct from new_j->col then
          perform public.write_audit_change(ev_id, col, old_j->col, new_j->col);

          -- Friendly field names for audit display
          friendly := case col
                        when 'rasha_list_id'  then 'RASHA Item'
                        when 'group_name'     then 'Group Name'
                        when 'type'           then 'Type'
                        when 'order_number'   then 'Order'
                        when 'active_flag'    then 'Active'
                        else initcap(replace(col, '_', ' '))
                      end;

          if not (friendly = any(changed_labels)) then
            changed_labels := changed_labels || friendly;
          end if;
        end if;
      end if;
    end loop;

    -- Create summary of changes
    labels_count := array_length(changed_labels, 1);
    if labels_count > 0 then
      audit_summary := 'Changed: ' || array_to_string(changed_labels, ', ');
      update audit_events set summary = audit_summary where audit_event_id = ev_id;
    end if;

    return NEW;

  elsif TG_OP = 'DELETE' then
    pk := OLD.member_program_rasha_id; 
    actor := coalesce(OLD.updated_by::uuid, OLD.created_by::uuid, null);
    program_id := OLD.member_program_id; 
    select lead_id into member_id from member_programs where member_program_id = program_id;
    audit_summary := 'Program RASHA item deleted';
    perform public.write_audit_event(
      'member_program_rasha', 
      pk, 
      'DELETE', 
      actor, 
      'member', 
      member_id, 
      program_id, 
      audit_summary, 
      null, 
      to_jsonb(OLD), 
      null
    );
    return OLD;
  end if;

  return null;
end;
$function$;

-- ============================================
-- 8. CREATE TRIGGERS
-- ============================================

-- Trigger 1: Audit trigger (AFTER INSERT/UPDATE/DELETE)
-- Logs all changes to the audit_events table
CREATE TRIGGER tr_audit_member_program_rasha 
  AFTER INSERT OR DELETE OR UPDATE 
  ON public.member_program_rasha 
  FOR EACH ROW 
  EXECUTE FUNCTION audit_member_program_rasha();

-- Trigger 2: Timestamp trigger (BEFORE UPDATE)
-- Automatically updates updated_at and updated_by fields
CREATE TRIGGER update_member_program_rasha_timestamp 
  BEFORE UPDATE 
  ON public.member_program_rasha 
  FOR EACH ROW 
  EXECUTE FUNCTION update_timestamp_function();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Verify table was created
-- SELECT * FROM pg_tables WHERE tablename = 'member_program_rasha';

-- 2. Verify indexes were created
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'member_program_rasha';

-- 3. Verify triggers were created
-- SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgrelid = 'public.member_program_rasha'::regclass;

-- 4. Verify RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'member_program_rasha';

-- 5. Verify CHECK constraint for type column
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.member_program_rasha'::regclass;

-- ============================================
-- SAMPLE TEST DATA (OPTIONAL - FOR TESTING ONLY)
-- ============================================

-- Test 1: Insert a group type RASHA item
-- INSERT INTO member_program_rasha (member_program_id, rasha_list_id, group_name, type, order_number)
-- VALUES (1, 1, 'Group A', 'group', 1);

-- Test 2: Insert an individual type RASHA item
-- INSERT INTO member_program_rasha (member_program_id, rasha_list_id, type, order_number)
-- VALUES (1, 2, 'individual', 2);

-- Test 3: Update to verify timestamp trigger
-- UPDATE member_program_rasha SET order_number = 3 WHERE member_program_rasha_id = 1;

-- Test 4: Verify updated_at and updated_by changed
-- SELECT member_program_rasha_id, type, group_name, order_number, created_at, updated_at, created_by, updated_by
-- FROM member_program_rasha;

-- Test 5: Verify audit log was created
-- SELECT * FROM audit_events WHERE table_name = 'member_program_rasha' ORDER BY created_at DESC LIMIT 5;

-- Test 6: Try invalid type (should fail)
-- INSERT INTO member_program_rasha (member_program_id, rasha_list_id, type, order_number)
-- VALUES (1, 1, 'invalid_type', 1);
-- Expected error: new row for relation "member_program_rasha" violates check constraint "member_program_rasha_type_check"

-- ============================================
-- FOREIGN KEY CONSTRAINTS (OPTIONAL - ADD IF NEEDED)
-- ============================================
-- Note: The original schema doesn't have explicit foreign key constraints,
-- but you can add them for referential integrity if desired:

-- Add foreign key to member_programs
-- ALTER TABLE public.member_program_rasha
--   ADD CONSTRAINT fk_member_program_rasha_member_program
--   FOREIGN KEY (member_program_id) 
--   REFERENCES public.member_programs(member_program_id)
--   ON DELETE CASCADE;

-- Add foreign key to rasha_list
-- ALTER TABLE public.member_program_rasha
--   ADD CONSTRAINT fk_member_program_rasha_rasha_list
--   FOREIGN KEY (rasha_list_id) 
--   REFERENCES public.rasha_list(rasha_list_id)
--   ON DELETE RESTRICT;

