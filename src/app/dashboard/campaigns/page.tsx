import React, { Suspense } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { getCampaigns } from '@/lib/data/campaigns';
import CampaignTable from '@/components/campaigns/campaign-table';

/**
 * Loading skeleton for the campaigns content
 */
function CampaignsSkeleton() {
  return (
    <Box sx={{ width: '100%' }}>
      {/* Search/Header area skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
      </Box>

      {/* Table skeleton */}
      <Skeleton variant="rectangular" width="100%" height={500} sx={{ borderRadius: 1 }} />
    </Box>
  );
}

/**
 * Data-fetching component that is deferred by Suspense
 */
async function CampaignsContent() {
  try {
    const campaigns = await getCampaigns();
    return <CampaignTable initialData={campaigns} />;
  } catch (error) {
    console.error('Error in CampaignsContent:', error);
    return <CampaignTable initialData={[]} />;
  }
}

/**
 * Main Campaigns page.
 * Renders the page shell immediately to allow for "instant" navigation
 * while fetching data in the background via Suspense.
 */
export default function CampaignsPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
        >
          Campaigns
        </Typography>
      </Box>

      <Suspense fallback={<CampaignsSkeleton />}>
        <CampaignsContent />
      </Suspense>
    </Box>
  );
}
