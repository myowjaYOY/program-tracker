import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !user?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get user permissions
    const { data: permissions, error } = await supabase
      .from('user_menu_permissions')
      .select('menu_path')
      .eq('user_id', id);

    if (error) {
      console.error('Error fetching user permissions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user permissions' },
        { status: 500 }
      );
    }

    const permissionPaths = permissions?.map(p => p.menu_path) || [];

    return NextResponse.json({ data: permissionPaths });
  } catch (error) {
    console.error('User permissions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !user?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { menuPaths } = body;

    if (!Array.isArray(menuPaths)) {
      return NextResponse.json(
        { error: 'menuPaths must be an array' },
        { status: 400 }
      );
    }

    // Delete existing permissions
    await supabase.from('user_menu_permissions').delete().eq('user_id', id);

    // Insert new permissions
    if (menuPaths.length > 0) {
      const permissions = menuPaths.map((path: string) => ({
        user_id: id,
        menu_path: path,
        granted_by: session.user.id,
      }));

      const { error: insertError } = await supabase
        .from('user_menu_permissions')
        .insert(permissions);

      if (insertError) {
        console.error('Error inserting permissions:', insertError);
        return NextResponse.json(
          { error: 'Failed to update permissions' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      message: 'Permissions updated successfully',
      count: menuPaths.length,
    });
  } catch (error) {
    console.error('Update permissions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
