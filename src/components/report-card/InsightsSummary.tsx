'use client';

import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Skeleton,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import type { ReportCardInsights } from '@/types/database.types';

interface InsightsSummaryProps {
  data: ReportCardInsights | undefined;
  isLoading: boolean;
  error: Error | null;
}

export default function InsightsSummary({
  data,
  isLoading,
  error,
}: InsightsSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Progress Insights" />
        <CardContent>
          <Skeleton variant="text" height={40} />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="Progress Insights" />
        <CardContent>
          <Alert severity="error">{error.message}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader title="Progress Insights" />
        <CardContent>
          <Alert severity="info">No insights available.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Progress Insights" subheader="Auto-generated analysis" />
      <CardContent>
        {/* Overall Summary */}
        <Alert severity={data.concerns.length > data.improvements.length ? 'warning' : 'success'} sx={{ mb: 3 }}>
          {data.summary}
        </Alert>

        {/* Improvements */}
        {data.improvements.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
              <Typography variant="h6">Improvements ({data.improvements.length})</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.improvements.map((insight, idx) => (
                <Box key={idx} sx={{ pl: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {insight.title}
                    </Typography>
                    {insight.significance && (
                      <Chip
                        label={insight.significance}
                        size="small"
                        color={insight.significance === 'large' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    {insight.message}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Concerns */}
        {data.concerns.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <WarningIcon sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="h6">Concerns ({data.concerns.length})</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.concerns.map((insight, idx) => (
                  <Box key={idx} sx={{ pl: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {insight.title}
                      </Typography>
                      {insight.significance && (
                        <Chip
                          label={insight.significance}
                          size="small"
                          color={insight.significance === 'large' ? 'error' : 'default'}
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {insight.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}

        {/* Stable Areas */}
        {data.stable_areas.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <RemoveCircleIcon sx={{ color: 'text.secondary', mr: 1 }} />
                <Typography variant="h6">Stable Areas ({data.stable_areas.length})</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.stable_areas.map((insight, idx) => (
                  <Box key={idx} sx={{ pl: 4 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {insight.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {insight.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}


