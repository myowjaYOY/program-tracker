'use client';

import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useMemberFeedback } from '@/lib/hooks/use-member-feedback';
import { SupportRatingsSummary, RatingsOverTimeChart, FeedbackTimeline } from './feedback';

interface MemberFeedbackTabProps {
  leadId: number | null;
}

/**
 * Member Feedback Tab
 * 
 * Displays member satisfaction and feedback data:
 * - Support Ratings Summary (Phase 2) - ratings with trends
 * - Ratings Over Time Chart (Phase 3) - line chart visualization
 * - Feedback Timeline (Phase 4) - text feedback chronologically
 */
export default function MemberFeedbackTab({ leadId }: MemberFeedbackTabProps) {
  const { data, isLoading, error } = useMemberFeedback(leadId);

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
          Choose a member from the dropdown above to view their feedback and ratings
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
          Loading member feedback...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          Feedback Not Available
        </Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Alert>
    );
  }

  // No data state
  if (!data?.data) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          No Feedback Data Yet
        </Typography>
        <Typography variant="body2">
          This member hasn&apos;t completed any surveys with feedback questions yet.
          Feedback will appear here after they complete Initial, Mid-Program, or Final Results surveys.
        </Typography>
      </Alert>
    );
  }

  const feedbackData = data.data;

  // Check if there's any meaningful data
  const hasRatings = feedbackData.ratings.overall.surveyCount > 0;
  const hasFeedback = feedbackData.feedback.length > 0;

  if (!hasRatings && !hasFeedback) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold">
          No Feedback Data Yet
        </Typography>
        <Typography variant="body2">
          This member hasn&apos;t provided any feedback or ratings yet.
          Data will appear here after they complete feedback questions in their surveys.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Section 1: Support Ratings Summary */}
      {hasRatings && (
        <SupportRatingsSummary ratings={feedbackData.ratings} />
      )}

      {/* Section 2: Ratings Over Time Chart */}
      {feedbackData.ratingTimeline.length > 1 && (
        <RatingsOverTimeChart data={feedbackData.ratingTimeline} />
      )}

      {/* Section 3: Feedback Timeline */}
      {hasFeedback && (
        <FeedbackTimeline feedback={feedbackData.feedback} />
      )}
    </Box>
  );
}

