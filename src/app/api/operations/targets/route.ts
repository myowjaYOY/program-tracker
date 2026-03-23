import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { PeriodType } from '@/lib/hooks/use-metric-definitions';
import { startOfWeek } from 'date-fns';

/**
 * TODO: Refactor all API routes to use a shared requireAuth (and requireAdmin where needed).
 * Currently only operations/targets and operations/metrics use this pattern; other routes
 * inline the same auth logic.
 */

/** Ensure period_start is first day of month. Parses YYYY-MM-DD string directly to avoid timezone shifts. */
function normalizeMonthStart(input: Date | string): string {
  if (typeof input === 'string') {
    const parts = input.split('-').map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = String(parts[1] ?? 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }
  const y = input.getUTCFullYear();
  const m = String(input.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Get Monday of the week for the given date (ISO week). */
function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/** Require authenticated user. RLS on metric_targets/metric_definitions enforces access. */
async function requireAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

const periodTypeSchema = z.enum(['WEEK', 'MONTH']);
const periodStartSchema = z.string().refine(
  (s) => {
    const d = new Date(s);
    return !isNaN(d.getTime());
  },
  { message: 'Invalid date' }
);

const targetItemSchema = z.object({
  metric_key: z.string().min(1),
  target_value: z.number().min(0),
  notes: z.string().nullable().optional(),
});

type MetricDef = { metric_key: string; value_type: string };

function validateTargetValue(def: MetricDef | null, value: number): string | null {
  if (!def) return 'Unknown metric';
  if (def.value_type === 'percent' && (value < 0 || value > 100)) {
    return 'Percent must be between 0 and 100';
  }
  return null;
}

/**
 * GET /api/operations/targets
 * Optional: ?periodType=WEEK|MONTH&periodStart=YYYY-MM-DD to filter by period.
 * Without params: returns all targets.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const periodTypeParam = searchParams.get('periodType') as PeriodType | null;
  const periodStartParam = searchParams.get('periodStart');

  let query = supabase
    .from('metric_targets')
    .select('*')
    .order('period_type')
    .order('period_start', { ascending: false })
    .order('metric_key');

  if (periodTypeParam && periodStartParam) {
    const parsePeriod = z.object({
      periodType: periodTypeSchema,
      periodStart: periodStartSchema,
    });
    const parsed = parsePeriod.safeParse({
      periodType: periodTypeParam,
      periodStart: periodStartParam,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    let periodStart = parsed.data.periodStart;
    if (parsed.data.periodType === 'MONTH') {
      periodStart = normalizeMonthStart(periodStart);
    } else {
      const parts = periodStart.split('-').map(Number);
      const y = parts[0] ?? new Date().getFullYear();
      const m = (parts[1] ?? 1) - 1;
      const day = parts[2] ?? 1;
      const localD = new Date(y, m, day);
      periodStart = getMonday(localD).toISOString().slice(0, 10);
    }
    query = query
      .eq('period_type', parsed.data.periodType)
      .eq('period_start', periodStart);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

/**
 * POST /api/operations/targets
 * Body: { periodType, periodStart, targets: [{ metric_key, target_value, notes? }, ...] }
 * Upsert by (metric_key, period_type, period_start). Auth required (RLS enforced).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const postSchema = z.object({
    periodType: periodTypeSchema,
    periodStart: periodStartSchema,
    targets: z.array(targetItemSchema),
  });
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { periodType, periodStart: rawStart, targets } = parsed.data;
  let periodStart: string;

  if (periodType === 'MONTH') {
    periodStart = normalizeMonthStart(rawStart);
  } else {
    const parts = rawStart.split('-').map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = (parts[1] ?? 1) - 1;
    const day = parts[2] ?? 1;
    const d = new Date(y, m, day);
    if (!isMonday(d)) {
      return NextResponse.json(
        {
          error:
            'For weekly targets, periodStart must be the Monday of the week.',
        },
        { status: 400 }
      );
    }
    const monday = getMonday(d);
    periodStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }

  const { data: metricDefs } = await supabase
    .from('metric_definitions')
    .select('metric_key, value_type')
    .eq('active_flag', true);
  const defByKey = new Map((metricDefs ?? []).map((d) => [d.metric_key, d]));

  for (const t of targets) {
    const def = defByKey.get(t.metric_key) ?? null;
    const err = validateTargetValue(def, t.target_value);
    if (err) {
      return NextResponse.json(
        { error: `${t.metric_key}: ${err}` },
        { status: 400 }
      );
    }
  }

  const nowIso = new Date().toISOString();
  for (const t of targets) {
    const { error: upsertError } = await supabase
      .from('metric_targets')
      .upsert(
        {
          metric_key: t.metric_key,
          period_type: periodType,
          period_start: periodStart,
          target_value: t.target_value,
          notes: t.notes ?? null,
          updated_at: nowIso,
        },
        {
          onConflict: 'metric_key,period_type,period_start',
        }
      );
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('metric_targets')
    .select('*')
    .eq('period_type', periodType)
    .eq('period_start', periodStart)
    .order('metric_key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

/**
 * DELETE /api/operations/targets
 * Body: { id: number } OR { metric_key, periodType, periodStart }
 * Auth required (RLS enforced).
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const byIdSchema = z.object({ id: z.number() });
  const byKeySchema = z.object({
    metric_key: z.string().min(1),
    periodType: periodTypeSchema,
    periodStart: periodStartSchema,
  });
  const byId = byIdSchema.safeParse(body);
  const byKey = byKeySchema.safeParse(body);

  if (!byId.success && !byKey.success) {
    return NextResponse.json(
      { error: 'Provide either { id } or { metric_key, periodType, periodStart }' },
      { status: 400 }
    );
  }

  if (byId.success) {
    const { error: delError } = await supabase
      .from('metric_targets')
      .delete()
      .eq('id', byId.data.id);
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }
  } else {
    const keyData = byKey.data;
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid delete parameters' }, { status: 400 });
    }
    let periodStart = keyData.periodStart;
    if (keyData.periodType === 'MONTH') {
      periodStart = normalizeMonthStart(periodStart);
    } else {
      const parts = periodStart.split('-').map(Number);
      const y = parts[0] ?? new Date().getFullYear();
      const m = (parts[1] ?? 1) - 1;
      const day = parts[2] ?? 1;
      const d = new Date(y, m, day);
      if (!isMonday(d)) {
        return NextResponse.json(
          { error: 'periodStart must be Monday for weekly targets.' },
          { status: 400 }
        );
      }
      const monday = getMonday(d);
      periodStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    }
    const { error: delError } = await supabase
      .from('metric_targets')
      .delete()
      .eq('metric_key', keyData.metric_key)
      .eq('period_type', keyData.periodType)
      .eq('period_start', periodStart);
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data: { deleted: true } });
}
