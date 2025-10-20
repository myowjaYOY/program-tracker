'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Grid,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { ClinicalActionPlan } from '@/types/database.types';

interface ClinicalPlanPanelsProps {
  clinicalPlan: ClinicalActionPlan;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Clinical Plan Panels Component
 * 
 * Displays AI-generated clinical recommendations in 2 panels:
 * - Left Panel: Clinical Action Plan (4 cards)
 *   1. Dietary Intervention
 *   2. Recommended Testing
 *   3. Lifestyle Modifications
 *   4. Follow-up Schedule
 * 
 * - Right Panel: Progress Monitoring (4 cards)
 *   1. Success Indicators
 *   2. Red Flags
 *   3. Patient Education Focus
 *   4. Expected Outcomes
 */
export default function ClinicalPlanPanels({
  clinicalPlan,
  isLoading,
  error,
}: ClinicalPlanPanelsProps) {
  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, mb: 4 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Generating AI recommendations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          AI-Generated Recommendations Unavailable
        </Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Alert>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Section Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
            Clinical Recommendations
          </Typography>
        </Box>
        <Chip
          label={`AI-Generated ${formatDate(clinicalPlan.generated_at)}`}
          size="small"
          variant="outlined"
          color="primary"
        />
      </Box>

      <Grid container spacing={3}>
        {/* Left Panel: Clinical Action Plan */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            color="primary"
            gutterBottom
          >
            Clinical Action Plan
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {clinicalPlan.action_plan.map((item, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {item.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Grid>

        {/* Right Panel: Progress Monitoring */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            color="primary"
            gutterBottom
          >
            Progress Monitoring
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {clinicalPlan.progress_monitoring.map((item, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {item.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

