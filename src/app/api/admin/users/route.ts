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

    // ============================================================
    // OPTIMIZED: Single query with nested select for program_roles
    // BEFORE: 2 queries (users + program_roles) + manual mapping
    // AFTER: 1 query with JOIN via nested select
    // ============================================================
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        *,
        program_roles (
          program_role_id,
          role_name,
          display_color
        )
      `)
      .eq('app_source', 'program_tracker')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // No manual mapping needed - Supabase handles the JOIN
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
    const { email, full_name, password, is_admin = false, is_active = true, program_role_id } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create admin client for user creation
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError2 } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        app_source: 'program_tracker',
      },
    });

    if (authError2) {
      console.error('Error creating user in auth:', authError2);
      return NextResponse.json(
        { error: authError2.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    // Wait for automatic user record creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // ============================================================
    // OPTIMIZED: Update user and fetch with role in single response
    // Uses RETURNING with nested select pattern
    // ============================================================
    const { data: userData, error: userError2 } = await supabase
      .from('users')
      .update({
        full_name: full_name || '',
        is_admin,
        is_active,
        program_role_id,
        app_source: 'program_tracker',
      })
      .eq('id', authData.user.id)
      .select(`
        *,
        program_roles (
          program_role_id,
          role_name,
          display_color
        )
      `)
      .single();

    if (userError2) {
      console.error('Error updating user record:', userError2);

      // Cleanup auth user on failure
      try {
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }

      return NextResponse.json(
        { error: userError2.message || 'Failed to update user record' },
        { status: 500 }
      );
    }

    // No separate role query needed - already included in response
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