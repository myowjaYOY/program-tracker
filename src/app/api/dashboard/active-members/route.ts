import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/dashboard/active-members
 * Returns all members with active programs
 */
export async function GET() {
  try {
    console.log('[Active Members API] Starting request...');
    const supabase = await createClient();
    console.log('[Active Members API] Supabase client created');

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    console.log('[Active Members API] Auth check:', { hasSession: !!session, authError: !!authError });
    
    if (authError || !session) {
      console.error('[Active Members API] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Active Members API] Fetching members...');
    // Fetch active members with their program details
    const { data: members, error } = await supabase
      .from('member_programs')
      .select(`
        lead_id,
        start_date,
        duration,
        member_program_id,
        program_type,
        leads!inner(
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('program_status_id', 1); // 1 = Active
    
    console.log('[Active Members API] Query result:', { 
      memberCount: members?.length, 
      hasError: !!error,
      errorMessage: error?.message 
    });

    if (error) {
      console.error('Error fetching active members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch active members', details: error.message },
        { status: 500 }
      );
    }

    if (!members) {
      return NextResponse.json({ data: [] });
    }

    // Get all member_program_ids for active programs
    const memberProgramIds = members.map(m => m.member_program_id);

    console.log('[Active Members API] Checking for coach items...');
    // Check which members have coach items
    const { data: coachItems, error: coachError } = await supabase
      .from('member_program_items')
      .select(`
        member_program_id,
        therapies!inner(
          therapy_name
        )
      `)
      .in('member_program_id', memberProgramIds)
      .ilike('therapies.therapy_name', '%coach%');

    if (coachError) {
      console.error('[Active Members API] Error fetching coach items:', coachError);
    }

    console.log('[Active Members API] Coach items found:', coachItems?.length || 0);

    // Build a Set of member_program_ids that have coach items
    const programsWithCoach = new Set(
      (coachItems || []).map((item: any) => item.member_program_id)
    );

    // Transform data for frontend and remove duplicates (in case member has multiple active programs)
    const memberMap = new Map();
    
    members.forEach((member: any) => {
      const hasCoach = programsWithCoach.has(member.member_program_id);
      
      if (!memberMap.has(member.lead_id) && member.leads) {
        // First time seeing this member
        memberMap.set(member.lead_id, {
          lead_id: member.lead_id,
          first_name: member.leads.first_name || '',
          last_name: member.leads.last_name || '',
          email: member.leads.email || '',
          phone: member.leads.phone || null,
          start_date: member.start_date,
          duration: member.duration,
          has_coach: hasCoach,
          is_membership: member.program_type === 'membership',
        });
      } else if (memberMap.has(member.lead_id)) {
        // Member already exists - update coach status and membership status if applicable
        const existingMember = memberMap.get(member.lead_id);
        if (hasCoach) {
          existingMember.has_coach = true;
        }
        // If any of their programs is a membership, mark them as membership
        if (member.program_type === 'membership') {
          existingMember.is_membership = true;
        }
      }
    });

    // Convert to array and sort by last name
    const transformedData = Array.from(memberMap.values()).sort((a, b) => {
      const lastNameCompare = a.last_name.localeCompare(b.last_name);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.first_name.localeCompare(b.first_name);
    });

    return NextResponse.json({ data: transformedData });
  } catch (error: any) {
    console.error('Unexpected error in active-members API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

