import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const { id } = await context.params;
  
  // Check if therapy exists in inventory_items with active_flag = true
  const { data, error } = await supabase
    .from('inventory_items')
    .select('inventory_item_id, active_flag')
    .eq('therapy_id', id)
    .single();

  if (error) {
    // If no record found, return tracked = false
    if (error.code === 'PGRST116') {
      return NextResponse.json({ tracked: false }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return tracked status based on active_flag
  return NextResponse.json({ tracked: data.active_flag || false }, { status: 200 });
}

