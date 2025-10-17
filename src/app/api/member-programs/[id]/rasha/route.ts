import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberProgramRashaSchema } from '@/lib/validations/member-program-rasha';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { data, error } = await supabase
      .from('member_program_rasha')
      .select(
        `
        *,
        rasha_list(
          name,
          length
        )
      `
      )
      .eq('member_program_id', id)
      .order('order_number');

    if (error) {
      console.error('Error fetching member program RASHA items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch member program RASHA items' },
        { status: 500 }
      );
    }

    // Flatten the rasha_list data for easier access in the UI
    const mappedData = (data || []).map(item => ({
      ...item,
      rasha_name: (item as any).rasha_list?.name || null,
      rasha_length: (item as any).rasha_list?.length || null,
    }));

    return NextResponse.json({ data: mappedData });
  } catch (error) {
    console.error('Error in member program RASHA GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();

    // Validate request body
    const validationResult = memberProgramRashaSchema.safeParse({
      ...body,
      member_program_id: parseInt(id),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const itemData = {
      member_program_id: parseInt(id),
      rasha_list_id: validationResult.data.rasha_list_id,
      group_name: validationResult.data.group_name || null,
      type: validationResult.data.type,
      order_number: validationResult.data.order_number,
      active_flag: validationResult.data.active_flag,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('member_program_rasha')
      .insert([itemData])
      .select()
      .single();

    if (error) {
      console.error('Error creating member program RASHA item:', error);
      return NextResponse.json(
        { error: 'Failed to create member program RASHA item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in member program RASHA POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

