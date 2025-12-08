import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { leadNoteSchema } from '@/lib/validations/lead-notes';

// GET /api/lead-notes?lead_id=123
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // Fetch notes for the specific lead
    const { data: notes, error } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', parseInt(leadId))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lead notes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch lead notes' },
        { status: 500 }
      );
    }


    // Get unique user IDs from notes
    const userIds = Array.from(
      new Set((notes || []).map((note: any) => note.created_by).filter(Boolean))
    );

    // Fetch user email information
    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);
      users = usersData || [];
    }

    const userMap = new Map(users.map(u => [u.id, u]));

    // Get note IDs to check for alert associations
    const noteIds = (notes || []).map((note: any) => note.note_id);
    
    // Maps to store note_id -> notification info relationships
    let sourceNoteToAlert: Map<number, { id: number; roles: string[] }> = new Map();
    let responseNoteToAlert: Map<number, { id: number; roles: string[] }> = new Map();
    
    if (noteIds.length > 0) {
      // Get all role names for lookup
      const { data: allRoles } = await supabase
        .from('program_roles')
        .select('program_role_id, role_name');
      const roleMap = new Map((allRoles || []).map((r: any) => [r.program_role_id, r.role_name]));
      
      // Get notes that created alerts (source notes) with notification_id and target_role_ids
      const { data: sourceNotifications } = await supabase
        .from('notifications')
        .select('notification_id, source_note_id, target_role_ids')
        .in('source_note_id', noteIds);
      
      (sourceNotifications || []).forEach((n: any) => {
        if (n.source_note_id) {
          const roleNames = (n.target_role_ids || []).map((id: number) => roleMap.get(id) || `Role ${id}`);
          sourceNoteToAlert.set(n.source_note_id, { id: n.notification_id, roles: roleNames });
        }
      });
      
      // Get notes that acknowledged alerts (response notes) with notification_id and target_role_ids
      const { data: responseNotifications } = await supabase
        .from('notifications')
        .select('notification_id, response_note_id, target_role_ids')
        .in('response_note_id', noteIds);
      
      (responseNotifications || []).forEach((n: any) => {
        if (n.response_note_id) {
          const roleNames = (n.target_role_ids || []).map((id: number) => roleMap.get(id) || `Role ${id}`);
          responseNoteToAlert.set(n.response_note_id, { id: n.notification_id, roles: roleNames });
        }
      });
    }

    // Enrich notes with user email information, BaseEntity fields, and alert info
    const enrichedNotes = (notes || []).map((note: any) => {
      const sourceAlert = sourceNoteToAlert.get(note.note_id);
      const responseAlert = responseNoteToAlert.get(note.note_id);
      
      return {
        ...note,
        id: note.note_id.toString(), // BaseEntity requires string id
        active_flag: true, // BaseEntity requires active_flag
        updated_at: note.created_at, // BaseEntity requires updated_at (using created_at as fallback)
        created_by_email: userMap.get(note.created_by)?.email || null,
        created_by_name: userMap.get(note.created_by)?.full_name || null,
        is_alert_source: !!sourceAlert,
        is_alert_response: !!responseAlert,
        alert_id: sourceAlert?.id || responseAlert?.id || null,
        alert_roles: sourceAlert?.roles || responseAlert?.roles || null,
      };
    });

    return NextResponse.json({ data: enrichedNotes });
  } catch (error) {
    console.error('Lead notes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/lead-notes
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validationResult = leadNoteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { lead_id, note_type, note } = validationResult.data;

    // Insert new note
    const { data: newNote, error } = await supabase
      .from('lead_notes')
      .insert({
        lead_id,
        note_type,
        note,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead note:', error);
      return NextResponse.json(
        { error: 'Failed to create lead note' },
        { status: 500 }
      );
    }

    // Enrich the new note with BaseEntity fields
    const enrichedNote = {
      ...newNote,
      id: newNote.note_id.toString(), // BaseEntity requires string id
      active_flag: true, // BaseEntity requires active_flag
      updated_at: newNote.created_at, // BaseEntity requires updated_at (using created_at as fallback)
      created_by_email: null, // Will be populated on next fetch
      created_by_name: null, // Will be populated on next fetch
    };

    return NextResponse.json({ data: enrichedNote }, { status: 201 });
  } catch (error) {
    console.error('Lead notes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
