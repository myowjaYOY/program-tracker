import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; action?: string }> }
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
    const programId = Number(id);
    if (!Number.isFinite(programId)) {
      return NextResponse.json(
        { error: 'Invalid program id' },
        { status: 400 }
      );
    }

    // Expect a query parameter ?action=pause
    // Example: POST /api/member-programs/123?action=pause
    const url = new URL(_req.url);
    const action = url.searchParams.get('action');
    if (action !== 'pause') {
      return NextResponse.json(
        { error: 'Unsupported action' },
        { status: 400 }
      );
    }

    const { error } = await supabase.rpc('pause_member_program', {
      p_program_id: programId,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to pause program schedules' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// (imports already declared at top)

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
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
      .from('member_programs')
      .select(
        `*,
        lead:leads!fk_member_programs_lead(lead_id,first_name,last_name,email),
        program_template:program_template!fk_member_programs_source_template(program_template_id,program_template_name),
        program_status:program_status!fk_member_programs_program_status(program_status_id,status_name)
      `
      )
      .eq('member_program_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Member program not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching member program:', error);
      return NextResponse.json(
        { error: 'Failed to fetch member program' },
        { status: 500 }
      );
    }

    // Map to flat fields for frontend
    const mapped = {
      ...data,
      created_by_email: null, // No user join available
      created_by_full_name: null, // No user join available
      updated_by_email: null, // No user join available
      updated_by_full_name: null, // No user join available
      lead_name: data.lead
        ? `${data.lead.first_name} ${data.lead.last_name}`
        : null,
      lead_email: data.lead?.email || null,
      template_name: data.program_template?.program_template_name || null,
      status_name: data.program_status?.status_name || null,
    };

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error('Error in member program GET:', error);
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

    // Validate required fields
    if (
      body.program_template_name !== undefined &&
      !body.program_template_name
    ) {
      return NextResponse.json(
        { error: 'Program name cannot be empty' },
        { status: 400 }
      );
    }

    // Validate status transitions if program_status_id is being changed
    if (body.program_status_id !== undefined) {
      // DEBUG: Log the incoming status ID
      console.log('[DEBUG] Incoming program_status_id:', body.program_status_id, 'Type:', typeof body.program_status_id);
      
      // Fetch current program with status
      const { data: currentProgram, error: fetchError } = await supabase
        .from('member_programs')
        .select('program_status_id, program_status(status_name)')
        .eq('member_program_id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching current program:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch program data' },
          { status: 500 }
        );
      }

      console.log('[DEBUG] Current program status_id:', currentProgram.program_status_id);

      // Only validate if status is actually changing
      if (currentProgram.program_status_id !== body.program_status_id) {
        console.log('[DEBUG] Status is changing, validating...');
        // Fetch new status name
        const { data: newStatus, error: statusError } = await supabase
          .from('program_status')
          .select('status_name')
          .eq('program_status_id', body.program_status_id)
          .single();

        if (statusError) {
          console.error('[DEBUG] Error fetching new status for ID:', body.program_status_id);
          console.error('[DEBUG] Status error details:', statusError);
          return NextResponse.json(
            { error: 'Invalid status ID' },
            { status: 400 }
          );
        }
        
        console.log('[DEBUG] New status found:', newStatus);

        // Validate transition
        const currentStatusName = ((currentProgram as any).program_status?.status_name || '').toLowerCase();
        const newStatusName = (newStatus.status_name || '').toLowerCase();
        
        // Status transition rules
        const getValidTransitions = (status: string): string[] => {
          switch (status) {
            case 'quote':
              return ['active', 'cancelled'];
            case 'active':
              return ['paused', 'cancelled', 'completed'];
            case 'paused':
              return ['active', 'cancelled', 'completed'];
            case 'completed':
            case 'cancelled':
              return []; // Final states
            default:
              return [];
          }
        };

        const validTransitions = getValidTransitions(currentStatusName);
        if (!validTransitions.includes(newStatusName)) {
          const validTransitionsStr = validTransitions.length > 0 
            ? validTransitions.join(', ')
            : 'none (final state)';
          return NextResponse.json(
            { 
              error: `Invalid status transition: ${currentStatusName} cannot be changed to ${newStatusName}. Valid transitions: ${validTransitionsStr}` 
            },
            { status: 400 }
          );
        }
      }
    }

    const updateData = {
      ...body,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('member_programs')
      .update(updateData)
      .eq('member_program_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating member program:', error);
      return NextResponse.json(
        { error: 'Failed to update member program' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in member program PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
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
    const { id } = context.params;

    // Check if program has items
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select('member_program_item_id')
      .eq('member_program_id', id)
      .eq('active_flag', true);

    if (itemsError) {
      console.error('Error checking program items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to check program items' },
        { status: 500 }
      );
    }

    if (items && items.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete program with active items. Remove all items first.',
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('member_programs')
      .delete()
      .eq('member_program_id', id);

    if (error) {
      console.error('Error deleting member program:', error);
      return NextResponse.json(
        { error: 'Failed to delete member program' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Member program deleted successfully',
    });
  } catch (error) {
    console.error('Error in member program DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
