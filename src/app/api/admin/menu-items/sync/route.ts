import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MENU_ITEMS } from '@/lib/config/menu-items';

export async function POST() {
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

    const validPaths = MENU_ITEMS.map(item => item.path);

    // Clean up permissions for paths no longer in MENU_ITEMS
    const { data: allPermissions } = await supabase
      .from('user_menu_permissions')
      .select('menu_path');

    if (allPermissions) {
      const stalePermPaths = [
        ...new Set(allPermissions.map(p => p.menu_path)),
      ].filter(path => !validPaths.includes(path));

      if (stalePermPaths.length > 0) {
        await supabase
          .from('user_menu_permissions')
          .delete()
          .in('menu_path', stalePermPaths);
      }
    }

    // Clear and rebuild menu_items table
    const { error: clearError } = await supabase
      .from('menu_items')
      .delete()
      .neq('id', 0);

    if (clearError) {
      console.error('Error clearing menu items:', clearError);
      return NextResponse.json(
        { error: 'Failed to clear menu items' },
        { status: 500 }
      );
    }

    // Insert all current menu items
    const { error: insertError } = await supabase.from('menu_items').insert(
      MENU_ITEMS.map(item => ({
        path: item.path,
        label: item.label,
        section: item.section,
        icon: item.icon,
      }))
    );

    if (insertError) {
      console.error('Error inserting menu items:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert menu items' },
        { status: 500 }
      );
    }

    // Auto-assign menu items to admin users
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id')
      .eq('is_admin', true);

    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        for (const path of validPaths) {
          const { data: existingPermission } = await supabase
            .from('user_menu_permissions')
            .select('id')
            .eq('user_id', admin.id)
            .eq('menu_path', path)
            .single();

          if (!existingPermission) {
            await supabase.from('user_menu_permissions').insert({
              user_id: admin.id,
              menu_path: path,
              granted_by: session.user.id,
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Menu items synced successfully',
      total: MENU_ITEMS.length,
    });
  } catch (error) {
    console.error('Menu sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync menu items' },
      { status: 500 }
    );
  }
}
