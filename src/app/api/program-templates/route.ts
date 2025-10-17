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

    // Use foreign key joins like other working APIs (vendors, leads)
    let query = supabase
      .from('program_template')
      .select(
        `*,
        created_user:users!program_template_created_by_fkey(id,email,full_name),
        updated_user:users!program_template_updated_by_fkey(id,email,full_name)
      `
      )
      .order('program_template_name');

    if (activeOnly) {
      query = query.eq('active_flag', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching program templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch program templates' },
        { status: 500 }
      );
    }

    // Map to flat fields for frontend (same pattern as vendors API)
    const mapped = (data || []).map(template => ({
      ...template,
      created_by_email: template.created_user?.email || null,
      created_by_full_name: template.created_user?.full_name || null,
      updated_by_email: template.updated_user?.email || null,
      updated_by_full_name: template.updated_user?.full_name || null,
    }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error('Error in program templates GET:', error);
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

    // Validate required fields
    if (!body.program_template_name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const templateData = {
      program_template_name: body.program_template_name,
      description: body.description || '',
      active_flag: body.active_flag ?? true,
      total_cost: 0,
      total_charge: 0,
      margin_percentage: 0,
      created_by: session.user.id,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template')
      .insert([templateData])
      .select()
      .single();

    if (error) {
      console.error('Error creating program template:', error);
      return NextResponse.json(
        { error: 'Failed to create program template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in program templates POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
