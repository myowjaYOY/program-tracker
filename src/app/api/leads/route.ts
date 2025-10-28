import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { leadSchema, LeadFormData } from '@/lib/validations/lead';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join to users for created_by/updated_by and campaigns/status for names
  const { data, error } = await supabase.from('leads').select(`*,
      created_user:users!leads_created_by_fkey(id,email,full_name),
      updated_user:users!leads_updated_by_fkey(id,email,full_name),
      campaign:campaigns!leads_campaign_id_fkey(campaign_id,campaign_name),
      status:status!leads_status_id_fkey(status_id,status_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Get note counts for each lead
  const leadIds = (data || []).map((lead: any) => lead.lead_id).filter(Boolean);
  let noteCounts: Record<number, number> = {};
  if (leadIds.length > 0) {
    const { data: notesData, error: notesError } = await supabase
      .from('lead_notes')
      .select('lead_id')
      .in('lead_id', leadIds);
    
    if (notesError) {
      console.error('Error fetching note counts:', notesError);
    }
    
    // Count notes per lead
    (notesData || []).forEach((note: any) => {
      noteCounts[note.lead_id] = (noteCounts[note.lead_id] || 0) + 1;
    });
  }

  const mapped = (data || []).map(lead => ({
    ...lead,
    created_by_email: lead.created_user?.email || null,
    updated_by_email: lead.updated_user?.email || null,
    campaign_name: lead.campaign?.campaign_name || null,
    status_name: lead.status?.status_name || null,
    note_count: noteCounts[lead.lead_id] || 0,
  }));
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: LeadFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = leadSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  // Check for existing lead with same name and email (case-insensitive)
  if (parse.data.email && parse.data.email !== '') {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('lead_id, first_name, last_name, email')
      .ilike('first_name', parse.data.first_name)
      .ilike('last_name', parse.data.last_name)
      .ilike('email', parse.data.email)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      return NextResponse.json(
        {
          error: `A lead with this name and email already exists: ${existingLead.first_name} ${existingLead.last_name} (${existingLead.email}) - Lead ID #${existingLead.lead_id}`,
        },
        { status: 409 } // 409 Conflict
      );
    }
  }

  // Convert empty pmedate string to null for database
  const leadData = {
    ...parse.data,
    pmedate: parse.data.pmedate === '' ? null : parse.data.pmedate,
    created_by: user.id,
    updated_by: user.id,
  };

  console.log('Inserting lead data:', leadData);

  const { data, error } = await supabase
    .from('leads')
    .insert([leadData])
    .select()
    .single();
  if (error) {
    console.error('Supabase error:', error);
    // Check if it's a unique constraint violation (in case backend check missed it)
    if (error.code === '23505' && error.message.includes('idx_leads_unique_name_email')) {
      return NextResponse.json(
        { error: 'A lead with this name and email already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
