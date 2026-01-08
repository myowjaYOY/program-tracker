import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication check
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');
    const pendingOnly = searchParams.get('pendingOnly') === 'true';

    // Follow EXACT coordinator API pattern: Filter programs by status first
    // Load status ids to exclude Cancelled/Completed/Quote
    const { data: statuses } = await supabase
      .from('program_status')
      .select('program_status_id, status_name');
    const excluded = new Set(
      (statuses || [])
        .filter((s: any) =>
          ['cancelled', 'completed', 'quote'].includes(
            (s.status_name || '').toLowerCase()
          )
        )
        .map((s: any) => s.program_status_id)
    );

    // Qualified programs (following coordinator pattern exactly)
    let progQuery = supabase.from('member_programs').select(`
        member_program_id,
        lead_id,
        program_status_id,
        program_template_name,
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name)
      `);
    
    // Apply member filter to programs first (like coordinator APIs)
    if (memberId) {
      progQuery = progQuery.eq('lead_id', Number(memberId));
    }
    
    const { data: programs, error: progErr } = await progQuery;
    if (progErr) {
      console.error('Failed to load programs:', progErr);
      throw progErr;
    }
    
    // Filter out excluded statuses (like coordinator APIs)
    const validPrograms = (programs || []).filter(
      (p: any) => !excluded.has(p.program_status_id)
    );
    const programIds = validPrograms.map((p: any) => p.member_program_id);
    if (programIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Now get payments for those programs
    let query = supabase
      .from('member_program_payments')
      .select(
        `*,
        payment_status (
          payment_status_id,
          payment_status_name
        ),
        payment_methods (
          payment_method_id,
          payment_method_name
        )`
      )
      .in('member_program_id', programIds)
      .eq('active_flag', true);

    const { data, error } = await query.order('payment_due_date', {
      ascending: true,
    });

    if (error) {
      throw error;
    }

    // Apply payment-specific filters after query (client-side filtering)
    let filteredData = data;
    if (pendingOnly) {
      // Show only payments with "Pending" status
      filteredData = (data || []).filter(
        (payment: any) => payment.payment_status?.payment_status_name === 'Pending'
      );
    }

    // Create a map of program data for lookup
    const programMap = new Map<number, any>();
    validPrograms?.forEach((prog: any) => {
      programMap.set(prog.member_program_id, prog);
    });

    // Get user information for created_by and updated_by
    const userIds = new Set<string>();
    filteredData?.forEach(payment => {
      if (payment.created_by) userIds.add(payment.created_by);
      if (payment.updated_by) userIds.add(payment.updated_by);
    });

    let userMap = new Map<string, { email: string; full_name: string }>();
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', Array.from(userIds));

      users?.forEach(user => {
        userMap.set(user.id, {
          email: user.email,
          full_name: user.full_name,
        });
      });
    }

    // Map the data to include flattened fields (following coordinator pattern)
    const mappedData = filteredData?.map(payment => {
      const program = programMap.get(payment.member_program_id);
      return {
        ...payment,
        lead_id: program?.lead_id || null, // Include lead_id for filtering
        member_name: program?.lead
          ? `${program.lead.first_name} ${program.lead.last_name}`
          : '',
        program_name: program?.program_template_name || '',
        payment_status_name: payment.payment_status?.payment_status_name || null,
        payment_method_name: payment.payment_methods?.payment_method_name || null,
        created_by_email: payment.created_by
          ? userMap.get(payment.created_by)?.email
          : null,
        created_by_full_name: payment.created_by
          ? userMap.get(payment.created_by)?.full_name
          : null,
        updated_by_email: payment.updated_by
          ? userMap.get(payment.updated_by)?.email
          : null,
        updated_by_full_name: payment.updated_by
          ? userMap.get(payment.updated_by)?.full_name
          : null,
      };
    });

    return NextResponse.json({ data: mappedData || [] });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

