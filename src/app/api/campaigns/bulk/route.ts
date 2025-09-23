import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { campaignSchema, CampaignFormData } from '@/lib/validations/campaign';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { campaigns: CampaignFormData[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.campaigns)) {
    return NextResponse.json(
      { error: 'Campaigns must be an array' },
      { status: 400 }
    );
  }

  if (body.campaigns.length === 0) {
    return NextResponse.json(
      { error: 'Campaigns array cannot be empty' },
      { status: 400 }
    );
  }

  if (body.campaigns.length > 1000) {
    return NextResponse.json(
      { error: 'Maximum 1000 campaigns per bulk import' },
      { status: 400 }
    );
  }

  // Validate each campaign
  const validatedCampaigns = [];
  const errors: string[] = [];

  for (let i = 0; i < body.campaigns.length; i++) {
    const campaign = body.campaigns[i];
    const parse = campaignSchema.safeParse(campaign);

    if (!parse.success) {
      errors.push(`Row ${i + 1}: ${parse.error.flatten().fieldErrors}`);
    } else {
      validatedCampaigns.push({
        ...parse.data,
        created_by: user.id,
        updated_by: user.id,
      });
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: 'Validation errors found',
        details: errors,
      },
      { status: 400 }
    );
  }

  // Use Supabase's bulk insert capability
  const { data, error } = await supabase
    .from('campaigns')
    .insert(validatedCampaigns).select(`
      *,
      vendor:vendors!campaigns_vendor_id_fkey(vendor_id,vendor_name),
      created_user:users!campaigns_created_by_fkey(id,email,full_name),
      updated_user:users!campaigns_updated_by_fkey(id,email,full_name)
    `);

  if (error) {
    console.error('Supabase bulk insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to flat fields for frontend consistency
  const mapped = (data || []).map(campaign => ({
    ...campaign,
    vendor_name: campaign.vendor?.vendor_name || null,
    created_by_email: campaign.created_user?.email || null,
    created_by_full_name: campaign.created_user?.full_name || null,
    updated_by_email: campaign.updated_user?.email || null,
    updated_by_full_name: campaign.updated_user?.full_name || null,
  }));

  return NextResponse.json(
    {
      data: mapped,
      message: `${validatedCampaigns.length} campaigns created successfully`,
      count: validatedCampaigns.length,
    },
    { status: 201 }
  );
}
