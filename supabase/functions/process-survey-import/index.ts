// Survey Data Import Edge Function
// Processes CSV files uploaded to data-imports bucket
// Validates and imports survey response data
// Auto-creates missing programs, modules, forms, questions, and user mappings

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

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
        // No mapping exists, find the lead by name first
        // IMPORTANT: Trim whitespace from both CSV values AND use trimmed comparison
        // to handle any leading/trailing spaces in either source
        const csvFirstName = firstRow.first_name.trim();
        const csvLastName = firstRow.last_name.trim();
        
        // Log warning if CSV had whitespace that needed trimming
        if (csvFirstName !== firstRow.first_name || csvLastName !== firstRow.last_name) {
          console.warn(`Session ${sessionKey}: CSV name had whitespace - trimmed "${firstRow.first_name} ${firstRow.last_name}" to "${csvFirstName} ${csvLastName}"`);
        }
        
        // Query leads with exact name match (case-insensitive)
        // First try exact match, then try with pattern to catch trailing/leading spaces
        let { data: nameMatches } = await supabase
          .from('leads')
          .select('lead_id, first_name, last_name, email')
          .ilike('first_name', csvFirstName)
          .ilike('last_name', csvLastName);
        
        // If no exact match, try a broader search to catch whitespace issues in DB
        // and filter in-memory with trimmed comparison
        if (!nameMatches || nameMatches.length === 0) {
          console.log(`Session ${sessionKey}: No exact match for "${csvFirstName} ${csvLastName}", trying broader search with trimmed comparison`);
          
          // Search for names that start with the target (handles trailing spaces in DB)
          const { data: broaderMatches } = await supabase
            .from('leads')
            .select('lead_id, first_name, last_name, email')
            .ilike('first_name', `${csvFirstName}%`)
            .ilike('last_name', `${csvLastName}%`);
          
          // Filter to exact trimmed matches only
          nameMatches = (broaderMatches || []).filter(lead => 
            lead.first_name.trim().toLowerCase() === csvFirstName.toLowerCase() &&
            lead.last_name.trim().toLowerCase() === csvLastName.toLowerCase()
          );
          
          if (nameMatches.length > 0) {
            console.log(`Session ${sessionKey}: Found ${nameMatches.length} match(es) after trimmed comparison`);
          }
        }

        let matchMethod = 'name_match';
        let leadData: { lead_id: number; first_name: string; last_name: string; email?: string } | null = null;

        // If exactly 1 name match, use it
        if (nameMatches && nameMatches.length === 1) {
          leadData = nameMatches[0];
          matchMethod = 'name_match';
        }
        // If 0 or >1 name matches, try email search (if email provided in CSV)
        else if (nameMatches && nameMatches.length > 1) {
          // Multiple name matches - try email disambiguation
          console.log(`Session ${sessionKey}: Multiple name matches found for "${firstRow.first_name} ${firstRow.last_name}" (${nameMatches.length} matches), checking if email can disambiguate`);
          
          // Try to match by email if available
          // Note: We don't have email in CSV for this import, but check if future CSVs include it
          // For now, we'll just report the error
          const duplicateInfo = nameMatches.map(m => `lead_id: ${m.lead_id}`).join(', ');
          const errorMsg = `DUPLICATE NAME: Multiple leads found with name "${firstRow.first_name} ${firstRow.last_name}" (lead_ids: ${duplicateInfo}). Cannot determine which lead to use. Please add email column to CSV or fix duplicate names in leads table.`;
          errors.push(`Session ${sessionKey}: ${errorMsg}`);
          errorDetails.push({
            row_number: rowNumber,
            error_type: 'duplicate_name_match',
            error_message: errorMsg,
            row_data: firstRow
          });
          errorRows += sessionRows.length;
          continue;
        }
        // No name matches - this is expected for new surveys, report and continue
        else {
          const errorMsg = `Lead not found in leads table: "${firstRow.first_name} ${firstRow.last_name}". Please add this person to the leads table or create a manual mapping in survey_user_mappings.`;
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
              match_method: matchMethod
            })
            .select()
            .single();

          if (mappingError) {
            console.error(`Failed to create mapping for external_user_id ${firstRow.user_id}: ${mappingError.message}`);
          } else {
            console.log(`Created user mapping: external_user_id ${firstRow.user_id} (${firstRow.first_name} ${firstRow.last_name}) -> Lead ${leadId} via ${matchMethod}`);
          }
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

  // Calculate member progress dashboards via separate analysis function
  try {
    console.log('Triggering member progress analysis...');
    
    // Call the analysis edge function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const analysisUrl = `${supabaseUrl}/functions/v1/analyze-member-progress`;
    
    const response = await fetch(analysisUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'batch',
        import_batch_id: jobId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analysis function returned ${response.status}: ${errorText}`);
    }

    const analysisResult = await response.json();
    console.log(`Member progress analysis completed: ${analysisResult.analyzed_count} members, ${analysisResult.duration_seconds}s`);
  } catch (dashboardError) {
    console.error('Dashboard calculation failed:', dashboardError);
    console.error('Dashboard error details:', dashboardError.message);
    // Don't fail the entire import - just log the error
  }

  // Process feedback alerts for low ratings and text feedback
  try {
    console.log('Triggering feedback alerts processing...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const feedbackAlertsUrl = `${supabaseUrl}/functions/v1/process-feedback-alerts`;
    
    const alertsResponse = await fetch(feedbackAlertsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        import_batch_id: jobId
      })
    });

    if (!alertsResponse.ok) {
      const errorText = await alertsResponse.text();
      throw new Error(`Feedback alerts function returned ${alertsResponse.status}: ${errorText}`);
    }

    const alertsResult = await alertsResponse.json();
    console.log(`Feedback alerts processing completed: ${alertsResult.notes_created} notes, ${alertsResult.alerts_created} alerts, ${alertsResult.duplicates_skipped} duplicates skipped`);
  } catch (alertsError) {
    console.error('Feedback alerts processing failed:', alertsError);
    console.error('Feedback alerts error details:', alertsError.message);
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

