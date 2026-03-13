'use client';

import React, { Suspense, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import {
  Flag as FlagIcon,
  ContentCopy as TemplateIcon,
  PlaylistAdd as ApplyIcon,
} from '@mui/icons-material';
import TargetsTable from '@/components/targets/targets-table';
import TemplateTable from '@/components/targets/template-table';
import ApplyTemplateDialog from '@/components/targets/apply-template-dialog';

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
      id={`targets-tabpanel-${index}`}
      aria-labelledby={`targets-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `targets-tab-${index}`,
    'aria-controls': `targets-tabpanel-${index}`,
  };
}

function TableSkeleton() {
  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton
          variant="rectangular"
          width={150}
          height={40}
          sx={{ borderRadius: 1 }}
        />
      </Box>
      <Box sx={{ height: 'calc(100vh - 120px)', width: '100%', flex: 1 }}>
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          sx={{ borderRadius: 1 }}
        />
      </Box>
    </Box>
  );
}

export default function TargetsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Performance Targets
        </Typography>
      </Box>

      {/* Tabs in Card */}
      <Card>
        <CardContent>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="performance targets tabs"
            sx={{
              '& .MuiTabs-flexContainer': { gap: 4 },
              '& .MuiTab-root': {
                fontWeight: 500,
                fontSize: '1rem',
              },
            }}
          >
            <Tab
              icon={<FlagIcon />}
              iconPosition="start"
              label="TARGETS"
              {...a11yProps(0)}
            />
            <Tab
              icon={<TemplateIcon />}
              iconPosition="start"
              label="TEMPLATE"
              {...a11yProps(1)}
            />
          </Tabs>

          {/* Tab Panels */}
          <Box sx={{ mt: 2 }}>
            <TabPanel value={tabValue} index={0}>
              <Suspense fallback={<TableSkeleton />}>
                <TargetsTable
                  additionalHeaderButtons={
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<ApplyIcon />}
                      onClick={() => setApplyDialogOpen(true)}
                      sx={{ borderRadius: 0, fontWeight: 600 }}
                    >
                      Apply Template
                    </Button>
                  }
                />
              </Suspense>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Suspense fallback={<TableSkeleton />}>
                <TemplateTable />
              </Suspense>
            </TabPanel>
          </Box>
        </CardContent>
      </Card>

      {/* Apply Template Dialog */}
      <ApplyTemplateDialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
      />
    </Box>
  );
}
