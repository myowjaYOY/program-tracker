import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // getMonth() is 0-indexed
    const currentYear = today.getFullYear();

    // Fetch program statuses
    const { data: statuses, error: statusErr } = await supabase
      .from('program_status')
      .select('program_status_id, status_name');
    if (statusErr) {
      console.error('Error fetching program statuses:', statusErr);
      return NextResponse.json(
        { error: 'Failed to fetch program statuses' },
        { status: 500 }
      );
    }

    const activeStatusId = statuses?.find(
      s => s.status_name?.toLowerCase() === 'active'
    )?.program_status_id;
    const completedStatusId = statuses?.find(
      s => s.status_name?.toLowerCase() === 'completed'
    )?.program_status_id;

    // 1. Active Members
    let activeMembers = 0;
    if (activeStatusId) {
      const { data: activePrograms, error: activeProgramsErr } = await supabase
        .from('member_programs')
        .select('lead_id')
        .eq('program_status_id', activeStatusId);

      if (activeProgramsErr) {
        console.error('Error fetching active programs:', activeProgramsErr);
      } else {
        const uniqueLeadIds = new Set(
          activePrograms.map(p => p.lead_id).filter(Boolean)
        );
        activeMembers = uniqueLeadIds.size;
      }
    }

    // 2. New Programs This Month
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0); // Last day of current month

    const { count: newProgramsThisMonth, error: newProgramsErr } = await supabase
      .from('member_programs')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', startOfMonth.toISOString().slice(0, 10))
      .lte('start_date', endOfMonth.toISOString().slice(0, 10));

    if (newProgramsErr) {
      console.error('Error fetching new programs this month:', newProgramsErr);
    }

    // 3. Completed Programs
    let completedPrograms = 0;
    if (completedStatusId) {
      const { count, error: completedProgramsErr } = await supabase
        .from('member_programs')
        .select('*', { count: 'exact', head: true })
        .eq('program_status_id', completedStatusId);

      if (completedProgramsErr) {
        console.error('Error fetching completed programs:', completedProgramsErr);
      } else {
        completedPrograms = count || 0;
      }
    }

    // 4. Members on Memberships (Placeholder)
    const membersOnMemberships = 0; // Placeholder for now

    return NextResponse.json({
      data: {
        activeMembers,
        newProgramsThisMonth: newProgramsThisMonth || 0,
        completedPrograms,
        membersOnMemberships,
      },
    });
  } catch (e: any) {
    console.error('Dashboard metrics API error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}