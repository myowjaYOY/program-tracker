import React, { Suspense } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import BucketTable from '@/components/buckets/bucket-table';

function BucketsPageSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
      <Skeleton variant="rectangular" width="100%" height={600} />
    </Box>
  );
}

export default function BucketsPage() {
  return (
    <Box sx={{ p: 3, height: '100%' }}>
      <Suspense fallback={<BucketsPageSkeleton />}>
        <BucketTable />
      </Suspense>
    </Box>
  );
}
