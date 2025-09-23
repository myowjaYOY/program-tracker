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

    // Sync menu items
    let syncedCount = 0;
    let newItemsCount = 0;

    for (const item of MENU_ITEMS) {
      const { data: existingItem } = await supabase
        .from('menu_items')
        .select('id')
        .eq('path', item.path)
        .single();

      if (existingItem) {
        // Update existing item
        await supabase
          .from('menu_items')
          .update({
            label: item.label,
            section: item.section,
            icon: item.icon,
            updated_at: new Date().toISOString(),
          })
          .eq('path', item.path);
        syncedCount++;
      } else {
        // Insert new item
        await supabase.from('menu_items').insert({
          path: item.path,
          label: item.label,
          section: item.section,
          icon: item.icon,
        });
        newItemsCount++;
        syncedCount++;
      }
    }

    // Auto-assign new menu items to admin users
    if (newItemsCount > 0) {
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('is_admin', true);

      if (adminUsers && adminUsers.length > 0) {
        const newMenuPaths = MENU_ITEMS.map(item => item.path);

        for (const admin of adminUsers) {
          for (const path of newMenuPaths) {
            // Check if admin already has this permission
            const { data: existingPermission } = await supabase
              .from('user_menu_permissions')
              .select('id')
              .eq('user_id', admin.id)
              .eq('menu_path', path)
              .single();

            if (!existingPermission) {
              // Grant permission to admin
              await supabase.from('user_menu_permissions').insert({
                user_id: admin.id,
                menu_path: path,
                granted_by: session.user.id,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Menu items synced successfully',
      synced: syncedCount,
      new: newItemsCount,
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
