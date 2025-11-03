import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get current PO to verify status
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('po_id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (currentPO.status !== 'approved') {
      return NextResponse.json(
        { error: `Cannot order PO with status: ${currentPO.status}. Only POs with status 'approved' can be ordered.` },
        { status: 400 }
      );
    }

    // Update PO status to ordered
    const { data: updatedPO, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'ordered',
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('po_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PO Order API] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updatedPO }, { status: 200 });
  } catch (error: any) {
    console.error('[PO Order API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to order purchase order' },
      { status: 500 }
    );
  }
}

