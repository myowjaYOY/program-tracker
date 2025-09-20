import React, { Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import AuditReportTable from '@/components/audit/audit-report-table';

function AuditReportSkeleton() {
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

export default function AuditReportPage() {
  return (
    <Box sx={{ 
      p: 3, 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>
      <Suspense fallback={<AuditReportSkeleton />}>
        <AuditReportTable />
      </Suspense>
    </Box>
  );
}







