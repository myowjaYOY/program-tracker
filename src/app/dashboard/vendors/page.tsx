import React, { Suspense } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { getVendors } from '@/lib/data/vendors';
import VendorTable from '@/components/vendors/vendor-table';

/**
 * Loading skeleton for the vendors content
 */
function VendorsSkeleton() {
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
async function VendorsContent() {
  try {
    const vendors = await getVendors();
    return <VendorTable initialData={vendors} />;
  } catch (error) {
    console.error('Error in VendorsContent:', error);
    return <VendorTable initialData={[]} />;
  }
}

/**
 * Main Vendors page.
 * Renders the page shell immediately to allow for "instant" navigation
 * while fetching data in the background via Suspense.
 */
export default function VendorsPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      <Suspense fallback={<VendorsSkeleton />}>
        <VendorTable />
      </Suspense>
    </Box>
  );
}
