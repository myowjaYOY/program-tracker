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

    // Get lead status mapping for PME logic
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

    // Get all audit events for PME status changes
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

    // Build audit map: lead_id -> array of status changes
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

    // Fetch campaigns with leads and programs
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        campaign_id,
        campaign_name,
        campaign_date,
        ad_spend,
        food_cost,
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

    // Fetch all programs with finances (filtered by date)
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

    // Apply date filtering
    if (dateFilter.start || dateFilter.end) {
      // For Active/Completed: filter on start_date
      // For Quote: filter on created_at
      // We'll filter in memory since we need different date fields for different statuses
    }

    const { data: programsData, error: programsError } = await programsQuery;

    if (programsError) {
      console.error('Programs query error:', programsError);
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    // Filter programs by date in memory
    const filteredPrograms = (programsData || []).filter(program => {
      const isQuote = program.program_status_id === quoteStatusId;
      const dateToCheck = isQuote ? program.created_at : program.start_date;
      
      if (!dateToCheck) return !dateFilter.start && !dateFilter.end; // Include if no date filter
      
      const programDate = dateToCheck.split('T')[0];
      
      if (dateFilter.start && programDate < dateFilter.start) return false;
      if (dateFilter.end && programDate > dateFilter.end) return false;
      
      return true;
    });

    // Build lead-to-programs map
    const leadToProgramsMap = new Map<number, any[]>();
    for (const program of filteredPrograms) {
      if (!program.lead_id) continue;
      if (!leadToProgramsMap.has(program.lead_id)) {
        leadToProgramsMap.set(program.lead_id, []);
      }
      leadToProgramsMap.get(program.lead_id)!.push(program);
    }

    // Calculate metrics by campaign
    const campaignMetrics = (campaignsData || [])
      .map(campaign => {
      const leads = campaign.leads || [];
      const campaignCost = (campaign.ad_spend || 0) + (campaign.food_cost || 0);

      // Calculate PME Scheduled - FILTER BY DATE RANGE
      let pmeScheduled = 0;
      let pmeNoShows = 0;
      
      for (const lead of leads) {
        const leadHistory = auditMap.get(lead.lead_id) || [];
        const statusName = (lead.status as any)?.status_name;
        
        // Find when PME was scheduled from audit history
        let pmeScheduledDate: string | null = null;
        let everHadPME = false;
        
        for (const change of leadHistory) {
          if (change.new_status === pmeScheduledStatusId && change.event_at) {
            pmeScheduledDate = change.event_at.split('T')[0] || null; // Get date part only
            everHadPME = true;
            break; // Use first transition to PME Scheduled
          }
        }
        
        // If no audit event, try pmedate field
        if (!pmeScheduledDate && lead.pmedate) {
          pmeScheduledDate = lead.pmedate.split('T')[0];
          everHadPME = true;
        }
        
        // Only count if PME was scheduled within the date range
        if (pmeScheduledDate) {
          if (dateFilter.start && pmeScheduledDate < dateFilter.start) continue;
          if (dateFilter.end && pmeScheduledDate > dateFilter.end) continue;
          pmeScheduled++;
          
          // Count PME No Shows: Had PME scheduled but current status is No Show
          if (everHadPME && statusName === 'No Show') {
            pmeNoShows++;
          }
        }
      }

      // Calculate Programs Won (Active + Completed)
      let programsWon = 0;
      let totalRevenue = 0;
      let totalMarginWeighted = 0;

      for (const lead of leads) {
        const programs = leadToProgramsMap.get(lead.lead_id) || [];
        for (const program of programs) {
          if (program.program_status_id === activeStatusId || program.program_status_id === completedStatusId) {
            programsWon++;
            const financeRecord = program.member_program_finances?.[0];
            const finalPrice = financeRecord?.final_total_price || 0;
            const margin = financeRecord?.margin || 0;
            totalRevenue += finalPrice;
            totalMarginWeighted += margin * finalPrice;
          }
        }
      }

      // Determine campaign status (same logic as marketing reports)
      const actualLeadCount = leads.length;
      const wonLeads = leads.filter((lead: any) => lead.status?.status_name === 'Won').length;
      const lostLeads = leads.filter((lead: any) => lead.status?.status_name === 'Lost').length;
      const noProgramLeads = leads.filter((lead: any) => lead.status?.status_name === 'No Program').length;
      
      // Count no PMEs and no shows
      let noPmes = 0;
      let noShows = 0;
      for (const lead of leads) {
        const leadHistory = auditMap.get(lead.lead_id) || [];
        const statusName = (lead.status as any)?.status_name;
        
        // No Shows: Leads with No Show status
        if (statusName === 'No Show') {
          noShows++;
        }
        
        // No PMEs: Never had PME scheduled AND status is specifically 'No PME'
        const everHadPME = leadHistory.some(
          change => change.new_status === pmeScheduledStatusId
        );
        if (!everHadPME && statusName === 'No PME' && !lead.pmedate) {
          noPmes++;
        }
      }
      
      const activeLeads = actualLeadCount - wonLeads - lostLeads - noProgramLeads - noPmes - noShows;
      
      let campaignStatus: 'Active' | 'Closed' | 'Mixed';
      if (activeLeads > 0) {
        campaignStatus = 'Active';
      } else if (actualLeadCount === wonLeads + lostLeads + noProgramLeads + noPmes + noShows) {
        campaignStatus = 'Closed';
      } else {
        campaignStatus = 'Mixed';
      }

      // Calculate metrics
      const attendedPMEs = pmeScheduled - pmeNoShows;
      const pmeWinPercentage = attendedPMEs > 0 ? (programsWon / attendedPMEs) * 100 : 0;
      const costPerCustomer = programsWon > 0 ? campaignCost / programsWon : 0;
      const roiPercentage = campaignCost > 0 ? ((totalRevenue - campaignCost) / campaignCost) * 100 : 0;

      return {
        id: `campaign-${campaign.campaign_id}`,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_date: campaign.campaign_date,
        campaign_status: campaignStatus,
        pme_scheduled: pmeScheduled,
        pme_no_shows: pmeNoShows,
        programs_won: programsWon,
        pme_win_percentage: pmeWinPercentage,
        campaign_cost: campaignCost,
        cost_per_customer: costPerCustomer,
        total_revenue: totalRevenue,
        roi_percentage: roiPercentage,
      };
    })
    .filter(campaign => {
      // Show campaigns that have activity in the date range:
      // - PMEs scheduled in the date range, OR
      // - Programs won in the date range
      return campaign.pme_scheduled > 0 || campaign.programs_won > 0;
    });

    // Calculate summary metrics
    let summaryTotalRevenue = 0;
    let summaryPipelineValue = 0;
    let summaryProgramsWon = 0;
    let summaryProgramsQuote = 0;
    let summaryTotalMarginWeighted = 0;
    let summaryTotalPmeScheduled = 0;
    let summaryTotalProgramsWon = 0;

    // Calculate from all filtered programs
    for (const program of filteredPrograms) {
      const financeRecord = program.member_program_finances?.[0];
      const finalPrice = financeRecord?.final_total_price || 0;
      const margin = financeRecord?.margin || 0;

      if (program.program_status_id === activeStatusId || program.program_status_id === completedStatusId) {
        summaryTotalRevenue += finalPrice;
        summaryProgramsWon++;
        summaryTotalMarginWeighted += margin * finalPrice;
      } else if (program.program_status_id === quoteStatusId) {
        summaryPipelineValue += finalPrice;
        summaryProgramsQuote++;
      }
    }

    // Calculate overall PME count and conversion
    // PMEs: Count leads with pmedate in the date range (PMEs conducted in that timeframe)
    // Programs Won: Count programs with start_date in the date range (independently)
    const allLeads = (campaignsData || []).flatMap(c => c.leads || []);
    const uniqueLeads = new Map(allLeads.map(lead => [lead.lead_id, lead]));

    // Count PMEs by pmedate in the date range
    for (const [, lead] of uniqueLeads.entries()) {
      // Use pmedate field directly (the actual PME appointment date)
      if (lead.pmedate) {
        const pmeDate = lead.pmedate.split('T')[0];
        
        // Only count if PME date is within the date range
        if (dateFilter.start && pmeDate < dateFilter.start) continue;
        if (dateFilter.end && pmeDate > dateFilter.end) continue;
        summaryTotalPmeScheduled++;
      }
    }

    // Count Programs Won: Programs with start_date in the date range (Active + Completed)
    // This is independent of PME date - a September PME can result in an October program
    summaryTotalProgramsWon = filteredPrograms.filter(p => 
      p.program_status_id === activeStatusId || p.program_status_id === completedStatusId
    ).length;

    const avgProgramValue = summaryProgramsWon > 0 ? summaryTotalRevenue / summaryProgramsWon : 0;
    const avgMargin = summaryTotalRevenue > 0 ? (summaryTotalMarginWeighted / summaryTotalRevenue) : 0;
    const conversionRate = summaryTotalPmeScheduled > 0 ? (summaryTotalProgramsWon / summaryTotalPmeScheduled) * 100 : 0;

    return NextResponse.json({
      data: {
        summary: {
          totalRevenue: summaryTotalRevenue,
          pipelineValue: summaryPipelineValue,
          avgProgramValue,
          avgMargin,
          conversionRate,
        },
        revenueByCampaign: campaignMetrics,
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Executive dashboard calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate executive dashboard' },
      { status: 500 }
    );
  }
}

