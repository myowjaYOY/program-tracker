import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/coordinator/program-changes?range=today|week|month|all|custom&start=&end=
// Returns rows from vw_audit_logs_with_program_context; only date filters apply
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

    const rows = (data as any[]) || [];
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
