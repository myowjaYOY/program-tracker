import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data, error } = await supabase
      .from('therapytype')
      .select('*')
      .eq('active_flag', true)
      .order('therapy_type_name');

    if (error) {
      console.error('Error fetching therapy types:', error);
      return NextResponse.json({ error: 'Failed to fetch therapy types' }, { status: 500 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in therapy types GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
