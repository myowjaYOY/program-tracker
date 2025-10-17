import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { programTemplateRashaSchema } from '@/lib/validations/program-template-rasha';

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
      .from('program_template_rasha')
      .select(
        `
        *,
        rasha_list(
          name,
          length
        )
      `
      )
      .eq('program_template_id', id)
      .order('order_number');

    if (error) {
      console.error('Error fetching program template RASHA items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch program template RASHA items' },
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
    console.error('Error in program template RASHA GET:', error);
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
    const validationResult = programTemplateRashaSchema.safeParse({
      ...body,
      program_template_id: parseInt(id),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const itemData = {
      program_template_id: parseInt(id),
      rasha_list_id: validationResult.data.rasha_list_id,
      group_name: validationResult.data.group_name || null,
      type: validationResult.data.type,
      order_number: validationResult.data.order_number,
      active_flag: validationResult.data.active_flag,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template_rasha')
      .insert([itemData])
      .select()
      .single();

    if (error) {
      console.error('Error creating program template RASHA item:', error);
      return NextResponse.json(
        { error: 'Failed to create program template RASHA item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in program template RASHA POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

