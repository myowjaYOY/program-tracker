'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  ShowChart as ChartIcon,
  Percent as PercentIcon,
  CompareArrows as ConversionIcon,
  TableChart as TableIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable from '@/components/tables/base-data-table';
import { useExecutiveDashboard, useMonthlySales, DateRangeFilter, CampaignMetrics } from '@/lib/hooks/use-sales-reports';
import MonthlySalesChart from '@/components/sales-reports/MonthlySalesChart';

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
      id={`sales-reports-tabpanel-${index}`}
      aria-labelledby={`sales-reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SalesReportsPage() {
  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Date filter state
  const [dateRange, setDateRange] = useState<DateRangeFilter['range']>('all');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useExecutiveDashboard({
    range: dateRange,
    startDate,
    endDate,
  });

  // Fetch monthly sales data
  const { data: monthlySalesData, isLoading: monthlySalesLoading, error: monthlySalesError } = useMonthlySales({
    range: dateRange,
    startDate,
    endDate,
  });

  const summary = dashboardData?.data.summary || {
    totalRevenue: 0,
    pipelineValue: 0,
    avgProgramValue: 0,
    avgMargin: 0,
    conversionRate: 0,
  };

  const campaignData = dashboardData?.data.revenueByCampaign || [];

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Handle date range change
  const handleDateRangeChange = (value: string) => {
    const newRange = value as DateRangeFilter['range'];
    setDateRange(newRange);

    // Set default dates for custom range
    if (newRange === 'custom') {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      setStartDate(prev => prev || iso);
      setEndDate(prev => prev || iso);
    } else {
      // Clear custom dates when switching to preset ranges
      setStartDate(null);
      setEndDate(null);
    }
  };

  // Campaign table columns
  const campaignColumns: GridColDef[] = [
    {
      field: 'campaign_name',
      headerName: 'Campaign Name',
      width: 200,
      flex: 1,
    },
    {
      field: 'campaign_date',
      headerName: 'Campaign Date',
      width: 120,
      renderCell: params => {
        const value = params.value;
        if (!value) return '-';
        return new Date(value).toLocaleDateString();
      },
    },
    {
      field: 'campaign_status',
      headerName: 'Status',
      width: 100,
      type: 'singleSelect',
      valueOptions: ['Active', 'Closed', 'Mixed'],
    },
    {
      field: 'pme_scheduled',
      headerName: 'PMEs Scheduled',
      width: 130,
      type: 'number',
    },
    {
      field: 'pme_no_shows',
      headerName: 'PME No Shows',
      width: 120,
      type: 'number',
    },
    {
      field: 'programs_won',
      headerName: 'Programs Won',
      width: 130,
      type: 'number',
    },
    {
      field: 'pme_win_percentage',
      headerName: 'PME → Win %',
      width: 130,
      type: 'number',
      renderCell: params => {
        const pmeScheduled = params.row.pme_scheduled || 0;
        const pmeNoShows = params.row.pme_no_shows || 0;
        const programsWon = params.row.programs_won || 0;
        const attendedPMEs = pmeScheduled - pmeNoShows;
        
        if (attendedPMEs === 0) return '0.0%';
        const percentage = (programsWon / attendedPMEs) * 100;
        return `${percentage.toFixed(1)}%`;
      },
    },
    {
      field: 'campaign_cost',
      headerName: 'Campaign Cost',
      width: 130,
      type: 'number',
      renderCell: params => {
        const value = params.value;
        if (value == null) return '-';
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: 'cost_per_customer',
      headerName: 'Cost per Customer',
      width: 150,
      type: 'number',
      renderCell: params => {
        const value = params.value;
        if (value == null || value === 0) return '$0.00';
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: 'total_revenue',
      headerName: 'Total Revenue',
      width: 140,
      type: 'number',
      renderCell: params => {
        const value = params.value;
        if (value == null) return '-';
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: 'roi_percentage',
      headerName: 'ROI %',
      width: 110,
      type: 'number',
      renderCell: params => {
        const value = params.value;
        const campaignCost = params.row.campaign_cost;
        if (campaignCost === 0) return 'N/A';
        if (value == null) return '-';
        const color = value >= 0 ? 'success.main' : 'error.main';
        return (
          <Box sx={{ color }}>
            {Number(value).toFixed(1)}%
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 3, height: '100%' }}>
      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
          sx={{ mb: 1 }}
        >
          Sales Reports
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Comprehensive sales performance analytics and insights
        </Typography>

        {/* Date Filter Controls */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Date Range"
            value={dateRange}
            onChange={e => handleDateRangeChange(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All Time</MenuItem>
            <MenuItem value="this_year">This Year</MenuItem>
            <MenuItem value="last_year">Last Year</MenuItem>
            <MenuItem value="this_month">This Month</MenuItem>
            <MenuItem value="last_month">Last Month</MenuItem>
            <MenuItem value="this_quarter">This Quarter</MenuItem>
            <MenuItem value="last_quarter">Last Quarter</MenuItem>
            <MenuItem value="custom">Custom Range</MenuItem>
          </TextField>
          {dateRange === 'custom' && (
            <>
              <TextField
                type="date"
                label="Start Date"
                value={startDate || ''}
                onChange={e => setStartDate(e.target.value || null)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                label="End Date"
                value={endDate || ''}
                onChange={e => setEndDate(e.target.value || null)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </Box>
      </Box>

      {/* Error State */}
      {error && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="error">
            Error: {error.message}
          </Typography>
        </Box>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      )}

      {/* Dashboard Content */}
      {!error && !isLoading && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Card 1: Total Revenue */}
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: theme => `4px solid ${theme.palette.primary.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                        Total Revenue
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{ fontWeight: 'bold', color: 'primary.main', mt: 1 }}
                      >
                        ${Math.round(summary.totalRevenue).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ color: 'primary.main', opacity: 0.8 }}>
                      <MoneyIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Active + Completed programs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 2: Pipeline Value */}
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: theme => `4px solid ${theme.palette.success.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                        Pipeline Value
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{ fontWeight: 'bold', color: 'success.main', mt: 1 }}
                      >
                        ${Math.round(summary.pipelineValue).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ color: 'success.main', opacity: 0.8 }}>
                      <TrendingUpIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Quote status programs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 3: Avg Program Value */}
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: theme => `4px solid ${theme.palette.info.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                        Avg Program Value
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{ fontWeight: 'bold', color: 'info.main', mt: 1 }}
                      >
                        ${Math.round(summary.avgProgramValue).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ color: 'info.main', opacity: 0.8 }}>
                      <ChartIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Average revenue per program
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 4: Avg Margin % */}
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: theme => `4px solid ${theme.palette.warning.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                        Avg Margin %
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{ fontWeight: 'bold', color: 'warning.main', mt: 1 }}
                      >
                        {summary.avgMargin.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ color: 'warning.main', opacity: 0.8 }}>
                      <PercentIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Weighted average margin
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 5: Conversion Rate */}
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: theme => `4px solid ${theme.palette.error.main}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme => theme.shadows[4],
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                        Conversion Rate
                      </Typography>
                      <Typography
                        variant="h3"
                        component="div"
                        sx={{ fontWeight: 'bold', color: 'error.main', mt: 1 }}
                      >
                        {summary.conversionRate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ color: 'error.main', opacity: 0.8 }}>
                      <ConversionIcon sx={{ fontSize: 40 }} />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    PME → Win conversion
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs Section */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="sales reports tabs"
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
                label="Revenue by Campaign"
                icon={<TableIcon />}
                iconPosition="start"
              />
              <Tab
                label="Monthly Sales"
                icon={<TimelineIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Tab 1: Revenue by Campaign Table */}
          <TabPanel value={tabValue} index={0}>
            <BaseDataTable<CampaignMetrics>
              title=""
              data={campaignData}
              columns={campaignColumns}
              loading={isLoading}
              onEdit={() => {}}
              showCreateButton={false}
              showActionsColumn={false}
              persistStateKey="salesRevenueByCampaignGrid"
            />
          </TabPanel>

          {/* Tab 2: Monthly Sales Chart */}
          <TabPanel value={tabValue} index={1}>
            <MonthlySalesChart
              data={monthlySalesData?.data}
              isLoading={monthlySalesLoading}
              error={monthlySalesError}
            />
          </TabPanel>
        </>
      )}
    </Box>
  );
}

