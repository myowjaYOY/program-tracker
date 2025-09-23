import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberProgramFinancesSchema } from '@/lib/validations/member-program-finances';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    
    const { data, error } = await supabase
      .from('member_program_finances')
      .select('*')
      .eq('member_program_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Program finances not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch program finances' }, { status: 500 });
    }

    // Return the data directly without foreign key joins for now
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    
    // Validate the request body
    const validatedData = memberProgramFinancesSchema.parse({
      ...body,
      member_program_id: parseInt(id),
    });

    const insertData = {
      ...validatedData,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('member_program_finances')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create program finances' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid data provided' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    
    // Validate the request body (excluding member_program_id for updates)
    const { member_program_id, ...updateFields } = body;
    const validatedData = memberProgramFinancesSchema.omit({ member_program_id: true }).parse(updateFields);

    // Load current finances to compare for regeneration pre-check
    const { data: currentFinances } = await supabase
      .from('member_program_finances')
      .select('financing_type_id, finance_charges, discounts, taxes')
      .eq('member_program_id', id)
      .single();

    const updateData = {
      ...validatedData,
      updated_by: session.user.id,
    };

    // Determine if changes would require payments regeneration
    const finTypeChanged =
      (updateData as any).financing_type_id !== undefined &&
      (currentFinances ? (updateData as any).financing_type_id !== currentFinances.financing_type_id : true);
    const financeChargesChanged =
      (updateData as any).finance_charges !== undefined &&
      (currentFinances ? Number((updateData as any).finance_charges) !== Number(currentFinances.finance_charges) : true);
    const discountsChanged =
      (updateData as any).discounts !== undefined &&
      (currentFinances ? Number((updateData as any).discounts) !== Number(currentFinances.discounts) : true);
    const shouldRegenerate = finTypeChanged || financeChargesChanged || discountsChanged;

    if (shouldRegenerate) {
      // Block update if any payment is already marked paid to keep data consistent
      const { data: paidRows, error: paidErr } = await supabase
        .from('member_program_payments')
        .select('member_program_payment_id')
        .eq('member_program_id', id)
        .not('payment_date', 'is', null)
        .limit(1);
      if (paidErr) {
        return NextResponse.json({ error: 'Failed to validate payments state' }, { status: 500 });
      }
      if (paidRows && paidRows.length > 0) {
        return NextResponse.json({ error: 'Cannot update finances because at least one payment is already paid.' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('member_program_finances')
      .update(updateData)
      .eq('member_program_id', id)
      .select()
      .single();

    if (error) {
      if ((error as any)?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Program finances not found' }, { status: 404 });
      }
      return NextResponse.json({
        error: 'Failed to update program finances',
        details: (error as any)?.message ?? null,
        hint: (error as any)?.hint ?? null,
      }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid data provided' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error', details: (error as any)?.message ?? null }, { status: 500 });
  }
}

