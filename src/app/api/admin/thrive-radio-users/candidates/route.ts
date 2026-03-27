import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface ThriveRadioCandidate {
  id: string | number;
  name: string;
  email: string;
  type: 'lead' | 'employee';
}

export async function GET() {
  try {
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

    // Get existing thrive_radio profile emails to exclude
    const { data: existingProfiles } = await adminSupabase
      .schema('thrive_radio')
      .from('profiles')
      .select('email');

    const existingEmails = new Set(
      (existingProfiles || []).map((p: { email: string }) =>
        p.email.toLowerCase()
      )
    );

    // Leads on active programs (program_status_id = 1 = Active)
    const { data: activePrograms } = await supabase
      .from('member_programs')
      .select('lead_id')
      .eq('program_status_id', 1);

    const activeLeadIds = [
      ...new Set(
        (activePrograms || [])
          .map((p: { lead_id: number | null }) => p.lead_id)
          .filter((id): id is number => id !== null)
      ),
    ];

    const leadCandidates: ThriveRadioCandidate[] = [];
    if (activeLeadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('lead_id, first_name, last_name, email')
        .in('lead_id', activeLeadIds);

      for (const lead of leads || []) {
        if (lead.email && !existingEmails.has(lead.email.toLowerCase())) {
          leadCandidates.push({
            id: lead.lead_id,
            name: `${lead.first_name} ${lead.last_name}`.trim(),
            email: lead.email,
            type: 'lead',
          });
        }
      }
    }

    // Active employees
    const { data: employees } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true)
      .eq('app_source', 'program_tracker');

    const employeeCandidates: ThriveRadioCandidate[] = [];
    for (const emp of employees || []) {
      if (emp.email && !existingEmails.has(emp.email.toLowerCase())) {
        employeeCandidates.push({
          id: emp.id,
          name: emp.full_name || emp.email,
          email: emp.email,
          type: 'employee',
        });
      }
    }

    employeeCandidates.sort((a, b) => a.name.localeCompare(b.name));
    leadCandidates.sort((a, b) => a.name.localeCompare(b.name));
    const candidates = [...employeeCandidates, ...leadCandidates];

    return NextResponse.json({ data: candidates });
  } catch (error) {
    console.error('Thrive Radio Candidates GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
