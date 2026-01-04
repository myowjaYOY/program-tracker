// src/app/api/member-programs/[id]/schedule/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Single optimized query via VIEW
    const { data, error } = await supabase
      .from('v_member_program_schedule')
      .select(`
        member_program_item_schedule_id,
        member_program_item_id,
        instance_number,
        scheduled_date,
        completed_flag,
        created_at,
        created_by,
        updated_at,
        updated_by,
        therapy_name,
        therapy_type_name,
        created_by_email,
        created_by_full_name,
        updated_by_email,
        updated_by_full_name
      `)
      .eq('member_program_id', id)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Schedule query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Schedule route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
