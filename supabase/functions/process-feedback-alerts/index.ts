// Feedback Alerts Edge Function
// Processes newly imported survey responses and creates alerts for:
// - Low ratings (< 3) for Provider, Staff/Coach, Curriculum
// - Improvement suggestions (text feedback)
// - Education requests (text feedback)
// - Overdue modules (from member_progress_summary)
// Alerts are created as notes linked to notifications, targeting appropriate roles.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * System User UUID for automated notifications
 * Use all-zeros UUID as convention for system-generated content
 * UI should display "System" when this UUID is the creator
 */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * TODO: Remove duplicate data storage in notifications table.
 * Currently we store noteContent in both:
 *   1. lead_notes.note (via source_note_id)
 *   2. notifications.message (redundant copy)
 * 
 * Future cleanup:
 *   - Stop populating notifications.message when source_note_id exists
 *   - Update existing notifications to clear message field
 *   - Ensure UI only displays the linked note content
 */

/**
 * Question IDs for feedback questions (across forms)
 * 
 * TODO: Need to fix this at some point so that it's not hardcoded
 * and is more dynamic (e.g., query by question text pattern or
 * use a question metadata/tag system).
 */
const RATING_QUESTION_IDS = {
  provider: [207, 250, 417],      // Final, Mid-Program, Initial Results
  staff: [208, 251, 418],         // Final, Mid-Program, Initial Results
  curriculum: [209, 252],         // Final, Mid-Program Results
};

const TEXT_QUESTION_IDS = {
  improvement: [219, 262, 432],   // Improvement suggestions - high priority
  education: [210, 253],          // Education requests - normal priority
};

// All rating question IDs flattened
const ALL_RATING_IDS = [
  ...RATING_QUESTION_IDS.provider,
  ...RATING_QUESTION_IDS.staff,
  ...RATING_QUESTION_IDS.curriculum,
];

// All text feedback question IDs flattened
const ALL_TEXT_IDS = [
  ...TEXT_QUESTION_IDS.improvement,
  ...TEXT_QUESTION_IDS.education,
];

/**
 * Support rating text to numeric score mapping
 * Scale: 1-5 (higher is better)
 */
const RATING_MAP: Record<string, number> = {
  'exceeding expectations': 5,
  'very supportive': 4,
  'adequately supportive': 3,
  'mildly supportive': 2,
  'not applicable': 1,
};

/**
 * Map support rating text to numeric score
 */
function mapRatingToScore(answer: string | null): number | null {
  if (!answer) return null;
  const normalized = answer.toLowerCase().trim();
  return RATING_MAP[normalized] ?? null;
}

/**
 * Get dimension name from question ID
 */
function getDimensionFromQuestionId(questionId: number): string | null {
  if (RATING_QUESTION_IDS.provider.includes(questionId)) return 'Provider';
  if (RATING_QUESTION_IDS.staff.includes(questionId)) return 'Staff/Coach';
  if (RATING_QUESTION_IDS.curriculum.includes(questionId)) return 'Curriculum';
  return null;
}

/**
 * Get feedback type from question ID
 */
function getFeedbackType(questionId: number): 'improvement' | 'education' | null {
  if (TEXT_QUESTION_IDS.improvement.includes(questionId)) return 'improvement';
  if (TEXT_QUESTION_IDS.education.includes(questionId)) return 'education';
  return null;
}

/**
 * Generate a unique hash for duplicate detection
 */
function generateReferenceHash(leadId: number, questionId: number, dateStr: string): string {
  const dateOnly = dateStr.split('T')[0]; // Just the date part
  return `SURVEY-${leadId}-${questionId}-${dateOnly}`;
}

/**
 * Check if feedback text is a non-actionable response (e.g., "none", "n/a")
 * Returns true if the response should be SKIPPED
 */
function isNonActionableFeedback(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  
  // Common non-answer patterns
  const nonAnswers = [
    'none',
    'n/a',
    'na',
    'no',
    'nope',
    'nothing',
    'none at this time',
    'no suggestions',
    'no comment',
    'no comments',
    'not applicable',
    'not at this time',
    'all good',
    'all is good',
    'none needed',
    'none right now',
    '-',
    '.',
    'x',
  ];
  
  // Check exact matches
  if (nonAnswers.includes(normalized)) {
    return true;
  }
  
  // Very short responses (< 5 chars) are likely not actionable
  if (normalized.length < 5) {
    return true;
  }
  
  return false;
}

interface ProcessResult {
  notes_created: number;
  alerts_created: number;
  duplicates_skipped: number;
  errors: string[];
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { import_batch_id } = await req.json();
    
    if (!import_batch_id) {
      return new Response(
        JSON.stringify({ error: 'Missing import_batch_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing feedback alerts for import_batch_id: ${import_batch_id}`);

    const result = await processFeedbackAlerts(supabase, import_batch_id);

    console.log('Feedback alert processing complete:', result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Feedback alert processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Processing failed', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function processFeedbackAlerts(supabase: any, importBatchId: number): Promise<ProcessResult> {
  const result: ProcessResult = {
    notes_created: 0,
    alerts_created: 0,
    duplicates_skipped: 0,
    errors: [],
  };

  // Step 1: Get Manager, Provider, and Nutritionist role IDs
  const { data: roles, error: roleError } = await supabase
    .from('program_roles')
    .select('program_role_id, role_name')
    .in('role_name', ['Manager', 'Provider', 'Nutritionist']);

  if (roleError || !roles || roles.length < 3) {
    console.error('Failed to find required roles:', roleError);
    result.errors.push('Required roles not found');
    return result;
  }

  const managerRoleId = roles.find((r: any) => r.role_name === 'Manager')?.program_role_id;
  const providerRoleId = roles.find((r: any) => r.role_name === 'Provider')?.program_role_id;
  const nutritionistRoleId = roles.find((r: any) => r.role_name === 'Nutritionist')?.program_role_id;
  
  if (!managerRoleId || !providerRoleId || !nutritionistRoleId) {
    result.errors.push('Manager, Provider, or Nutritionist role not found');
    return result;
  }
  
  console.log(`Role IDs - Manager: ${managerRoleId}, Provider: ${providerRoleId}, Nutritionist: ${nutritionistRoleId}`);

  // Step 2: Get all sessions from this import batch with lead info
  const { data: sessions, error: sessionsError } = await supabase
    .from('survey_response_sessions')
    .select(`
      session_id,
      lead_id,
      completed_on,
      survey_forms!inner(form_name)
    `)
    .eq('import_batch_id', importBatchId);

  if (sessionsError) {
    console.error('Failed to fetch sessions:', sessionsError);
    result.errors.push(`Failed to fetch sessions: ${sessionsError.message}`);
    return result;
  }

  if (!sessions || sessions.length === 0) {
    console.log('No sessions found for this import batch');
    return result;
  }

  console.log(`Found ${sessions.length} sessions to process`);

  // Build session map for quick lookup
  const sessionMap = new Map(
    sessions.map((s: any) => [s.session_id, {
      lead_id: s.lead_id,
      completed_on: s.completed_on,
      form_name: s.survey_forms.form_name,
    }])
  );

  // Get all lead IDs to fetch names
  const leadIds = [...new Set(sessions.map((s: any) => s.lead_id))];
  
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('lead_id, first_name, last_name')
    .in('lead_id', leadIds);

  if (leadsError) {
    console.error('Failed to fetch leads:', leadsError);
    result.errors.push(`Failed to fetch leads: ${leadsError.message}`);
    return result;
  }

  const leadMap = new Map(
    (leads || []).map((l: any) => [l.lead_id, `${l.first_name} ${l.last_name}`])
  );

  const sessionIds = sessions.map((s: any) => s.session_id);

  // Step 3: Get rating responses
  const { data: ratingResponses, error: ratingError } = await supabase
    .from('survey_responses')
    .select('session_id, question_id, answer_text')
    .in('session_id', sessionIds)
    .in('question_id', ALL_RATING_IDS);

  if (ratingError) {
    console.error('Failed to fetch rating responses:', ratingError);
    result.errors.push(`Failed to fetch rating responses: ${ratingError.message}`);
  }

  // Step 4: Get text feedback responses
  const { data: textResponses, error: textError } = await supabase
    .from('survey_responses')
    .select('session_id, question_id, answer_text')
    .in('session_id', sessionIds)
    .in('question_id', ALL_TEXT_IDS);

  if (textError) {
    console.error('Failed to fetch text responses:', textError);
    result.errors.push(`Failed to fetch text responses: ${textError.message}`);
  }

  // Step 5: Process rating responses for low scores
  for (const response of (ratingResponses || [])) {
    const score = mapRatingToScore(response.answer_text);
    if (score === null || score >= 3) continue; // Only alert on scores < 3

    const sessionData = sessionMap.get(response.session_id);
    if (!sessionData) continue;

    const dimension = getDimensionFromQuestionId(response.question_id);
    if (!dimension) continue;

    const memberName = leadMap.get(sessionData.lead_id) || 'Unknown Member';
    const dateStr = new Date(sessionData.completed_on).toLocaleDateString();
    const refHash = generateReferenceHash(sessionData.lead_id, response.question_id, sessionData.completed_on);

    // Check for duplicate
    const { data: existingNote } = await supabase
      .from('lead_notes')
      .select('note_id')
      .eq('lead_id', sessionData.lead_id)
      .ilike('note', `%[REF:${refHash}]%`)
      .maybeSingle();

    if (existingNote) {
      result.duplicates_skipped++;
      continue;
    }

    // Create note
    const noteContent = `${memberName} - ${dateStr}\nLow rating for ${dimension}.\nReview responses in Member Feedback report.\n[REF:${refHash}]`;
    
    const { data: newNote, error: noteError } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: sessionData.lead_id,
        note_type: 'Challenge',
        note: noteContent,
      })
      .select('note_id')
      .single();

    if (noteError) {
      console.error('Failed to create note:', noteError);
      result.errors.push(`Failed to create note for ${memberName}: ${noteError.message}`);
      continue;
    }

    result.notes_created++;

    // Create notification
    // Provider low ratings go to Provider role, all others go to Manager
    const alertTitle = `Low Rating: ${dimension}`;
    const targetRoleId = dimension === 'Provider' ? providerRoleId : managerRoleId;
    
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        lead_id: sessionData.lead_id,
        title: alertTitle,
        message: noteContent,
        priority: 'urgent',
        target_role_ids: [targetRoleId],
        source_note_id: newNote.note_id,
        status: 'active',
        created_by: SYSTEM_USER_ID,
      });

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      result.errors.push(`Failed to create notification for ${memberName}: ${notifError.message}`);
      continue;
    }

    result.alerts_created++;
    console.log(`Created alert: ${alertTitle} for ${memberName}`);
  }

  // Step 6: Process text feedback responses
  for (const response of (textResponses || [])) {
    // Skip empty or non-actionable responses (e.g., "none", "n/a")
    if (!response.answer_text || response.answer_text.trim().length === 0) continue;
    if (isNonActionableFeedback(response.answer_text)) {
      console.log(`Skipping non-actionable feedback: "${response.answer_text}"`);
      continue;
    }

    const sessionData = sessionMap.get(response.session_id);
    if (!sessionData) continue;

    const feedbackType = getFeedbackType(response.question_id);
    if (!feedbackType) continue;

    const memberName = leadMap.get(sessionData.lead_id) || 'Unknown Member';
    const dateStr = new Date(sessionData.completed_on).toLocaleDateString();
    const refHash = generateReferenceHash(sessionData.lead_id, response.question_id, sessionData.completed_on);

    // Check for duplicate
    const { data: existingNote } = await supabase
      .from('lead_notes')
      .select('note_id')
      .eq('lead_id', sessionData.lead_id)
      .ilike('note', `%[REF:${refHash}]%`)
      .maybeSingle();

    if (existingNote) {
      result.duplicates_skipped++;
      continue;
    }

    // Create note
    const noteContent = `${memberName} - ${dateStr}\nFeedback provided.\nReview responses in Member Feedback report.\n[REF:${refHash}]`;
    
    const { data: newNote, error: noteError } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: sessionData.lead_id,
        note_type: 'Challenge',
        note: noteContent,
      })
      .select('note_id')
      .single();

    if (noteError) {
      console.error('Failed to create note:', noteError);
      result.errors.push(`Failed to create note for ${memberName}: ${noteError.message}`);
      continue;
    }

    result.notes_created++;

    // Create notification - priority based on feedback type
    const alertTitle = 'Feedback Provided';
    const priority = feedbackType === 'improvement' ? 'high' : 'normal';
    
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        lead_id: sessionData.lead_id,
        title: alertTitle,
        message: noteContent,
        priority: priority,
        target_role_ids: [managerRoleId],
        source_note_id: newNote.note_id,
        status: 'active',
        created_by: SYSTEM_USER_ID,
      });

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      result.errors.push(`Failed to create notification for ${memberName}: ${notifError.message}`);
      continue;
    }

    result.alerts_created++;
    console.log(`Created alert: ${alertTitle} (${feedbackType}) for ${memberName}`);
  }

  // Step 7: Process overdue module alerts
  // Only for members with ACTIVE programs (program_status_id = 1)
  console.log('Checking for overdue modules (Active programs only)...');
  
  // First, get lead_ids that have an active program
  const { data: activePrograms, error: activeProgramsError } = await supabase
    .from('member_programs')
    .select('lead_id')
    .eq('program_status_id', 1)  // Active status
    .in('lead_id', leadIds);

  if (activeProgramsError) {
    console.error('Failed to fetch active programs:', activeProgramsError);
    result.errors.push(`Failed to fetch active programs: ${activeProgramsError.message}`);
  }

  const activeLeadIds = activePrograms ? [...new Set(activePrograms.map((p: any) => p.lead_id))] : [];
  console.log(`Found ${activeLeadIds.length} members with active programs out of ${leadIds.length} total`);

  // Skip if no active programs
  if (activeLeadIds.length === 0) {
    console.log('No active programs found, skipping overdue module alerts');
    return result;
  }
  
  const { data: progressSummaries, error: progressError } = await supabase
    .from('member_progress_summary')
    .select('lead_id, overdue_milestones')
    .in('lead_id', activeLeadIds)  // Only active program members
    .not('overdue_milestones', 'is', null);

  if (progressError) {
    console.error('Failed to fetch progress summaries:', progressError);
    result.errors.push(`Failed to fetch progress summaries: ${progressError.message}`);
  } else if (progressSummaries && progressSummaries.length > 0) {
    // Process ONE consolidated alert per member (not per module)
    for (const summary of progressSummaries) {
      // Parse overdue_milestones (stored as JSON string or array)
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

      // ONE alert per member - reference hash does not include module name
      const refHash = `OVERDUE-${summary.lead_id}`;

      // Check for ACTIVE notification (not dismissed)
      // This allows new alerts after user dismisses the previous one
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

      // Build consolidated message with all overdue modules
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

      // Create notification - urgent priority, target Nutritionist and Manager
      const alertTitle = 'Member is behind on their education';

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          lead_id: summary.lead_id,
          title: alertTitle,
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
  }

  return result;
}

