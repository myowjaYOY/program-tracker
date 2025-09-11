import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { leadUpdateSchema, LeadUpdateData } from '@/lib/validations/lead';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const { data, error } = await supabase
    .from('leads')
    .select(
      `*,
      created_user:users!leads_created_by_fkey(id,email,full_name),
      updated_user:users!leads_updated_by_fkey(id,email,full_name),
      campaign:campaigns!leads_campaign_id_fkey(campaign_id,campaign_name),
      status:status!leads_status_id_fkey(status_id,status_name)
    `
    )
    .eq('lead_id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = {
    ...data,
    created_by_email: data.created_user?.email || null,
    updated_by_email: data.updated_user?.email || null,
    campaign_name: data.campaign?.campaign_name || null,
    status_name: data.status?.status_name || null,
  };
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  let body: LeadUpdateData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = leadUpdateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  
  // Convert empty pmedate string to null for database
  const updateData = {
    ...parse.data,
    ...(parse.data.pmedate !== undefined && { 
      pmedate: parse.data.pmedate === '' ? null : parse.data.pmedate 
    }),
    updated_by: user.id,
  };
  
  const { data, error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('lead_id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  // Add referential integrity checks here if needed
  const { error } = await supabase.from('leads').delete().eq('lead_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
