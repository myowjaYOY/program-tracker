import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api';
import {
  therapyRelationshipSchema,
  TherapyRelationshipFormData,
} from '@/lib/validations/therapy-relationships';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const { id } = await params;
  const therapyId = parseInt(id);
  if (isNaN(therapyId)) {
    return NextResponse.json({ error: 'Invalid therapy ID' }, { status: 400 });
  }

  // Join with bodies and pillars to get names, and users for created_by/updated_by
  const { data, error } = await supabase
    .from('therapies_bodies_pillars')
    .select(
      `
      *,
      body:bodies!therapies_bodies_pillars_body_id_fkey(body_name),
      pillar:pillars!therapies_bodies_pillars_pillar_id_fkey(pillar_name),
      created_user:users!therapies_bodies_pillars_created_by_fkey(id,email,full_name),
      updated_user:users!therapies_bodies_pillars_updated_by_fkey(id,email,full_name)
    `
    )
    .eq('therapy_id', therapyId)
    .eq('active_flag', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data || []).map(relationship => ({
    ...relationship,
    body_name: relationship.body?.body_name || null,
    pillar_name: relationship.pillar?.pillar_name || null,
    created_by_email: relationship.created_user?.email || null,
    updated_by_email: relationship.updated_user?.email || null,
  }));

  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const { id } = await params;
  const therapyId = parseInt(id);
  if (isNaN(therapyId)) {
    return NextResponse.json({ error: 'Invalid therapy ID' }, { status: 400 });
  }

  let relationship: TherapyRelationshipFormData;
  try {
    relationship = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Ensure the therapy_id matches the URL parameter
  relationship.therapy_id = therapyId;

  const parse = therapyRelationshipSchema.safeParse(relationship);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  // Check for duplicate relationship
  const { data: existing } = await supabase
    .from('therapies_bodies_pillars')
    .select('therapy_id')
    .eq('therapy_id', therapyId)
    .eq('body_id', relationship.body_id)
    .eq('pillar_id', relationship.pillar_id)
    .eq('active_flag', true)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'This relationship already exists' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('therapies_bodies_pillars')
    .insert([{ ...parse.data, created_by: user.id, updated_by: user.id }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
