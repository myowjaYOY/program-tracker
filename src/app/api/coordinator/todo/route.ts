import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

// GET /api/coordinator/todo?memberId=&range=today|week|month|all&start=&end=
// Returns To Do rows for Active programs only.
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
  const showMissed = searchParams.get('showMissed') === 'true';

  try {
    // Get Active program IDs using centralized service (default: Active only)
    const programIds = await ProgramStatusService.getValidProgramIds(
      supabase,
      memberId ? { memberId: Number(memberId) } : undefined
    );
    if (programIds.length === 0) return NextResponse.json({ data: [] });

    // Query optimized view - filters by program_id (44 IDs) instead of schedule_id (2000+ IDs)
    let todoQuery = supabase
      .from('vw_coordinator_task_schedule')
      .select('*')
      .in('member_program_id', programIds);

    // Filter by completed_flag
    // Default behavior: hide missed and completed, show only pending
    if (showCompleted && showMissed) {
      // Show everything (pending + missed + completed)
      // No filter needed - show all
    } else if (showCompleted && !showMissed) {
      // Show completed + pending (exclude missed)
      todoQuery = todoQuery.or('completed_flag.is.null,completed_flag.eq.true');
    } else if (!showCompleted && showMissed) {
      // Show pending + missed (exclude completed)
      todoQuery = todoQuery.or('completed_flag.is.null,completed_flag.eq.false');
    } else {
      // Default: Show only pending items (exclude missed and completed)
      todoQuery = todoQuery.is('completed_flag', null);
    }

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

    // Enrich with audit emails and note counts
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

    // Get note counts for each lead (from view data)
    const leadIds = Array.from(new Set((data || []).map((r: any) => r.lead_id).filter(Boolean)));
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

    // Transform flat view data into nested structure expected by frontend
    const enriched = (data || []).map((r: any) => {
      return {
        // Base fields from view
        member_program_item_task_schedule_id: r.member_program_item_task_schedule_id,
        member_program_item_schedule_id: r.member_program_item_schedule_id,
        member_program_item_task_id: r.member_program_item_task_id,
        due_date: r.due_date,
        completed_flag: r.completed_flag,
        created_at: r.created_at,
        created_by: r.created_by,
        updated_at: r.updated_at,
        updated_by: r.updated_by,
        program_role_id: r.program_role_id,
        
        // Transform flat columns into nested structure for frontend
        member_program_item_tasks: {
          task_name: r.task_name,
          description: r.task_description,
          task_delay: r.task_delay,
          therapy_tasks: {
            therapies: {
              therapy_name: r.therapy_name,
              therapytype: {
                therapy_type_name: r.therapy_type_name
              }
            }
          }
        },
        
        // Transform role into nested structure
        program_role: {
          role_name: r.role_name,
          display_color: r.role_display_color
        },
        
        // Enrichment fields from view
        member_program_id: r.member_program_id,
        lead_id: r.lead_id,
        program_status_name: r.program_status_name,
        member_name: r.member_name,
        instance_number: r.instance_number,
        script_scheduled_date: r.script_scheduled_date,
        note_count: r.lead_id ? (noteCounts[r.lead_id] || 0) : 0,
        
        // Audit enrichment
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
