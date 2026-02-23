/**
 * Server-side data fetching utilities for Leads
 * 
 * These functions are used in Server Components to fetch data on the server,
 * enabling SSR and faster initial page loads.
 */

import { createClient } from '@/lib/supabase/server';
import type { Leads } from '@/types/database.types';

export interface LeadWithMetadata extends Leads {
  created_by_email: string | null;
  created_by_name: string | null;
  updated_by_email: string | null;
  updated_by_name: string | null;
  campaign_name: string | null;
  status_name: string | null;
  note_count: number;
  last_followup_note: string | null;
}

/**
 * Fetch all leads with related metadata (server-side)
 * Optimized to reduce N+1 queries by fetching related data in parallel
 */
export async function getLeads(): Promise<LeadWithMetadata[]> {
  const supabase = await createClient();
  
  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // OPTIMIZED: Fetch leads with related data in parallel
  const [leadsResult, notesResult, followUpNotesResult] = await Promise.all([
    // Main leads query with joins
    supabase.from('leads').select(`*,
      created_user:users!leads_created_by_fkey(id,email,full_name),
      updated_user:users!leads_updated_by_fkey(id,email,full_name),
      campaign:campaigns!leads_campaign_id_fkey(campaign_id,campaign_name),
      status:status!leads_status_id_fkey(status_id,status_name)
    `),
    // Fetch all notes for counting (single query instead of per-lead)
    supabase
      .from('lead_notes')
      .select('lead_id')
      .not('lead_id', 'is', null),
    // Fetch follow-up notes with ordering (single query, filter in memory)
    supabase
      .from('lead_notes')
      .select('lead_id, note, created_at')
      .eq('note_type', 'Follow-Up')
      .order('created_at', { ascending: false }),
  ]);

  if (leadsResult.error) {
    throw new Error(leadsResult.error.message);
  }

  const data = leadsResult.data || [];
  const leadIds = data.map((lead: any) => lead.lead_id).filter(Boolean);
  
  // Build note counts map (single pass)
  const noteCounts: Record<number, number> = {};
  if (notesResult.data && leadIds.length > 0) {
    notesResult.data.forEach((note: any) => {
      if (leadIds.includes(note.lead_id)) {
        noteCounts[note.lead_id] = (noteCounts[note.lead_id] || 0) + 1;
      }
    });
  }

  // Build last follow-up note map (single pass, most recent first)
  const lastFollowUpNotes: Record<number, string> = {};
  if (followUpNotesResult.data && leadIds.length > 0) {
    followUpNotesResult.data.forEach((note: any) => {
      if (leadIds.includes(note.lead_id) && !lastFollowUpNotes[note.lead_id]) {
        lastFollowUpNotes[note.lead_id] = note.note;
      }
    });
  }

  return data.map(lead => ({
    ...lead,
    created_by_email: lead.created_user?.email || null,
    created_by_name: lead.created_user?.full_name || null,
    updated_by_email: lead.updated_user?.email || null,
    updated_by_name: lead.updated_user?.full_name || null,
    campaign_name: lead.campaign?.campaign_name || null,
    status_name: lead.status?.status_name || null,
    note_count: noteCounts[lead.lead_id] || 0,
    last_followup_note: lastFollowUpNotes[lead.lead_id] || null,
  }));
}
