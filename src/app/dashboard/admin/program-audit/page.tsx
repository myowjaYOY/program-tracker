'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

/**
 * Program Audit Page
 * Displays the data integrity audit report in an iframe
 * Admin-only access enforced by the API endpoint
 */
export default function ProgramAuditPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if iframe loaded successfully
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Program Audit
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review financial data integrity for all programs
        </Typography>
      </Box>

      {loading && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          width: '100%',
          height: 'calc(100vh - 200px)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          display: loading ? 'none' : 'block',
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
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load audit report. You may not have permission to access this feature.');
          }}
        />
      </Box>
    </Box>
  );
}

