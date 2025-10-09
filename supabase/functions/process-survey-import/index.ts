// Survey Data Import Edge Function
// Processes CSV files uploaded to data-imports bucket
// Validates and imports survey response data
// Auto-creates missing programs, modules, forms, questions, and user mappings

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'

interface SurveyResponseRow {
  completed_on: string;
  user_id: number;
  first_name: string;
  last_name: string;
  program_name: string;
  module_name: string;
  form: string;
  question: string;
  answer: string;
}

interface ImportJobResult {
  job_id: number;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  errors: string[];
}

Deno.serve(async (req) => {
  try {
    const { method } = req;
    
    // Handle different HTTP methods
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
  
  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const jobId = jobData.import_batch_id;
    console.log(`Created import job: ${jobId}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket_name)
      .download(file_path);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      await updateJobStatus(supabase, jobId, 'failed', downloadError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to download file', details: downloadError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse CSV content
    const csvText = await fileData.text();
    const rows = parseCSV(csvText);
    
    console.log(`Parsed ${rows.length} rows from CSV`);

    // Process the data with timeout
    console.log(`Starting data processing for ${rows.length} rows...`);
    const result = await Promise.race([
      processSurveyData(supabase, rows, jobId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout after 60 seconds')), 60000)
      )
    ]) as ImportJobResult;

    console.log('Data processing completed:', result);

    // Update job with final results
    await updateJobStatus(supabase, jobId, 'completed', null, result);

    // Rename the processed file with .csv.old extension to prevent re-processing
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]; // Format: YYYY-MM-DDTHH-MM-SS
      const pathParts = file_path.split('/');
      const fileName = pathParts.pop();
      const filePath = pathParts.join('/');
      
      const fileNameParts = fileName.split('.');
      const extension = fileNameParts.pop();
      const baseName = fileNameParts.join('.');
      const newFileName = `${baseName}_processed_${timestamp}.${extension}.old`;
      const newFilePath = filePath ? `${filePath}/${newFileName}` : newFileName;

      // Move/rename the file
      const { error: moveError } = await supabase.storage
        .from(bucket_name)
        .move(file_path, newFilePath);

      if (moveError) {
        console.error('Failed to rename file:', moveError);
      } else {
        console.log(`File renamed to: ${newFilePath}`);
      }
    } catch (error) {
      console.error('Error during file rename:', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        message: 'File processed successfully',
        result: result
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    // Update job status to failed
    if (jobId) {
      try {
        await updateJobStatus(supabase, jobId, 'failed', error.message);
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Processing failed', 
        details: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleStatusCheck(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const jobId = url.searchParams.get('job_id');

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'Missing job_id parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
    JSON.stringify({ job: data }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

function parseCSV(csvText: string): SurveyResponseRow[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const rows: SurveyResponseRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const row: SurveyResponseRow = {
      completed_on: values[0] || '',
      user_id: parseInt(values[1]) || 0,
      first_name: values[2] || '',
      last_name: values[3] || '',
      program_name: values[4] || '',
      module_name: values[5] || '',
      form: values[6] || '',
      question: values[7] || '',
      answer: values[8] || ''
    };
    
    rows.push(row);
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

async function processSurveyData(
  supabase: any, 
  rows: SurveyResponseRow[], 
  jobId: number
): Promise<ImportJobResult> {
  let successfulRows = 0;
  let errorRows = 0;
  let skippedRows = 0;
  let duplicateRows = 0;
  const errors: string[] = [];
  const errorDetails: any[] = [];

  console.log(`Processing ${rows.length} rows...`);

  // Load existing lookup data
  const [programsResult, modulesResult, formsResult, questionsResult] = await Promise.all([
    supabase.from('survey_programs').select('program_id, program_name'),
    supabase.from('survey_modules').select('module_id, module_name, program_id'),
    supabase.from('survey_forms').select('form_id, form_name'),  // Forms are global, no module_id
    supabase.from('survey_questions').select('question_id, question_text, form_id')
  ]);

  const programs = new Map(programsResult.data?.map(p => [p.program_name, p.program_id]) || []);
  const modules = new Map(modulesResult.data?.map(m => [`${m.program_id}|${m.module_name}`, m.module_id]) || []);
  const forms = new Map(formsResult.data?.map(f => [f.form_name, f.form_id]) || []);  // Forms are global, not module-specific
  const questions = new Map(questionsResult.data?.map(q => [`${q.form_id}|${q.question_text}`, q.question_id]) || []);

  // Group rows by session (completed_on + user_id + form)
  const sessions = new Map<string, SurveyResponseRow[]>();
  
  for (const row of rows) {
    const sessionKey = `${row.completed_on}|${row.user_id}|${row.form}`;
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, []);
    }
    sessions.get(sessionKey)!.push(row);
  }

  console.log(`Grouped into ${sessions.size} sessions`);

  // Process each session
  let rowNumber = 0;
  for (const [sessionKey, sessionRows] of sessions) {
    try {
      const firstRow = sessionRows[0];
      rowNumber++;
      
      // Skip header rows or empty program names
      if (!firstRow.program_name || firstRow.program_name === 'Program Name') {
        skippedRows += sessionRows.length;
        continue;
      }

      // Get or create program
      let programId = programs.get(firstRow.program_name);
      if (!programId) {
        const { data: newProgram, error: programError } = await supabase
          .from('survey_programs')
          .insert({ program_name: firstRow.program_name })
          .select()
          .single();
        
        if (programError) {
          errors.push(`Session ${sessionKey}: Failed to create program "${firstRow.program_name}" - ${programError.message}`);
          errorRows += sessionRows.length;
          continue;
        }
        programId = newProgram.program_id;
        programs.set(firstRow.program_name, programId);
        console.log(`Created new program: ${firstRow.program_name}`);
      }

      // Get or create module (with program_id)
      const moduleKey = `${programId}|${firstRow.module_name}`;
      let moduleId = modules.get(moduleKey);
      if (!moduleId) {
        const { data: newModule, error: moduleError } = await supabase
          .from('survey_modules')
          .insert({ 
            module_name: firstRow.module_name,
            program_id: programId
          })
          .select()
          .single();
        
        if (moduleError) {
          errors.push(`Session ${sessionKey}: Failed to create module "${firstRow.module_name}" - ${moduleError.message}`);
          errorRows += sessionRows.length;
          continue;
        }
        moduleId = newModule.module_id;
        modules.set(moduleKey, moduleId);
        console.log(`Created new module: ${firstRow.module_name} for program ${programId}`);
      }

      // Get or create form (forms are global, not module-specific)
      let formId = forms.get(firstRow.form);
      if (!formId) {
        const { data: newForm, error: formError } = await supabase
          .from('survey_forms')
          .insert({ 
            form_name: firstRow.form,
            form_type: 'survey'
          })
          .select()
          .single();
        
        if (formError) {
          errors.push(`Session ${sessionKey}: Failed to create form "${firstRow.form}" - ${formError.message}`);
          errorRows += sessionRows.length;
          continue;
        }
        formId = newForm.form_id;
        forms.set(firstRow.form, formId);
        console.log(`Created new form: ${firstRow.form}`);
      }

      // Get or create lead mapping
      // First, check if a mapping already exists for this external_user_id
      let leadId: number | undefined;
      const { data: existingMapping } = await supabase
        .from('survey_user_mappings')
        .select('mapping_id, lead_id')
        .eq('external_user_id', firstRow.user_id)
        .maybeSingle();

      if (existingMapping) {
        // Mapping exists, use it
        leadId = existingMapping.lead_id;
        console.log(`Using existing user mapping for external_user_id ${firstRow.user_id} -> Lead ${leadId}`);
      } else {
        // No mapping exists, find the lead by name
        const { data: leadData } = await supabase
          .from('leads')
          .select('lead_id, first_name, last_name')
          .ilike('first_name', firstRow.first_name)
          .ilike('last_name', firstRow.last_name)
          .maybeSingle();

        if (leadData) {
          leadId = leadData.lead_id;
          
          // Create new user mapping
          const { error: mappingError } = await supabase
            .from('survey_user_mappings')
            .insert({
              external_user_id: firstRow.user_id,
              lead_id: leadId,
              first_name: firstRow.first_name,
              last_name: firstRow.last_name,
              match_confidence: 'high',
              match_method: 'name_match'
            })
            .select()
            .single();

          if (mappingError) {
            console.error(`Failed to create mapping for external_user_id ${firstRow.user_id}: ${mappingError.message}`);
          } else {
            console.log(`Created user mapping: external_user_id ${firstRow.user_id} (${firstRow.first_name} ${firstRow.last_name}) -> Lead ${leadId}`);
          }
        } else {
          // Lead not found
          const errorMsg = `Lead "${firstRow.first_name} ${firstRow.last_name}" not found in leads table`;
          errors.push(`Session ${sessionKey}: ${errorMsg}`);
          errorDetails.push({
            row_number: rowNumber,
            error_type: 'lead_not_found',
            error_message: errorMsg,
            row_data: firstRow
          });
          errorRows += sessionRows.length;
          continue;
        }
      }

      // Ensure we have a valid leadId before proceeding
      if (!leadId) {
        errorRows += sessionRows.length;
        continue;
      }

      // Check if session already exists (duplicate prevention)
      const completedOnISO = new Date(firstRow.completed_on).toISOString();
      const { data: existingSession } = await supabase
        .from('survey_response_sessions')
        .select('session_id')
        .eq('lead_id', leadId)
        .eq('external_user_id', firstRow.user_id)
        .eq('form_id', formId)
        .eq('completed_on', completedOnISO)
        .single();

      if (existingSession) {
        // Session already imported - skip it
        const errorMsg = `Duplicate session: already imported (session_id: ${existingSession.session_id})`;
        errors.push(`Session ${sessionKey}: ${errorMsg}`);
        errorDetails.push({
          row_number: rowNumber,
          error_type: 'duplicate_session',
          error_message: errorMsg,
          row_data: firstRow
        });
        duplicateRows += sessionRows.length;
        continue;
      }

      // Create response session
      const { data: sessionData, error: sessionError } = await supabase
        .from('survey_response_sessions')
        .insert({
          completed_on: completedOnISO,
          lead_id: leadId,
          external_user_id: firstRow.user_id,
          form_id: formId,
          import_batch_id: jobId
        })
        .select()
        .single();

      if (sessionError) {
        const errorMsg = `Failed to create session - ${sessionError.message}`;
        errors.push(`Session ${sessionKey}: ${errorMsg}`);
        errorDetails.push({
          row_number: rowNumber,
          error_type: 'session_insert_failed',
          error_message: errorMsg,
          row_data: firstRow
        });
        errorRows += sessionRows.length;
        continue;
      }

      const sessionId = sessionData.session_id;

      // Create program context cross-reference
      const { error: contextError } = await supabase
        .from('survey_session_program_context')
        .insert({
          session_id: sessionId,
          program_id: programId,
          module_id: moduleId
        })
        .select()
        .single();

      if (contextError) {
        const errorMsg = `Failed to create program context - ${contextError.message}`;
        console.error(`Error: ${errorMsg}`);
        errors.push(`Session ${sessionKey}: ${errorMsg}`);
        errorDetails.push({
          row_number: rowNumber,
          error_type: 'context_insert_failed',
          error_message: errorMsg,
          row_data: firstRow
        });
        // Continue processing - context is nice-to-have but not critical
      }

      // Process questions and insert responses
      const responsesToInsert = [];
      
      for (const row of sessionRows) {
        // Skip empty questions
        if (!row.question || row.question === 'Question') continue;

        // Get or create question (with form_id)
        const questionKey = `${formId}|${row.question}`;
        let questionId = questions.get(questionKey);
        if (!questionId) {
          const { data: newQuestion, error: questionError } = await supabase
            .from('survey_questions')
            .insert({ 
              question_text: row.question,
              form_id: formId,
              answer_type: 'text',  // Default to text since we don't have this in CSV
              question_order: null
            })
            .select()
            .single();
          
          if (newQuestion) {
            questionId = newQuestion.question_id;
            questions.set(questionKey, questionId);
            console.log(`Created new question: ${row.question.substring(0, 50)}... for form ${formId}`);
          } else {
            console.error(`Failed to create question: ${questionError?.message}`);
            continue;
          }
        }

        responsesToInsert.push({
          session_id: sessionId,
          question_id: questionId,
          answer_text: row.answer
        });
      }

      if (responsesToInsert.length === 0) {
        errors.push(`Session ${sessionKey}: No valid questions found`);
        errorRows += sessionRows.length;
        continue;
      }

      // Insert all responses for this session
      const { error: responsesError } = await supabase
        .from('survey_responses')
        .insert(responsesToInsert);

      if (responsesError) {
        errors.push(`Session ${sessionKey}: Failed to insert responses - ${responsesError.message}`);
        errorRows += sessionRows.length;
        continue;
      }

      successfulRows += sessionRows.length;
      console.log(`Successfully processed session ${sessionKey} with ${sessionRows.length} responses`);

    } catch (error) {
      const errorMsg = `Processing error - ${error.message}`;
      errors.push(`Session ${sessionKey}: ${errorMsg}`);
      errorDetails.push({
        row_number: rowNumber,
        error_type: 'processing_error',
        error_message: errorMsg,
        row_data: sessionRows[0]
      });
      errorRows += sessionRows.length;
    }
  }

  // Insert all errors into data_import_errors table
  if (errorDetails.length > 0) {
    const errorInserts = errorDetails.map(err => ({
      import_batch_id: jobId,
      row_number: err.row_number,
      error_type: err.error_type,
      error_message: err.error_message,
      row_data: err.row_data
    }));

    const { error: errorInsertError } = await supabase
      .from('data_import_errors')
      .insert(errorInserts);

    if (errorInsertError) {
      console.error('Failed to insert errors into data_import_errors table:', errorInsertError);
    } else {
      console.log(`Inserted ${errorDetails.length} errors into data_import_errors table`);
    }
  }

  const result: ImportJobResult = {
    job_id: jobId,
    total_rows: rows.length,
    successful_rows: successfulRows,
    failed_rows: errorRows,
    skipped_rows: skippedRows,
    errors: errors.slice(0, 20) // Limit to first 20 errors in response
  };

  console.log('Processing complete:', result);
  console.log(`Summary: ${successfulRows} successful, ${errorRows} errors, ${duplicateRows} duplicates, ${skippedRows} skipped`);
  return result;
}

async function updateJobStatus(
  supabase: any, 
  jobId: number, 
  status: string, 
  errorMessage?: string,
  result?: ImportJobResult
) {
  const updateData: any = {
    status: status,
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

  const { error } = await supabase
    .from('data_import_jobs')
    .update(updateData)
    .eq('import_batch_id', jobId);

  if (error) {
    console.error('Failed to update job status:', error);
  }
}
