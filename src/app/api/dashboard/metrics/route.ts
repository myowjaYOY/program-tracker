import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

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

    // 1. Active Members - Use ProgramStatusService for Active programs only
    const activeProgramIds = await ProgramStatusService.getValidProgramIds(supabase);
    
    let activeMembers = 0;
    if (activeProgramIds.length > 0) {
      const { data: activePrograms, error: activeProgramsErr } = await supabase
        .from('member_programs')
        .select('lead_id')
        .in('member_program_id', activeProgramIds);

      if (activeProgramsErr) {
        console.error('Error fetching active programs:', activeProgramsErr);
      } else {
        const uniqueLeadIds = new Set(
          (activePrograms || []).map(p => p.lead_id).filter(Boolean)
        );
        activeMembers = uniqueLeadIds.size;
      }
    }

    // 2. New Programs This Month - Use ProgramStatusService for Active programs + date range
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0); // Last day of current month

    let newProgramsThisMonth = 0;
    if (activeProgramIds.length > 0) {
      const { count, error: newProgramsErr } = await supabase
        .from('member_programs')
        .select('*', { count: 'exact', head: true })
        .in('member_program_id', activeProgramIds)
        .gte('start_date', startOfMonth.toISOString().slice(0, 10))
        .lte('start_date', endOfMonth.toISOString().slice(0, 10));

      if (newProgramsErr) {
        console.error('Error fetching new programs this month:', newProgramsErr);
      } else {
        newProgramsThisMonth = count || 0;
      }
    }

    // 3. Completed Programs - EXCEPTION CASE: Intentionally queries Completed status directly
    // This is NOT using ProgramStatusService because we specifically want Completed programs
    const { data: statuses } = await supabase
      .from('program_status')
      .select('program_status_id, status_name');
    const completedStatusId = statuses?.find(
      s => s.status_name?.toLowerCase() === 'completed'
    )?.program_status_id;

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
        newProgramsThisMonth,
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