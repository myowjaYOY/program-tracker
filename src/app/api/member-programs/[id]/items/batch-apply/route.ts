import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCents } from '@/lib/utils/money';

type Change =
  | {
      type: 'add';
      therapy_id: number;
      quantity: number;
      days_from_start?: number;
      days_between?: number;
      instructions?: string;
    }
  | { type: 'remove'; itemId: number }
  | {
      type: 'update';
      itemId: number;
      therapy_id?: number;
      quantity?: number;
      days_from_start?: number;
      days_between?: number;
      instructions?: string;
    };

interface ApplyBody {
  changes: Change[];
  expectedLocked: { price: number; margin: number };
  tolerance?: { priceCents?: number; marginPct?: number };
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

  const { id } = await context.params;
  let body: ApplyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const priceCentsTol = Math.max(
    0,
    Math.round(body.tolerance?.priceCents ?? 1)
  );
  const marginTol = body.tolerance?.marginPct ?? 0.1;

  // Load locked finances for authoritative values
  const { data: finances, error: finErr } = await supabase
    .from('member_program_finances')
    .select('final_total_price, margin, finance_charges, discounts')
    .eq('member_program_id', id)
    .single();
  if (finErr || !finances) {
    return NextResponse.json(
      { error: 'Program finances not found' },
      { status: 404 }
    );
  }
  const lockedPrice = Number(finances.final_total_price || 0);
  const lockedMargin = Number(finances.margin || 0);
  const financeCharges = Number(finances.finance_charges || 0);
  const discounts = Number(finances.discounts || 0);

  // Staleness check
  const exp = body.expectedLocked || { price: NaN, margin: NaN };
  if (
    Math.abs(Math.round((exp.price - lockedPrice) * 100)) > 0 ||
    Math.abs(exp.margin - lockedMargin) > 0.0001
  ) {
    return NextResponse.json(
      { error: 'Locked values changed; refresh and preview again.' },
      { status: 409 }
    );
  }

  // Apply all changes sequentially
  for (const ch of body.changes || []) {
    if (ch.type === 'remove') {
      const { error } = await supabase
        .from('member_program_items')
        .delete()
        .eq('member_program_item_id', ch.itemId)
        .eq('member_program_id', id);
      if (error) {
        console.error('batch-apply remove error:', error);
        return NextResponse.json(
          { error: 'Failed to remove item', details: error.message },
          { status: 500 }
        );
      }
    } else if (ch.type === 'update') {
      const upd: any = {};
      if (typeof ch.quantity === 'number')
        upd.quantity = Math.max(0, ch.quantity);
      if (typeof ch.days_from_start === 'number')
        upd.days_from_start = ch.days_from_start;
      if (typeof ch.days_between === 'number')
        upd.days_between = ch.days_between;
      if (typeof ch.instructions === 'string')
        upd.instructions = ch.instructions ?? '';
      if (typeof ch.therapy_id === 'number') {
        const { data: t, error: thErr } = await supabase
          .from('therapies')
          .select('cost, charge, taxable')
          .eq('therapy_id', ch.therapy_id)
          .single();
        if (thErr || !t)
          return NextResponse.json(
            { error: 'Therapy not found' },
            { status: 400 }
          );
        upd.therapy_id = ch.therapy_id;
        upd.item_cost = Number(t.cost || 0);
        upd.item_charge = Number(t.charge || 0);
      }
      upd.updated_by = session.user.id;
      const { error } = await supabase
        .from('member_program_items')
        .update(upd)
        .eq('member_program_item_id', ch.itemId)
        .eq('member_program_id', id);
      if (error) {
        console.error('batch-apply update error:', error, 'payload:', upd);
        return NextResponse.json(
          { error: 'Failed to update item', details: error.message },
          { status: 500 }
        );
      }
    } else if (ch.type === 'add') {
      const { data: t, error: thErr } = await supabase
        .from('therapies')
        .select('therapy_id, cost, charge, taxable')
        .eq('therapy_id', ch.therapy_id)
        .single();
      if (thErr || !t)
        return NextResponse.json(
          { error: 'Therapy not found' },
          { status: 400 }
        );
      const ins: any = {
        member_program_id: Number(id),
        therapy_id: t.therapy_id,
        quantity: Math.max(0, Number(ch.quantity || 0)),
        item_cost: Number(t.cost || 0),
        item_charge: Number(t.charge || 0),
        days_from_start: ch.days_from_start ?? 0,
        days_between: ch.days_between ?? 0,
        instructions: ch.instructions ?? '',
        active_flag: true,
        created_by: session.user.id,
        updated_by: session.user.id,
      };
      const { data: newItem, error } = await supabase
        .from('member_program_items')
        .insert(ins)
        .select()
        .single();
      if (error) {
        console.error('batch-apply add error:', error, 'payload:', ins);
        return NextResponse.json(
          { error: 'Failed to add item', details: error.message },
          { status: 500 }
        );
      }

      // Copy default tasks for the therapy into member_program_item_tasks (insert missing)
      try {
        const { data: tasks } = await supabase
          .from('therapy_tasks')
          .select('task_id, task_name, description, task_delay')
          .eq('therapy_id', ch.therapy_id)
          .eq('active_flag', true);
        if (tasks && tasks.length > 0 && newItem?.member_program_item_id) {
          const newItemId = newItem.member_program_item_id;
          const { data: existing } = await supabase
            .from('member_program_item_tasks')
            .select('task_id')
            .eq('member_program_item_id', newItemId);
          const existingSet = new Set(
            (existing || []).map((r: any) => r.task_id)
          );
          const toInsert = tasks
            .filter((t: any) => !existingSet.has(t.task_id))
            .map((t: any) => ({
              member_program_item_id: newItemId,
              task_id: t.task_id,
              task_name: t.task_name,
              description: t.description,
              task_delay: t.task_delay,
              created_by: session.user.id,
              updated_by: session.user.id,
            }));
          if (toInsert.length > 0) {
            await supabase.from('member_program_item_tasks').insert(toInsert);
          }
        }
      } catch (e) {
        console.error('batch-apply task copy error:', e);
      }
    }
  }

  // Recompute totals after applying
  const { data: postItems, error: postErr } = await supabase
    .from('member_program_items')
    .select(`
      item_cost, 
      item_charge, 
      quantity,
      therapies(
        taxable
      )
    `)
    .eq('member_program_id', id);
  if (postErr) {
    console.error('batch-apply post load items error:', postErr);
    return NextResponse.json(
      { error: 'Failed to load updated items', details: postErr.message },
      { status: 500 }
    );
  }
  let charge = 0;
  let cost = 0;
  let totalTaxableCharge = 0;
  for (const r of postItems || []) {
    const quantity = Number(r.quantity || 0);
    const itemCharge = Number(r.item_charge || 0);
    const itemCost = Number(r.item_cost || 0);
    const isTaxable = (r.therapies as any)?.taxable === true;
    
    charge += itemCharge * quantity;
    cost += itemCost * quantity;
    
    // Track taxable charge separately
    if (isTaxable) {
      totalTaxableCharge += itemCharge * quantity;
    }
  }
  
  // Calculate proportional discount for taxable items
  let calculatedTaxes = 0;
  if (charge > 0 && totalTaxableCharge > 0) {
    // Calculate what percentage of the total charge is taxable
    const taxablePercentage = totalTaxableCharge / charge;
    // Apply that percentage of the discount to taxable items
    const taxableDiscount = Math.abs(discounts) * taxablePercentage;
    // Calculate taxes on the discounted taxable amount
    const discountedTaxableCharge = totalTaxableCharge - taxableDiscount;
    calculatedTaxes = discountedTaxableCharge * 0.0825;
  }
  const projectedPrice = charge + financeCharges + discounts + calculatedTaxes;
  const projectedMargin =
    lockedPrice > 0 ? ((lockedPrice - (cost + calculatedTaxes)) / lockedPrice) * 100 : 0;
  const priceDeltaCents = toCents(projectedPrice) - toCents(lockedPrice);
  const marginDelta = projectedMargin - lockedMargin;
  const ok =
    Math.abs(priceDeltaCents) <= priceCentsTol &&
    Math.abs(marginDelta) <= marginTol;

  if (!ok) {
    return NextResponse.json(
      {
        error: 'Locked values would change. No changes committed.',
        deltas: { price: projectedPrice - lockedPrice, margin: marginDelta },
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    projected: { price: projectedPrice, margin: projectedMargin, charge, cost },
  });
}
