import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  campaignUpdateSchema,
  CampaignUpdateData,
} from '@/lib/validations/campaign';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `*,
      vendor:vendors!campaigns_vendor_id_fkey(vendor_id,vendor_name)
    `
    )
    .eq('campaign_id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = {
    ...data,
    vendor_name: data.vendor?.vendor_name || null,
    created_by_email: data.created_by || null, // Use user ID directly
    updated_by_email: data.updated_by || null, // Use user ID directly
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
  let body: CampaignUpdateData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = campaignUpdateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('campaigns')
    .update(parse.data)
    .eq('campaign_id', id)
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
  // Check for leads referencing this campaign (if applicable)
  const { data: leadRefs, error: refError } = await supabase
    .from('leads')
    .select('lead_id')
    .eq('campaign_id', id)
    .limit(1);
  if (refError) {
    return NextResponse.json({ error: refError.message }, { status: 500 });
  }
  if (leadRefs && leadRefs.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete campaign: referenced by leads.' },
      { status: 409 }
    );
  }
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('campaign_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
