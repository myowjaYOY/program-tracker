import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api';

export async function PUT(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; bodyId: string; pillarId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const { id, bodyId: bodyIdParam, pillarId: pillarIdParam } = await params;
  const therapyId = parseInt(id);
  const bodyId = parseInt(bodyIdParam);
  const pillarId = parseInt(pillarIdParam);

  if (isNaN(therapyId) || isNaN(bodyId) || isNaN(pillarId)) {
    return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
  }

  let updateData: any;
  try {
    updateData = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('therapies_bodies_pillars')
    .update({ ...updateData, updated_by: user.id })
    .eq('therapy_id', therapyId)
    .eq('body_id', bodyId)
    .eq('pillar_id', pillarId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; bodyId: string; pillarId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const { id, bodyId: bodyIdParam, pillarId: pillarIdParam } = await params;
  const therapyId = parseInt(id);
  const bodyId = parseInt(bodyIdParam);
  const pillarId = parseInt(pillarIdParam);

  if (isNaN(therapyId) || isNaN(bodyId) || isNaN(pillarId)) {
    return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
  }

  // Soft delete by setting active_flag to false
  const { error } = await supabase
    .from('therapies_bodies_pillars')
    .update({ active_flag: false, updated_by: user.id })
    .eq('therapy_id', therapyId)
    .eq('body_id', bodyId)
    .eq('pillar_id', pillarId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { data: { therapy_id: therapyId, body_id: bodyId, pillar_id: pillarId } },
    { status: 200 }
  );
}
