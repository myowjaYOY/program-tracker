import React, { Suspense } from 'react';
import { Box, Typography } from '@mui/material';
import { getLeads } from '@/lib/data/leads';
import LeadsPageClient from '@/components/leads/leads-page-client';
import LeadsPageLoading from '@/components/leads/leads-page-loading';

/**
 * Data-fetching component that is deferred by Suspense
 */
async function LeadsContent() {
  try {
    const leads = await getLeads();
    return <LeadsPageClient initialLeads={leads} />;
  } catch (error) {
    console.error('Error fetching leads on server:', error);
    return <LeadsPageClient initialLeads={[]} />;
  }
}

/**
 * Main Leads page.
 * Renders the page shell (header) immediately to allow for "instant" navigation
 * while fetching data in the background via Suspense.
 */
export default function LeadsPage() {
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
          Leads
        </Typography>
      </Box>

      {/* Data-dependent content with spinner-based fallback */}
      <Suspense fallback={<LeadsPageLoading />}>
        <LeadsContent />
      </Suspense>
    </Box>
  );
}
