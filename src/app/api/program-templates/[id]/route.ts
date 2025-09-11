import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    
    const { data, error } = await supabase
      .from('program_template')
      .select('*')
      .eq('program_template_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Program template not found' }, { status: 404 });
      }
      console.error('Error fetching program template:', error);
      return NextResponse.json({ error: 'Failed to fetch program template' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in program template GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    
    // Validate required fields
    if (body.program_template_name !== undefined && !body.program_template_name) {
      return NextResponse.json({ error: 'Template name cannot be empty' }, { status: 400 });
    }

    const updateData = {
      ...body,
      updated_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('program_template')
      .update(updateData)
      .eq('program_template_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating program template:', error);
      return NextResponse.json({ error: 'Failed to update program template' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in program template PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    
    // Check if template has items
    const { data: items, error: itemsError } = await supabase
      .from('program_template_items')
      .select('program_template_items_id')
      .eq('program_template_id', id)
      .eq('active_flag', true);

    if (itemsError) {
      console.error('Error checking template items:', itemsError);
      return NextResponse.json({ error: 'Failed to check template items' }, { status: 500 });
    }

    if (items && items.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete template with active items. Remove all items first.' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('program_template')
      .delete()
      .eq('program_template_id', id);

    if (error) {
      console.error('Error deleting program template:', error);
      return NextResponse.json({ error: 'Failed to delete program template' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Program template deleted successfully' });
  } catch (error) {
    console.error('Error in program template DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
