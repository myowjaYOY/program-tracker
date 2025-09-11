import React, { Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import ProgramStatusTable from '@/components/program-status/program-status-table';

function ProgramStatusTableSkeleton() {
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
      <Box sx={{ height: 600, width: '100%' }}>
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

export default function ProgramStatusPage() {
  return (
    <Box sx={{ p: 3, height: '100%' }}>
      <Suspense fallback={<ProgramStatusTableSkeleton />}>
        <ProgramStatusTable />
      </Suspense>
    </Box>
  );
}
