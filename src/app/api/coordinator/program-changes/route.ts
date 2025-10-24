import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

// GET /api/coordinator/program-changes?range=today|week|month|all|custom&start=&end=&unique_only=true&limit=7
// Returns rows from vw_audit_member_changes for Active programs only; supports unique grouping and limiting
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
  const memberIdParam = searchParams.get('memberId');
  const memberId = memberIdParam ? parseInt(memberIdParam, 10) : null;
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  // Source filtering removed
  const uniqueOnly = searchParams.get('unique_only') === 'true';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    // Get Active program IDs using centralized service (default: Active only)
    const validProgramIds = await ProgramStatusService.getValidProgramIds(
      supabase,
      memberId ? { memberId } : undefined
    );
    if (validProgramIds.length === 0) return NextResponse.json({ data: [] });

    let query = supabase
      .from('vw_audit_member_items')
      .select('*')
      .in('program_id', validProgramIds)
      .order('event_at', { ascending: false });

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
    if (startStr) query = query.gte('event_at', startStr);
    if (endStr) {
      // Include entire end date by filtering up to (but not including) the next day
      const nextDay = new Date(endStr + 'T00:00:00Z');
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt('event_at', nextDay.toISOString());
    }

    // Source filtering removed

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

    // Handle unique grouping if requested
    if (uniqueOnly) {
      // Group by member_id + program_id, take most recent change per program
      const grouped = new Map<string, any>();
      
      rows.forEach(row => {
        if (row.member_id && row.program_id) {
          const key = `${row.member_id}-${row.program_id}`;
          const existing = grouped.get(key);
          
          if (!existing || new Date(row.event_at) > new Date(existing.event_at)) {
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
        // keep response key as changed_at for UI compatibility
        changed_at: r.event_at,
      }));
      return NextResponse.json({ data: simplified });
    }

    // Return rows directly (user enrichment removed)
    return NextResponse.json({ data: rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
