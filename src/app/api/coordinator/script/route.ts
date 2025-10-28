import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

// GET /api/coordinator/script?memberId=&range=today|week|month|all&start=&end=
// Returns schedule rows for Active programs only.
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
  const showCompleted = searchParams.get('showCompleted') === 'true';
  const hideMissed = searchParams.get('hideMissed') === 'true';

  try {
    // Get Active program IDs using centralized service (default: Active only)
    const programIds = await ProgramStatusService.getValidProgramIds(
      supabase,
      memberId ? { memberId: Number(memberId) } : undefined
    );
    if (programIds.length === 0) return NextResponse.json({ data: [] });

    // Fetch program details for enrichment
    const { data: programs, error: progErr } = await supabase
      .from('member_programs')
      .select(`
        member_program_id,
        lead_id,
        program_status_id,
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name)
      `)
      .in('member_program_id', programIds);
    if (progErr)
      return NextResponse.json(
        { error: 'Failed to load programs' },
        { status: 500 }
      );
    const validPrograms = programs || [];

    const { data: items, error: itemErr } = await supabase
      .from('member_program_items')
      .select(
        'member_program_item_id, member_program_id, therapies(therapy_name, therapytype(therapy_type_name))'
      )
      .in('member_program_id', programIds);
    if (itemErr)
      return NextResponse.json(
        { error: 'Failed to load items' },
        { status: 500 }
      );
    const itemIds = (items || []).map((r: any) => r.member_program_item_id);

    let schedQuery = supabase
      .from('member_program_item_schedule')
      .select(
        'member_program_item_schedule_id, member_program_item_id, instance_number, scheduled_date, completed_flag, created_at, created_by, updated_at, updated_by, program_role_id, program_role:program_roles(program_role_id, role_name, display_color)'
      )
      .in('member_program_item_id', itemIds)
      .order('scheduled_date', { ascending: true });

    // Filter by completed_flag
    if (showCompleted && hideMissed) {
      // Show completed + pending (exclude missed)
      schedQuery = schedQuery.or('completed_flag.is.null,completed_flag.eq.true');
    } else if (showCompleted) {
      // Show everything (pending + missed + completed)
      // No filter needed - show all
    } else if (hideMissed) {
      // Show only pending items (exclude missed and completed)
      schedQuery = schedQuery.is('completed_flag', null);
    } else {
      // Default: Show pending + missed (exclude completed)
      schedQuery = schedQuery.or('completed_flag.is.null,completed_flag.eq.false');
    }

    // Date filtering for script view: if range is not 'all'
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
    if (startStr) schedQuery = schedQuery.gte('scheduled_date', startStr);
    if (endStr) schedQuery = schedQuery.lte('scheduled_date', endStr);

    const { data: scheduleRows, error: schedErr } = await schedQuery;
    if (schedErr)
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      );

    const idToTherapy: Record<
      string,
      {
        therapy_name?: string | null;
        therapy_type_name?: string | null;
        member_program_id?: number | null;
      }
    > = {};
    (items || []).forEach((it: any) => {
      idToTherapy[String(it.member_program_item_id)] = {
        therapy_name: it.therapies?.therapy_name ?? null,
        therapy_type_name: it.therapies?.therapytype?.therapy_type_name ?? null,
        member_program_id: it.member_program_id ?? null,
      };
    });

    // Get status names for enrichment
    const { data: statuses } = await supabase
      .from('program_status')
      .select('program_status_id, status_name');
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

    // Enrich rows with therapy labels and audit email lookup
    const userIds = Array.from(
      new Set([
        ...(scheduleRows || []).map((r: any) => r.created_by).filter(Boolean),
        ...(scheduleRows || []).map((r: any) => r.updated_by).filter(Boolean),
      ] as any)
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

    // Create lead ID to program mapping for note counts
    const programIdToLeadId = new Map<number, number>(
      validPrograms.map((p: any) => [p.member_program_id as number, p.lead_id as number])
    );

    const enriched = (scheduleRows || []).map((r: any) => {
      const programId = idToTherapy[String(r.member_program_item_id)]?.member_program_id;
      const leadId = programId ? programIdToLeadId.get(programId) : null;
      
      return {
        ...r,
        therapy_name:
          idToTherapy[String(r.member_program_item_id)]?.therapy_name || null,
        therapy_type_name:
          idToTherapy[String(r.member_program_item_id)]?.therapy_type_name ||
          null,
        member_program_id:
          idToTherapy[String(r.member_program_item_id)]?.member_program_id ||
          null,
        lead_id: leadId,
        note_count: leadId ? (noteCounts[leadId] || 0) : 0,
        program_status_name: programId
          ? programIdToStatusName.get(programId) || null
          : null,
        member_name: programId
          ? programIdToMemberName.get(programId) || null
          : null,
        role_name: r.program_role?.role_name || null,
        role_display_color: r.program_role?.display_color || null,
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

    const response = NextResponse.json({ data: enriched });
    // Bust cache to ensure fresh data after role fixes
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
