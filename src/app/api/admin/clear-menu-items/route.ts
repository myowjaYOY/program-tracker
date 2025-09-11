import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
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
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    // Clear menu items table
    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (deleteError) {
      console.error('Error clearing menu items:', deleteError);
      return NextResponse.json({ error: 'Failed to clear menu items' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'Menu items table cleared successfully'
    });
    
  } catch (error) {
    console.error('Clear menu items error:', error);
    return NextResponse.json({ error: 'Failed to clear menu items' }, { status: 500 });
  }
}

