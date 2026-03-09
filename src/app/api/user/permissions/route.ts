import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase, user: authUser } = auth;

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin, is_super_admin, is_active')
      .eq('id', authUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If admin, return all permissions
    if (user.is_admin) {
      return NextResponse.json({
        isAdmin: true,
        isSuperAdmin: user.is_super_admin || false,
        permissions: ['*'], // * means all permissions
        isActive: user.is_active,
      });
    }

    // Get user's specific permissions
    const { data: permissions, error: permissionsError } = await supabase
      .from('user_menu_permissions')
      .select('menu_path')
      .eq('user_id', authUser.id);

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
      isSuperAdmin: user.is_super_admin || false,
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
