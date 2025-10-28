import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberProgramFinancesSchema } from '@/lib/validations/member-program-finances';
import { calculateTaxesOnTaxableItems } from '@/lib/utils/financial-calculations';

export async function GET(
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

    const { data, error } = await supabase
      .from('member_program_finances')
      .select('*, contracted_at_margin, variance')
      .eq('member_program_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Program finances not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch program finances' },
        { status: 500 }
      );
    }

    // Return the data directly without foreign key joins for now
    return NextResponse.json({ data });
  } catch (error) {
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
      return NextResponse.json(
        { error: 'Failed to create program finances' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid data provided' },
        { status: 400 }
      );
    }
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

    // Validate the request body (excluding member_program_id for updates)
    const { member_program_id, ...updateFields } = body;
    const validatedData = memberProgramFinancesSchema
      .omit({ member_program_id: true })
      .parse(updateFields);

    // Load current finances to compare for regeneration pre-check
    const { data: currentFinances } = await supabase
      .from('member_program_finances')
      .select('financing_type_id, finance_charges, discounts, taxes, contracted_at_margin, variance')
      .eq('member_program_id', id)
      .single();

    // ========================================
    // RECALCULATE TAXES SERVER-SIDE
    // ========================================
    // Always recalculate taxes from fresh database data to prevent
    // stale client-side cache from causing tax drift (critical bug fix)
    
    // 1. Fetch fresh program items with therapy info to calculate total_taxable_charge
    const { data: programItems, error: itemsError } = await supabase
      .from('member_program_items')
      .select('item_charge, quantity, therapies!inner(taxable)')
      .eq('member_program_id', id)
      .eq('active_flag', true);

    if (itemsError) {
      console.error('Failed to fetch program items for tax calculation:', itemsError);
      return NextResponse.json(
        { error: 'Failed to calculate taxes: could not fetch program items' },
        { status: 500 }
      );
    }

    // 2. Calculate total_charge and total_taxable_charge from items
    let totalCharge = 0;
    let totalTaxableCharge = 0;
    
    if (programItems && programItems.length > 0) {
      for (const item of programItems) {
        const itemCharge = Number(item.item_charge || 0) * Number(item.quantity || 0);
        totalCharge += itemCharge;
        if (item.therapies?.taxable) {
          totalTaxableCharge += itemCharge;
        }
      }
    }

    // 3. Get the discount value (use new value if being updated, otherwise current)
    const discountToUse = (validatedData as any).discounts !== undefined
      ? Number((validatedData as any).discounts)
      : Number(currentFinances?.discounts || 0);

    // 4. Recalculate taxes server-side using the proven financial calculation function
    const recalculatedTaxes = calculateTaxesOnTaxableItems(
      totalCharge,
      totalTaxableCharge,
      discountToUse
    );

    // 5. Override client-sent taxes with server-calculated value
    // This prevents stale browser cache from corrupting tax data
    (validatedData as any).taxes = recalculatedTaxes;

    console.log(`[Finances API] Tax recalculation for program ${id}:`, {
      totalCharge: Number(totalCharge).toFixed(2),
      totalTaxableCharge: Number(totalTaxableCharge).toFixed(2),
      discountToUse: Number(discountToUse).toFixed(2),
      recalculatedTaxes: Number(recalculatedTaxes).toFixed(2),
      clientSentTaxes: body.taxes !== undefined ? Number(body.taxes).toFixed(2) : 'not provided'
    });

    const updateData = {
      ...validatedData,
      updated_by: session.user.id,
    };

    // Determine if changes would require payments regeneration
    const finTypeChanged =
      (updateData as any).financing_type_id !== undefined &&
      (currentFinances
        ? (updateData as any).financing_type_id !==
          currentFinances.financing_type_id
        : true);
    const financeChargesChanged =
      (updateData as any).finance_charges !== undefined &&
      (currentFinances
        ? Number((updateData as any).finance_charges) !==
          Number(currentFinances.finance_charges)
        : true);
    const discountsChanged =
      (updateData as any).discounts !== undefined &&
      (currentFinances
        ? Number((updateData as any).discounts) !==
          Number(currentFinances.discounts)
        : true);
    const shouldRegenerate =
      finTypeChanged || financeChargesChanged || discountsChanged;

    if (shouldRegenerate) {
      // Block update if any payment is already marked paid to keep data consistent
      const { data: paidRows, error: paidErr } = await supabase
        .from('member_program_payments')
        .select('member_program_payment_id')
        .eq('member_program_id', id)
        .not('payment_date', 'is', null)
        .limit(1);
      if (paidErr) {
        return NextResponse.json(
          { error: 'Failed to validate payments state' },
          { status: 500 }
        );
      }
      if (paidRows && paidRows.length > 0) {
        return NextResponse.json(
          {
            error:
              'Cannot update finances because at least one payment is already paid.',
          },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: 'Program finances not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: 'Failed to update program finances',
          details: (error as any)?.message ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      console.error('[Finances API] Zod validation error:', error);
      return NextResponse.json(
        { error: 'Invalid data provided', details: (error as any).issues },
        { status: 400 }
      );
    }
    console.error('[Finances API] Unexpected error in PUT /finances:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null,
      },
      { status: 500 }
    );
  }
}
