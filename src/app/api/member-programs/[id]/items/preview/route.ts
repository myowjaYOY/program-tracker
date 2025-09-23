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

interface PreviewBody {
  changes: Change[];
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
  let body: PreviewBody;
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

  // Load locked finances
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

  // Load current items with therapy refs
  const { data: items, error: itemsErr } = await supabase
    .from('member_program_items')
    .select(
      'member_program_item_id, therapy_id, quantity, item_cost, item_charge'
    )
    .eq('member_program_id', id);
  if (itemsErr) {
    return NextResponse.json(
      { error: 'Failed to load program items' },
      { status: 500 }
    );
  }

  // Build working set and collect therapy ids we may need
  const working = new Map<
    number,
    {
      itemId: number;
      therapy_id: number;
      quantity: number;
      item_cost: number;
      item_charge: number;
    }
  >();
  const therapyNeeded = new Set<number>();
  for (const it of items || []) {
    working.set(it.member_program_item_id, {
      itemId: it.member_program_item_id,
      therapy_id: it.therapy_id as number,
      quantity: Number(it.quantity || 0),
      item_cost: Number(it.item_cost || 0),
      item_charge: Number(it.item_charge || 0),
    });
  }
  for (const ch of body.changes || []) {
    if (ch.type === 'add' || (ch.type === 'update' && ch.therapy_id)) {
      therapyNeeded.add((ch as any).therapy_id);
    }
  }

  const therapyMap = new Map<number, { cost: number; charge: number }>();
  if (therapyNeeded.size > 0) {
    const { data: therapies, error: thErr } = await supabase
      .from('therapies')
      .select('therapy_id, cost, charge')
      .in('therapy_id', Array.from(therapyNeeded));
    if (thErr) {
      return NextResponse.json(
        { error: 'Failed to load therapies' },
        { status: 500 }
      );
    }
    for (const t of therapies || []) {
      therapyMap.set(t.therapy_id as number, {
        cost: Number(t.cost || 0),
        charge: Number(t.charge || 0),
      });
    }
  }

  // Apply staged changes in memory
  for (const ch of body.changes || []) {
    if (ch.type === 'remove') {
      working.delete(ch.itemId);
    } else if (ch.type === 'update') {
      const cur = working.get(ch.itemId);
      if (!cur) continue;
      const next = { ...cur };
      if (typeof ch.quantity === 'number')
        next.quantity = Math.max(0, ch.quantity);
      if (typeof ch.therapy_id === 'number') {
        const t = therapyMap.get(ch.therapy_id);
        if (!t) {
          return NextResponse.json(
            { error: `Therapy ${ch.therapy_id} not found` },
            { status: 400 }
          );
        }
        next.therapy_id = ch.therapy_id;
        next.item_cost = t.cost;
        next.item_charge = t.charge;
      }
      working.set(ch.itemId, next);
    } else if (ch.type === 'add') {
      const t = therapyMap.get(ch.therapy_id);
      if (!t) {
        return NextResponse.json(
          { error: `Therapy ${ch.therapy_id} not found` },
          { status: 400 }
        );
      }
      // Use negative temp id to avoid collision
      const tempId = -1 * (working.size + Math.floor(Math.random() * 1000) + 1);
      working.set(tempId, {
        itemId: tempId,
        therapy_id: ch.therapy_id,
        quantity: Math.max(0, Number(ch.quantity || 0)),
        item_cost: t.cost,
        item_charge: t.charge,
      });
    }
  }

  // Totals
  let projectedCharge = 0;
  let projectedCost = 0;
  working.forEach(v => {
    projectedCharge += Number(v.item_charge || 0) * Number(v.quantity || 0);
    projectedCost += Number(v.item_cost || 0) * Number(v.quantity || 0);
  });
  const projectedPrice = projectedCharge + financeCharges + discounts;
  const projectedMargin =
    lockedPrice > 0 ? ((lockedPrice - projectedCost) / lockedPrice) * 100 : 0;

  const priceDeltaCents = toCents(projectedPrice) - toCents(lockedPrice);
  const marginDelta = projectedMargin - lockedMargin;
  const ok =
    Math.abs(priceDeltaCents) <= priceCentsTol &&
    Math.abs(marginDelta) <= marginTol;

  return NextResponse.json({
    ok,
    locked: { price: lockedPrice, margin: lockedMargin },
    projected: {
      price: projectedPrice,
      margin: projectedMargin,
      charge: projectedCharge,
      cost: projectedCost,
    },
    deltas: {
      price: projectedPrice - lockedPrice,
      margin: marginDelta,
    },
  });
}
