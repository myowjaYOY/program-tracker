import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { programTemplateRashaUpdateSchema } from '@/lib/validations/program-template-rasha';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; rashaId: string }> }
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
    const { id, rashaId } = await context.params;
    const body = await req.json();

    // Validate request body
    const validationResult = programTemplateRashaUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = {
      ...validationResult.data,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template_rasha')
      .update(updateData)
      .eq('program_template_rasha_id', parseInt(rashaId))
      .eq('program_template_id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('Error updating program template RASHA item:', error);
      return NextResponse.json(
        { error: 'Failed to update program template RASHA item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in program template RASHA PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; rashaId: string }> }
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
    const { id, rashaId } = await context.params;

    const { error } = await supabase
      .from('program_template_rasha')
      .delete()
      .eq('program_template_rasha_id', parseInt(rashaId))
      .eq('program_template_id', parseInt(id));

    if (error) {
      console.error('Error deleting program template RASHA item:', error);
      return NextResponse.json(
        { error: 'Failed to delete program template RASHA item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error in program template RASHA DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

