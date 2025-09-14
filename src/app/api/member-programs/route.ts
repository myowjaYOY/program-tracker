import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';

    // STANDARD: Join to related tables using existing foreign keys (following vendors pattern)
    let query = supabase
      .from('member_programs')
      .select(`
        *,
        created_user:users!member_programs_created_by_fkey(id, email, full_name),
        updated_user:users!member_programs_updated_by_fkey(id, email, full_name),
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name, email),
        program_status:program_status!fk_member_programs_program_status(program_status_id, status_name),
        program_template:program_template!fk_member_programs_source_template(program_template_id, program_template_name),
        finances:member_program_finances!fk_member_program_finances_program(margin)
      `)
      .order('program_template_name');

    if (activeOnly) {
      query = query.eq('active_flag', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching member programs:', error);
      return NextResponse.json({ error: 'Failed to fetch member programs' }, { status: 500 });
    }

    console.log('Raw member program data from database:', data);

    // Map to flat fields for frontend (following vendors pattern)
    const mapped = (data || []).map(program => ({
      ...program,
      created_by_email: program.created_user?.email || null,
      created_by_full_name: program.created_user?.full_name || null,
      updated_by_email: program.updated_user?.email || null,
      updated_by_full_name: program.updated_user?.full_name || null,
      lead_name: program.lead ? `${program.lead.first_name} ${program.lead.last_name}`.trim() : null,
      lead_email: program.lead?.email || null,
      template_name: program.program_template?.program_template_name || null,
      status_name: program.program_status?.status_name || null,
      margin: program.finances?.margin || null,
    }));

    console.log('Mapped member program data:', mapped);

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error('Error in member programs GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    
    // Validate required fields for using the database function
    if (!body.lead_id || !body.source_template_id) {
      return NextResponse.json({ error: 'Lead ID and source template ID are required' }, { status: 400 });
    }

    // Use the database function to create member program and copy template items
    const { data: newProgramId, error: functionError } = await supabase.rpc(
      'create_member_program_from_template',
      {
        p_lead_id: body.lead_id,
        p_template_id: body.source_template_id,
        p_start_date: body.start_date || null
      }
    );

    if (functionError) {
      console.error('Error calling create_member_program_from_template:', functionError);
      console.error('Function error details:', JSON.stringify(functionError, null, 2));
      return NextResponse.json({ 
        error: 'Failed to create member program from template', 
        details: functionError.message || 'Unknown database error' 
      }, { status: 500 });
    }

    // Update the created program with custom name and description if provided
    if (body.program_template_name || body.description) {
      const updateData: any = {
        updated_by: session.user.id,
      };
      
      if (body.program_template_name) {
        updateData.program_template_name = body.program_template_name;
      }
      
      if (body.description !== undefined) {
        updateData.description = body.description;
      }

      if (body.program_status_id) {
        updateData.program_status_id = body.program_status_id;
      }

      const { error: updateError } = await supabase
        .from('member_programs')
        .update(updateData)
        .eq('member_program_id', newProgramId);

      if (updateError) {
        console.error('Error updating member program:', updateError);
        return NextResponse.json({ error: 'Failed to update member program details' }, { status: 500 });
      }
    }

    // Fetch the created program with basic details (no joins to avoid FK issues)
    const { data: createdProgram, error: fetchError } = await supabase
      .from('member_programs')
      .select('*')
      .eq('member_program_id', newProgramId)
      .single();

    if (fetchError) {
      console.error('Error fetching created member program:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch created member program' }, { status: 500 });
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
    console.error('Error in member programs POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
