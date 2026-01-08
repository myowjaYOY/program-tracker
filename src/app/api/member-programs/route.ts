import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';

    // STANDARD: Join to related tables using existing foreign keys (following vendors pattern)
    let query = supabase
      .from('member_programs')
      .select(
        `
        *,
        created_user:users!member_programs_created_by_fkey(id, email, full_name),
        updated_user:users!member_programs_updated_by_fkey(id, email, full_name),
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name, email),
        program_status:program_status!fk_member_programs_program_status(program_status_id, status_name),
        program_template:program_template!fk_member_programs_source_template(program_template_id, program_template_name),
        member_program_finances(member_program_finance_id, margin, finance_charges, taxes, discounts, final_total_price)
      `
      )
      .order('program_template_name');

    if (activeOnly) {
      query = query.eq('active_flag', true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch member programs' },
        { status: 500 }
      );
    }

    // Map to flat fields for frontend (following vendors pattern)
    const mapped = (data || []).map(program => {
      // Get the first finance record (there should only be one per program)
      const financeRecord =
        program.member_program_finances &&
        program.member_program_finances.length > 0
          ? program.member_program_finances[0]
          : null;

      return {
        ...program,
        created_by_email: program.created_user?.email || null,
        created_by_full_name: program.created_user?.full_name || null,
        updated_by_email: program.updated_user?.email || null,
        updated_by_full_name: program.updated_user?.full_name || null,
        lead_name: program.lead
          ? `${program.lead.first_name} ${program.lead.last_name}`.trim()
          : null,
        lead_email: program.lead?.email || null,
        template_name: program.program_template?.program_template_name || null,
        status_name: program.program_status?.status_name || null,
        margin: financeRecord?.margin ?? null,
        final_total_price: financeRecord?.final_total_price ?? null,
      };
    });

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate required fields for using the database function
    if (!body.lead_id || !body.selected_template_ids || !Array.isArray(body.selected_template_ids) || body.selected_template_ids.length === 0) {
      return NextResponse.json(
        { error: 'Lead ID and at least one template ID are required' },
        { status: 400 }
      );
    }

    // Validate that lead exists
    const { data: leadExists, error: leadError } = await supabase
      .from('leads')
      .select('lead_id')
      .eq('lead_id', body.lead_id)
      .single();

    if (leadError || !leadExists) {
      return NextResponse.json(
        { error: `Lead with ID ${body.lead_id} does not exist` },
        { status: 400 }
      );
    }

    // Validate that all templates exist
    const { data: templatesExist, error: templateError } = await supabase
      .from('program_template')
      .select('program_template_id')
      .in('program_template_id', body.selected_template_ids);

    if (templateError || !templatesExist || templatesExist.length !== body.selected_template_ids.length) {
      return NextResponse.json(
        {
          error: 'One or more selected templates do not exist',
        },
        { status: 400 }
      );
    }

    // Use the database function to create member program and copy template items
    const { data: newProgramId, error: functionError } = await supabase.rpc(
      'create_member_program_from_template',
      {
        p_lead_id: body.lead_id,
        p_template_ids: body.selected_template_ids,
        p_program_name: body.program_template_name,
        p_description: body.description || '',
        p_start_date: body.start_date || null,
      }
    );

    if (functionError) {
      return NextResponse.json(
        {
          error: 'Failed to create member program from template',
          details: functionError.message || 'Unknown database error',
        },
        { status: 500 }
      );
    }

    // Build update payload for fields not handled by the database function
    const updatePayload: Record<string, unknown> = {
      updated_by: session.user.id,
    };

    // Update program status if provided
    if (body.program_status_id) {
      updatePayload.program_status_id = body.program_status_id;
    }

    // Update program_type if provided (critical for membership programs)
    if (body.program_type && (body.program_type === 'one-time' || body.program_type === 'membership')) {
      updatePayload.program_type = body.program_type;
      
      // For membership programs, set duration to 30 (monthly billing cycle)
      if (body.program_type === 'membership') {
        updatePayload.duration = 30;
      }
    }

    // Apply updates if we have any fields to update
    if (Object.keys(updatePayload).length > 1) { // More than just updated_by
      const { error: updateError } = await supabase
        .from('member_programs')
        .update(updatePayload)
        .eq('member_program_id', newProgramId);

      if (updateError) {
        console.error('Failed to update member program after creation:', updateError);
        return NextResponse.json(
          { error: 'Failed to update member program after creation' },
          { status: 500 }
        );
      }
    }

    // Fetch the created program with basic details (no joins to avoid FK issues)
    const { data: createdProgram, error: fetchError } = await supabase
      .from('member_programs')
      .select('*')
      .eq('member_program_id', newProgramId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch created member program' },
        { status: 500 }
      );
    }

    // Map the response with basic fields (joins will be handled by the GET endpoint)
    const mappedProgram = {
      ...createdProgram,
      created_by_email: null, // Will be populated by GET endpoint
      created_by_full_name: null,
      updated_by_email: null,
      updated_by_full_name: null,
      lead_email: null,
      lead_name: null,
      template_name: null,
      status_name: null,
    };

    return NextResponse.json({ data: mappedProgram }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
