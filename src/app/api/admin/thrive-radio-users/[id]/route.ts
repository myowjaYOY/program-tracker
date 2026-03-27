import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing service role key' },
        { status: 500 }
      );
    }

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete related thrive_radio data first
    await adminSupabase
      .schema('thrive_radio')
      .from('station_listens')
      .delete()
      .eq('user_id', id);

    await adminSupabase
      .schema('thrive_radio')
      .from('auth_events')
      .delete()
      .eq('user_id', id);

    const { error: deleteError } = await adminSupabase
      .schema('thrive_radio')
      .from('profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting thrive_radio profile:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete profile' },
        { status: 500 }
      );
    }

    // Check if this user is also a Program Tracker employee
    const { data: ptUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (!ptUser) {
      // Lead-origin user: also remove from auth.users
      const { error: authDeleteError } =
        await adminSupabase.auth.admin.deleteUser(id);
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
      }
    }

    return NextResponse.json({
      message: 'Thrive Radio user deleted successfully',
    });
  } catch (error) {
    console.error('Thrive Radio Users DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
