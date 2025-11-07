import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/inventory/items
 * Fetch all inventory items with therapy details
 */
export async function GET() {
  const supabase = await createClient();

  // Authentication check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch inventory items with therapy information
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        therapy:therapies (
          therapy_id,
          therapy_name,
          description,
          cost,
          charge,
          therapy_type:therapytype (
            therapy_type_name
          )
        )
      `)
      .eq('active_flag', true)
      .order('therapy_id');

    if (error) {
      console.error('Error fetching inventory items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching inventory items:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}











