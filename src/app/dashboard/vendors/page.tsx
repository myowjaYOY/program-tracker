import React, { Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import VendorTable from '@/components/vendors/vendor-table';

// Loading skeleton component
function VendorTableSkeleton() {
  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      {/* Header skeleton */}
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
          width={120}
          height={40}
          sx={{ borderRadius: 2 }}
        />
      </Box>

      {/* Table skeleton */}
      <Box sx={{ height: 600, width: '100%' }}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </Box>
    </Box>
  );
}

export default function VendorsPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      <Suspense fallback={<VendorTableSkeleton />}>
        <VendorTable />
      </Suspense>
    </Box>
  );
}
