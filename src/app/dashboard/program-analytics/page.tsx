'use client';

import { useState } from 'react';
import { Box, Tabs, Tab, Typography, CircularProgress, Alert } from '@mui/material';
import { Dashboard as OverviewIcon, FactCheck as ComplianceIcon, ErrorOutline as BottleneckIcon, TrendingUp as EngagementIcon, Lightbulb as InsightsIcon } from '@mui/icons-material';
import { useAnalyticsMetrics } from '@/lib/hooks/use-analytics-metrics';
import OverviewTab from '@/components/program-analytics/OverviewTab';
import ComplianceTab from '@/components/program-analytics/ComplianceTab';
import BottleneckTab from '@/components/program-analytics/BottleneckTab';
import EngagementTab from '@/components/program-analytics/EngagementTab';
import InsightsTab from '@/components/program-analytics/InsightsTab';

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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProgramAnalyticsPage() {
  const [tabValue, setTabValue] = useState(0);
  const { data: metricsResponse, isLoading, error } = useAnalyticsMetrics();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Error loading analytics: {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  const metrics = metricsResponse;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main">
          Program Analytics
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              minWidth: 140,
              mx: 1,
            },
          }}
        >
          <Tab icon={<OverviewIcon />} iconPosition="start" label="Overview" />
          <Tab icon={<ComplianceIcon />} iconPosition="start" label="Compliance" />
          <Tab icon={<BottleneckIcon />} iconPosition="start" label="Bottlenecks" />
          <Tab icon={<EngagementIcon />} iconPosition="start" label="Engagement" />
          <Tab icon={<InsightsIcon />} iconPosition="start" label="Insights" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <TabPanel value={tabValue} index={0}>
        <OverviewTab metrics={metrics} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <ComplianceTab metrics={metrics} />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <BottleneckTab metrics={metrics} />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <EngagementTab metrics={metrics} />
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        <InsightsTab metrics={metrics} />
      </TabPanel>
    </Box>
  );
}

