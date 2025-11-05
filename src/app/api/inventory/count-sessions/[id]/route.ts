import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { countSessionUpdateSchema } from '@/lib/validations/inventory-count';

/**
 * GET /api/inventory/count-sessions/[id]
 * Fetch a single count session with all details
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Fetch session with details
    const { data: session, error: sessionError } = await supabase
      .from('inventory_count_sessions')
      .select(`
        *,
        counted_by_user:users!counted_by (
          id,
          full_name,
          email
        )
      `)
      .eq('count_session_id', id)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Count session not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching count session:', sessionError);
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 }
      );
    }

    // Fetch count details with inventory items
    const { data: details, error: detailsError } = await supabase
      .from('inventory_count_details')
      .select(`
        *,
        inventory_item:inventory_items (
          inventory_item_id,
          therapy_id,
          quantity_on_hand,
          therapy:therapies (
            therapy_name,
            therapy_type:therapytype (
              therapy_type_name
            )
          )
        ),
        approved_by_user:users!approved_by (
          id,
          full_name,
          email
        )
      `)
      .eq('count_session_id', id)
      .order('count_detail_id');

    if (detailsError) {
      console.error('Error fetching count details:', detailsError);
      return NextResponse.json(
        { error: detailsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: { ...session, details: details || [] } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error fetching count session:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/count-sessions/[id]
 * Update a count session (status, notes, etc.)
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parse = countSessionUpdateSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    // If status is being set to 'completed', set completed_at
    const updateData: any = { ...parse.data, updated_by: user.id };
    if (parse.data.status === 'completed' && !parse.data.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('inventory_count_sessions')
      .update(updateData)
      .eq('count_session_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Count session not found' },
          { status: 404 }
        );
      }
      console.error('Error updating count session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error updating count session:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/count-sessions/[id]
 * Cancel a count session (soft delete - sets status to 'cancelled')
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Check if session is already completed
    const { data: session, error: fetchError } = await supabase
      .from('inventory_count_sessions')
      .select('status')
      .eq('count_session_id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Count session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed count session' },
        { status: 400 }
      );
    }

    // Cancel the session
    const { data, error } = await supabase
      .from('inventory_count_sessions')
      .update({ status: 'cancelled', updated_by: user.id })
      .eq('count_session_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling count session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error cancelling count session:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}



