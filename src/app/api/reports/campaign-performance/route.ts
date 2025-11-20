import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get campaigns
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        campaign_id,
        campaign_name,
        campaign_date,
        confirmed_count,
        ad_spend,
        food_cost,
        vendor:vendors!campaigns_vendor_id_fkey(vendor_name),
        leads:leads!leads_campaign_id_fkey(
          lead_id,
          status_id,
          pmedate,
          status:status!leads_status_id_fkey(status_id, status_name)
        )
      `);

    if (campaignsError) {
      console.error('Database query error:', campaignsError);
      return NextResponse.json({ error: campaignsError.message }, { status: 500 });
    }

    // Get all status IDs for filtering
    const { data: statusData, error: statusError } = await supabase
      .from('status')
      .select('status_id, status_name');

    if (statusError) {
      console.error('Status query error:', statusError);
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    const statusMap = new Map(statusData.map(s => [s.status_name, s.status_id]));
    const confirmedStatusId = statusMap.get('Confirmed');
    const noShowStatusId = statusMap.get('No Show');
    const pmeScheduledStatusId = statusMap.get('PME Scheduled');

    // Get all audit events for status changes on leads
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
    const auditMap = new Map<number, Array<{ old_status: number | null; new_status: number | null; event_at: string }>>();
    
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
              event_at: event.event_at
            });
          }
        }
      }
    }

    // Process campaign performance
    const campaignPerformance = campaignsData?.map(campaign => {
      const leads = campaign.leads || [];
      const actualLeadCount = leads.length;
      
      // Total Leads: MAX(confirmed_count, actual lead count)
      const totalLeads = Math.max(campaign.confirmed_count || 0, actualLeadCount);

      // No Shows: Count leads that transitioned from Confirmed → No Show
      let noShows = 0;
      for (const lead of leads) {
        const leadHistory = auditMap.get(lead.lead_id) || [];
        
        // Check if there's a Confirmed → No Show transition in audit history
        const hasConfirmedToNoShow = leadHistory.some(
          change => 
            change.old_status === confirmedStatusId && 
            change.new_status === noShowStatusId
        );
        
        if (hasConfirmedToNoShow) {
          noShows++;
        } else if (leadHistory.length === 0 && (lead.status as any)?.status_name === 'No Show') {
          // No audit data: assume current "No Show" status counts
          noShows++;
        }
      }

      // No PMEs: Leads who never scheduled a PME
      let noPmes = 0;
      for (const lead of leads) {
        const leadHistory = auditMap.get(lead.lead_id) || [];
        const statusName = (lead.status as any)?.status_name;
        
        // Check if ever had PME Scheduled status in history
        const everHadPME = leadHistory.some(
          change => change.new_status === pmeScheduledStatusId
        );
        
        // If currently in terminal state and never had PME scheduled
        if (!everHadPME && 
            (statusName === 'No PME' || statusName === 'Lost' || statusName === 'No Program') && 
            !lead.pmedate) {
          noPmes++;
        }
      }

      // PME Scheduled: Count leads who ever had PME Scheduled status
      let pmeScheduled = 0;
      for (const lead of leads) {
        const leadHistory = auditMap.get(lead.lead_id) || [];
        const statusName = (lead.status as any)?.status_name;
        
        // Check audit history for PME Scheduled status
        const everHadPME = leadHistory.some(
          change => change.new_status === pmeScheduledStatusId
        );
        
        // Count if: ever had PME in history OR currently PME/Won/Lost/No Program OR has pmedate
        if (everHadPME || 
            statusName === 'PME Scheduled' ||
            statusName === 'Won' ||
            statusName === 'Lost' ||
            statusName === 'No Program' ||
            lead.pmedate !== null) {
          pmeScheduled++;
        }
      }

      // Show Rate: ((Total Leads - No Shows) / Total Leads) × 100
      // Measures percentage of leads who actually showed up
      const showedUp = totalLeads - noShows;
      const showRate = totalLeads > 0 ? (showedUp / totalLeads) * 100 : 0;

      // Conversion Rate: (PME Scheduled / (Total Leads - No Shows)) × 100
      // Measures conversion of leads who actually showed up
      const conversionRate = showedUp > 0 ? (pmeScheduled / showedUp) * 100 : 0;

      // Total Cost: ad_spend + food_cost (handle nulls)
      const totalCost = (campaign.ad_spend || 0) + (campaign.food_cost || 0);

      // Cost per Lead: total_cost / total_leads
      const costPerLead = totalLeads > 0 ? totalCost / totalLeads : 0;

      // Determine campaign status
      const wonLeads = leads.filter((lead: any) => lead.status?.status_name === 'Won').length;
      const lostLeads = leads.filter((lead: any) => lead.status?.status_name === 'Lost').length;
      const noProgramLeads = leads.filter((lead: any) => lead.status?.status_name === 'No Program').length;
      const activeLeads = actualLeadCount - wonLeads - lostLeads - noProgramLeads - noPmes - noShows;
      
      let campaignStatus: 'Active' | 'Closed' | 'Mixed';
      if (activeLeads > 0) {
        campaignStatus = 'Active';
      } else if (actualLeadCount === wonLeads + lostLeads + noProgramLeads + noPmes + noShows) {
        campaignStatus = 'Closed';
      } else {
        campaignStatus = 'Mixed';
      }

      return {
        id: `campaign-${campaign.campaign_id}`,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_date: campaign.campaign_date,
        vendor_name: (campaign.vendor as any)?.vendor_name || 'Unknown',
        campaign_status: campaignStatus,
        total_leads: totalLeads,
        no_shows: noShows,
        no_pmes: noPmes,
        show_rate: showRate,
        pme_scheduled: pmeScheduled,
        conversion_rate: conversionRate,
        total_cost: totalCost,
        cost_per_lead: costPerLead,
      };
    }) || [];

    return NextResponse.json({ data: campaignPerformance }, { status: 200 });
  } catch (error) {
    console.error('Campaign performance calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate campaign performance' },
      { status: 500 }
    );
  }
}
