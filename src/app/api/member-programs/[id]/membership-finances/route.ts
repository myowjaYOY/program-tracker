import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api';
import {
  memberProgramMembershipFinancesSchema,
  memberProgramMembershipFinancesUpdateSchema
} from '@/lib/validations/member-program-membership-finances';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user: authUser } = auth;

  try {
    const { id } = await context.params;

    // First verify this is a membership program
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('program_type')
      .eq('member_program_id', id)
      .single();

    if (programError) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    if (program.program_type !== 'membership') {
      return NextResponse.json(
        { error: 'Program is not a membership type' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('member_program_membership_finances')
      .select('*')
      .eq('member_program_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No membership finances record yet - return null data (not an error)
        return NextResponse.json({ data: null });
      }
      return NextResponse.json(
        { error: 'Failed to fetch membership finances' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Membership Finances API] GET error:', error);
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
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user: authUser } = auth;

  try {
    const { id } = await context.params;
    const body = await req.json();

    // Verify this is a membership program
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('program_type')
      .eq('member_program_id', id)
      .single();

    if (programError) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    if (program.program_type !== 'membership') {
      return NextResponse.json(
        { error: 'Cannot create membership finances for a non-membership program' },
        { status: 400 }
      );
    }

    // Validate the request body
    const validatedData = memberProgramMembershipFinancesSchema.parse({
      ...body,
      member_program_id: parseInt(id),
    });

    const insertData = {
      ...validatedData,
      created_by: authUser.id,
      updated_by: authUser.id,
    };

    const { data, error } = await supabase
      .from('member_program_membership_finances')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - record already exists
        return NextResponse.json(
          { error: 'Membership finances already exist for this program' },
          { status: 409 }
        );
      }
      console.error('[Membership Finances API] POST error:', error);
      return NextResponse.json(
        { error: 'Failed to create membership finances' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid data provided', details: (error as any).issues },
        { status: 400 }
      );
    }
    console.error('[Membership Finances API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user: authUser } = auth;

  try {
    const { id } = await context.params;
    const body = await req.json();

    // Verify this is a membership program
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('program_type')
      .eq('member_program_id', id)
      .single();

    if (programError) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    if (program.program_type !== 'membership') {
      return NextResponse.json(
        { error: 'Cannot update membership finances for a non-membership program' },
        { status: 400 }
      );
    }

    // Validate the request body
    const { member_program_id, membership_finance_id, ...updateFields } = body;
    const validatedData = memberProgramMembershipFinancesUpdateSchema.parse(updateFields);

    const updateData = {
      ...validatedData,
      updated_by: authUser.id,
    };

    const { data, error } = await supabase
      .from('member_program_membership_finances')
      .update(updateData)
      .eq('member_program_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Membership finances not found' },
          { status: 404 }
        );
      }
      console.error('[Membership Finances API] PUT error:', error);
      return NextResponse.json(
        { error: 'Failed to update membership finances' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid data provided', details: (error as any).issues },
        { status: 400 }
      );
    }
    console.error('[Membership Finances API] PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}












