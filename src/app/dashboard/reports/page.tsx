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
} from '@mui/icons-material';
import ReportsTable from '@/components/reports/reports-table';

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
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
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

export default function ReportsPage() {
  const [tabValue, setTabValue] = useState(0);

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main">
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
          Generate and view comprehensive reports for your marketing campaigns, leads, and sales data.
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
        <ReportsTable />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          <Card>
            <CardHeader 
              title="Lead Conversion Funnel" 
              subheader="Track lead progression through stages"
            />
            <CardContent>
              <Typography variant="body1" color="text.secondary">
                Visualize how leads move through your sales funnel and identify bottlenecks.
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardHeader 
              title="Lead Source Analysis" 
              subheader="Which sources generate the best leads"
            />
            <CardContent>
              <Typography variant="body1" color="text.secondary">
                Analyze lead quality and conversion rates by source to optimize your marketing efforts.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          <Card>
            <CardHeader 
              title="Revenue Trends" 
              subheader="Monthly and quarterly revenue analysis"
            />
            <CardContent>
              <Typography variant="body1" color="text.secondary">
                Track revenue growth, seasonal patterns, and forecast future performance.
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardHeader 
              title="Customer Lifetime Value" 
              subheader="Long-term customer value analysis"
            />
            <CardContent>
              <Typography variant="body1" color="text.secondary">
                Understand customer retention and long-term value to inform business strategy.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>
    </Box>
  );
}
