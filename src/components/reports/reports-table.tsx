'use client';

import React, { useMemo } from 'react';
import { GridColDef } from '@mui/x-data-grid';
import {
  Box,
  Skeleton,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Campaign as CampaignIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import BaseDataTable, {
  commonColumns,
  renderDate,
  renderCurrency,
} from '@/components/tables/base-data-table';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
import { useLeads } from '@/lib/hooks/use-leads';
import { useStatus } from '@/lib/hooks/use-status';
import { Campaigns, Leads, Status } from '@/types/database.types';

// Interface for campaign performance data
interface CampaignPerformanceData {
  id: string;
  campaign_id: number;
  campaign_name: string;
  campaign_date: string;
  vendor_name: string;
  total_leads: number;
  active_leads: number;
  won_leads: number;
  lost_leads: number;
  no_pme_leads: number;
  conversion_rate: number;
  campaign_status: 'Active' | 'Closed' | 'Mixed';
  ad_spend: number | null;
  food_cost: number | null;
  cost_per_lead: number;
  roi_percentage: number;
}

// Reports table component
export default function ReportsTable() {
  const [campaignPerformance, setCampaignPerformance] = React.useState<
    CampaignPerformanceData[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch campaign performance data directly from the API
  React.useEffect(() => {
    const fetchCampaignPerformance = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/reports/campaign-performance', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch campaign performance: ${response.status}`
          );
        }

        const result = await response.json();
        console.log('API response:', result);
        console.log('Campaign performance data:', result.data);
        setCampaignPerformance(result.data || []);
      } catch (err) {
        console.error('Error fetching campaign performance:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignPerformance();
  }, []);

  // Campaign performance columns
  const campaignColumns: GridColDef[] = [
    {
      field: 'campaign_name',
      headerName: 'Campaign',
      width: 200,
      flex: 1,
    },
    {
      field: 'campaign_date',
      headerName: 'Date',
      width: 120,
      renderCell: renderDate,
    },
    {
      field: 'vendor_name',
      headerName: 'Vendor',
      width: 150,
    },
    {
      field: 'campaign_status',
      headerName: 'Status',
      width: 120,
      type: 'singleSelect',
      valueOptions: ['Active', 'Closed', 'Mixed'],
    },
    {
      field: 'total_leads',
      headerName: 'Total Leads',
      width: 120,
      type: 'number',
    },
    {
      field: 'active_leads',
      headerName: 'Active',
      width: 100,
      type: 'number',
    },
    {
      field: 'won_leads',
      headerName: 'Won',
      width: 100,
      type: 'number',
      renderCell: params => (
        <Box sx={{ color: 'success.main', fontWeight: 'bold' }}>
          {params.value}
        </Box>
      ),
    },
    {
      field: 'lost_leads',
      headerName: 'Lost',
      width: 100,
      type: 'number',
      renderCell: params => {
        const lostLeads = params.row.lost_leads || 0;
        const noPmeLeads = params.row.no_pme_leads || 0;
        const totalLost = lostLeads + noPmeLeads;
        return totalLost;
      },
    },
    {
      field: 'conversion_rate',
      headerName: 'Conversion %',
      width: 130,
      type: 'number',
      renderCell: params => {
        const value = params.value;
        if (value === 0) return '0.0%';
        if (value != null && value !== undefined && !isNaN(value)) {
          return `${Number(value).toFixed(1)}%`;
        }
        return '-';
      },
    },
    {
      field: 'cost_per_lead',
      headerName: 'Cost/Lead',
      width: 120,
      type: 'number',
      renderCell: renderCurrency,
    },
    {
      field: 'roi_percentage',
      headerName: 'ROI %',
      width: 100,
      type: 'number',
      renderCell: params => {
        const value = params.value;
        if (value === 0) return '0.0%';
        if (value != null && value !== undefined && !isNaN(value)) {
          return `${Number(value).toFixed(1)}%`;
        }
        return '-';
      },
    },
  ];

  const handleEdit = (row: CampaignPerformanceData) => {
    // For reports, we might want to navigate to the campaign detail page
    console.log('View campaign details:', row);
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!campaignPerformance.length) return null;

    const totalCampaigns = campaignPerformance.length;
    const activeCampaigns = campaignPerformance.filter(
      c => c.campaign_status === 'Active'
    ).length;
    const overallConversionRate =
      campaignPerformance.reduce((sum, c) => sum + c.conversion_rate, 0) /
      totalCampaigns;
    const totalCampaignSpend = campaignPerformance.reduce(
      (sum, c) => sum + (c.ad_spend || 0) + (c.food_cost || 0),
      0
    );

    // Find referrals campaign specifically
    const referralsCampaign = campaignPerformance.find(
      c => c.campaign_name === 'Referrals'
    );
    const referralsConversionRate = referralsCampaign
      ? referralsCampaign.conversion_rate
      : 0;

    return {
      totalCampaigns,
      activeCampaigns,
      overallConversionRate,
      totalCampaignSpend,
      referralsConversionRate,
    };
  }, [campaignPerformance]);

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="error">
          Error: {error}
        </Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', height: 400 }}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </Box>
    );
  }

  if (!campaignPerformance.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          No campaign data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 3,
          mb: 4,
        }}
      >
        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Campaigns
                </Typography>
                <Typography variant="h4" component="div">
                  {summaryStats?.totalCampaigns || 0}
                </Typography>
              </Box>
              <CampaignIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Campaigns
                </Typography>
                <Typography variant="h4" component="div" color="success.main">
                  {summaryStats?.activeCampaigns || 0}
                </Typography>
              </Box>
              <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Overall Conversion
                </Typography>
                <Typography variant="h4" component="div" color="primary.main">
                  {summaryStats?.overallConversionRate.toFixed(1) || 0}%
                </Typography>
              </Box>
              <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Referrals Conversion
                </Typography>
                <Typography variant="h4" component="div" color="success.main">
                  {summaryStats?.referralsConversionRate.toFixed(1) || 0}%
                </Typography>
              </Box>
              <PeopleIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Campaign Spend
                </Typography>
                <Typography variant="h4" component="div" color="error.main">
                  ${summaryStats?.totalCampaignSpend.toLocaleString() || 0}
                </Typography>
              </Box>
              <MoneyIcon color="error" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader
          title="Campaign Performance Details"
          subheader="Detailed analysis of each campaign's performance metrics"
        />
        <CardContent>
          <BaseDataTable<CampaignPerformanceData>
            title=""
            data={campaignPerformance}
            columns={campaignColumns}
            loading={isLoading}
            onEdit={handleEdit}
            showCreateButton={false}
            showActionsColumn={false}
          />
        </CardContent>
      </Card>

      {/* Status Categories Info */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title="Status Categories"
          subheader="Understanding how leads are classified"
        />
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" color="success.main" gutterBottom>
                Active Statuses
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Leads with these statuses are still in the pipeline and actively
                being worked:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="New Lead" color="success" size="small" />
                <Chip label="Contacted" color="success" size="small" />
                <Chip label="Follow Up" color="success" size="small" />
                <Chip label="Qualified" color="success" size="small" />
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" color="error.main" gutterBottom>
                Closed Statuses
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Leads with these statuses are considered closed/dead:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Won" color="error" size="small" />
                <Chip label="Lost" color="error" size="small" />
                <Chip label="No PME" color="error" size="small" />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
