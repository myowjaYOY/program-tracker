import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

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

/**
 * GET /api/operations/target-templates
 * Optional: ?templateName=Default to filter by template name.
 * Without params: returns all template entries.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const templateName = searchParams.get('templateName');

  let query = supabase
    .from('metric_target_templates')
    .select('*')
    .order('period_type')
    .order('metric_key');

  if (templateName) {
    query = query.eq('template_name', templateName);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

const templateItemSchema = z.object({
  metric_key: z.string().min(1),
  period_type: z.enum(['WEEK', 'MONTH']),
  target_value: z.number().min(0),
  notes: z.string().nullable().optional(),
});

/**
 * POST /api/operations/target-templates
 * Body: { templateName?, metric_key, period_type, target_value, notes? }
 * Upsert by (template_name, metric_key, period_type).
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
    templateName: z.string().optional().default('Default'),
  }).merge(templateItemSchema);

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { templateName, metric_key, period_type, target_value, notes } = parsed.data;

  const { data: metricDef } = await supabase
    .from('metric_definitions')
    .select('metric_key, value_type')
    .eq('metric_key', metric_key)
    .eq('active_flag', true)
    .maybeSingle();

  if (!metricDef) {
    return NextResponse.json({ error: 'Unknown or inactive metric' }, { status: 400 });
  }
  if (metricDef.value_type === 'percent' && (target_value < 0 || target_value > 100)) {
    return NextResponse.json({ error: 'Percent must be between 0 and 100' }, { status: 400 });
  }

  const { error: upsertError } = await supabase
    .from('metric_target_templates')
    .upsert(
      {
        template_name: templateName,
        metric_key,
        period_type,
        target_value,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'template_name,metric_key,period_type' }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('metric_target_templates')
    .select('*')
    .eq('template_name', templateName)
    .order('period_type')
    .order('metric_key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

/**
 * DELETE /api/operations/target-templates
 * Body: { id: number }
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

  const parsed = z.object({ id: z.number() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide { id }' }, { status: 400 });
  }

  const { error: delError } = await supabase
    .from('metric_target_templates')
    .delete()
    .eq('id', parsed.data.id);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }
  return NextResponse.json({ data: { deleted: true } });
}
