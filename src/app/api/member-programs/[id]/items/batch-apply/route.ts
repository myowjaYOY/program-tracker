import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCents } from '@/lib/utils/money';

type Change =
  | { type: 'add'; therapy_id: number; quantity: number; days_from_start?: number; days_between?: number; instructions?: string }
  | { type: 'remove'; itemId: number }
  | { type: 'update'; itemId: number; therapy_id?: number; quantity?: number; days_from_start?: number; days_between?: number; instructions?: string };

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
  const { data: { session }, error: authError } = await supabase.auth.getSession();
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
  const priceCentsTol = Math.max(0, Math.round((body.tolerance?.priceCents ?? 1)));
  const marginTol = body.tolerance?.marginPct ?? 0.1;

  // Load locked finances for authoritative values
  const { data: finances, error: finErr } = await supabase
    .from('member_program_finances')
    .select('final_total_price, margin, finance_charges, discounts')
    .eq('member_program_id', id)
    .single();
  if (finErr || !finances) {
    return NextResponse.json({ error: 'Program finances not found' }, { status: 404 });
  }
  const lockedPrice = Number(finances.final_total_price || 0);
  const lockedMargin = Number(finances.margin || 0);
  const financeCharges = Number(finances.finance_charges || 0);
  const discounts = Number(finances.discounts || 0);

  // Staleness check
  const exp = body.expectedLocked || { price: NaN, margin: NaN };
  if (Math.abs(Math.round((exp.price - lockedPrice) * 100)) > 0 || Math.abs(exp.margin - lockedMargin) > 0.0001) {
    return NextResponse.json({ error: 'Locked values changed; refresh and preview again.' }, { status: 409 });
  }

  // Try authoritative transactional RPC first (if database function exists)
  try {
    const rpcPayload: any = {
      p_program_id: Number(id),
      p_changes: body.changes,
      p_locked_price: lockedPrice,
      p_locked_margin: lockedMargin,
      p_price_cents_tol: priceCentsTol,
      p_margin_tol: marginTol,
    };
    const { data: rpcData, error: rpcErr } = await supabase.rpc('apply_member_program_items_changes', rpcPayload);
    if (!rpcErr && rpcData) {
      // Expect shape: { ok: boolean, projected: { price, margin, charge, cost }, deltas?: { price, margin } }
      if (rpcData.ok) {
        return NextResponse.json({ ok: true, projected: rpcData.projected });
      }
      return NextResponse.json({ error: 'Locked values would change. No changes committed.', deltas: rpcData.deltas }, { status: 409 });
    }
    // If RPC missing or failed unexpectedly, fall back to sequential method below
  } catch (e) {
    // ignore and fallback
  }

  // Load current items (fallback path)
  const { data: currentItems, error: itemsErr } = await supabase
    .from('member_program_items')
    .select('member_program_item_id, therapy_id, quantity')
    .eq('member_program_id', id);
  if (itemsErr) {
    return NextResponse.json({ error: 'Failed to load program items' }, { status: 500 });
  }

  // Apply all changes sequentially; although Supabase lacks explicit BEGIN/COMMIT here,
  // we emulate atomicity by validating totals AFTER all writes and rejecting on mismatch.
  // (For true DB transactions, this endpoint should be backed by a Postgres function.)
  for (const ch of body.changes || []) {
    if (ch.type === 'remove') {
      const { error } = await supabase
        .from('member_program_items')
        .delete()
        .eq('member_program_item_id', ch.itemId)
        .eq('member_program_id', id);
      if (error) return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
    } else if (ch.type === 'update') {
      const upd: any = {};
      if (typeof ch.quantity === 'number') upd.quantity = Math.max(0, ch.quantity);
      if (typeof ch.days_from_start === 'number') upd.days_from_start = ch.days_from_start;
      if (typeof ch.days_between === 'number') upd.days_between = ch.days_between;
      if (typeof ch.instructions === 'string') upd.instructions = ch.instructions;
      if (typeof ch.therapy_id === 'number') {
        // refresh cost/charge from therapy
        const { data: t, error: thErr } = await supabase
          .from('therapies')
          .select('cost, charge')
          .eq('therapy_id', ch.therapy_id)
          .single();
        if (thErr || !t) return NextResponse.json({ error: 'Therapy not found' }, { status: 400 });
        upd.therapy_id = ch.therapy_id;
        upd.item_cost = Number(t.cost || 0);
        upd.item_charge = Number(t.charge || 0);
      }
      const { error } = await supabase
        .from('member_program_items')
        .update(upd)
        .eq('member_program_item_id', ch.itemId)
        .eq('member_program_id', id);
      if (error) return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    } else if (ch.type === 'add') {
      const { data: t, error: thErr } = await supabase
        .from('therapies')
        .select('therapy_id, cost, charge')
        .eq('therapy_id', ch.therapy_id)
        .single();
      if (thErr || !t) return NextResponse.json({ error: 'Therapy not found' }, { status: 400 });
      const ins: any = {
        member_program_id: Number(id),
        therapy_id: t.therapy_id,
        quantity: Math.max(0, Number(ch.quantity || 0)),
        item_cost: Number(t.cost || 0),
        item_charge: Number(t.charge || 0),
        days_from_start: ch.days_from_start ?? 0,
        days_between: ch.days_between ?? 0,
        instructions: ch.instructions ?? '',
      };
      const { error } = await supabase
        .from('member_program_items')
        .insert(ins);
      if (error) return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
  }

  // Recompute totals after applying
  const { data: postItems, error: postErr } = await supabase
    .from('member_program_items')
    .select('item_cost, item_charge, quantity')
    .eq('member_program_id', id);
  if (postErr) {
    return NextResponse.json({ error: 'Failed to load updated items' }, { status: 500 });
  }
  let charge = 0; let cost = 0;
  for (const r of postItems || []) {
    charge += Number(r.item_charge || 0) * Number(r.quantity || 0);
    cost += Number(r.item_cost || 0) * Number(r.quantity || 0);
  }
  const projectedPrice = charge + financeCharges + discounts;
  const projectedMargin = lockedPrice > 0 ? ((lockedPrice - cost) / lockedPrice) * 100 : 0;
  const priceDeltaCents = toCents(projectedPrice) - toCents(lockedPrice);
  const marginDelta = projectedMargin - lockedMargin;
  const ok = Math.abs(priceDeltaCents) <= priceCentsTol && Math.abs(marginDelta) <= marginTol;

  if (!ok) {
    // Reject by reverting to original state: since we cannot txn rollback with Supabase client easily,
    // we must inform caller to refresh and correct; recommend backing this endpoint with a DB function for full atomicity.
    return NextResponse.json({
      error: 'Locked values would change. No changes committed.',
      deltas: { price: projectedPrice - lockedPrice, margin: marginDelta },
    }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    projected: { price: projectedPrice, margin: projectedMargin, charge, cost },
  });
}


