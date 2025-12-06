import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Get program roles for mapping
    const { data: roles } = await supabase
      .from('program_roles')
      .select('program_role_id, role_name, display_color');
    
    // Map role info to users
    const rolesMap = new Map(roles?.map(r => [r.program_role_id, r]) || []);
    const usersWithRoles = users?.map(u => ({
      ...u,
      program_roles: rolesMap.get(u.program_role_id) || null
    })) || [];

    return NextResponse.json({ data: usersWithRoles });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      email,
      full_name,
      password,
      is_admin = false,
      is_active = false,
      program_role_id = 1, // Default to Coordinator
    } = body;

    console.log('Creating user with data:', {
      email,
      full_name,
      is_admin,
      is_active,
      program_role_id,
    });

    if (!email || !password) {
      console.log('Missing required fields:', {
        email: !!email,
        password: !!password,
      });
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create user using Supabase Admin API to avoid auto-login
    console.log('Attempting to create user with admin API...');
    
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Missing service role key' },
        { status: 500 }
      );
    }
    
    // Create admin client with service role key for user creation
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: authData, error: authError2 } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: full_name || '',
      },
    });

    console.log('Auth creation result:', { authData, authError2 });

    if (authError2) {
      console.error('Error creating user in auth:', authError2);
      return NextResponse.json(
        { error: authError2.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.error('No user returned from admin createUser');
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    // Wait a moment for automatic user record creation, then update it with our settings
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update the automatically created user record with our settings
    const { data: userData, error: userError2 } = await supabase
      .from('users')
      .update({
        full_name: full_name || '',
        is_admin,
        is_active,
        program_role_id,
      })
      .eq('id', authData.user.id)
      .select('*')
      .single();

    if (userError2) {
      console.error('Error updating user record:', userError2);

      // If user record update fails, we should clean up the auth user
      try {
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        console.log('Cleaned up auth user after database update failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }

      return NextResponse.json(
        { error: userError2.message || 'Failed to update user record' },
        { status: 500 }
      );
    }

    // Get role info for response
    const { data: newUserRole } = await supabase
      .from('program_roles')
      .select('program_role_id, role_name, display_color')
      .eq('program_role_id', userData.program_role_id)
      .single();

    return NextResponse.json({
      data: { ...userData, program_roles: newUserRole || null },
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Create user API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
