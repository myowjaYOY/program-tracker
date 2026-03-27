// User Progress Data Import Edge Function
// Processes Excel files uploaded to data-imports/module-progress/ bucket
// Validates and imports member program progress data
// Updates existing records based on date_of_last_completed

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface ProgressRow {
  user_id: number;  // External user ID from wellness curriculum system
  name: string;
  email: string;
  phone: string;
  program: string;
  registration_date: string;
  start_date: string;
  projected_completion: string;
  status: string;
  last_completed: string;
  date_of_last_completed: string;
  working_on: string;
}

interface ImportJobResult {
  job_id: number;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  updated_lead_ids: number[];
}

Deno.serve(async (req) => {
  try {
    const { method } = req;
    
    if (method === 'POST') {
      return await handleFileUpload(req);
    } else if (method === 'GET') {
      return await handleStatusCheck(req);
    } else {
      return new Response('Method not allowed', { status: 405 });
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleFileUpload(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let jobId: number | undefined;

  try {
    const { file_path, bucket_name } = await req.json();
    
    if (!file_path || !bucket_name) {
      return new Response(
        JSON.stringify({ error: 'Missing file_path or bucket_name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing file: ${file_path} from bucket: ${bucket_name}`);

    // Create import job record
    const { data: jobData, error: jobError } = await supabase
      .from('data_import_jobs')
      .insert({
        file_name: file_path.split('/').pop(),
        file_path: file_path,
        bucket_name: bucket_name,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating import job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create import job', details: jobError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    jobId = jobData.import_batch_id;
    console.log(`Created import job: ${jobId}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket_name)
      .download(file_path);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      await updateJobStatus(supabase, jobId, 'failed', downloadError?.message);
      return new Response(
        JSON.stringify({ error: 'Failed to download file', details: downloadError?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('File downloaded successfully');

    // Parse Excel file
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON starting from row 5 (header) and row 6 (data)
    // Row 5 is index 4 in 0-based indexing
    // Column order: User ID, Name, Email, Phone, Program, Registration Date, Start Date, 
    //               Projected Completion, Status, Last Completed, Date of Last Completed, Working On
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      range: 4, // Start from row 5 (0-indexed)
      header: ['user_id', 'name', 'email', 'phone', 'program', 'registration_date', 
               'start_date', 'projected_completion', 'status', 
               'last_completed', 'date_of_last_completed', 'working_on'],
      defval: '' // Default value for empty cells
    });

    console.log(`Parsed ${jsonData.length} rows from Excel file`);

    // Process the data
    const result = await processProgressData(supabase, jsonData as ProgressRow[], jobId);

    // Update job status
    await updateJobStatus(supabase, jobId, 'completed', undefined, result);

    // Trigger member progress analysis for updated members
    if (result.updated_lead_ids.length > 0) {
      console.log(`Triggering analysis for ${result.updated_lead_ids.length} updated members...`);
      await triggerMemberProgressAnalysis(supabaseUrl, supabaseServiceKey, result.updated_lead_ids);

      // Process overdue module alerts using freshly-updated progress data
      console.log('Processing overdue module alerts...');
      const alertResult = await processOverdueModuleAlerts(supabase, result.updated_lead_ids);
      console.log(`Overdue alerts: ${alertResult.alerts_created} created, ${alertResult.duplicates_skipped} skipped, ${alertResult.errors.length} errors`);
    }

    // Rename the processed file
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const pathParts = file_path.split('/');
      const fileName = pathParts.pop()!;
      const filePath = pathParts.join('/');
      
      const fileNameParts = fileName.split('.');
      const extension = fileNameParts.pop();
      const baseName = fileNameParts.join('.');
      const newFileName = `${baseName}_processed_${timestamp}.${extension}.old`;
      const newFilePath = filePath ? `${filePath}/${newFileName}` : newFileName;

      await supabase.storage
        .from(bucket_name)
        .move(file_path, newFilePath);

      console.log(`Renamed file to: ${newFilePath}`);
    } catch (renameError) {
      console.error('Error renaming file:', renameError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: jobId,
        ...result
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing file:', error);
    if (jobId) {
      await updateJobStatus(supabase, jobId, 'failed', error.message);
    }
    return new Response(
      JSON.stringify({ error: 'Failed to process file', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function processProgressData(
  supabase: any,
  rows: ProgressRow[],
  jobId: number
): Promise<ImportJobResult> {
  
  let totalRows = 0;
  let successfulRows = 0;
  let failedRows = 0;
  let skippedRows = 0;
  const updatedLeadIds = new Set<number>(); // Track which members were updated

  console.log('Preloading lookup data...');

  // Preload user mappings by external_user_id for direct lookup
  const { data: userMappings, error: userError } = await supabase
    .from('survey_user_mappings')
    .select('mapping_id, lead_id, external_user_id, first_name, last_name');

  if (userError) {
    console.error('Error loading user mappings:', userError);
    throw new Error('Failed to load user mappings');
  }

  // Preload programs
  const { data: programs, error: programError } = await supabase
    .from('survey_programs')
    .select('program_id, program_name');

  if (programError) {
    console.error('Error loading programs:', programError);
    throw new Error('Failed to load programs');
  }

  // Create simple lookup map by external_user_id (integer key for fast lookup)
  const userMap = new Map<number, { mapping_id: number; lead_id: number; first_name: string; last_name: string }>();
  for (const user of userMappings || []) {
    userMap.set(user.external_user_id, {
      mapping_id: user.mapping_id,
      lead_id: user.lead_id,
      first_name: user.first_name,
      last_name: user.last_name
    });
  }

  const programMap = new Map<string, number>();
  for (const program of programs || []) {
    programMap.set(program.program_name.trim(), program.program_id);
  }

  console.log(`Loaded ${userMap.size} user mappings and ${programMap.size} programs`);

  // Preload existing progress records for date comparison
  const { data: existingProgress, error: progressError } = await supabase
    .from('survey_user_progress')
    .select('mapping_id, program_id, date_of_last_completed');

  if (progressError) {
    console.error('Error loading existing progress:', progressError);
  }

  const progressMap = new Map<string, Date | null>();
  for (const progress of existingProgress || []) {
    const key = `${progress.mapping_id}_${progress.program_id}`;
    progressMap.set(key, progress.date_of_last_completed ? new Date(progress.date_of_last_completed) : null);
  }

  // Process in batches
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const recordsToUpsert: any[] = [];

    for (const row of batch) {
      totalRows++;
      const rowNumber = totalRows + 5; // Adjust for header starting at row 5

      try {
        // Skip completely empty rows
        if (!row.user_id && !row.name && !row.program && !row.status) {
          skippedRows++;
          continue;
        }

        // Validate required fields - user_id is now required
        if (!row.user_id) {
          await logError(supabase, jobId, rowNumber, 'validation_error', 
            `Missing user_id for "${row.name || 'unknown'}"`);
          failedRows++;
          continue;
        }

        if (!row.program || !row.program.trim()) {
          await logError(supabase, jobId, rowNumber, 'validation_error', 'Missing program');
          failedRows++;
          continue;
        }

        if (!row.registration_date || !row.start_date || !row.projected_completion || !row.status) {
          await logError(supabase, jobId, rowNumber, 'validation_error', 'Missing required date/status fields');
          failedRows++;
          continue;
        }

        // Direct lookup by external_user_id - simple and fast
        const userId = typeof row.user_id === 'string' ? parseInt(row.user_id, 10) : row.user_id;
        const userMatch = userMap.get(userId);

        if (!userMatch) {
          await logError(supabase, jobId, rowNumber, 'user_not_found', 
            `User ID ${userId} not found in survey_user_mappings. Name: "${row.name || 'unknown'}". Please add this user to the mappings table.`);
          failedRows++;
          continue;
        }

        const { mapping_id, lead_id } = userMatch;

        // Match program
        const program_id = programMap.get(row.program.trim());

        if (!program_id) {
          await logError(supabase, jobId, rowNumber, 'program_not_found', 
            `Program not found: ${row.program}`);
          failedRows++;
          continue;
        }

        // Parse dates
        const regDate = parseDate(row.registration_date);
        const startDate = parseDate(row.start_date);
        const projDate = parseDate(row.projected_completion);
        const lastCompletedDate = row.date_of_last_completed ? parseDate(row.date_of_last_completed) : null;

        if (!regDate || !startDate || !projDate) {
          await logError(supabase, jobId, rowNumber, 'invalid_date', 
            `Invalid date format in required fields`);
          failedRows++;
          continue;
        }

        // Check for outdated record
        const progressKey = `${mapping_id}_${program_id}`;
        const existingDate = progressMap.get(progressKey);

        if (existingDate && lastCompletedDate && lastCompletedDate < existingDate) {
          await logError(supabase, jobId, rowNumber, 'outdated_record', 
            `Incoming record is older than existing (${formatDate(lastCompletedDate)} < ${formatDate(existingDate)})`);
          failedRows++;
          continue;
        }

        // Prepare upsert record
        recordsToUpsert.push({
          mapping_id,
          program_id,
          registration_date: formatDate(regDate),
          start_date: formatDate(startDate),
          projected_completion_date: formatDate(projDate),
          status: row.status.trim(),
          last_completed: row.last_completed?.trim() || null,
          date_of_last_completed: lastCompletedDate ? formatDate(lastCompletedDate) : null,
          working_on: row.working_on?.trim() || null,
          import_batch_id: jobId,
          __lead_id: lead_id // Temporary tracking field (stripped before upsert)
        });

      } catch (error) {
        await logError(supabase, jobId, rowNumber, 'processing_error', error.message);
        failedRows++;
      }
    }

    // Batch upsert into survey_user_progress
    if (recordsToUpsert.length > 0) {
      // Extract lead_ids and strip temporary tracking field before upsert
      const batchLeadIds: number[] = [];
      const cleanRecords = recordsToUpsert.map(record => {
        const { __lead_id, ...cleanRecord } = record;
        batchLeadIds.push(__lead_id);
        return cleanRecord;
      });

      const { error: upsertError } = await supabase
        .from('survey_user_progress')
        .upsert(cleanRecords, {
          onConflict: 'mapping_id,program_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Batch upsert error:', upsertError);
        for (const record of recordsToUpsert) {
          await logError(supabase, jobId, null, 'upsert_error', upsertError.message);
          failedRows++;
        }
      } else {
        successfulRows += recordsToUpsert.length;
        // Track successfully updated lead_ids
        batchLeadIds.forEach(id => updatedLeadIds.add(id));
        console.log(`Successfully upserted ${recordsToUpsert.length} records`);
      }
    }
  }

  const leadIdsArray = Array.from(updatedLeadIds);
  console.log(`Processing complete: ${successfulRows} successful, ${failedRows} failed, ${skippedRows} skipped`);
  console.log(`Updated ${leadIdsArray.length} unique members`);

  return {
    job_id: jobId,
    total_rows: totalRows,
    successful_rows: successfulRows,
    failed_rows: failedRows,
    skipped_rows: skippedRows,
    updated_lead_ids: leadIdsArray
  };
}

async function handleStatusCheck(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('job_id');

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'Missing job_id parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('data_import_jobs')
    .select('*')
    .eq('import_batch_id', jobId)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Job not found', details: error.message }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify(data),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function updateJobStatus(
  supabase: any,
  jobId: number,
  status: string,
  errorMessage?: string,
  result?: Partial<ImportJobResult>
) {
  const updateData: any = {
    status,
    completed_at: new Date().toISOString()
  };

  if (errorMessage) {
    updateData.error_summary = errorMessage;
  }

  if (result) {
    updateData.total_rows = result.total_rows;
    updateData.successful_rows = result.successful_rows;
    updateData.failed_rows = result.failed_rows;
    updateData.skipped_rows = result.skipped_rows;
  }

  await supabase
    .from('data_import_jobs')
    .update(updateData)
    .eq('import_batch_id', jobId);
}

async function logError(
  supabase: any,
  jobId: number,
  rowNumber: number | null,
  errorType: string,
  errorMessage: string
) {
  const { error } = await supabase.from('data_import_errors').insert({
    import_batch_id: jobId,
    row_number: rowNumber || 0, // Default to 0 if null (for batch errors)
    error_type: errorType,
    error_message: errorMessage,
    row_data: null
  });
  
  if (error) {
    console.error('Failed to log error:', error);
  }
}

function parseDate(value: any): Date | null {
  if (!value) return null;

  // If Excel date number
  if (typeof value === 'number') {
    return excelDateToJSDate(value);
  }

  // If string date
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  // If already Date object
  if (value instanceof Date) {
    return value;
  }

  return null;
}

function excelDateToJSDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Trigger the analyze-member-progress edge function to recalculate
 * member_progress_summary for the specified lead_ids.
 * 
 * This ensures that overdue_milestones and other timeline metrics
 * are updated after new progress data is imported.
 */
async function triggerMemberProgressAnalysis(
  supabaseUrl: string,
  supabaseServiceKey: string,
  leadIds: number[]
): Promise<void> {
  try {
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-member-progress`;
    
    console.log(`Calling analyze-member-progress for ${leadIds.length} members...`);
    
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        mode: 'specific',
        lead_ids: leadIds
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Analysis trigger failed (${response.status}): ${errorText}`);
      // Don't throw - we don't want to fail the import if analysis fails
      return;
    }

    const result = await response.json();
    console.log(`Analysis complete: ${result.analyzed || 0} members analyzed, ${result.failed || 0} failed`);
    
    if (result.errors && result.errors.length > 0) {
      console.warn('Analysis errors:', result.errors.slice(0, 5)); // Log first 5 errors
    }
  } catch (error) {
    console.error('Failed to trigger member progress analysis:', error);
    // Don't throw - import succeeded, analysis is a secondary concern
  }
}

/**
 * Process overdue module alerts for members whose progress was just updated.
 * Creates "Member is behind on their education" notifications for members
 * with >1 overdue module and an active program.
 * 
 * This runs AFTER analyze-member-progress has recalculated overdue_milestones
 * using the freshly-imported progress data, so alerts are based on current state.
 */
async function processOverdueModuleAlerts(
  supabase: any,
  leadIds: number[]
): Promise<{ alerts_created: number; notes_created: number; duplicates_skipped: number; errors: string[] }> {
  const result = { alerts_created: 0, notes_created: 0, duplicates_skipped: 0, errors: [] as string[] };

  if (leadIds.length === 0) return result;

  // Get Manager and Nutritionist role IDs
  const { data: roles, error: roleError } = await supabase
    .from('program_roles')
    .select('program_role_id, role_name')
    .in('role_name', ['Manager', 'Nutritionist']);

  if (roleError || !roles || roles.length < 2) {
    console.error('Failed to find required roles:', roleError);
    result.errors.push('Manager or Nutritionist role not found');
    return result;
  }

  const managerRoleId = roles.find((r: any) => r.role_name === 'Manager')?.program_role_id;
  const nutritionistRoleId = roles.find((r: any) => r.role_name === 'Nutritionist')?.program_role_id;

  if (!managerRoleId || !nutritionistRoleId) {
    result.errors.push('Manager or Nutritionist role not found');
    return result;
  }

  // Filter to members with active programs only
  const { data: activePrograms, error: activeProgramsError } = await supabase
    .from('member_programs')
    .select('lead_id')
    .eq('program_status_id', 1)
    .in('lead_id', leadIds);

  if (activeProgramsError) {
    console.error('Failed to fetch active programs:', activeProgramsError);
    result.errors.push(`Failed to fetch active programs: ${activeProgramsError.message}`);
    return result;
  }

  const activeLeadIds = activePrograms ? [...new Set(activePrograms.map((p: any) => p.lead_id))] : [];
  console.log(`Found ${activeLeadIds.length} members with active programs out of ${leadIds.length} updated`);

  if (activeLeadIds.length === 0) {
    console.log('No active programs found, skipping overdue module alerts');
    return result;
  }

  // Get freshly-updated progress summaries
  const { data: progressSummaries, error: progressError } = await supabase
    .from('member_progress_summary')
    .select('lead_id, overdue_milestones')
    .in('lead_id', activeLeadIds)
    .not('overdue_milestones', 'is', null);

  if (progressError) {
    console.error('Failed to fetch progress summaries:', progressError);
    result.errors.push(`Failed to fetch progress summaries: ${progressError.message}`);
    return result;
  }

  if (!progressSummaries || progressSummaries.length === 0) {
    console.log('No overdue milestones found');
    return result;
  }

  // Get lead names for alert messages
  const { data: leads } = await supabase
    .from('leads')
    .select('lead_id, first_name, last_name')
    .in('lead_id', activeLeadIds);

  const leadMap = new Map(
    (leads || []).map((l: any) => [l.lead_id, `${l.first_name} ${l.last_name}`])
  );

  for (const summary of progressSummaries) {
    let overdueModules: string[] = [];
    try {
      if (typeof summary.overdue_milestones === 'string') {
        overdueModules = JSON.parse(summary.overdue_milestones);
      } else if (Array.isArray(summary.overdue_milestones)) {
        overdueModules = summary.overdue_milestones;
      }
    } catch (e) {
      console.error(`Failed to parse overdue_milestones for lead ${summary.lead_id}:`, e);
      continue;
    }

    if (overdueModules.length <= 1) continue;

    const memberName = leadMap.get(summary.lead_id) || 'Unknown Member';
    const dateStr = new Date().toLocaleDateString();
    const refHash = `OVERDUE-${summary.lead_id}`;

    // Check for existing active notification to avoid duplicates
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('notification_id')
      .eq('lead_id', summary.lead_id)
      .eq('title', 'Member is behind on their education')
      .eq('status', 'active')
      .maybeSingle();

    if (existingNotification) {
      result.duplicates_skipped++;
      console.log(`Skipping overdue alert for ${memberName} - active notification exists`);
      continue;
    }

    const modulesList = overdueModules.map(m => `• ${m}`).join('\n');
    const noteContent = `${memberName} - ${dateStr}\nMember is behind schedule on ${overdueModules.length} module(s):\n${modulesList}\nReview member report card for details.\n[REF:${refHash}]`;

    // Create note
    const { data: newNote, error: noteError } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: summary.lead_id,
        note_type: 'Challenge',
        note: noteContent,
      })
      .select('note_id')
      .single();

    if (noteError) {
      console.error('Failed to create overdue note:', noteError);
      result.errors.push(`Failed to create overdue note for ${memberName}: ${noteError.message}`);
      continue;
    }

    result.notes_created++;

    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        lead_id: summary.lead_id,
        title: 'Member is behind on their education',
        message: noteContent,
        priority: 'urgent',
        target_role_ids: [nutritionistRoleId, managerRoleId],
        source_note_id: newNote.note_id,
        status: 'active',
        created_by: SYSTEM_USER_ID,
      });

    if (notifError) {
      console.error('Failed to create overdue notification:', notifError);
      result.errors.push(`Failed to create overdue notification for ${memberName}: ${notifError.message}`);
      continue;
    }

    result.alerts_created++;
    console.log(`Created consolidated overdue alert for ${memberName} (${overdueModules.length} modules)`);
  }

  return result;
}