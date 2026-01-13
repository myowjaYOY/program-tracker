import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

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

    // Step 1a: Get valid program IDs (Active + Paused) for operational metrics
    const activePausedProgramIds = await ProgramStatusService.getValidProgramIds(supabase, {
      includeStatuses: ['paused']
    });

    // Step 1b: Get ALL program IDs for metrics that need all programs (Amount Paid, Cancelled)
    const allProgramIds = await ProgramStatusService.getValidProgramIds(supabase, {
      includeStatuses: ['all']
    });

    if (activePausedProgramIds.length === 0 && allProgramIds.length === 0) {
      return NextResponse.json({
        data: {
          totalAmountOwed: 0,
          totalAmountDue: 0,
          totalAmountLate: 0,
          totalAmountCancelled: 0,
          membersWithPaymentsDue: 0,
          latePaymentsBreakdown: [],
          cancelledPaymentsBreakdown: [],
        }
      });
    }

    // Step 2a: Get programs with leads for Active + Paused programs (operational metrics)
    const { data: activePausedPrograms } = await supabase.from('member_programs').select(`
        member_program_id,
        lead_id,
        program_status_id,
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name)
      `)
      .in('member_program_id', activePausedProgramIds);

    // Step 2b: Get programs with leads for ALL programs (for cancelled payments breakdown)
    const { data: allPrograms } = await supabase.from('member_programs').select(`
        member_program_id,
        lead_id,
        program_status_id,
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name)
      `)
      .in('member_program_id', allProgramIds);
    
    const programIds = activePausedProgramIds;

    // Step 3a: Get payments for Active + Paused programs (operational metrics)
    const { data: activePausedPayments } = await supabase
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

    // Step 3b: Get payments for ALL programs (for Amount Paid This Month and Cancelled metrics)
    const { data: allProgramPayments } = await supabase
      .from('member_program_payments')
      .select(
        `*,
        payment_status (
          payment_status_id,
          payment_status_name
        )`
      )
      .in('member_program_id', allProgramIds)
      .eq('active_flag', true);

    // Create program map for Active + Paused lookups
    const activePausedProgramMap = new Map<number, any>();
    activePausedPrograms?.forEach((prog: any) => {
      activePausedProgramMap.set(prog.member_program_id, prog);
    });

    // Create program map for ALL programs lookups
    const allProgramMap = new Map<number, any>();
    allPrograms?.forEach((prog: any) => {
      allProgramMap.set(prog.member_program_id, prog);
    });

    // Calculate metrics - only include payments from Active + Paused programs
    const unpaidPayments = (activePausedPayments || []).filter(
      (p: any) => {
        // Only include if payment is unpaid AND program is valid (Active/Paused)
        const program = activePausedProgramMap.get(p.member_program_id);
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

    // Card 2: Amount paid THIS MONTH for ALL programs regardless of status
    // Uses ProgramStatusService with 'all' for consistency
    const paidThisMonthPayments = (allProgramPayments || []).filter(
      (p: any) => p.payment_date && p.payment_date >= monthStart && p.payment_date <= monthEnd
    );

    const totalAmountDue = paidThisMonthPayments.reduce(
      (sum: number, p: any) => sum + (Number(p.payment_amount) || 0),
      0
    );

    // Late payments: only Pending status with past due date (Active + Paused programs only)
    const latePayments = (activePausedPayments || []).filter(
      (p: any) => {
        const program = activePausedProgramMap.get(p.member_program_id);
        return program && 
          p.payment_status?.payment_status_name === 'Pending' &&
          p.payment_due_date && 
          p.payment_due_date < todayStr;
      }
    );

    const totalAmountLate = latePayments.reduce(
      (sum, p) => sum + (Number(p.payment_amount) || 0),
      0
    );

    // Create late payments breakdown
    const breakdownMap = new Map<number, { memberId: number; memberName: string; amount: number }>();
    latePayments.forEach((p: any) => {
      const program = activePausedProgramMap.get(p.member_program_id);
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

    // Cancelled payments: ALL programs with "Cancelled" payment status
    const cancelledPayments = (allProgramPayments || []).filter(
      (p: any) => p.payment_status?.payment_status_name === 'Cancelled'
    );

    const totalAmountCancelled = cancelledPayments.reduce(
      (sum, p) => sum + (Number(p.payment_amount) || 0),
      0
    );

    // Get earliest and latest cancelled payment dates
    const cancelledDates = cancelledPayments
      .map((p: any) => p.payment_due_date || p.payment_date)
      .filter((d): d is string => !!d)
      .sort();
    
    const cancelledDateRangeStart = cancelledDates.length > 0 ? cancelledDates[0] : null;
    const cancelledDateRangeEnd = cancelledDates.length > 0 ? cancelledDates[cancelledDates.length - 1] : null;

    // Create cancelled payments breakdown (using allProgramMap for member names)
    const cancelledBreakdownMap = new Map<number, { memberId: number; memberName: string; amount: number }>();
    cancelledPayments.forEach((p: any) => {
      const program = allProgramMap.get(p.member_program_id);
      if (program?.lead_id && program?.lead) {
        const leadId = program.lead_id;
        const memberName = `${program.lead.first_name} ${program.lead.last_name}`;
        const existing = cancelledBreakdownMap.get(leadId);
        if (existing) {
          existing.amount += Number(p.payment_amount) || 0;
        } else {
          cancelledBreakdownMap.set(leadId, {
            memberId: leadId,
            memberName,
            amount: Number(p.payment_amount) || 0,
          });
        }
      }
    });

    const cancelledPaymentsBreakdown = Array.from(cancelledBreakdownMap.values())
      .filter(item => item.amount > 0);

    // Count unique members with payments due (Active + Paused programs)
    const membersWithPaymentsDue = new Set(
      dueTodayPayments
        .map((p: any) => {
          const program = activePausedProgramMap.get(p.member_program_id);
          return program?.lead_id;
        })
        .filter(id => id != null)
    ).size;

    const metrics = {
      totalAmountOwed,
      totalAmountDue,
      totalAmountLate,
      totalAmountCancelled,
      cancelledDateRangeStart,
      cancelledDateRangeEnd,
      membersWithPaymentsDue,
      latePaymentsBreakdown,
      cancelledPaymentsBreakdown,
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

