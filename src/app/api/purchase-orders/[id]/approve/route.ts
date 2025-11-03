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
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Only admins can approve purchase orders' }, { status: 403 });
    }

    // Get current PO to verify status
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('po_id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (currentPO.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `Cannot approve PO with status: ${currentPO.status}. Only POs with status 'pending_approval' can be approved.` },
        { status: 400 }
      );
    }

    // Update PO status to approved
    const { data: updatedPO, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('po_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PO Approve API] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updatedPO }, { status: 200 });
  } catch (error: any) {
    console.error('[PO Approve API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve purchase order' },
      { status: 500 }
    );
  }
}

