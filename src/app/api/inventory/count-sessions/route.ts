import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { countSessionSchema, startCountSessionSchema } from '@/lib/validations/inventory-count';

/**
 * GET /api/inventory/count-sessions
 * Fetch all count sessions with optional status filter
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get('status');

  try {
    let query = supabase
      .from('inventory_count_sessions')
      .select(`
        *,
        counted_by_user:users!counted_by (
          id,
          full_name,
          email
        )
      `)
      .order('session_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching count sessions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching count sessions:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/count-sessions
 * Create a new count session with items
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parse = startCountSessionSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { count_type, session_date, notes, selected_item_ids } = parse.data;

    // Step 1: Create the count session
    const { data: session, error: sessionError } = await supabase
      .from('inventory_count_sessions')
      .insert([
        {
          session_date,
          count_type,
          status: 'in_progress',
          counted_by: user.id,
          notes: notes || null,
          started_at: new Date().toISOString(), // Track when count session started
          created_by: user.id,
          updated_by: user.id,
        },
      ])
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating count session:', sessionError);
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 }
      );
    }

    // Step 2: Determine which items to include
    let itemsQuery = supabase
      .from('inventory_items')
      .select('inventory_item_id, therapy_id, quantity_on_hand')
      .eq('active_flag', true);

    if (count_type === 'custom' && selected_item_ids && selected_item_ids.length > 0) {
      itemsQuery = itemsQuery.in('inventory_item_id', selected_item_ids);
    }

    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) {
      console.error('Error fetching inventory items:', itemsError);
      // Clean up the session
      await supabase
        .from('inventory_count_sessions')
        .delete()
        .eq('count_session_id', session.count_session_id);
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    // Step 3: Create count details for each item
    const countDetails = items.map((item) => ({
      count_session_id: session.count_session_id,
      inventory_item_id: item.inventory_item_id,
      expected_quantity: item.quantity_on_hand,
      status: 'pending',
    }));

    const { error: detailsError } = await supabase
      .from('inventory_count_details')
      .insert(countDetails);

    if (detailsError) {
      console.error('Error creating count details:', detailsError);
      // Clean up the session
      await supabase
        .from('inventory_count_sessions')
        .delete()
        .eq('count_session_id', session.count_session_id);
      return NextResponse.json(
        { error: detailsError.message },
        { status: 500 }
      );
    }

    // Step 4: Update session items_total
    await supabase
      .from('inventory_count_sessions')
      .update({ items_total: items.length })
      .eq('count_session_id', session.count_session_id);

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating count session:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}



