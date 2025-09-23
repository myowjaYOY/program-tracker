import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Update user to be admin
    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', session.user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user to admin:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user to admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'User successfully made admin',
      user: user,
    });
  } catch (error) {
    console.error('Make admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
