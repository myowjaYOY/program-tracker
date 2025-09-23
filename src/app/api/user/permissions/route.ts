import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin, is_active')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If admin, return all permissions
    if (user.is_admin) {
      return NextResponse.json({
        isAdmin: true,
        permissions: ['*'], // * means all permissions
        isActive: user.is_active,
      });
    }

    // Get user's specific permissions
    const { data: permissions, error: permissionsError } = await supabase
      .from('user_menu_permissions')
      .select('menu_path')
      .eq('user_id', session.user.id);

    if (permissionsError) {
      console.error('Error fetching user permissions:', permissionsError);
      return NextResponse.json(
        { error: 'Failed to fetch permissions' },
        { status: 500 }
      );
    }

    const permissionPaths = permissions?.map(p => p.menu_path) || [];

    return NextResponse.json({
      isAdmin: false,
      permissions: permissionPaths,
      isActive: user.is_active,
    });
  } catch (error) {
    console.error('User permissions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
