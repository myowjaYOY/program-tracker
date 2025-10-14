import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/coordinator/todo?memberId=&range=today|week|month|all&start=&end=
// Returns To Do rows across all programs except Cancelled/Completed.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  const range = (searchParams.get('range') || 'all').toLowerCase();
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    // Exclude Cancelled/Completed/Quote programs
    const { data: statuses } = await supabase
      .from('program_status')
      .select('program_status_id, status_name');
    const excluded = new Set(
      (statuses || [])
        .filter((s: any) =>
          ['cancelled', 'completed', 'quote'].includes(
            (s.status_name || '').toLowerCase()
          )
        )
        .map((s: any) => s.program_status_id)
    );

    // Programs filtered by member and status
    let progQuery = supabase.from('member_programs').select(`
        member_program_id,
        lead_id,
        program_status_id,
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name)
      `);
    if (memberId) {
      progQuery = progQuery.eq('lead_id', Number(memberId));
    }
    const { data: programs, error: progErr } = await progQuery;
    if (progErr)
      return NextResponse.json(
        { error: 'Failed to load programs' },
        { status: 500 }
      );
    const validPrograms = (programs || []).filter(
      (p: any) => !excluded.has(p.program_status_id)
    );
    const programIds = validPrograms.map((p: any) => p.member_program_id);
    if (programIds.length === 0) return NextResponse.json({ data: [] });

    // Items and schedules
    const { data: items, error: itemErr } = await supabase
      .from('member_program_items')
      .select('member_program_item_id, member_program_id')
      .in('member_program_id', programIds);
    if (itemErr)
      return NextResponse.json(
        { error: 'Failed to load items' },
        { status: 500 }
      );
    const itemIds = (items || []).map((r: any) => r.member_program_item_id);

    const schedQuery = supabase
      .from('member_program_item_schedule')
      .select('member_program_item_schedule_id, member_program_item_id')
      .in('member_program_item_id', itemIds);
    const { data: schedules, error: schedErr } = await schedQuery;
    if (schedErr)
      return NextResponse.json(
        { error: 'Failed to load item schedules' },
        { status: 500 }
      );
    const scheduleIds = (schedules || []).map(
      (r: any) => r.member_program_item_schedule_id
    );
    if (scheduleIds.length === 0) return NextResponse.json({ data: [] });

    // To Do query
    let todoQuery = supabase
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
      .in('member_program_item_schedule_id', scheduleIds);

    // Date range filter on due_date for To Do
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startStr =
      start ||
      (range === 'today'
        ? today.toISOString().slice(0, 10)
        : range === 'week'
          ? new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() - today.getDay()
            )
              .toISOString()
              .slice(0, 10)
          : range === 'month'
            ? new Date(today.getFullYear(), today.getMonth(), 1)
                .toISOString()
                .slice(0, 10)
            : undefined);
    const endStr =
      end ||
      (range === 'today'
        ? today.toISOString().slice(0, 10)
        : range === 'week'
          ? new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() - today.getDay() + 6
            )
              .toISOString()
              .slice(0, 10)
          : range === 'month'
            ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
                .toISOString()
                .slice(0, 10)
            : undefined);
    if (startStr) todoQuery = todoQuery.gte('due_date', startStr);
    if (endStr) todoQuery = todoQuery.lte('due_date', endStr);

    const { data, error } = await todoQuery;
    if (error)
      return NextResponse.json(
        { error: 'Failed to fetch task schedule' },
        { status: 500 }
      );

    // Enrich with audit emails
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

    // Get note counts for each lead
    const leadIds = Array.from(new Set(validPrograms.map((p: any) => p.lead_id).filter(Boolean)));
    let noteCounts: Record<number, number> = {};
    if (leadIds.length > 0) {
      const { data: notesData, error: notesError } = await supabase
        .from('lead_notes')
        .select('lead_id')
        .in('lead_id', leadIds);
      
      if (notesError) {
        console.error('Error fetching note counts:', notesError);
      }
      
      // Count notes per lead
      (notesData || []).forEach((note: any) => {
        noteCounts[note.lead_id] = (noteCounts[note.lead_id] || 0) + 1;
      });
    }

    // Build scheduleId -> program status name mapping
    const statusIdToName = new Map<number, string>(
      (statuses || []).map((s: any) => [
        s.program_status_id as number,
        (s.status_name || '').toLowerCase(),
      ])
    );
    const programIdToStatusName = new Map<number, string>(
      (validPrograms || []).map((p: any) => [
        p.member_program_id as number,
        statusIdToName.get(p.program_status_id) || '',
      ])
    );
    const programIdToMemberName = new Map<number, string>(
      (validPrograms || []).map((p: any) => {
        const fn = p.lead?.first_name || '';
        const ln = p.lead?.last_name || '';
        const name = `${fn} ${ln}`.trim();
        return [p.member_program_id as number, name || `Lead #${p.lead_id}`];
      })
    );
    const itemIdToProgramId = new Map<number, number>(
      (items || []).map((it: any) => [
        it.member_program_item_id as number,
        it.member_program_id as number,
      ])
    );
    const schedIdToProgramId = new Map<number, number>(
      (schedules || []).map((s: any) => [
        s.member_program_item_schedule_id as number,
        itemIdToProgramId.get(s.member_program_item_id) as number,
      ])
    );

    // Create lead ID to program mapping for note counts
    const programIdToLeadId = new Map<number, number>(
      validPrograms.map((p: any) => [p.member_program_id as number, p.lead_id as number])
    );

    const enriched = (data || []).map((r: any) => {
      const programId =
        schedIdToProgramId.get(r.member_program_item_schedule_id as number) ||
        null;
      const programStatusName = programId
        ? programIdToStatusName.get(programId) || null
        : null;
      const leadId = programId ? programIdToLeadId.get(programId) : null;
      
      return {
        ...r,
        member_program_id: programId,
        lead_id: leadId,
        note_count: leadId ? (noteCounts[leadId] || 0) : 0,
        program_status_name: programStatusName,
        member_name: programId
          ? programIdToMemberName.get(programId) || null
          : null,
        created_by_email: r.created_by
          ? userMap.get(r.created_by)?.email || null
          : null,
        created_by_full_name: r.created_by
          ? userMap.get(r.created_by)?.full_name || null
          : null,
        updated_by_email: r.updated_by
          ? userMap.get(r.updated_by)?.email || null
          : null,
        updated_by_full_name: r.updated_by
          ? userMap.get(r.updated_by)?.full_name || null
          : null,
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
