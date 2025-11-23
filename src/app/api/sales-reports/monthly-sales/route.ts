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

    // Group data by month
    const monthlyData = new Map<string, {
      totalLeads: number;
      noShows: number;
      pmeScheduled: number;
      programsWon: number;
      totalRevenue: number;
      campaignWinRates: number[];
    }>();

    // Process leads and assign to months
    for (const campaign of (campaignsData || [])) {
      const leads = campaign.leads || [];
      const isReferralsCampaign = campaign.campaign_name.toLowerCase() === 'referrals';

      for (const lead of leads) {
        // Determine which month this lead belongs to
        let monthKey: string | null = null;

        if (isReferralsCampaign) {
          // For Referrals: use PME date
          const leadHistory = auditMap.get(lead.lead_id) || [];
          let pmeScheduledDate: string | null = null;

          for (const change of leadHistory) {
            if (change.new_status === pmeScheduledStatusId && change.event_at) {
              pmeScheduledDate = change.event_at.split('T')[0] || null;
              break;
            }
          }

          if (!pmeScheduledDate && lead.pmedate) {
            pmeScheduledDate = lead.pmedate.split('T')[0];
          }

          if (pmeScheduledDate) {
            if (dateFilter.start && pmeScheduledDate < dateFilter.start) continue;
            if (dateFilter.end && pmeScheduledDate > dateFilter.end) continue;
            monthKey = pmeScheduledDate.substring(0, 7); // YYYY-MM
          }
        } else {
          // For other campaigns: use campaign date
          if (!campaign.campaign_date) continue;
          const campaignDate = campaign.campaign_date.split('T')[0];
          
          if (dateFilter.start && campaignDate < dateFilter.start) continue;
          if (dateFilter.end && campaignDate > dateFilter.end) continue;
          monthKey = campaignDate.substring(0, 7); // YYYY-MM
        }

        if (!monthKey) continue;

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            totalLeads: 0,
            noShows: 0,
            pmeScheduled: 0,
            programsWon: 0,
            totalRevenue: 0,
            campaignWinRates: [],
          });
        }

        const monthData = monthlyData.get(monthKey)!;
        monthData.totalLeads++;

        // Check if no show
        const statusName = (lead.status as any)?.status_name;
        if (statusName === 'No Show') {
          monthData.noShows++;
        }

        // Check if PME scheduled
        const leadHistory = auditMap.get(lead.lead_id) || [];
        const everHadPME = leadHistory.some(change => change.new_status === pmeScheduledStatusId);
        
        if (everHadPME || statusName === 'PME Scheduled' || statusName === 'Won' || 
            statusName === 'Lost' || statusName === 'No Program' || lead.pmedate !== null) {
          monthData.pmeScheduled++;
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
        const conversionRate = showedUp > 0 ? (data.pmeScheduled / showedUp) * 100 : 0;
        const pmeWinRate = data.pmeScheduled > 0 ? (data.programsWon / data.pmeScheduled) * 100 : 0;

        return {
          month: monthKey,
          conversionRate,
          pmeWinRate,
          totalRevenue: data.totalRevenue,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({ data: results }, { status: 200 });

  } catch (error) {
    console.error('Monthly sales calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate monthly sales' },
      { status: 500 }
    );
  }
}

