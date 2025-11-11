'use client';

import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useIndividualInsights } from '@/lib/hooks/use-individual-insights';
import MemberRankingProfile from './analytics/MemberRankingProfile';
import ComparativeAnalysisGrid from './analytics/ComparativeAnalysisGrid';
import RecommendationsGrid from './analytics/RecommendationsGrid';

interface AnalyticsInsightsTabProps {
  leadId: number | null;
}

/**
 * Analytics & Insights Tab
 * 
 * Displays:
 * - Member Ranking Profile (thin card at top with 4 sections)
 * - Comparative Analysis Grid (5 compliance cards + 5 vitals cards)
 * - Recommendations Grid (individual cards: high priority full width, medium/low half width)
 */
export default function AnalyticsInsightsTab({ leadId }: AnalyticsInsightsTabProps) {
  const { data, isLoading, error } = useIndividualInsights(leadId);

  // Empty state - No member selected
  if (!leadId) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 2,
          backgroundColor: 'background.paper',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" color="textSecondary" gutterBottom>
          Select a Member
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Choose a member from the dropdown above to view their analytics and insights
        </Typography>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress size={48} />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Loading analytics & insights...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          Analytics Not Available
        </Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Alert>
    );
  }

  // No data state
  if (!data?.insights) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          Analytics Not Yet Generated
        </Typography>
        <Typography variant="body2">
          Individual analytics will be calculated during the next survey import.
        </Typography>
      </Alert>
    );
  }

  const insights = data.insights;

  return (
    <Box>
      {/* Member Ranking Profile - At Top */}
      <MemberRankingProfile insights={insights} />

      {/* Comparative Analysis Grid - Compliance & Vitals */}
      <ComparativeAnalysisGrid insights={insights} />

      {/* Recommendations Grid */}
      <RecommendationsGrid recommendations={insights.ai_recommendations || []} />
    </Box>
  );
}


