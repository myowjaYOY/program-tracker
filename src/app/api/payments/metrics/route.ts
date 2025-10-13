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

    const now = new Date();
    const todayStr: string = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    // Use the same filtering logic as the main payments API
    // Step 1: Load status ids to exclude Cancelled/Completed/Quote
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

    // Step 2: Get all programs with leads (filtered by status)
    const { data: programs } = await supabase.from('member_programs').select(`
        member_program_id,
        lead_id,
        program_status_id,
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name)
      `);
    
    // Filter out excluded statuses (same as main payments API)
    const validPrograms = (programs || []).filter(
      (p: any) => !excluded.has(p.program_status_id)
    );
    const programIds = validPrograms.map((p: any) => p.member_program_id);
    if (programIds.length === 0) {
      return NextResponse.json({
        data: {
          totalAmountOwed: 0,
          totalAmountDue: 0,
          totalAmountLate: 0,
          membersWithPaymentsDue: 0,
          latePaymentsBreakdown: [],
        }
      });
    }

    // Step 2: Get all payments for those programs
    const { data: allPayments } = await supabase
      .from('member_program_payments')
      .select(
        `*,
        payment_status (
          payment_status_id,
          payment_status_name
        )`
      )
      .in('member_program_id', programIds)
      .eq('active_flag', true);

    // Create program map for lookups
    const programMap = new Map<number, any>();
    validPrograms?.forEach((prog: any) => {
      programMap.set(prog.member_program_id, prog);
    });

    // Calculate metrics - only include payments from valid programs
    const unpaidPayments = (allPayments || []).filter(
      (p: any) => {
        // Only include if payment is unpaid AND program is valid
        const program = programMap.get(p.member_program_id);
        return program && p.payment_status?.payment_status_name !== 'Paid';
      }
    );

    const totalAmountOwed = unpaidPayments.reduce(
      (sum, p) => sum + (Number(p.payment_amount) || 0),
      0
    );

    const dueTodayPayments = unpaidPayments.filter(
      (p: any) => p.payment_due_date && p.payment_due_date <= todayStr
    );

    // Card 2 requirement change: Amount paid THIS MONTH for ALL programs regardless of status
    // We compute this separately without program status filtering
    const { data: paidThisMonthRows } = await supabase
      .from('member_program_payments')
      .select('payment_amount, payment_date')
      .gte('payment_date', monthStart)
      .lte('payment_date', monthEnd)
      .eq('active_flag', true);

    const totalAmountDue = (paidThisMonthRows || []).reduce(
      (sum: number, r: any) => sum + (Number(r.payment_amount) || 0),
      0
    );

    const latePayments = unpaidPayments.filter(
      (p: any) => p.payment_due_date && p.payment_due_date < todayStr
    );

    const totalAmountLate = latePayments.reduce(
      (sum, p) => sum + (Number(p.payment_amount) || 0),
      0
    );

    // Create late payments breakdown
    const breakdownMap = new Map<number, { memberId: number; memberName: string; amount: number }>();
    latePayments.forEach((p: any) => {
      const program = programMap.get(p.member_program_id);
      if (program?.lead_id && program?.lead) {
        const leadId = program.lead_id;
        const memberName = `${program.lead.first_name} ${program.lead.last_name}`;
        const existing = breakdownMap.get(leadId);
        if (existing) {
          existing.amount += Number(p.payment_amount) || 0;
        } else {
          breakdownMap.set(leadId, {
            memberId: leadId,
            memberName,
            amount: Number(p.payment_amount) || 0,
          });
        }
      }
    });

    const latePaymentsBreakdown = Array.from(breakdownMap.values());

    // Count unique members with payments due
    const membersWithPaymentsDue = new Set(
      dueTodayPayments
        .map((p: any) => {
          const program = programMap.get(p.member_program_id);
          return program?.lead_id;
        })
        .filter(id => id != null)
    ).size;

    const metrics = {
      totalAmountOwed,
      totalAmountDue,
      totalAmountLate,
      membersWithPaymentsDue,
      latePaymentsBreakdown,
    };

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('Error fetching payment metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment metrics' },
      { status: 500 }
    );
  }
}

