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
    // Get campaign performance data with all calculations done in the query
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        campaign_id,
        campaign_name,
        campaign_date,
        ad_spend,
        food_cost,
        vendor:vendors!campaigns_vendor_id_fkey(vendor_name),
        leads:leads!leads_campaign_id_fkey(
          lead_id,
          status_id,
          status:status!leads_status_id_fkey(status_name)
        )
      `);

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process the data to calculate metrics
    const campaignPerformance = data?.map(campaign => {
      const leads = campaign.leads || [];
      
      // Count leads by status
      const totalLeads = leads.length;
      const wonLeads = leads.filter(lead => lead.status?.status_name === 'Won').length;
      const lostLeads = leads.filter(lead => lead.status?.status_name === 'Lost').length;
      const noPmeLeads = leads.filter(lead => lead.status?.status_name === 'No PME').length;
      const activeLeads = totalLeads - wonLeads - lostLeads - noPmeLeads;

      // Calculate conversion rate
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

      // Determine campaign status
      let campaignStatus: 'Active' | 'Closed' | 'Mixed';
      if (activeLeads > 0) {
        campaignStatus = 'Active';
      } else if (totalLeads === (wonLeads + lostLeads + noPmeLeads)) {
        campaignStatus = 'Closed';
      } else {
        campaignStatus = 'Mixed';
      }

      // Calculate costs and ROI
      const totalCost = (campaign.ad_spend || 0) + (campaign.food_cost || 0);
      const costPerLead = totalLeads > 0 ? totalCost / totalLeads : 0;
      
      // Simple ROI calculation (assuming each won lead has a value)
      const estimatedLeadValue = 100; // Placeholder value
      const totalRevenue = wonLeads * estimatedLeadValue;
      const roiPercentage = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

      // Debug logging
      console.log(`Campaign ${campaign.campaign_name}:`, {
        totalLeads,
        wonLeads,
        conversionRate,
        roiPercentage,
        leads: leads.map(l => ({ status: l.status?.status_name }))
      });

      return {
        id: `campaign-${campaign.campaign_id}`,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_date: campaign.campaign_date,
        vendor_name: campaign.vendor?.vendor_name || 'Unknown',
        total_leads: totalLeads,
        active_leads: activeLeads,
        won_leads: wonLeads,
        lost_leads: lostLeads,
        no_pme_leads: noPmeLeads,
        conversion_rate: conversionRate,
        campaign_status: campaignStatus,
        ad_spend: campaign.ad_spend,
        food_cost: campaign.food_cost,
        cost_per_lead: costPerLead,
        roi_percentage: roiPercentage,
      };
    }) || [];

    // Debug logging
    console.log('Raw data from database:', data);
    console.log('Processed campaign performance:', campaignPerformance);

    return NextResponse.json({ data: campaignPerformance }, { status: 200 });
  } catch (error) {
    console.error('Campaign performance calculation error:', error);
    return NextResponse.json({ error: 'Failed to calculate campaign performance' }, { status: 500 });
  }
}
