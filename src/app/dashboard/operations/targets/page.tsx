'use client';

import React, { Suspense } from 'react';
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';
import TargetsTable from '@/components/targets/targets-table';

function TargetsTableSkeleton() {
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
  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header - same as Leads: h4, bold, primary (purple) */}
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

      {/* Data Grid in Card - same as Leads */}
      <Card>
        <CardContent>
          <Suspense fallback={<TargetsTableSkeleton />}>
            <TargetsTable />
          </Suspense>
        </CardContent>
      </Card>
    </Box>
  );
}
