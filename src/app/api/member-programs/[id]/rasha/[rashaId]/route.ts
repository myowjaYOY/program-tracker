import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberProgramRashaUpdateSchema } from '@/lib/validations/member-program-rasha';

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
    const validationResult = memberProgramRashaUpdateSchema.safeParse(body);

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
      .from('member_program_rasha')
      .update(updateData)
      .eq('member_program_rasha_id', parseInt(rashaId))
      .eq('member_program_id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('Error updating member program RASHA item:', error);
      return NextResponse.json(
        { error: 'Failed to update member program RASHA item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in member program RASHA PUT:', error);
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
      .from('member_program_rasha')
      .delete()
      .eq('member_program_rasha_id', parseInt(rashaId))
      .eq('member_program_id', parseInt(id));

    if (error) {
      console.error('Error deleting member program RASHA item:', error);
      return NextResponse.json(
        { error: 'Failed to delete member program RASHA item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error in member program RASHA DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

