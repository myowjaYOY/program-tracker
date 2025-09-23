import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

    return NextResponse.json({ data: users || [] });
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
    } = body;

    console.log('Creating user with data:', {
      email,
      full_name,
      is_admin,
      is_active,
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

    // Create user in Supabase Auth using regular signup (works with anon key)
    console.log('Attempting to create user in auth...');
    const { data: authData, error: authError2 } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || '',
        },
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
      console.error('No user returned from signup');
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    // Upsert user record in users table (handle trigger conflict)
    const { data: userData, error: userError2 } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name || '',
        is_admin,
        is_active,
      })
      .select()
      .single();

    if (userError2) {
      console.error('Error creating user record:', userError2);

      // Provide user-friendly error messages
      if (userError2.code === '23505') {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        );
      } else if (userError2.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User creation failed due to permissions' },
          { status: 500 }
        );
      } else {
        return NextResponse.json(
          { error: userError2.message || 'Failed to create user record' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      data: userData,
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
