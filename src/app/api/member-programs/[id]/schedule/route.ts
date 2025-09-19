import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    // Step 1: get schedule rows for this program by joining to items to filter only ids
    const itemsRes = await supabase
      .from('member_program_items')
      .select('member_program_item_id')
      .eq('member_program_id', id);
    if (itemsRes.error) {
      return NextResponse.json({ error: 'Failed to load program items' }, { status: 500 });
    }
    const itemIds = (itemsRes.data || []).map((r: any) => r.member_program_item_id);

    const { data: scheduleRows, error: schedErr } = await supabase
      .from('member_program_item_schedule')
      .select('member_program_item_schedule_id, member_program_item_id, instance_number, scheduled_date, completed_flag')
      .in('member_program_item_id', itemIds)
      .order('scheduled_date', { ascending: true });
    if (schedErr) {
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    // Step 2: load therapy labels for those items
    const { data: itemDetails, error: detErr } = await supabase
      .from('member_program_items')
      .select(`member_program_item_id, therapies(therapy_name, therapytype(therapy_type_name))`)
      .in('member_program_item_id', itemIds);
    if (detErr) {
      return NextResponse.json({ error: 'Failed to load therapy details' }, { status: 500 });
    }
    const idToTherapy = new Map<string, { therapy_name: string | null; therapy_type_name: string | null }>();
    (itemDetails || []).forEach((row: any) => {
      const th = row.therapies || {};
      idToTherapy.set(String(row.member_program_item_id), {
        therapy_name: th.therapy_name ?? null,
        therapy_type_name: th.therapytype?.therapy_type_name ?? null,
      });
    });

    const flattened = (scheduleRows || []).map((r: any) => {
      const t = idToTherapy.get(String(r.member_program_item_id)) || { therapy_name: null, therapy_type_name: null };
      return { ...r, ...t };
    });

    return NextResponse.json({ data: flattened });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}


