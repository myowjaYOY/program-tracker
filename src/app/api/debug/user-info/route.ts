import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }
    const { supabase, user: authUser } = auth;

    // Get user info from users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError) {
      return NextResponse.json(
        {
          error: 'User not found in users table',
          userError,
          sessionUser: {
            id: authUser.id,
            email: authUser.email,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionUser: {
        id: authUser.id,
        email: authUser.email,
      },
      dbUser: user,
      isAdmin: user.is_admin,
    });
  } catch (error) {
    console.error('Debug user info error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
