-- Backfill Member Progress Dashboards for All Existing Survey Data
-- This script creates a synthetic import batch and invokes the edge function logic
-- Run this ONCE after deploying the new edge function to populate member_progress_summary

-- Step 1: Create a backfill batch record
INSERT INTO data_import_jobs (
  file_name,
  file_path,
  entity_type,
  status,
  total_rows,
  successful_rows,
  created_at
) VALUES (
  'BACKFILL_ALL_EXISTING_SURVEYS',
  'system/backfill',
  'survey_responses',
  'processing',
  0,
  0,
  NOW()
)
RETURNING import_batch_id;

-- Note the import_batch_id returned above, then use it below:
-- Replace XXX with the actual batch ID

-- Step 2: Temporarily assign ALL sessions without a batch_id to this backfill batch
UPDATE survey_response_sessions
SET import_batch_id = XXX  -- Replace with actual batch ID from above
WHERE import_batch_id IS NULL;

-- Step 3: Verify how many sessions were assigned
SELECT 
  import_batch_id,
  COUNT(DISTINCT lead_id) as unique_members,
  COUNT(*) as total_sessions
FROM survey_response_sessions
WHERE import_batch_id = XXX  -- Replace with actual batch ID
GROUP BY import_batch_id;

-- Step 4: Now manually invoke the edge function
-- Go to Supabase Dashboard -> Edge Functions -> process-survey-import
-- Click "Invoke" and pass: {"jobId": XXX}  (replace XXX with batch ID)

-- OR use this approach to list all leads that need processing:
SELECT DISTINCT lead_id
FROM survey_response_sessions
WHERE import_batch_id = XXX  -- Replace with actual batch ID
ORDER BY lead_id;

-- Step 5: After edge function completes, verify results
SELECT 
  COUNT(*) as total_dashboards_created,
  MIN(calculated_at) as earliest_calculation,
  MAX(calculated_at) as latest_calculation
FROM member_progress_summary;

-- Step 6: Clean up - set batch_id back to NULL for legacy data
UPDATE survey_response_sessions
SET import_batch_id = NULL
WHERE import_batch_id = XXX  -- Replace with actual batch ID
  AND import_batch_id IN (
    SELECT import_batch_id 
    FROM data_import_jobs 
    WHERE file_name = 'BACKFILL_ALL_EXISTING_SURVEYS'
  );

-- Step 7: Mark the backfill batch as complete
UPDATE data_import_jobs
SET 
  status = 'completed',
  completed_at = NOW()
WHERE import_batch_id = XXX;  -- Replace with actual batch ID

