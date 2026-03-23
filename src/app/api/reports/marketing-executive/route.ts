import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const monthEnd = `${y}-${String(m + 2 > 12 ? 1 : m + 2).padStart(2, '0')}-01`;
    const monthEndYear = m + 2 > 12 ? y + 1 : y;
    const monthEndStr = `${monthEndYear}-${String(m + 2 > 12 ? 1 : m + 2).padStart(2, '0')}-01`;

    // 1. Leads count: leads created this month
    const { count: leadsCount, error: leadsError } = await supabase
      .from('leads')
      .select('lead_id', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lt('created_at', monthEndStr);

    if (leadsError) {
      console.error('[Marketing Executive] Leads count error:', leadsError);
    }

    // 2. PMEs Scheduled this month: leads with pmedate in current month
    const { data: leadsWithPme, error: pmeError } = await supabase
      .from('leads')
      .select('lead_id')
      .gte('pmedate', monthStart)
      .lt('pmedate', monthEndStr);

    if (pmeError) {
      console.error('[Marketing Executive] PME query error:', pmeError);
    }
    const pmesScheduled = leadsWithPme?.length ?? 0;

    // 3. Show Rate: aggregate across all campaigns this month
    //    Formula: (totalLeads - noShows) / totalLeads × 100
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        campaign_id,
        confirmed_count,
        campaign_date,
        leads:leads!leads_campaign_id_fkey(
          lead_id,
          status_id,
          pmedate,
          status:status!leads_status_id_fkey(status_id, status_name)
        )
      `)
      .gte('campaign_date', monthStart)
      .lt('campaign_date', monthEndStr);

    if (campaignsError) {
      console.error('[Marketing Executive] Campaigns query error:', campaignsError);
    }

    const { data: statusData } = await supabase
      .from('status')
      .select('status_id, status_name');

    const statusMap = new Map(statusData?.map((s) => [s.status_name, s.status_id]) ?? []);
    const confirmedStatusId = statusMap.get('Confirmed');
    const noShowStatusId = statusMap.get('No Show');

    // Get audit events for status changes on leads from this month's campaigns
    const campaignLeadIds = (campaignsData ?? []).flatMap(
      (c) => (c.leads ?? []).map((l: { lead_id: number }) => l.lead_id)
    );

    const auditMap = new Map<number, Array<{ old_status: number | null; new_status: number | null }>>();

    if (campaignLeadIds.length > 0) {
      const { data: auditData } = await supabase
        .from('audit_events')
        .select(`
          record_id,
          audit_event_changes!inner(
            column_name,
            old_value,
            new_value
          )
        `)
        .eq('table_name', 'leads')
        .eq('audit_event_changes.column_name', 'status_id')
        .in('record_id', campaignLeadIds);

      if (auditData) {
        for (const event of auditData) {
          const leadId = event.record_id;
          if (!leadId) continue;
          const changes = Array.isArray(event.audit_event_changes)
            ? event.audit_event_changes
            : [event.audit_event_changes];
          for (const change of changes) {
            if (change.column_name === 'status_id') {
              if (!auditMap.has(leadId)) auditMap.set(leadId, []);
              auditMap.get(leadId)!.push({
                old_status: change.old_value ? parseInt(change.old_value as string) : null,
                new_status: change.new_value ? parseInt(change.new_value as string) : null,
              });
            }
          }
        }
      }
    }

    let totalLeadsForShowRate = 0;
    let totalNoShows = 0;

    for (const campaign of campaignsData ?? []) {
      const leads = campaign.leads ?? [];
      const campLeads = Math.max(campaign.confirmed_count || 0, leads.length);
      totalLeadsForShowRate += campLeads;

      for (const lead of leads) {
        const leadHistory = auditMap.get(lead.lead_id) || [];
        const hasConfirmedToNoShow = leadHistory.some(
          (change) =>
            change.old_status === confirmedStatusId &&
            change.new_status === noShowStatusId
        );

        if (hasConfirmedToNoShow) {
          totalNoShows++;
        } else if (
          leadHistory.length === 0 &&
          (lead.status as { status_name?: string } | null)?.status_name === 'No Show'
        ) {
          totalNoShows++;
        }
      }
    }

    const showRate =
      totalLeadsForShowRate > 0
        ? ((totalLeadsForShowRate - totalNoShows) / totalLeadsForShowRate) * 100
        : 0;

    return NextResponse.json({
      leadsCount: leadsCount ?? 0,
      pmesScheduled,
      showRate: parseFloat(showRate.toFixed(1)),
    });
  } catch (error) {
    console.error('[Marketing Executive] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
