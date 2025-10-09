-- ============================================================================
-- DATA IMPORT JOB TRACKING TABLES
-- ============================================================================
-- These tables track CSV import jobs and errors

-- ============================================================================
-- Import Jobs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_import_jobs (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Import Errors Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_import_errors (
    id SERIAL PRIMARY KEY,
    import_job_id INTEGER NOT NULL REFERENCES data_import_jobs(id) ON DELETE CASCADE,
    row_number INTEGER,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    row_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON data_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON data_import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_errors_job_id ON data_import_errors(import_job_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE data_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_import_errors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view import jobs
CREATE POLICY "Allow authenticated users to view import jobs" ON data_import_jobs
FOR SELECT TO authenticated
USING (true);

-- Allow service_role full access
CREATE POLICY "Allow service_role full access to import jobs" ON data_import_jobs
FOR ALL TO service_role
USING (true);

CREATE POLICY "Allow service_role full access to import errors" ON data_import_errors
FOR ALL TO service_role
USING (true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON data_import_jobs TO service_role;
GRANT ALL ON data_import_errors TO service_role;
GRANT SELECT ON data_import_jobs TO authenticated;
GRANT SELECT ON data_import_errors TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;















