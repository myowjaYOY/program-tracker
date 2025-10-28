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

  // Check for duplicate lead (if updating name or email)
  // Only check if all three fields are being updated with non-empty values
  if (
    parse.data.first_name &&
    parse.data.last_name &&
    parse.data.email &&
    parse.data.email !== ''
  ) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('lead_id, first_name, last_name, email')
      .ilike('first_name', parse.data.first_name)
      .ilike('last_name', parse.data.last_name)
      .ilike('email', parse.data.email)
      .neq('lead_id', parseInt(id)) // Exclude the current lead being updated
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      return NextResponse.json(
        {
          error: `Cannot update: A lead with this name and email already exists: ${existingLead.first_name} ${existingLead.last_name} (${existingLead.email}) - Lead ID #${existingLead.lead_id}`,
        },
        { status: 409 } // 409 Conflict
      );
    }
  }

  // Convert empty pmedate string to null for database
  const updateData = {
    ...parse.data,
    ...(parse.data.pmedate !== undefined && {
      pmedate: parse.data.pmedate === '' ? null : parse.data.pmedate,
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
    // Check if it's a unique constraint violation (in case backend check missed it)
    if (error.code === '23505' && error.message.includes('idx_leads_unique_name_email')) {
      return NextResponse.json(
        { error: 'A lead with this name and email already exists.' },
        { status: 409 }
      );
    }
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
