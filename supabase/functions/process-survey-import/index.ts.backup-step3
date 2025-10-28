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

interface QuestionDomainMapping {
  question_id: number;
  domain_key: string;
  survey_code: string;
}

/**
 * Converts PROMIS-29 text answers to numeric scores based on domain-specific mappings
 * @param answerText - The text answer from the survey
 * @param domainKey - The domain key from survey_domains table
 * @param questionText - The question text (used for Sleep Disturbance special cases)
 * @returns Numeric score (1-5 for most domains, 0-10 for pain_intensity) or null if not convertible
 */
function convertPromisAnswerToNumeric(
  answerText: string,
  domainKey: string,
  questionText: string
): number | null {
  // Normalize answer text (case-insensitive, trim spaces)
  const answer = answerText.trim().toLowerCase();
  
  // Domain-specific mappings
  switch (domainKey) {
    case 'physical_function':
      // Higher = better
      const physicalMap: Record<string, number> = {
        'without any difficulty': 5,
        'with a little difficulty': 4,
        'with some difficulty': 3,
        'with much difficulty': 2,
        'unable to do': 1
      };
      return physicalMap[answer] ?? null;
    
    case 'anxiety':
      // Higher = worse
      const anxietyMap: Record<string, number> = {
        'never': 1,
        'rarely': 2,
        'sometimes': 3,
        'often': 4,
        'always': 5
      };
      return anxietyMap[answer] ?? null;
    
    case 'depression':
      // Higher = worse
      const depressionMap: Record<string, number> = {
        'never': 1,
        'rarely': 2,
        'sometimes': 3,
        'often': 4,
        'always': 5
      };
      return depressionMap[answer] ?? null;
    
    case 'fatigue':
      // Higher = worse
      const fatigueMap: Record<string, number> = {
        'not at all': 1,
        'a little bit': 2,
        'somewhat': 3,
        'quite a bit': 4,
        'very much': 5
      };
      return fatigueMap[answer] ?? null;
    
    case 'sleep_disturbance':
      // Mixed wording - check question text for special cases
      const questionLower = questionText.toLowerCase();
      
      if (questionLower.includes('sleep quality')) {
        // "My sleep quality was" - reversed scoring
        const sleepQualityMap: Record<string, number> = {
          'very poor': 5,
          'poor': 4,
          'fair': 3,
          'good': 2,
          'very good': 1
        };
        return sleepQualityMap[answer] ?? null;
      } else if (questionLower.includes('refreshing')) {
        // "My sleep was refreshing" - reversed scoring
        const sleepRefreshingMap: Record<string, number> = {
          'not at all': 5,
          'a little bit': 4,
          'somewhat': 3,
          'quite a bit': 2,
          'very much': 1
        };
        return sleepRefreshingMap[answer] ?? null;
      } else {
        // Standard sleep disturbance questions (problem with sleep, difficulty falling asleep)
        const sleepStandardMap: Record<string, number> = {
          'not at all': 1,
          'a little bit': 2,
          'somewhat': 3,
          'quite a bit': 4,
          'very much': 5
        };
        return sleepStandardMap[answer] ?? null;
      }
    
    case 'social_roles':
      // Higher = better (reversed from typical)
      const socialMap: Record<string, number> = {
        'never': 5,
        'rarely': 4,
        'sometimes': 3,
        'often': 2,
        'always': 1
      };
      return socialMap[answer] ?? null;
    
    case 'pain_interference':
      // Higher = worse
      const painInterferenceMap: Record<string, number> = {
        'not at all': 1,
        'a little bit': 2,
        'somewhat': 3,
        'quite a bit': 4,
        'very much': 5
      };
      return painInterferenceMap[answer] ?? null;
    
    case 'pain_intensity':
      // Single numeric item (0-10) - should already be numeric, return null to use existing value
      return null;
    
    default:
      // Unknown domain - return null
      return null;
  }
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

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      if (jobId) {
        await updateJobStatus(supabase, jobId, 'failed', downloadError.message);
      }
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
      processSurveyData(supabase, rows, jobId!),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout after 10 minutes')), 600000)
      )
    ]) as ImportJobResult;

    console.log('Data processing completed:', result);

    // Update job with final results
    if (jobId) {
      await updateJobStatus(supabase, jobId, 'completed', undefined, result);
    }

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
    if (typeof jobId !== 'undefined') {
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
  const [programsResult, modulesResult, formsResult, questionsResult, domainMappingsResult] = await Promise.all([
    supabase.from('survey_programs').select('program_id, program_name'),
    supabase.from('survey_modules').select('module_id, module_name, program_id'),
    supabase.from('survey_forms').select('form_id, form_name'),  // Forms are global, no module_id
    supabase.from('survey_questions').select('question_id, question_text, form_id'),
    supabase
      .from('survey_form_question_domain')
      .select(`
        question_id,
        domain_key,
        survey_domains!inner(survey_code)
      `)
  ]);

  const programs = new Map(programsResult.data?.map(p => [p.program_name, p.program_id]) || []);
  const modules = new Map(modulesResult.data?.map(m => [`${m.program_id}|${m.module_name}`, m.module_id]) || []);
  const forms = new Map(formsResult.data?.map(f => [f.form_name, f.form_id]) || []);  // Forms are global, not module-specific
  const questions = new Map(questionsResult.data?.map(q => [`${q.form_id}|${q.question_text}`, q.question_id]) || []);
  
  // Build question-domain mapping lookup: questionId -> { domain_key, survey_code }
  const questionDomainMap = new Map<number, QuestionDomainMapping>();
  if (domainMappingsResult.data) {
    for (const mapping of domainMappingsResult.data) {
      questionDomainMap.set(mapping.question_id, {
        question_id: mapping.question_id,
        domain_key: mapping.domain_key,
        survey_code: (mapping.survey_domains as any).survey_code
      });
    }
  }
  console.log(`Loaded ${questionDomainMap.size} question-domain mappings`);

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
  const responsesToInsert: any[] = [];
      
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

        // Convert answer to numeric if possible
        let answerNumeric: number | null = null;
        
        // First, check if answer is already numeric (handles Pain Intensity and MSQ numeric responses)
        const numericValue = parseFloat(row.answer);
        if (!isNaN(numericValue) && isFinite(numericValue)) {
          answerNumeric = numericValue;
        } else if (typeof questionId === 'number') {
          // Answer is text - check if this question has a domain mapping
          const domainMapping = questionDomainMap.get(questionId);
          
          if (domainMapping && domainMapping.survey_code === 'PROMIS') {
            // This is a PROMIS question - apply text-to-numeric conversion
            const convertedValue = convertPromisAnswerToNumeric(
              row.answer,
              domainMapping.domain_key,
              row.question
            );
            
            if (convertedValue !== null) {
              answerNumeric = convertedValue;
              console.log(`Converted PROMIS answer: "${row.answer}" -> ${convertedValue} (domain: ${domainMapping.domain_key})`);
            }
          }
          // If not PROMIS or conversion failed, answerNumeric remains null (MSQ text responses stay as text)
        }

        responsesToInsert.push({
          session_id: sessionId,
          question_id: questionId,
          answer_text: row.answer,
          answer_numeric: answerNumeric
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

  // Calculate domain scores for MSQ and PROMIS surveys (form_id = 3 or 6)
  // Only run for NEW sessions (not duplicates)
  if (result.successful_rows > 0) {
    try {
      console.log('Starting domain scoring for MSQ and PROMIS surveys...');
      await calculateDomainScores(supabase, jobId);
      console.log('Domain scoring completed successfully');
    } catch (domainError) {
      console.error('Domain scoring failed:', domainError);
      console.error('Domain scoring error details:', domainError.message);
      console.error('Domain scoring error stack:', domainError.stack);
      // Don't fail the entire import - just log the error
    }
  }

  // Calculate member progress dashboards (runs for ALL batches, including duplicates/backfills)
  try {
    console.log('Starting member progress dashboard calculations...');
    await calculateMemberProgressDashboards(supabase, jobId);
    console.log('Member progress dashboard calculations completed successfully');
  } catch (dashboardError) {
    console.error('Dashboard calculation failed:', dashboardError);
    console.error('Dashboard error details:', dashboardError.message);
    console.error('Dashboard error stack:', dashboardError.stack);
    // Don't fail the entire import - just log the error
  }

  return result;
}

async function calculateDomainScores(supabase: any, jobId: number) {
  console.log(`Calculating domain scores for import job ${jobId}...`);

  try {
    // Get all MSQ and PROMIS sessions from this import job
    const { data: sessions, error: sessionsError } = await supabase
      .from('survey_response_sessions')
      .select(`
        session_id,
        external_user_id,
        lead_id,
        form_id,
        completed_on
      `)
      .eq('import_batch_id', jobId)
      .in('form_id', [3, 6]) // MSQ (form_id=3) and PROMIS (form_id=6) surveys
      .limit(1000); // Override default PostgREST limit to fetch all sessions

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    if (!sessions || sessions.length === 0) {
      console.log('No MSQ or PROMIS sessions found for domain scoring');
      return;
    }

    console.log(`Found ${sessions.length} sessions for domain scoring (MSQ and PROMIS)`);

    // Fetch responses in batches to avoid PostgREST row limits on RPC calls
    // PostgREST has a ~1000 row limit on RPC responses
    // With 74 responses per MSQ session: 1000 ÷ 74 = 13.5, so use 13 to be safe
    const SESSION_BATCH_SIZE = 13; // Process 13 sessions at a time
    const allResponses: any[] = [];
    
    console.log(`Fetching responses for ${sessions.length} sessions in batches of ${SESSION_BATCH_SIZE}...`);
    
    for (let i = 0; i < sessions.length; i += SESSION_BATCH_SIZE) {
      const sessionBatch = sessions.slice(i, i + SESSION_BATCH_SIZE);
      const sessionIds = sessionBatch.map(s => s.session_id);
      const batchNum = Math.floor(i / SESSION_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sessions.length / SESSION_BATCH_SIZE);
      
      console.log(`Fetching batch ${batchNum}/${totalBatches}: sessions ${sessionIds.join(', ')}`);
      
      const { data: batchResponses, error: responsesError } = await supabase
        .rpc('get_responses_with_domains', {
          session_ids: sessionIds
        });

      if (responsesError) {
        console.error(`Error fetching responses for batch ${batchNum}:`, responsesError);
        throw new Error(`Failed to fetch responses for batch ${batchNum}: ${responsesError.message}`);
      }

      if (batchResponses && batchResponses.length > 0) {
        allResponses.push(...batchResponses);
        console.log(`Batch ${batchNum}/${totalBatches}: fetched ${batchResponses.length} responses`);
      }
    }

    if (allResponses.length === 0) {
      console.log('No numeric responses found for domain scoring');
      return;
    }

    console.log(`Found ${allResponses.length} total numeric responses for domain scoring`);
    const responses = allResponses;

    // Group responses by session and domain
    const domainScores = new Map<string, { session: any, domainKey: string, totalScore: number, questionCount: number }>();
    
    for (const response of responses) {
      const domainKey = response.domain_key;
      if (!domainKey) {
        console.log(`Skipping response with no domain mapping: session_id=${response.session_id}, question_id=${response.question_id}`);
        continue; // Skip if no domain mapping
      }

      const sessionKey = `${response.session_id}|${domainKey}`;
      const score = parseFloat(response.answer_numeric.toString()) || 0;

      if (domainScores.has(sessionKey)) {
        const existing = domainScores.get(sessionKey)!;
        existing.totalScore += score;
        existing.questionCount += 1;
      } else {
        const session = sessions.find(s => s.session_id === response.session_id);
        domainScores.set(sessionKey, {
          session,
          domainKey,
          totalScore: score,
          questionCount: 1
        });
      }
    }

    console.log(`Grouped into ${domainScores.size} domain score entries`);

    // Calculate severity assessments and prepare inserts
    const domainScoreInserts: any[] = [];
    
    for (const [sessionKey, data] of domainScores) {
      const { session, domainKey, totalScore, questionCount } = data;
      
      // Calculate severity assessment based on quartiles
      const maxPossibleScore = questionCount * 4;
      const quartileSize = maxPossibleScore / 4;
      
      let severityAssessment: string;
      if (totalScore <= quartileSize) {
        severityAssessment = 'minimal';
      } else if (totalScore <= quartileSize * 2) {
        severityAssessment = 'mild';
      } else if (totalScore <= quartileSize * 3) {
        severityAssessment = 'moderate';
      } else {
        severityAssessment = 'severe';
      }

      domainScoreInserts.push({
        session_id: session.session_id,
        external_user_id: session.external_user_id,
        lead_id: session.lead_id,
        form_id: session.form_id,
        completed_on: session.completed_on,
        domain_key: domainKey,
        domain_total_score: totalScore,
        severity_assessment: severityAssessment,
        created_at: new Date().toISOString()
      });
    }

    console.log(`Prepared ${domainScoreInserts.length} domain score inserts`);

    // Batch insert domain scores to avoid payload size limits (1MB limit in Supabase)
    if (domainScoreInserts.length > 0) {
      const BATCH_SIZE = 100; // Insert 100 records at a time
      const totalBatches = Math.ceil(domainScoreInserts.length / BATCH_SIZE);
      let totalInserted = 0;

      console.log(`Inserting ${domainScoreInserts.length} records in ${totalBatches} batches of ${BATCH_SIZE}`);

      for (let i = 0; i < domainScoreInserts.length; i += BATCH_SIZE) {
        const batch = domainScoreInserts.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`Inserting batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

        const { error: insertError } = await supabase
          .from('survey_domain_scores')
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting batch ${batchNumber}:`, insertError);
          throw new Error(`Failed to insert batch ${batchNumber}: ${insertError.message}`);
        }

        totalInserted += batch.length;
        console.log(`Batch ${batchNumber}/${totalBatches} inserted successfully. Total: ${totalInserted}/${domainScoreInserts.length}`);
      }

      console.log(`Successfully inserted all ${totalInserted} domain score records in ${totalBatches} batches`);
    } else {
      console.log('No domain scores to insert');
    }

  } catch (error) {
    console.error('Error in calculateDomainScores:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    throw error; // Re-throw to be caught by the calling function
  }
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

/**
 * Calculate member progress dashboard metrics for all members in this import batch
 * Populates the member_progress_summary table with pre-calculated dashboard data
 */

// Fallback module sequence for 4-Month AIP Program (program_id = 2)
// Used only if database query fails
const FALLBACK_MODULE_SEQUENCE = [
  'MODULE 1 - PRE-PROGRAM',
  'MODULE 2 - WEEK 1',
  'MODULE 3 - WEEK 2',
  'MODULE 4 - START OF DETOX',
  'MODULE 5 - WEEK 4',
  'MODULE 6 - MID-DETOX',
  'MODULE 7 - END OF DETOX',
  'MODULE 8 - END OF MONTH 2',
  'MODULE 9 - START OF MONTH 3',
  'MODULE 10 - MID-MONTH 3',
  'MODULE 11 - END OF MONTH 3',
  'MODULE 12 - START OF MONTH 4',
  'MODULE 13 - MID-MONTH 4'
];

/**
 * Get module sequence from database for a specific program
 * Returns the ordered list of module names from the survey_modules table
 * 
 * @param supabase - Supabase client
 * @param programId - Program ID to fetch modules for
 * @returns Array of module names in order
 */
async function getModuleSequence(supabase: any, programId: number): Promise<string[]> {
  try {
    const { data: modules, error } = await supabase
      .from('survey_modules')
      .select('module_name, module_order')
      .eq('program_id', programId)
      .eq('active_flag', true);

    if (error) {
      console.error(`Error fetching module sequence for program ${programId}:`, error);
      return FALLBACK_MODULE_SEQUENCE;
    }

    if (!modules || modules.length === 0) {
      console.warn(`No modules found for program ${programId}, using fallback`);
      return FALLBACK_MODULE_SEQUENCE;
    }

    // If module_order is populated, sort by it
    if (modules[0]?.module_order !== null && modules[0]?.module_order !== undefined) {
      const sorted = modules.sort((a, b) => (a.module_order || 0) - (b.module_order || 0));
      return sorted.map(m => m.module_name);
    }

    // If module_order is null, extract number from "MODULE X - ..." pattern and sort
    const sorted = modules.sort((a, b) => {
      const aMatch = a.module_name.match(/MODULE (\d+)/);
      const bMatch = b.module_name.match(/MODULE (\d+)/);
      const aNum = aMatch ? parseInt(aMatch[1]) : 9999;
      const bNum = bMatch ? parseInt(bMatch[1]) : 9999;
      return aNum - bNum;
    });

    const sequence = sorted.map(m => m.module_name);
    console.log(`Loaded ${sequence.length} modules for program ${programId}`);
    return sequence;
  } catch (error) {
    console.error(`Exception fetching module sequence for program ${programId}:`, error);
    return FALLBACK_MODULE_SEQUENCE;
  }
}

async function calculateMemberProgressDashboards(supabase: any, jobId: number) {
  console.log(`Calculating member progress dashboards for import job ${jobId}...`);

  try {
    // Create cache for module sequences by program_id
    // This prevents re-querying the same program's modules for multiple members
    const moduleSequenceCache = new Map<number, string[]>();
    console.log('Initialized module sequence cache');

    // Get all lead_ids from this import batch
    const { data: sessions, error: sessionsError } = await supabase
      .from('survey_response_sessions')
      .select('lead_id')
      .eq('import_batch_id', jobId);

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for dashboard calculation');
      return;
    }

    // Get unique lead_ids in JavaScript (Supabase JS client doesn't support DISTINCT in select)
    const uniqueLeadIds = [...new Set(sessions.map(s => s.lead_id))];
    const uniqueSessions = uniqueLeadIds.map(lead_id => ({ lead_id: lead_id as number }));

    console.log(`Calculating dashboards for ${uniqueSessions.length} unique members...`);

    // Process each member
    for (const session of uniqueSessions) {
      try {
        const leadId = session.lead_id;
        console.log(`Processing lead ${leadId}...`);

        // Calculate all metrics for this member (passes cache for module sequences)
        const metrics = await calculateMemberMetrics(supabase, leadId, moduleSequenceCache);

        // Upsert to member_progress_summary
        const { error: upsertError } = await supabase
          .from('member_progress_summary')
          .upsert({
            lead_id: leadId,
            ...metrics,
            calculated_at: new Date().toISOString(),
            last_import_batch_id: jobId
          }, {
            onConflict: 'lead_id'
          });

        if (upsertError) {
          console.error(`Failed to upsert dashboard for lead ${leadId}:`, upsertError);
        } else {
          console.log(`Successfully updated dashboard for lead ${leadId}`);
        }
      } catch (memberError) {
        console.error(`Error processing lead ${session.lead_id}:`, memberError);
        // Continue with next member
      }
    }

    console.log(`Dashboard calculations complete for ${uniqueSessions.length} members`);
  } catch (error) {
    console.error('Error in calculateMemberProgressDashboards:', error);
    throw error;
  }
}

/**
 * Calculate all dashboard metrics for a specific member
 * 
 * @param supabase - Supabase client
 * @param leadId - Lead ID to calculate metrics for
 * @param moduleSequenceCache - Cache of module sequences by program_id (to avoid repeated DB queries)
 */
async function calculateMemberMetrics(supabase: any, leadId: number, moduleSequenceCache: Map<number, string[]>) {
  console.log(`Calculating metrics for lead ${leadId}...`);

  // Get external_user_id and mapping_id from survey_user_mappings
  const { data: mapping, error: mappingError } = await supabase
    .from('survey_user_mappings')
    .select('external_user_id, mapping_id')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (mappingError || !mapping) {
    console.log(`No survey mapping found for lead ${leadId}`);
    return getDefaultMetrics();
  }

  const externalUserId = mapping.external_user_id;

  // Get member program info for days_in_program
  const { data: program, error: programError } = await supabase
    .from('member_programs')
    .select('start_date, duration, program_name')
    .eq('lead_id', leadId)
    .eq('active_flag', true)
    .maybeSingle();

  let daysInProgram: number | null = null;
  console.log(`[DAYS_IN_PROGRAM DEBUG] Lead ${leadId}: programError=${!!programError}, program=${!!program}, start_date=${program?.start_date}`);
  
  if (programError) {
    console.error(`Error fetching program for lead ${leadId}:`, programError);
  } else if (!program) {
    console.warn(`No active program found for lead ${leadId}`);
  } else if (!program.start_date) {
    console.warn(`Program found for lead ${leadId} but no start_date:`, JSON.stringify(program));
  } else {
    const startDate = new Date(program.start_date);
    const today = new Date();
    daysInProgram = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`[DAYS_IN_PROGRAM SUCCESS] Lead ${leadId}: start_date=${program.start_date}, days_in_program=${daysInProgram}, type=${typeof daysInProgram}`);
  }
  
  console.log(`[DAYS_IN_PROGRAM FINAL] Lead ${leadId}: daysInProgram=${daysInProgram} (will be saved to DB)`);

  // Get curriculum progress from survey_user_progress (via mapping_id)
  // Also get program_id to fetch the correct module sequence for this member
  const { data: userProgress, error: progressError } = await supabase
    .from('survey_user_progress')
    .select('program_id, status, last_completed, working_on, date_of_last_completed')
    .eq('mapping_id', mapping.mapping_id)
    .maybeSingle();

  // Get or fetch module sequence for this member's program
  let moduleSequence: string[] = FALLBACK_MODULE_SEQUENCE; // Default
  let programId = 2; // Default to 4 Month AIP Program
  
  if (userProgress && userProgress.program_id) {
    programId = userProgress.program_id;
    
    // Check cache first
    if (moduleSequenceCache.has(programId)) {
      moduleSequence = moduleSequenceCache.get(programId)!;
      console.log(`Using cached module sequence for program ${programId}`);
    } else {
      // Fetch from database and cache it
      console.log(`Fetching module sequence for program ${programId}...`);
      moduleSequence = await getModuleSequence(supabase, programId);
      moduleSequenceCache.set(programId, moduleSequence);
      console.log(`Cached module sequence for program ${programId} (${moduleSequence.length} modules)`);
    }
  } else {
    console.warn(`No program_id found for lead ${leadId}, using fallback sequence`);
  }

  // Get all surveys for this member (excluding MSQ and PROMIS for now)
  const { data: allSessions, error: sessionsError } = await supabase
    .from('survey_response_sessions')
    .select('session_id, form_id, completed_on, survey_forms!inner(form_name)')
    .eq('external_user_id', externalUserId)
    .not('form_id', 'in', '(3,6)') // Exclude MSQ and PROMIS for now
    .order('completed_on', { ascending: true });

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    return getDefaultMetrics();
  }

  if (!allSessions || allSessions.length === 0) {
    console.log(`No surveys found for lead ${leadId}`);
    return getDefaultMetrics();
  }

  const sessionIds = allSessions.map(s => s.session_id);

  // Get all responses for these sessions
  const { data: responses, error: responsesError} = await supabase
    .from('survey_responses')
    .select('session_id, question_id, answer_text, answer_numeric, survey_questions!inner(question_text)')
    .in('session_id', sessionIds);

  if (responsesError) {
    console.error('Error fetching responses:', responsesError);
    return getDefaultMetrics();
  }

  // Calculate health vitals
  const healthVitals = calculateHealthVitals(allSessions, responses);
  
  // Calculate compliance metrics (with target for exercise)
  const compliance = calculateCompliance(allSessions, responses);
  
  // Extract alerts (wins and concerns)
  const alerts = extractAlerts(allSessions, responses);
  
  // Calculate timeline progress using survey_user_progress
  const timeline = calculateTimelineProgress(userProgress, allSessions, moduleSequence);
  
  // Get goals from "Goals & Whys" survey
  const goals = await extractGoals(supabase, externalUserId);
  
  // Extract weight tracking with session dates for chronological sorting
  const weight = extractWeightData(allSessions, responses);
  
  // Calculate status indicator
  const statusIndicator = calculateStatusIndicator(healthVitals, compliance, alerts, userProgress);

  return {
    // Profile
    last_survey_date: allSessions[allSessions.length - 1]?.completed_on || null,
    last_survey_name: (allSessions[allSessions.length - 1]?.survey_forms as any)?.form_name || null,
    total_surveys_completed: allSessions.length,
    days_in_program: daysInProgram,
    status_indicator: statusIndicator,
    
    // Health vitals
    ...healthVitals,
    
    // Compliance
    ...compliance,
    
    // Alerts
    latest_wins: JSON.stringify(alerts.wins),
    latest_concerns: JSON.stringify(alerts.concerns),
    
    // Timeline
    module_sequence: JSON.stringify(moduleSequence), // Full module list for member's program
    ...timeline,
    
    // Goals
    goals: JSON.stringify(goals),
    
    // Weight
    current_weight: weight.current,
    weight_change: weight.change
  };
}

/**
 * Calculate health vitals (energy, mood, motivation, wellbeing, sleep)
 */
function calculateHealthVitals(sessions: any[], responses: any[]) {
  const metrics = {
    energy: { scores: [] as number[], trend: 'no_data' as string },
    mood: { scores: [] as number[], trend: 'no_data' as string },
    motivation: { scores: [] as number[], trend: 'no_data' as string },
    wellbeing: { scores: [] as number[], trend: 'no_data' as string },
    sleep: { scores: [] as number[], trend: 'no_data' as string }
  };

  // Map question patterns to metrics
  const questionPatterns = {
    energy: ['rate your energy', 'energy level'],
    mood: ['rate your mood', 'mood /'],
    motivation: ['rate your motivation', 'motivation level'],
    wellbeing: ['rate your wellbeing', 'general wellbeing'],
    sleep: ['rate your sleep', 'sleep quality']
  };

  // Group responses by session
  const sessionMap = new Map<number, any[]>();
  for (const response of responses) {
    if (!sessionMap.has(response.session_id)) {
      sessionMap.set(response.session_id, []);
    }
    sessionMap.get(response.session_id)!.push(response);
  }

  // Extract scores for each session
  for (const session of sessions) {
    const sessionResponses = sessionMap.get(session.session_id) || [];
    
    for (const [metric, patterns] of Object.entries(questionPatterns)) {
      for (const response of sessionResponses) {
        const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
        
        // Check if this question matches the metric pattern
        if (patterns.some(pattern => questionText.includes(pattern))) {
          const score = response.answer_numeric;
          if (score !== null && score !== undefined) {
            metrics[metric as keyof typeof metrics].scores.push(Number(score));
          }
          break; // Found the question for this metric in this session
        }
      }
    }
  }

  // Calculate trends and prepare output
  const result: any = {};
  for (const [metric, data] of Object.entries(metrics)) {
    if (data.scores.length > 0) {
      const currentScore = data.scores[data.scores.length - 1];
      const trend = data.scores.length >= 2 
        ? calculateTrend(data.scores[data.scores.length - 2], currentScore)
        : 'stable';
      
      result[`${metric}_score`] = currentScore;
      result[`${metric}_trend`] = trend;
      result[`${metric}_sparkline`] = JSON.stringify(data.scores.slice(-10)); // Last 10 scores
    } else {
      result[`${metric}_score`] = null;
      result[`${metric}_trend`] = 'no_data';
      result[`${metric}_sparkline`] = JSON.stringify([]);
    }
  }

  return result;
}

/**
 * Calculate compliance metrics
 */
function calculateCompliance(sessions: any[], responses: any[]) {
  const compliance = {
    nutrition: { yes: 0, total: 0 },
    supplements: { yes: 0, total: 0 },
    exercise: { days: [] as number[] },
    meditation: { yes: 0, total: 0 }
  };

  // Group responses by session
  const sessionMap = new Map<number, any[]>();
  for (const response of responses) {
    if (!sessionMap.has(response.session_id)) {
      sessionMap.set(response.session_id, []);
    }
    sessionMap.get(response.session_id)!.push(response);
  }

  // Extract compliance data
  for (const session of sessions) {
    const sessionResponses = sessionMap.get(session.session_id) || [];
    
    for (const response of sessionResponses) {
      const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
      const answer = response.answer_text?.toLowerCase() || '';

      // Nutrition compliance
      if (questionText.includes('following the nutritional plan') || 
          questionText.includes('followed the nutritional plan')) {
        compliance.nutrition.total++;
        if (answer === 'yes') compliance.nutrition.yes++;
      }

      // Supplements compliance
      if (questionText.includes('taken your supplements') || 
          questionText.includes('taking supplements as prescribed')) {
        compliance.supplements.total++;
        if (answer === 'yes') compliance.supplements.yes++;
      }

      // Exercise days per week
      if (questionText.includes('how many days per week do you exercise')) {
        const days = response.answer_numeric;
        if (days !== null && days !== undefined) {
          compliance.exercise.days.push(Number(days));
        }
      }

      // Meditation compliance
      if (questionText.includes('abdominal breathing') || 
          questionText.includes('meditation')) {
        compliance.meditation.total++;
        if (answer === 'yes' || answer === 'daily') compliance.meditation.yes++;
      }
    }
  }

  // Calculate percentages
  const exerciseTarget = 5; // Standard target: 5 days per week
  const latestExerciseDays = compliance.exercise.days.length > 0 
    ? compliance.exercise.days[compliance.exercise.days.length - 1] 
    : null;
  
  return {
    nutrition_compliance_pct: compliance.nutrition.total > 0 
      ? Math.round((compliance.nutrition.yes / compliance.nutrition.total) * 100) 
      : null,
    nutrition_streak: compliance.nutrition.yes, // Simplified for now
    supplements_compliance_pct: compliance.supplements.total > 0 
      ? Math.round((compliance.supplements.yes / compliance.supplements.total) * 100) 
      : null,
    exercise_compliance_pct: latestExerciseDays !== null
      ? Math.round((latestExerciseDays / exerciseTarget) * 100)
      : null,
    exercise_days_per_week: latestExerciseDays,
    meditation_compliance_pct: compliance.meditation.total > 0 
      ? Math.round((compliance.meditation.yes / compliance.meditation.total) * 100) 
      : null
  };
}

/**
 * Extract wins and concerns from open-ended responses
 */
function extractAlerts(sessions: any[], responses: any[]) {
  const wins: any[] = [];
  const concerns: any[] = [];
  
  // Group responses by session
  const sessionMap = new Map<number, any[]>();
  for (const response of responses) {
    if (!sessionMap.has(response.session_id)) {
      sessionMap.set(response.session_id, []);
    }
    sessionMap.get(response.session_id)!.push(response);
  }

  // Extract from recent sessions (last 5)
  const recentSessions = sessions.slice(-5);

  for (const session of recentSessions) {
    const sessionResponses = sessionMap.get(session.session_id) || [];
    
    for (const response of sessionResponses) {
      const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
      const answer = response.answer_text || '';

      // Skip empty or placeholder answers
      if (!answer || answer.toLowerCase() === 'none' || answer.toLowerCase() === 'n/a') {
        continue;
      }

      // Extract wins
      if (questionText.includes('benefits') || 
          questionText.includes('successes') || 
          questionText.includes('positive health results')) {
        
        // Filter out negative responses even when answering "benefits" questions
        const answerLower = answer.toLowerCase();
        const negativeKeywords = [
          'however', 'but ', 'worsened', 'worse', 'gotten worse', 'getting worse',
          'no improvement', 'not improved', 'not better', 'no change',
          'haven\'t', 'hasn\'t', 'didn\'t help', 'don\'t feel', 'doesn\'t',
          'failed', 'unfortunately', 'disappointed', 'frustrated',
          'same questions', 'why am i asked', 'over and over',
          'both have worsened', 'still struggling', 'still have'
        ];
        
        // Skip if answer contains strong negative indicators
        const hasNegativeKeywords = negativeKeywords.some(keyword => answerLower.includes(keyword));
        
        if (!hasNegativeKeywords) {
          wins.push({
            date: session.completed_on,
            message: answer.substring(0, 200), // Limit length
            type: 'explicit'
          });
        }
      }

      // Extract concerns
      if (questionText.includes('obstacles') || 
          questionText.includes('concerns') || 
          questionText.includes('challenges') || 
          questionText.includes('hesitations')) {
        concerns.push({
          date: session.completed_on,
          message: answer.substring(0, 200),
          severity: 'medium'
        });
      }
    }
  }

  return {
    wins: wins.slice(-5).reverse(), // Keep last 5, newest first
    concerns: concerns.slice(-5).reverse() // Keep last 5, newest first
  };
}

/**
 * Calculate timeline progress using survey_user_progress table
 * 
 * IMPORTANT: 
 * - last_completed = last module they finished
 * - working_on = module they SHOULD BE on (not currently on)
 * - Overdue = all modules from (last_completed + 1) to working_on (INCLUSIVE of working_on)
 * 
 * @param userProgress - User progress data from survey_user_progress table
 * @param sessions - All survey sessions for this member
 * @param moduleSequence - Ordered array of module names from survey_modules table
 */
function calculateTimelineProgress(userProgress: any | null, sessions: any[], moduleSequence: string[]) {
  if (!userProgress || !userProgress.last_completed) {
    // Fallback: use session data
    const milestones = sessions.map(s => (s.survey_forms as any)?.form_name || 'Unknown');
    return {
      completed_milestones: JSON.stringify(milestones),
      next_milestone: null,
      overdue_milestones: JSON.stringify([])
    };
  }

  const lastCompleted = userProgress.last_completed;
  const workingOn = userProgress.working_on; // SHOULD BE on (not currently on)

  // Find position in module sequence
  const lastCompletedIndex = moduleSequence.indexOf(lastCompleted);
  const workingOnIndex = moduleSequence.indexOf(workingOn);

  // Warn if module not found (indicates bad data in survey_user_progress)
  if (lastCompletedIndex === -1) {
    console.warn(`[TIMELINE WARNING] Module not found in sequence: last_completed="${lastCompleted}" (available: ${moduleSequence.join(', ')})`);
  }
  if (workingOn !== 'Finished' && workingOnIndex === -1) {
    console.warn(`[TIMELINE WARNING] Module not found in sequence: working_on="${workingOn}"`);
  }

  // Completed milestones: all modules up to and including last_completed
  const completedMilestones = lastCompletedIndex >= 0 
    ? moduleSequence.slice(0, lastCompletedIndex + 1)
    : [];

  // Next milestone: always the module immediately after last_completed
  // ONLY show "Program Complete" if they've ACTUALLY completed all modules
  let nextMilestone: string | null = null;
  const allModulesActuallyCompleted = lastCompletedIndex >= 0 && lastCompletedIndex === moduleSequence.length - 1;
  
  if (allModulesActuallyCompleted) {
    nextMilestone = 'Program Complete';
  } else if (lastCompletedIndex >= 0 && lastCompletedIndex < moduleSequence.length - 1) {
    nextMilestone = moduleSequence[lastCompletedIndex + 1];
  }

  // Overdue milestones: ALL modules from (last_completed + 1) to working_on (INCLUSIVE)
  // SPECIAL CASE: If working_on = "Finished" but they haven't completed all modules,
  // then ALL remaining modules are overdue
  const overdueMilestones: string[] = [];
  
  if (workingOn === 'Finished' && !allModulesActuallyCompleted && lastCompletedIndex >= 0) {
    // They SHOULD be finished, but aren't → all remaining modules are overdue
    for (let i = lastCompletedIndex + 1; i < moduleSequence.length; i++) {
      overdueMilestones.push(moduleSequence[i]);
    }
  } else if (lastCompletedIndex >= 0 && workingOnIndex >= 0 && workingOnIndex > lastCompletedIndex) {
    // Normal case: modules between last_completed and working_on are overdue
    for (let i = lastCompletedIndex + 1; i <= workingOnIndex; i++) {
      if (i < moduleSequence.length) {
        overdueMilestones.push(moduleSequence[i]);
      }
    }
  }

  return {
    completed_milestones: JSON.stringify(completedMilestones),
    next_milestone: nextMilestone,
    overdue_milestones: JSON.stringify(overdueMilestones)
  };
}

/**
 * Extract weight tracking data from survey responses
 * Sorts by session date to ensure correct chronological order
 */
function extractWeightData(sessions: any[], responses: any[]) {
  const weightPattern = ['weight', 'current weight', 'body weight'];
  const weightData: Array<{ value: number; date: string; sessionId: number }> = [];

  // Create a map of session_id to completed_on date
  const sessionDateMap = new Map<number, string>();
  for (const session of sessions) {
    sessionDateMap.set(session.session_id, session.completed_on);
  }

  for (const response of responses) {
    const questionText = (response.survey_questions as any)?.question_text?.toLowerCase() || '';
    
    // Check if this is a weight question (exclude MSQ "excessive weight" type questions)
    const isWeightQuestion = weightPattern.some(pattern => questionText.includes(pattern));
    const isActualWeight = questionText.includes('current weight') || questionText.includes('body weight');
    
    if (isWeightQuestion && isActualWeight) {
      const weight = response.answer_numeric;
      const sessionDate = sessionDateMap.get(response.session_id);
      
      if (weight !== null && weight !== undefined && weight > 0 && weight < 500 && sessionDate) {
        // Reasonable weight range filter
        weightData.push({ 
          value: Number(weight), 
          date: sessionDate,
          sessionId: response.session_id
        });
      }
    }
  }

  if (weightData.length === 0) {
    return { current: null, change: null };
  }

  // Sort by date chronologically (earliest to latest)
  weightData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const firstWeight = weightData[0].value;
  const currentWeight = weightData[weightData.length - 1].value;
  const weightChange = currentWeight - firstWeight;

  return {
    current: currentWeight,
    change: weightChange
  };
}

/**
 * Extract goals from "Goals & Whys" survey
 */
async function extractGoals(supabase: any, memberId: number) {
  const { data: goalSession, error } = await supabase
    .from('survey_response_sessions')
    .select(`
      session_id,
      survey_responses!inner(answer_text, survey_questions!inner(question_text))
    `)
    .eq('external_user_id', memberId)
    .eq('form_id', 2) // "Goals & Whys" survey
    .order('completed_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !goalSession) {
    return [];
  }

  const goals: any[] = [];
  const responses = goalSession.survey_responses || [];

  for (const response of responses) {
    const questionText = response.survey_questions?.question_text || '';
    const answer = response.answer_text || '';

    if (questionText.includes('SMART Goal') && answer && answer !== '' && answer.toLowerCase() !== 'n/a') {
      goals.push({
        goal_text: answer,
        status: 'on_track' // Default status
      });
    }
  }

  return goals;
}

/**
 * Calculate overall status indicator
 */
function calculateStatusIndicator(healthVitals: any, compliance: any, alerts: any, userProgress: any | null): string {
  // Red flags
  if (alerts.concerns.length >= 3) return 'red';
  if (compliance.nutrition_compliance_pct !== null && compliance.nutrition_compliance_pct < 40) return 'red';
  
  // Check for declining trends
  const decliningCount = Object.keys(healthVitals)
    .filter(key => key.includes('_trend'))
    .filter(key => healthVitals[key] === 'declining')
    .length;
  
  if (decliningCount >= 3) return 'red';
  
  // Check if behind on curriculum AND overdue > 14 days
  if (userProgress && userProgress.status === 'Behind' && userProgress.date_of_last_completed) {
    const lastCompletionDate = new Date(userProgress.date_of_last_completed);
    const today = new Date();
    const daysSinceLastSurvey = Math.floor((today.getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastSurvey > 14) return 'red';
  }
  
  // Yellow flags
  if (alerts.concerns.length >= 1) return 'yellow';
  if (compliance.nutrition_compliance_pct !== null && compliance.nutrition_compliance_pct < 70) return 'yellow';
  if (decliningCount >= 1) return 'yellow';
  if (userProgress && userProgress.status === 'Behind') return 'yellow';
  
  // Green - all good
  return 'green';
}

/**
 * Calculate trend based on previous and current scores
 */
function calculateTrend(previousScore: number, currentScore: number): string {
  const diff = currentScore - previousScore;
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

/**
 * Get default metrics when no data is available
 */
function getDefaultMetrics() {
  return {
    last_survey_date: null,
    last_survey_name: null,
    total_surveys_completed: 0,
    days_in_program: null,
    status_indicator: 'green',
    energy_score: null,
    energy_trend: 'no_data',
    energy_sparkline: JSON.stringify([]),
    mood_score: null,
    mood_trend: 'no_data',
    mood_sparkline: JSON.stringify([]),
    motivation_score: null,
    motivation_trend: 'no_data',
    motivation_sparkline: JSON.stringify([]),
    wellbeing_score: null,
    wellbeing_trend: 'no_data',
    wellbeing_sparkline: JSON.stringify([]),
    sleep_score: null,
    sleep_trend: 'no_data',
    sleep_sparkline: JSON.stringify([]),
    nutrition_compliance_pct: null,
    nutrition_streak: 0,
    supplements_compliance_pct: null,
    exercise_compliance_pct: null,
    exercise_days_per_week: null,
    meditation_compliance_pct: null,
    latest_wins: JSON.stringify([]),
    latest_concerns: JSON.stringify([]),
    module_sequence: JSON.stringify(FALLBACK_MODULE_SEQUENCE), // Use fallback when no data
    completed_milestones: JSON.stringify([]),
    next_milestone: null,
    overdue_milestones: JSON.stringify([]),
    goals: JSON.stringify([]),
    current_weight: null,
    weight_change: null
  };
}
