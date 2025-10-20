// User Progress Data Import Edge Function
// Processes Excel files uploaded to data-imports/module-progress/ bucket
// Validates and imports member program progress data
// Updates existing records based on date_of_last_completed

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs'

interface ProgressRow {
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      range: 4, // Start from row 5 (0-indexed)
      header: ['name', 'email', 'phone', 'program', 'registration_date', 
               'start_date', 'projected_completion', 'status', 
               'last_completed', 'date_of_last_completed', 'working_on'],
      defval: '' // Default value for empty cells
    });

    console.log(`Parsed ${jsonData.length} rows from Excel file`);

    // Process the data
    const result = await processProgressData(supabase, jsonData as ProgressRow[], jobId);

    // Update job status
    await updateJobStatus(supabase, jobId, 'completed', undefined, result);

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

  console.log('Preloading lookup data...');

  // Preload user mappings for performance
  const { data: userMappings, error: userError } = await supabase
    .from('survey_user_mappings')
    .select('mapping_id, lead_id, first_name, last_name');

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

  // Create lookup maps
  const userMap = new Map<string, { mapping_id: number; lead_id: number }>();
  for (const user of userMappings || []) {
    const key = `${user.first_name.toLowerCase()}_${user.last_name.toLowerCase()}`;
    userMap.set(key, { mapping_id: user.mapping_id, lead_id: user.lead_id });
  }

  const programMap = new Map<string, number>();
  for (const program of programs || []) {
    programMap.set(program.program_name.trim(), program.program_id);
  }

  console.log(`Loaded ${userMap.size} users and ${programMap.size} programs`);

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
    const leadsToUpdate: Array<{ lead_id: number; email?: string; phone?: string }> = [];

    for (const row of batch) {
      totalRows++;
      const rowNumber = totalRows + 5; // Adjust for header starting at row 5

      try {
        // Skip completely empty rows
        if (!row.name && !row.email && !row.program && !row.status) {
          skippedRows++;
          continue;
        }

        // Validate required fields
        if (!row.name || !row.name.trim()) {
          await logError(supabase, jobId, rowNumber, 'validation_error', 'Missing name');
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

        // Parse name
        const nameParts = row.name.trim().split(/\s+/);
        if (nameParts.length < 2) {
          await logError(supabase, jobId, rowNumber, 'validation_error', `Invalid name format: ${row.name}`);
          failedRows++;
          continue;
        }

        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        // Match user in survey_user_mappings
        const userKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
        const userMatch = userMap.get(userKey);

        if (!userMatch) {
          await logError(supabase, jobId, rowNumber, 'user_not_found', 
            `User not found in cross-reference table: ${firstName} ${lastName}`);
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
          import_batch_id: jobId
        });

        // Prepare lead update
        if (row.email || row.phone) {
          const updateData: any = { lead_id };
          if (row.email?.trim()) updateData.email = row.email.trim();
          if (row.phone?.trim()) updateData.phone = row.phone.trim();
          leadsToUpdate.push(updateData);
        }

      } catch (error) {
        await logError(supabase, jobId, rowNumber, 'processing_error', error.message);
        failedRows++;
      }
    }

    // Batch upsert into survey_user_progress
    if (recordsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('survey_user_progress')
        .upsert(recordsToUpsert, {
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
        console.log(`Successfully upserted ${recordsToUpsert.length} records`);
      }
    }

    // Batch update leads table
    for (const leadUpdate of leadsToUpdate) {
      const { lead_id, ...updateData } = leadUpdate;
      
      if (Object.keys(updateData).length > 0) {
        const { error: leadError } = await supabase
          .from('leads')
          .update(updateData)
          .eq('lead_id', lead_id);

        if (leadError) {
          console.error(`Error updating lead ${lead_id}:`, leadError);
        }
      }
    }
  }

  console.log(`Processing complete: ${successfulRows} successful, ${failedRows} failed, ${skippedRows} skipped`);

  return {
    job_id: jobId,
    total_rows: totalRows,
    successful_rows: successfulRows,
    failed_rows: failedRows,
    skipped_rows: skippedRows
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
    updateData.error_message = errorMessage;
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

