-- =====================================================
-- LEAD NOTES TABLE SCHEMA
-- =====================================================
-- Generic note-taking feature for leads/members
-- Notes are added but never updated (immutable)
-- Automatically cleaned up when lead is deleted

-- Create the notes table
CREATE TABLE IF NOT EXISTS lead_notes (
    note_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    note_type VARCHAR(20) NOT NULL CHECK (note_type IN ('PME', 'Other', 'Win', 'Challenge')),
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_note_type ON lead_notes(note_type);

-- Foreign key constraint to leads table with CASCADE DELETE
ALTER TABLE lead_notes 
ADD CONSTRAINT fk_lead_notes_lead_id 
FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE;

-- Add comment to table
COMMENT ON TABLE lead_notes IS 'Immutable notes associated with leads/members. Notes cannot be updated, only added.';

-- Add comments to columns
COMMENT ON COLUMN lead_notes.note_id IS 'Unique identifier for the note (auto-generated)';
COMMENT ON COLUMN lead_notes.lead_id IS 'Foreign key to leads table - will cascade delete if lead is deleted';
COMMENT ON COLUMN lead_notes.note_type IS 'Type of note: PME, Other, Win, or Challenge';
COMMENT ON COLUMN lead_notes.note IS 'The actual note content';
COMMENT ON COLUMN lead_notes.created_at IS 'When the note was created (immutable)';
COMMENT ON COLUMN lead_notes.created_by IS 'User who created the note';

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the table
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all notes
CREATE POLICY "Authenticated users can view lead notes" ON lead_notes
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Authenticated users can insert notes
CREATE POLICY "Authenticated users can insert lead notes" ON lead_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to service_role (bypasses RLS for admin operations)
GRANT ALL ON lead_notes TO service_role;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON lead_notes TO authenticated;


-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment the following lines to insert sample data for testing
/*
INSERT INTO lead_notes (lead_id, note_type, note, created_by) VALUES
(1, 'PME', 'Initial consultation completed. Member showed interest in weight loss program.', auth.uid()),
(1, 'Win', 'Member committed to 12-week program. Payment arranged.', auth.uid()),
(2, 'Challenge', 'Member has scheduling conflicts. Need to reschedule sessions.', auth.uid()),
(2, 'Other', 'Follow-up call scheduled for next week.', auth.uid());
*/


-- =====================================================
-- NOTES
-- =====================================================
/*
Key Features:
1. Immutable notes - can only be added, never updated or deleted
2. Cascade delete when lead is removed
3. RLS policies for security
4. Optimized indexes for common queries
5. Type-safe note categories
6. Auto-generated identity primary key

Usage:
- INSERT: Add new notes
- SELECT: View notes (with RLS)
- UPDATE: Not allowed (immutable requirement)
- DELETE: Not allowed (immutable requirement)

Security:
- RLS enabled with policies for authenticated users
- service_role has full access (bypasses RLS for admin operations)
- authenticated role can SELECT and INSERT only
- Updates and deletes are prevented by policy absence (immutable)
*/
