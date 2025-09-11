import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { campaignSchema, CampaignFormData } from '@/lib/validations/campaign';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join campaigns to vendors and users for created_by/updated_by
  const { data, error } = await supabase.from('campaigns').select(`*,
      vendor:vendors!campaigns_vendor_id_fkey(vendor_id,vendor_name),
      created_user:users!campaigns_created_by_fkey(id,email,full_name),
      updated_user:users!campaigns_updated_by_fkey(id,email,full_name)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Map to flat fields for frontend
  const mapped = (data || []).map(campaign => ({
    ...campaign,
    vendor_name: campaign.vendor?.vendor_name || null,
    created_by_email: campaign.created_user?.email || null,
    created_by_full_name: campaign.created_user?.full_name || null,
    updated_by_email: campaign.updated_user?.email || null,
    updated_by_full_name: campaign.updated_user?.full_name || null,
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
  let body: CampaignFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = campaignSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('campaigns')
    .insert([parse.data])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
