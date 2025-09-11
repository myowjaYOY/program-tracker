import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized', authError }, { status: 401 });
    }
    
    // Get user info from users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (userError) {
      return NextResponse.json({ 
        error: 'User not found in users table', 
        userError,
        sessionUser: {
          id: session.user.id,
          email: session.user.email
        }
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      sessionUser: {
        id: session.user.id,
        email: session.user.email
      },
      dbUser: user,
      isAdmin: user.is_admin
    });
    
  } catch (error) {
    console.error('Debug user info error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  }
}

