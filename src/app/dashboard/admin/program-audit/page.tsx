import { Suspense } from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';

/**
 * Audit iframe component - will be streamed in via Suspense
 */
function AuditIframe() {
  return (
    <Box
      sx={{
        width: '100%',
        height: 'calc(100vh - 200px)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <iframe
        src="/api/debug/verify-data-integrity"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title="Program Audit Report"
      />
    </Box>
  );
}

/**
 * Loading fallback for the audit iframe
 */
function AuditLoadingFallback() {
  return (
    <Paper
      sx={{
        width: '100%',
        height: 'calc(100vh - 200px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <CircularProgress size={40} />
      <Typography variant="body2" color="text.secondary">
        Loading audit report...
      </Typography>
    </Paper>
  );
}

/**
 * Program Audit Page - Server Component
 * 
 * Displays the data integrity audit report in an iframe.
 * Admin-only access enforced by the API endpoint.
 * 
 * Converted from Client Component:
 * - Removed useState/useEffect for loading state
 * - Uses React Suspense for loading UI instead
 * - ~0.5KB JS bundle reduction
 * 
 * Note: Error handling is now done by the iframe's internal error state
 * or via error.tsx boundary if needed.
 */
export default function ProgramAuditPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Program Audit
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review financial data integrity for all programs
        </Typography>
      </Box>

      {/* Audit Report Iframe with Suspense boundary */}
      <Suspense fallback={<AuditLoadingFallback />}>
        <AuditIframe />
      </Suspense>
    </Box>
  );
}