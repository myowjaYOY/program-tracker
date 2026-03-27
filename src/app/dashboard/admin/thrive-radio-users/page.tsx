'use client';

import React, { Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import ThriveRadioUserTable from '@/components/thrive-radio-users/thrive-radio-user-table';

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
        <Skeleton variant="text" width={250} height={40} />
        <Skeleton
          variant="rectangular"
          width={120}
          height={40}
          sx={{ borderRadius: 2 }}
        />
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </Box>
    </Box>
  );
}

export default function ThriveRadioUsersPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      <Suspense fallback={<TableSkeleton />}>
        <ThriveRadioUserTable />
      </Suspense>
    </Box>
  );
}
