import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    
    // Get user by ID
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ data: targetUser });
    
  } catch (error) {
    console.error('Get user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    
    const body = await request.json();
    const { full_name, is_admin, is_active, password } = body;
    
    // Update password in Supabase Auth if provided
    if (password && password.trim() !== '') {
      const { error: passwordError } = await supabase.auth.admin.updateUserById(id, {
        password: password
      });
      
      if (passwordError) {
        console.error('Error updating password:', passwordError);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
      }
    }
    
    // Update user in users table
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        full_name: full_name || null,
        is_admin: is_admin || false,
        is_active: is_active !== undefined ? is_active : true
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: updatedUser,
      message: 'User updated successfully' 
    });
    
  } catch (error) {
    console.error('Update user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    
    // Prevent deleting yourself
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }
    
    // Delete user from users table (this will cascade to user_menu_permissions)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'User deleted successfully' 
    });
    
  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
