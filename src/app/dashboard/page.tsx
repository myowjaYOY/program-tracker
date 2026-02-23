import React, { Suspense } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { getDashboardData } from '@/lib/data/dashboard';
import DashboardPageClient from '@/components/dashboard/dashboard-page-client';

/**
 * Loading skeleton for the dashboard content
 */
function DashboardSkeleton() {
  return (
    <Box sx={{ width: '100%' }}>
      {/* Metrics Cards Skeleton */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, overflow: 'hidden' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            sx={{ flex: 1, height: 140, borderRadius: 1 }}
          />
        ))}
      </Box>

      {/* Member Selection Skeleton */}
      <Skeleton variant="rectangular" width={220} height={40} sx={{ mb: 3, borderRadius: 1 }} />

      {/* Program Details Skeleton */}
      <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 1 }} />
    </Box>
  );
}

/**
 * Data-fetching component that is deferred by Suspense
 */
async function DashboardContent() {
  const data = await getDashboardData();
  return <DashboardPageClient initialData={data} />;
}

/**
 * Main Dashboard page.
 * Renders the page shell (header) immediately to allow for "instant" navigation
 * while fetching data in the background via Suspense.
 */
export default function DashboardPage() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header - Renders immediately */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Dashboard
        </Typography>
      </Box>

      {/* Data-dependent content with skeleton-based fallback */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </Box>
  );
}