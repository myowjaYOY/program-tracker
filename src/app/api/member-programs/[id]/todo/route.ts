import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    // Filter task schedule rows to the current program
    const { id } = await context.params;
    const { data: itemIdsData, error: itemErr } = await supabase
      .from('member_program_items')
      .select('member_program_item_id')
      .eq('member_program_id', id);
    if (itemErr)
      return NextResponse.json(
        { error: 'Failed to load items' },
        { status: 500 }
      );
    const itemIds = (itemIdsData || []).map(
      (r: any) => r.member_program_item_id
    );

    const { data: schedIdsData, error: schedErr } = await supabase
      .from('member_program_item_schedule')
      .select('member_program_item_schedule_id, member_program_item_id')
      .in('member_program_item_id', itemIds);
    if (schedErr)
      return NextResponse.json(
        { error: 'Failed to load item schedules' },
        { status: 500 }
      );
    const scheduleIds = (schedIdsData || []).map(
      (r: any) => r.member_program_item_schedule_id
    );

    const { data, error } = await supabase
      .from('member_program_items_task_schedule')
      .select(
        `
        member_program_item_task_schedule_id,
        member_program_item_schedule_id,
        member_program_item_task_id,
        due_date,
        completed_flag,
        created_at,
        created_by,
        updated_at,
        updated_by,
        member_program_item_tasks:member_program_item_task_id(
          task_name,
          description,
          task_delay,
          therapy_tasks:therapy_tasks!inner(
            therapies!inner(therapy_name, therapytype(therapy_type_name))
          )
        )
      `
      )
      .in('member_program_item_schedule_id', scheduleIds)
      .order('due_date', { ascending: true });

    if (error)
      return NextResponse.json(
        { error: 'Failed to fetch task schedule' },
        { status: 500 }
      );

    // Resolve user emails for audit fields
    const userIds = Array.from(
      new Set([
        ...(data || []).map((r: any) => r.created_by).filter(Boolean),
        ...(data || []).map((r: any) => r.updated_by).filter(Boolean),
      ])
    );

    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds as any);
      users = usersData || [];
    }
    const userMap = new Map(users.map(u => [u.id, u]));

    const enriched = (data || []).map((r: any) => {
      const createdUser = r.created_by ? userMap.get(r.created_by) : null;
      const updatedUser = r.updated_by ? userMap.get(r.updated_by) : null;
      return {
        ...r,
        created_by_email: createdUser?.email || null,
        created_by_full_name: createdUser?.full_name || null,
        updated_by_email: updatedUser?.email || null,
        updated_by_full_name: updatedUser?.full_name || null,
      };
    });

    return NextResponse.json({ data: enriched });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
