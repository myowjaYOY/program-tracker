import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { response_note_id } = body;

  // Validate required fields - must provide a note when acknowledging
  if (!response_note_id) {
    return NextResponse.json(
      { error: 'response_note_id is required - you must create a note when acknowledging' },
      { status: 400 }
    );
  }

  // Verify the notification exists and is active
  const { data: notification, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('notification_id', id)
    .single();

  if (fetchError || !notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  if (notification.status !== 'active') {
    return NextResponse.json(
      { error: 'Notification has already been acknowledged' },
      { status: 400 }
    );
  }

  // Verify the response note exists
  const { data: note, error: noteError } = await supabase
    .from('lead_notes')
    .select('note_id')
    .eq('note_id', response_note_id)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: 'Response note not found' }, { status: 400 });
  }

  // Update the notification
  const { data: updatedNotification, error: updateError } = await supabase
    .from('notifications')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user.id,
      response_note_id,
    })
    .eq('notification_id', id)
    .select(`
      *,
      lead:leads(lead_id, first_name, last_name),
      creator:users!notifications_created_by_fkey(id, full_name, email),
      acknowledger:users!notifications_acknowledged_by_fkey(id, full_name, email),
      response_note:lead_notes!notifications_response_note_id_fkey(note_id, note, note_type)
    `)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ data: updatedNotification });
}











