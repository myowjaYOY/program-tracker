import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vendorSchema, VendorUpdateData } from '@/lib/validations/vendor';

export async function PUT(
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
  let body: VendorUpdateData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = vendorSchema.partial().safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('vendors')
    .update(parse.data)
    .eq('vendor_id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
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
  // Check for campaign references
  const { data: campaignRefs, error: refError } = await supabase
    .from('campaigns')
    .select('campaign_id')
    .eq('vendor_id', id)
    .limit(1);
  if (refError) {
    return NextResponse.json({ error: refError.message }, { status: 500 });
  }
  if (campaignRefs && campaignRefs.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete vendor: referenced by campaigns.' },
      { status: 409 }
    );
  }
  const { error } = await supabase.from('vendors').delete().eq('vendor_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
