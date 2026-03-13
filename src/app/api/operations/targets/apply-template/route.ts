import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { startOfISOWeek, setISOWeek, setISOWeekYear, getISOWeek, getISOWeekYear } from 'date-fns';

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

function toMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function weekToPeriodStart(year: number, week: number): string {
  const d = new Date(year, 0, 4);
  const withYear = setISOWeekYear(d, year);
  const withWeek = setISOWeek(withYear, week);
  const monday = startOfISOWeek(withWeek);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get all ISO weeks whose Monday falls within the given month. */
function getWeeksInMonth(year: number, month: number): string[] {
  const weeks: string[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const startWeek = getISOWeek(firstDay);
  const startYear = getISOWeekYear(firstDay);
  const endWeek = getISOWeek(lastDay);
  const endYear = getISOWeekYear(lastDay);

  // Iterate through possible weeks and check if their Monday falls in this month
  let currentDate = new Date(firstDay);
  const seen = new Set<string>();
  while (currentDate <= lastDay) {
    const monday = startOfISOWeek(currentDate);
    if (monday.getMonth() + 1 === month && monday.getFullYear() === year) {
      const key = weekToPeriodStart(getISOWeekYear(monday), getISOWeek(monday));
      if (!seen.has(key)) {
        seen.add(key);
        weeks.push(key);
      }
    }
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Also check if any Monday before the 1st still falls in this month (edge case)
  const dayBeforeFirst = new Date(year, month - 1, 0);
  const mondayBefore = startOfISOWeek(dayBeforeFirst);
  if (mondayBefore.getMonth() + 1 === month && mondayBefore.getFullYear() === year) {
    const key = weekToPeriodStart(getISOWeekYear(mondayBefore), getISOWeek(mondayBefore));
    if (!seen.has(key)) {
      weeks.unshift(key);
    }
  }

  return weeks;
}

/**
 * POST /api/operations/targets/apply-template
 * Body: { templateName?, year, month, overwrite? }
 * Creates metric_targets for the given month (monthly targets) and all weeks
 * whose Monday falls in that month (weekly targets) from the template.
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

  const schema = z.object({
    templateName: z.string().optional().default('Default'),
    year: z.number().int().min(2020).max(2040),
    month: z.number().int().min(1).max(12),
    overwrite: z.boolean().optional().default(false),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { templateName, year, month, overwrite } = parsed.data;

  const { data: templateItems, error: tplError } = await supabase
    .from('metric_target_templates')
    .select('*')
    .eq('template_name', templateName);

  if (tplError) {
    return NextResponse.json({ error: tplError.message }, { status: 500 });
  }
  if (!templateItems?.length) {
    return NextResponse.json({ error: 'Template is empty or does not exist' }, { status: 404 });
  }

  const monthlyItems = templateItems.filter((t) => t.period_type === 'MONTH');
  const weeklyItems = templateItems.filter((t) => t.period_type === 'WEEK');
  const monthStart = toMonthStart(year, month);
  const weekStarts = getWeeksInMonth(year, month);

  const nowIso = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Apply monthly targets
  for (const item of monthlyItems) {
    if (!overwrite) {
      const { data: existing } = await supabase
        .from('metric_targets')
        .select('id')
        .eq('metric_key', item.metric_key)
        .eq('period_type', 'MONTH')
        .eq('period_start', monthStart)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }
    }
    const { error: upsertError } = await supabase
      .from('metric_targets')
      .upsert(
        {
          metric_key: item.metric_key,
          period_type: 'MONTH',
          period_start: monthStart,
          target_value: item.target_value,
          notes: item.notes,
          updated_at: nowIso,
        },
        { onConflict: 'metric_key,period_type,period_start' }
      );
    if (upsertError) {
      errors.push(`Monthly ${item.metric_key}: ${upsertError.message}`);
    } else {
      created++;
    }
  }

  // Apply weekly targets to each week in the month
  for (const weekStart of weekStarts) {
    for (const item of weeklyItems) {
      if (!overwrite) {
        const { data: existing } = await supabase
          .from('metric_targets')
          .select('id')
          .eq('metric_key', item.metric_key)
          .eq('period_type', 'WEEK')
          .eq('period_start', weekStart)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }
      }
      const { error: upsertError } = await supabase
        .from('metric_targets')
        .upsert(
          {
            metric_key: item.metric_key,
            period_type: 'WEEK',
            period_start: weekStart,
            target_value: item.target_value,
            notes: item.notes,
            updated_at: nowIso,
          },
          { onConflict: 'metric_key,period_type,period_start' }
        );
      if (upsertError) {
        errors.push(`Weekly ${item.metric_key} (${weekStart}): ${upsertError.message}`);
      } else {
        created++;
      }
    }
  }

  return NextResponse.json({
    data: {
      created,
      skipped,
      errors: errors.length ? errors : undefined,
      monthStart,
      weekStarts,
      monthlyCount: monthlyItems.length,
      weeklyCount: weeklyItems.length,
    },
  });
}
