import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/coordinator/program-changes?range=today|week|month|all|custom&start=&end=&unique_only=true&limit=7
// Returns rows from vw_audit_member_changes; supports unique grouping and limiting
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
  const range = (searchParams.get('range') || 'all').toLowerCase();
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const sourcesParam = searchParams.get('sources');
  const uniqueOnly = searchParams.get('unique_only') === 'true';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    let query = supabase
      .from('vw_audit_member_changes')
      .select('*')
      .order('changed_at', { ascending: false });

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
    if (startStr) query = query.gte('changed_at', startStr);
    if (endStr) query = query.lte('changed_at', endStr);

    // Filter by sources if provided (values are display names in the view)
    if (sourcesParam) {
      const list = sourcesParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (list.length > 0) {
        query = query.in('source', list);
      }
    }

    const { data, error } = await query;
    if (error)
      return NextResponse.json(
        {
          error: 'Failed to fetch program changes',
          details: (error as any)?.message ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 500 }
      );

    let rows = (data as any[]) || [];

    // Filter for Active and Paused programs only (IDs 1 and 3)
    if (rows.length > 0) {
      try {
        // Get Active and Paused program status IDs
        const { data: statusData, error: statusError } = await supabase
          .from('program_status')
          .select('program_status_id, status_name')
          .in('status_name', ['Active', 'Paused']);

        if (statusError) {
          // Continue with unfiltered data if status fetch fails
        } else {
          const activeAndPausedStatusIds = statusData?.map(s => s.program_status_id) || [];
          
          // Get member programs with their status IDs
          const programIds = [...new Set(rows.map(r => r.program_id).filter(Boolean))];
          if (programIds.length > 0) {
            const { data: memberPrograms, error: programsError } = await supabase
              .from('member_programs')
              .select('member_program_id, program_status_id')
              .in('member_program_id', programIds);

            if (programsError) {
              // Continue with unfiltered data if member programs fetch fails
            } else if (memberPrograms) {
              // Filter to only include Active and Paused programs
              const activePausedProgramIds = memberPrograms
                .filter(mp => activeAndPausedStatusIds.includes(mp.program_status_id))
                .map(mp => mp.member_program_id);

              // Filter rows to only include Active/Paused programs
              rows = rows.filter(row => activePausedProgramIds.includes(row.program_id));
            }
          }
        }
      } catch (error) {
        // Continue with unfiltered data if filtering fails
      }
    }

    // Handle unique grouping if requested
    if (uniqueOnly) {
      // Group by member_id + program_id, take most recent change per program
      const grouped = new Map<string, any>();
      
      rows.forEach(row => {
        if (row.member_id && row.program_id) {
          const key = `${row.member_id}-${row.program_id}`;
          const existing = grouped.get(key);
          
          if (!existing || new Date(row.changed_at) > new Date(existing.changed_at)) {
            grouped.set(key, row);
          }
        }
      });
      
      rows = Array.from(grouped.values());
    }

    // Apply limit if specified
    if (limit && limit > 0) {
      rows = rows.slice(0, limit);
    }

    // For unique_only mode, return simplified structure
    if (uniqueOnly) {
      const simplified = rows.map(r => ({
        member_name: r.member_name,
        program_name: r.program_name,
        changed_at: r.changed_at,
      }));
      return NextResponse.json({ data: simplified });
    }

    // For full mode, enrich with user data as before
    const changedByIds = Array.from(
      new Set(rows.map(r => r.changed_by).filter(Boolean))
    );

    let userMap = new Map<
      string,
      { id: string; email: string | null; full_name: string | null }
    >();
    if (changedByIds.length > 0) {
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', changedByIds);
      if (!usersErr && Array.isArray(users)) {
        userMap = new Map(
          users.map((u: any) => [
            u.id,
            {
              id: u.id,
              email: u.email || null,
              full_name: u.full_name || null,
            },
          ])
        );
      }
    }

    const enriched = rows.map(r => ({
      ...r,
      changed_by_email: r.changed_by
        ? (userMap.get(r.changed_by)?.email ?? null)
        : null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
