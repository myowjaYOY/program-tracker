import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { therapySchema, TherapyFormData } from '@/lib/validations/therapy';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Join to users for created_by/updated_by and related tables
  const { data, error } = await supabase.from('therapies').select(`*,
      created_user:users!therapies_created_by_fkey(id,email,full_name),
      updated_user:users!therapies_updated_by_fkey(id,email,full_name),
      therapy_type:therapytype(therapy_type_id,therapy_type_name),
      bucket:buckets(bucket_id,bucket_name),
      program_role:program_roles(program_role_id,role_name,display_color)
    `);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = (data || []).map(therapy => ({
    ...therapy,
    created_by_email: therapy.created_user?.email || null,
    created_by_full_name: therapy.created_user?.full_name || null,
    updated_by_email: therapy.updated_user?.email || null,
    updated_by_full_name: therapy.updated_user?.full_name || null,
    therapy_type_name: therapy.therapy_type?.therapy_type_name || null,
    bucket_name: therapy.bucket?.bucket_name || null,
    role_name: therapy.program_role?.role_name || null,
    role_display_color: therapy.program_role?.display_color || null,
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
  let therapy: TherapyFormData;
  try {
    therapy = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapySchema.safeParse(therapy);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  
  // Separate track_inventory from therapy data
  const { track_inventory, ...therapyData } = parse.data;
  
  const { data, error } = await supabase
    .from('therapies')
    .insert([{ ...therapyData, created_by: user.id, updated_by: user.id }])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If track_inventory is true, create inventory_items record
  if (track_inventory && data.therapy_id) {
    const { error: invError } = await supabase
      .from('inventory_items')
      .insert([{
        therapy_id: data.therapy_id,
        quantity_on_hand: 0,
        reorder_point: 0,
        reorder_quantity: 0,
        active_flag: true,
        created_by: user.id,
        updated_by: user.id,
      }]);
    
    if (invError) {
      // Log error but don't fail the therapy creation
      console.error('Failed to create inventory item:', invError);
    }
  }

  return NextResponse.json({ data }, { status: 201 });
}
