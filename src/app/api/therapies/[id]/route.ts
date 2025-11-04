import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  therapyUpdateSchema,
  TherapyUpdateData,
} from '@/lib/validations/therapy';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    .from('therapies')
    .select(
      `*,
      created_user:users!therapies_created_by_fkey(id,email,full_name),
      updated_user:users!therapies_updated_by_fkey(id,email,full_name),
      therapy_type:therapytype(therapy_type_id,therapy_type_name),
      bucket:buckets(bucket_id,bucket_name),
      program_role:program_roles(program_role_id,role_name,display_color)
    `
    )
    .eq('therapy_id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const mapped = {
    ...data,
    created_by_email: data.created_user?.email || null,
    created_by_full_name: data.created_user?.full_name || null,
    updated_by_email: data.updated_user?.email || null,
    updated_by_full_name: data.updated_user?.full_name || null,
    therapy_type_name: data.therapy_type?.therapy_type_name || null,
    bucket_name: data.bucket?.bucket_name || null,
    role_name: data.program_role?.role_name || null,
    role_display_color: data.program_role?.display_color || null,
  };
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
  let therapy: TherapyUpdateData;
  try {
    therapy = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = therapyUpdateSchema.safeParse(therapy);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  
  // Separate track_inventory from therapy data
  const { track_inventory, ...therapyData } = parse.data;
  
  const { data, error } = await supabase
    .from('therapies')
    .update({ ...therapyData, updated_by: user.id })
    .eq('therapy_id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Handle inventory tracking changes if track_inventory is provided
  if (track_inventory !== undefined) {
    // Check if inventory item exists
    const { data: existingInv } = await supabase
      .from('inventory_items')
      .select('inventory_item_id, active_flag')
      .eq('therapy_id', id)
      .single();

    if (track_inventory) {
      // User wants to track in inventory
      if (existingInv) {
        // Reactivate existing inventory item
        await supabase
          .from('inventory_items')
          .update({ active_flag: true, updated_by: user.id })
          .eq('therapy_id', id);
      } else {
        // Create new inventory item
        await supabase
          .from('inventory_items')
          .insert([{
            therapy_id: parseInt(id),
            quantity_on_hand: 0,
            reorder_point: 0,
            reorder_quantity: 0,
            active_flag: true,
            created_by: user.id,
            updated_by: user.id,
          }]);
      }
    } else {
      // User wants to remove from inventory tracking
      if (existingInv && existingInv.active_flag) {
        // Deactivate inventory item
        await supabase
          .from('inventory_items')
          .update({ active_flag: false, updated_by: user.id })
          .eq('therapy_id', id);
      }
    }
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
  const { error } = await supabase
    .from('therapies')
    .delete()
    .eq('therapy_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: true }, { status: 200 });
}
