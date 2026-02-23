import React, { Suspense } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { getMemberPrograms } from '@/lib/data/programs';
import ProgramsPageClient from '@/components/programs/programs-page-client';

/**
 * Loading skeleton for the programs content
 */
function ProgramsSkeleton() {
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search/Header area skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
      </Box>

      {/* Grid skeleton */}
      <Skeleton variant="rectangular" width="100%" height={300} sx={{ mb: 2, borderRadius: 1 }} />

      {/* Tabs skeleton (simulated) */}
      <Box sx={{ height: 40, borderBottom: 1, borderColor: 'divider', mb: 2 }} />

      {/* Tab content skeleton */}
      <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
    </Box>
  );
}

/**
 * Data-fetching component that is deferred by Suspense
 */
async function ProgramsContent() {
  try {
    const programs = await getMemberPrograms();
    return <ProgramsPageClient initialPrograms={programs} />;
  } catch (error) {
    console.error('Error in ProgramsContent:', error);
    return <ProgramsPageClient initialPrograms={[]} />;
  }
}

/**
 * Main Programs page.
 * Renders the page shell immediately to allow for "instant" navigation
 * while fetching data in the background via Suspense.
 */
export default function ProgramsPage() {
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
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Programs
        </Typography>
      </Box>

      <Suspense fallback={<ProgramsSkeleton />}>
        <ProgramsContent />
      </Suspense>
    </Box>
  );
}
