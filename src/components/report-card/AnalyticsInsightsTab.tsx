'use client';

import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useIndividualInsights } from '@/lib/hooks/use-individual-insights';
import MemberRankingCard from './analytics/MemberRankingCard';
import ComparativeAnalysisCard from './analytics/ComparativeAnalysisCard';
import AIRecommendationsCard from './analytics/AIRecommendationsCard';

interface AnalyticsInsightsTabProps {
  leadId: number | null;
}

/**
 * Analytics & Insights Tab
 * 
 * Displays:
 * 1. Member Ranking & Risk Level
 * 2. Comparative Analysis (vs. population)
 * 3. AI-Powered Recommendations
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
      {/* Section 1: Member Ranking & Risk Level */}
      <MemberRankingCard insights={insights} />

      {/* Section 2: Comparative Analysis */}
      <ComparativeAnalysisCard insights={insights} />

      {/* Section 3: AI-Powered Recommendations */}
      <AIRecommendationsCard recommendations={insights.ai_recommendations || []} />
    </Box>
  );
}


