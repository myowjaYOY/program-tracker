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

    // Enrich notes with user email information
    const enrichedNotes = (notes || []).map((note: any) => ({
      ...note,
      created_by_email: userMap.get(note.created_by)?.email || null,
      created_by_name: userMap.get(note.created_by)?.full_name || null,
    }));

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

    return NextResponse.json({ data: newNote }, { status: 201 });
  } catch (error) {
    console.error('Lead notes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
