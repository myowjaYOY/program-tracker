import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'all';
    const startDate: string | null = searchParams.get('startDate');
    const endDate: string | null = searchParams.get('endDate');

    // Helper function to calculate date ranges
    const getDateRange = (rangeType: string): { start: string | null; end: string | null } => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      switch (rangeType) {
        case 'this_year':
          return {
            start: `${year}-01-01`,
            end: `${year}-12-31`,
          };
        case 'last_year':
          return {
            start: `${year - 1}-01-01`,
            end: `${year - 1}-12-31`,
          };
        case 'this_month': {
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0);
          return {
            start: monthStart.toISOString().split('T')[0] as string,
            end: monthEnd.toISOString().split('T')[0] as string,
          };
        }
        case 'last_month': {
          const lastMonthStart = new Date(year, month - 1, 1);
          const lastMonthEnd = new Date(year, month, 0);
          return {
            start: lastMonthStart.toISOString().split('T')[0] as string,
            end: lastMonthEnd.toISOString().split('T')[0] as string,
          };
        }
        case 'this_quarter': {
          const currentQuarter = Math.floor(month / 3);
          const quarterStartMonth = currentQuarter * 3;
          return {
            start: `${year}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`,
            end: new Date(year, quarterStartMonth + 3, 0).toISOString().split('T')[0] as string,
          };
        }
        case 'last_quarter': {
          const lastQuarter = Math.floor(month / 3) - 1;
          const lastQuarterYear = lastQuarter < 0 ? year - 1 : year;
          const lastQuarterStartMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
          return {
            start: `${lastQuarterYear}-${String(lastQuarterStartMonth + 1).padStart(2, '0')}-01`,
            end: new Date(lastQuarterYear, lastQuarterStartMonth + 3, 0).toISOString().split('T')[0] as string,
          };
        }
        case 'custom':
          return { start: startDate, end: endDate };
        default: // 'all'
          return { start: null, end: null };
      }
    };

    const dateFilter = getDateRange(range);

    // Get lead status mapping
    const { data: leadStatusData, error: leadStatusError } = await supabase
      .from('status')
      .select('status_id, status_name');

    if (leadStatusError) {
      console.error('Lead status query error:', leadStatusError);
      return NextResponse.json({ error: leadStatusError.message }, { status: 500 });
    }

    const leadStatusMap = new Map(leadStatusData.map(s => [s.status_name, s.status_id]));
    const pmeScheduledStatusId = leadStatusMap.get('PME Scheduled');
    const noShowStatusId = leadStatusMap.get('No Show');
    const confirmedStatusId = leadStatusMap.get('Confirmed');

    // Get program status mapping
    const { data: statusData, error: statusError } = await supabase
      .from('program_status')
      .select('program_status_id, status_name');

    if (statusError) {
      console.error('Status query error:', statusError);
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    const statusMap = new Map(statusData.map(s => [s.status_name.toLowerCase(), s.program_status_id]));
    const activeStatusId = statusMap.get('active');
    const completedStatusId = statusMap.get('completed');
    const quoteStatusId = statusMap.get('quote');

    // Get audit events for PME status changes
    const { data: auditData, error: auditError } = await supabase
      .from('audit_events')
      .select(`
        event_id,
        record_id,
        event_at,
        audit_event_changes!inner(
          column_name,
          old_value,
          new_value
        )
      `)
      .eq('table_name', 'leads')
      .eq('audit_event_changes.column_name', 'status_id');

    if (auditError) {
      console.error('Audit query error (non-fatal):', auditError);
    }

    // Build audit map
    const auditMap = new Map<number, Array<{ old_status: number | null; new_status: number | null; event_at: string | null }>>();
    
    if (auditData) {
      for (const event of auditData) {
        const leadId = event.record_id;
        if (!leadId) continue;

        const changes = Array.isArray(event.audit_event_changes) ? event.audit_event_changes : [event.audit_event_changes];
        
        for (const change of changes) {
          if (change.column_name === 'status_id') {
            if (!auditMap.has(leadId)) {
              auditMap.set(leadId, []);
            }
            auditMap.get(leadId)!.push({
              old_status: change.old_value ? parseInt(change.old_value as any) : null,
              new_status: change.new_value ? parseInt(change.new_value as any) : null,
              event_at: event.event_at || null
            });
          }
        }
      }
    }

    // Fetch campaigns with leads
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        campaign_id,
        campaign_name,
        campaign_date,
        leads:leads!leads_campaign_id_fkey(
          lead_id,
          status_id,
          pmedate,
          status:status!leads_status_id_fkey(status_id, status_name)
        )
      `);

    if (campaignsError) {
      console.error('Campaigns query error:', campaignsError);
      return NextResponse.json({ error: campaignsError.message }, { status: 500 });
    }

    // Fetch all programs with finances
    let programsQuery = supabase
      .from('member_programs')
      .select(`
        member_program_id,
        lead_id,
        program_status_id,
        start_date,
        created_at,
        member_program_finances(final_total_price, margin)
      `)
      .in('program_status_id', [activeStatusId, completedStatusId, quoteStatusId].filter(Boolean));

    const { data: programsData, error: programsError } = await programsQuery;

    if (programsError) {
      console.error('Programs query error:', programsError);
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    // Filter programs by date
    const filteredPrograms = (programsData || []).filter(program => {
      const isQuote = program.program_status_id === quoteStatusId;
      const dateToCheck = isQuote ? program.created_at : program.start_date;
      
      if (!dateToCheck) return !dateFilter.start && !dateFilter.end;
      
      const programDate = dateToCheck.split('T')[0];
      
      if (dateFilter.start && programDate < dateFilter.start) return false;
      if (dateFilter.end && programDate > dateFilter.end) return false;
      
      return true;
    });

    // Build lead-to-campaign map
    const leadToCampaignMap = new Map<number, { campaign_id: number; campaign_name: string; campaign_date: string }>();
    for (const campaign of (campaignsData || [])) {
      for (const lead of (campaign.leads || [])) {
        leadToCampaignMap.set(lead.lead_id, {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          campaign_date: campaign.campaign_date,
        });
      }
    }

    // Group data by month with TWO separate PME counts:
    // 1. pmeScheduledCampaign: For Event → PME % (campaign-based logic, consistent with Campaign Performance report)
    // 2. pmeScheduledByDate: For PME → Win % (pmedate-based logic, consistent with summary cards)
    const monthlyData = new Map<string, {
      totalLeads: number;
      noShows: number;
      pmeScheduledCampaign: number;  // For Event → PME % (campaign-based)
      pmeScheduledByDate: number;     // For PME → Win % (pmedate-based)
      programsWon: number;
      totalRevenue: number;
      campaignWinRates: number[];
      leadIds: Set<number>; // Track which leads are already counted for totalLeads
      pmeLeadIds: Set<number>; // Track which leads are counted for pmeScheduledByDate
    }>();

    // Helper to ensure month bucket exists
    const ensureMonthBucket = (monthKey: string) => {
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          totalLeads: 0,
          noShows: 0,
          pmeScheduledCampaign: 0,
          pmeScheduledByDate: 0,
          programsWon: 0,
          totalRevenue: 0,
          campaignWinRates: [],
          leadIds: new Set(),
          pmeLeadIds: new Set(),
        });
      }
      return monthlyData.get(monthKey)!;
    };

    // Helper to check if lead is a No Show (Confirmed → No Show transition)
    const isNoShow = (lead: any): boolean => {
      const leadHistory = auditMap.get(lead.lead_id) || [];
      const hasConfirmedToNoShow = leadHistory.some(
        change => change.old_status === confirmedStatusId && change.new_status === noShowStatusId
      );
      if (hasConfirmedToNoShow) return true;
      // No audit data: assume current "No Show" status counts
      if (leadHistory.length === 0 && (lead.status as any)?.status_name === 'No Show') return true;
      return false;
    };

    // Helper to check if lead has PME scheduled (same logic as campaign-performance)
    const hasPmeScheduled = (lead: any): boolean => {
      const leadHistory = auditMap.get(lead.lead_id) || [];
      const statusName = (lead.status as any)?.status_name;
      
      // Check audit history for PME Scheduled status
      const everHadPME = leadHistory.some(
        change => change.new_status === pmeScheduledStatusId
      );
      
      // Count if: ever had PME in history OR currently PME/Won/Lost/No Program OR has pmedate
      return everHadPME || 
             statusName === 'PME Scheduled' ||
             statusName === 'Won' ||
             statusName === 'Lost' ||
             statusName === 'No Program' ||
             lead.pmedate !== null;
    };

    // Step 1: Process leads from campaigns based on campaign_date (for Event → PME %)
    for (const campaign of (campaignsData || [])) {
      if (!campaign.campaign_date) continue;
      
      const campaignDate = campaign.campaign_date.split('T')[0];
      
      // Check if campaign_date is within the date range
      if (dateFilter.start && campaignDate < dateFilter.start) continue;
      if (dateFilter.end && campaignDate > dateFilter.end) continue;
      
      const monthKey = campaignDate.substring(0, 7); // YYYY-MM
      const monthData = ensureMonthBucket(monthKey);
      
      for (const lead of (campaign.leads || [])) {
        // Skip if already counted for totalLeads
        if (monthData.leadIds.has(lead.lead_id)) continue;
        
        monthData.leadIds.add(lead.lead_id);
        monthData.totalLeads++;
        
        if (isNoShow(lead)) {
          monthData.noShows++;
        }
        
        if (hasPmeScheduled(lead)) {
          monthData.pmeScheduledCampaign++;
        }
      }
    }

    // Step 2: Add additional leads with pmedate in month to totalLeads (not already counted)
    for (const campaign of (campaignsData || [])) {
      for (const lead of (campaign.leads || [])) {
        if (!lead.pmedate) continue;
        
        const pmeDate = lead.pmedate.split('T')[0];
        
        // Check if pmedate is within the date range
        if (dateFilter.start && pmeDate < dateFilter.start) continue;
        if (dateFilter.end && pmeDate > dateFilter.end) continue;
        
        const monthKey = pmeDate.substring(0, 7); // YYYY-MM
        const monthData = ensureMonthBucket(monthKey);
        
        // Add to totalLeads if not already counted
        if (!monthData.leadIds.has(lead.lead_id)) {
          monthData.leadIds.add(lead.lead_id);
          monthData.totalLeads++;
          
          if (isNoShow(lead)) {
            monthData.noShows++;
          }
          
          if (hasPmeScheduled(lead)) {
            monthData.pmeScheduledCampaign++;
          }
        }
      }
    }

    // Step 3: Count PMEs by pmedate (for PME → Win %, consistent with summary cards)
    for (const campaign of (campaignsData || [])) {
      for (const lead of (campaign.leads || [])) {
        if (!lead.pmedate) continue;
        
        const pmeDate = lead.pmedate.split('T')[0];
        
        // Check if pmedate is within the date range
        if (dateFilter.start && pmeDate < dateFilter.start) continue;
        if (dateFilter.end && pmeDate > dateFilter.end) continue;
        
        const monthKey = pmeDate.substring(0, 7); // YYYY-MM
        const monthData = ensureMonthBucket(monthKey);
        
        // Count for pmeScheduledByDate (unique leads with pmedate in this month)
        if (!monthData.pmeLeadIds.has(lead.lead_id)) {
          monthData.pmeLeadIds.add(lead.lead_id);
          monthData.pmeScheduledByDate++;
        }
      }
    }

    // Process programs for revenue and win rates
    for (const program of filteredPrograms) {
      if (program.program_status_id !== activeStatusId && program.program_status_id !== completedStatusId) continue;

      const dateToUse = program.start_date;
      if (!dateToUse) continue;

      const monthKey = dateToUse.substring(0, 7);
      if (!monthlyData.has(monthKey)) continue;

      const monthData = monthlyData.get(monthKey)!;
      monthData.programsWon++;

      const financeRecord = program.member_program_finances?.[0];
      const finalPrice = financeRecord?.final_total_price || 0;
      monthData.totalRevenue += finalPrice;
    }

    // Calculate metrics for each month
    const results = Array.from(monthlyData.entries())
      .map(([monthKey, data]) => {
        const showedUp = data.totalLeads - data.noShows;
        
        // Event → PME %: Uses campaign-based PME count (consistent with Campaign Performance report)
        const conversionRate = showedUp > 0 ? (data.pmeScheduledCampaign / showedUp) * 100 : 0;
        
        // PME → Win %: Uses pmedate-based PME count (consistent with summary cards)
        const pmeWinRate = data.pmeScheduledByDate > 0 ? (data.programsWon / data.pmeScheduledByDate) * 100 : 0;

        return {
          month: monthKey,
          conversionRate,
          pmeWinRate,
          totalRevenue: data.totalRevenue,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate summary totals for the entire timeframe
    // PMEs: Count leads with pmedate in the date range (PMEs conducted in that timeframe)
    // Programs Won: Count programs with start_date in the date range (independently)
    const allLeads = (campaignsData || []).flatMap(c => c.leads || []);
    const uniqueLeads = new Map(allLeads.map(lead => [lead.lead_id, lead]));
    
    let totalPMEsScheduled = 0;
    for (const [, lead] of uniqueLeads.entries()) {
      // Use pmedate field directly (the actual PME appointment date)
      if (lead.pmedate) {
        const pmeDate = lead.pmedate.split('T')[0];
        
        // Only count if PME date is within the date range
        if (dateFilter.start && pmeDate < dateFilter.start) continue;
        if (dateFilter.end && pmeDate > dateFilter.end) continue;
        totalPMEsScheduled++;
      }
    }

    // Programs Won: Count programs with start_date in the date range (Active + Completed)
    // This is independent of PME date - a September PME can result in an October program
    const totalProgramsWon = filteredPrograms.filter(p => 
      p.program_status_id === activeStatusId || p.program_status_id === completedStatusId
    ).length;

    // Count leads currently in "PME Scheduled" status (pending PMEs) within date range
    let pendingPMEsQuery = supabase
      .from('leads')
      .select('lead_id', { count: 'exact', head: true })
      .eq('status_id', pmeScheduledStatusId);

    // Apply date filter to pending PMEs based on pmedate
    if (dateFilter.start) {
      pendingPMEsQuery = pendingPMEsQuery.gte('pmedate', dateFilter.start);
    }
    if (dateFilter.end) {
      pendingPMEsQuery = pendingPMEsQuery.lte('pmedate', dateFilter.end);
    }

    const { count: pendingPMEsCount, error: pendingPMEsError } = await pendingPMEsQuery;

    if (pendingPMEsError) {
      console.error('Pending PMEs count error:', pendingPMEsError);
    }

    return NextResponse.json({ 
      data: results,
      summary: {
        totalPMEsScheduled,
        totalProgramsWon,
        pendingPMEs: pendingPMEsCount || 0,
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Monthly sales calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate monthly sales' },
      { status: 500 }
    );
  }
}

