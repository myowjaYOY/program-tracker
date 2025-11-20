'use client';

import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Campaign as CampaignIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import BaseDataTable, {
  commonColumns,
  renderDate,
  renderCurrency,
} from '@/components/tables/base-data-table';
import { GridColDef } from '@mui/x-data-grid';

// Tab Panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Tab label component
function a11yProps(index: number) {
  return {
    id: `reports-tab-${index}`,
    'aria-controls': `reports-tabpanel-${index}`,
  };
}

// Interface for campaign performance data
interface CampaignPerformanceData {
  id: string;
  campaign_id: number;
  campaign_name: string;
  campaign_date: string;
  vendor_name: string;
  campaign_status: 'Active' | 'Closed' | 'Mixed';
  total_leads: number;
  no_shows: number;
  no_pmes: number;
  show_rate: number;
  pme_scheduled: number;
  conversion_rate: number;
  total_cost: number;
  cost_per_lead: number;
}

export default function ReportsPage() {
  const [tabValue, setTabValue] = useState(0);

  // Fetch campaign performance data
  const { data: campaignPerformance = [], isLoading, error } = useQuery({
    queryKey: ['campaign-performance'],
    queryFn: async () => {
      const response = await fetch('/api/reports/campaign-performance', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign performance: ${response.status}`);
      }
      const result = await response.json();
      return result.data || [];
    },
  });

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!campaignPerformance.length) return null;

    const totalCampaigns = campaignPerformance.length;
    const activeCampaigns = campaignPerformance.filter(
      (c: any) => c.campaign_status === 'Active'
    ).length;
    const overallConversionRate =
      campaignPerformance.reduce((sum: number, c: any) => sum + c.conversion_rate, 0) /
      totalCampaigns;
    const totalCampaignSpend = campaignPerformance.reduce(
      (sum: number, c: any) => sum + (c.total_cost || 0),
      0
    );

    // Find referrals campaign specifically
    const referralsCampaign = campaignPerformance.find(
      (c: any) => c.campaign_name === 'Referrals'
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
      field: 'no_shows',
      headerName: 'No Shows',
      width: 100,
      type: 'number',
    },
    {
      field: 'no_pmes',
      headerName: 'No PMEs',
      width: 100,
      type: 'number',
    },
    {
      field: 'show_rate',
      headerName: 'Show Rate',
      width: 110,
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
      field: 'pme_scheduled',
      headerName: 'PME Scheduled',
      width: 130,
      type: 'number',
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
      field: 'total_cost',
      headerName: 'Cost',
      width: 120,
      type: 'number',
      renderCell: renderCurrency,
    },
    {
      field: 'cost_per_lead',
      headerName: 'Cost/Lead',
      width: 120,
      type: 'number',
      renderCell: renderCurrency,
    },
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    // TODO: Implement refresh logic for reports
    console.log('Refreshing reports...');
  };

  const handleDownload = () => {
    // TODO: Implement download logic for reports
    console.log('Downloading report...');
  };

  return (
    <Box sx={{ p: 3, height: '100%' }}>
      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            color="primary.main"
          >
            Reports Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Reports">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download Report">
              <IconButton onClick={handleDownload} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Generate and view comprehensive reports for your marketing campaigns,
          leads, and sales data.
        </Typography>
      </Box>

      {/* Tabs Section */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="reports tabs"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            label="Campaign Performance"
            icon={<BarChartIcon />}
            iconPosition="start"
            {...a11yProps(0)}
          />
          <Tab
            label="Lead Analytics"
            icon={<PieChartIcon />}
            iconPosition="start"
            {...a11yProps(1)}
          />
          <Tab
            label="Sales Metrics"
            icon={<TimelineIcon />}
            iconPosition="start"
            {...a11yProps(2)}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <TabPanel value={tabValue} index={0}>
        {error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="error">
              Error: {error.message}
            </Typography>
          </Box>
        ) : isLoading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              Loading campaign data...
            </Typography>
          </Box>
        ) : !campaignPerformance.length ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No campaign data available
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: theme => `4px solid ${theme.palette.primary.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        color="textSecondary"
                        variant="body2"
                        sx={{ fontWeight: 500 }}
                      >
                        Total Campaigns
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{
                          fontWeight: 'bold',
                          color: 'primary.main',
                          mt: 1,
                        }}
                      >
                        {summaryStats?.totalCampaigns || 0}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        color: 'primary.main',
                        opacity: 0.8,
                      }}
                    >
                      <CampaignIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Total number of campaigns
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: theme => `4px solid ${theme.palette.success.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        color="textSecondary"
                        variant="body2"
                        sx={{ fontWeight: 500 }}
                      >
                        Active Campaigns
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{
                          fontWeight: 'bold',
                          color: 'success.main',
                          mt: 1,
                        }}
                      >
                        {summaryStats?.activeCampaigns || 0}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        color: 'success.main',
                        opacity: 0.8,
                      }}
                    >
                      <TrendingUpIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Currently active campaigns
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: theme => `4px solid ${theme.palette.info.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        color="textSecondary"
                        variant="body2"
                        sx={{ fontWeight: 500 }}
                      >
                        Overall Conversion
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{
                          fontWeight: 'bold',
                          color: 'info.main',
                          mt: 1,
                        }}
                      >
                        {summaryStats?.overallConversionRate.toFixed(1) || 0}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        color: 'info.main',
                        opacity: 0.8,
                      }}
                    >
                      <PeopleIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Average conversion rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: theme => `4px solid ${theme.palette.warning.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        color="textSecondary"
                        variant="body2"
                        sx={{ fontWeight: 500 }}
                      >
                        Referrals Conversion
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{
                          fontWeight: 'bold',
                          color: 'warning.main',
                          mt: 1,
                        }}
                      >
                        {summaryStats?.referralsConversionRate.toFixed(1) || 0}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        color: 'warning.main',
                        opacity: 0.8,
                      }}
                    >
                      <PeopleIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Referrals campaign conversion
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: theme => `4px solid ${theme.palette.error.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        color="textSecondary"
                        variant="body2"
                        sx={{ fontWeight: 500 }}
                      >
                        Total Campaign Spend
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{
                          fontWeight: 'bold',
                          color: 'error.main',
                          mt: 1,
                        }}
                      >
                        ${Math.round(summaryStats?.totalCampaignSpend || 0).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        color: 'error.main',
                        opacity: 0.8,
                      }}
                    >
                      <MoneyIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Total advertising spend
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Campaign Performance Table */}
          <Card sx={{ mt: 3 }}>
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
                onEdit={() => {}}
                showCreateButton={false}
                showActionsColumn={false}
                persistStateKey="campaignPerformanceGrid"
              />
            </CardContent>
          </Card>
          </>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid size={6}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.primary.main}`,
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Lead Conversion Funnel
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'primary.main',
                        mt: 1,
                      }}
                    >
                      Track Progress
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'primary.main',
                      opacity: 0.8,
                    }}
                  >
                    <PieChartIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Visualize how leads move through your sales funnel and identify bottlenecks.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={6}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.success.main}`,
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Lead Source Analysis
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'success.main',
                        mt: 1,
                      }}
                    >
                      Source Quality
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'success.main',
                      opacity: 0.8,
                    }}
                  >
                    <BarChartIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Analyze lead quality and conversion rates by source to optimize your marketing efforts.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid size={6}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.info.main}`,
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Revenue Trends
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'info.main',
                        mt: 1,
                      }}
                    >
                      Growth Analysis
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'info.main',
                      opacity: 0.8,
                    }}
                  >
                    <TimelineIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Track revenue growth, seasonal patterns, and forecast future performance.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={6}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => `4px solid ${theme.palette.warning.main}`,
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      Customer Lifetime Value
                    </Typography>
                    <Typography
                      variant="h3"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: 'warning.main',
                        mt: 1,
                      }}
                    >
                      Long-term Value
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: 'warning.main',
                      opacity: 0.8,
                    }}
                  >
                    <BarChartIcon sx={{ fontSize: 40 }} />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Understand customer retention and long-term value to inform business strategy.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
}
