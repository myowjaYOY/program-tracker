'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import ScheduledJobsTab from './scheduled-jobs-tab';
import ImportJobsTab from './import-jobs-tab';

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
      id={`system-jobs-tabpanel-${index}`}
      aria-labelledby={`system-jobs-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function SystemJobsPage() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        height: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          System Jobs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Monitor scheduled tasks and data import jobs. Data refreshes automatically every 30 seconds.
        </Typography>
      </Box>

      {/* Main Content */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="system jobs tabs"
            sx={{
              '& .MuiTab-root': {
                minHeight: 56,
                textTransform: 'none',
                fontSize: '0.9375rem',
                fontWeight: 500,
              },
            }}
          >
            <Tab
              icon={<ScheduleIcon />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Scheduled Jobs
                  <Chip
                    label="Cron"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.6875rem' }}
                  />
                </Box>
              }
            />
            <Tab
              icon={<CloudUploadIcon />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Import Jobs
                  <Chip
                    label="File"
                    size="small"
                    color="secondary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.6875rem' }}
                  />
                </Box>
              }
            />
          </Tabs>
        </Box>

        <CardContent sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          <Box sx={{ px: 2 }}>
            <TabPanel value={tabValue} index={0}>
              <ScheduledJobsTab />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <ImportJobsTab />
            </TabPanel>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}












