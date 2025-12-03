'use client';

import React from 'react';
import { Grid, Skeleton } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MetricCardWithTooltip from './MetricCardWithTooltip';
import { useReportCardDashboardMetrics } from '@/lib/hooks/use-dashboard-metrics-report-card';

export default function DashboardMetricsCards() {
  const { data: metrics, isLoading, error } = useReportCardDashboardMetrics();

  if (isLoading) {
    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 4, md: 2 }}>
            <Skeleton variant="rectangular" height={120} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    console.error('Dashboard metrics error:', error);
    return null;
  }

  if (!metrics) {
    console.warn('No dashboard metrics data received');
    return null;
  }

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {/* Card 1: Member Progress Coverage */}
      <Grid size={{ xs: 12, sm: 4, md: 2 }}>
        <MetricCardWithTooltip
          title="Member Progress Coverage"
          value={`${metrics.membersWithProgress}/${metrics.totalActiveMembers} members`}
          subtitle="Active members with progress data"
          icon={PeopleIcon}
          color="#8e24ff" // Primary purple
        />
      </Grid>

      {/* Card 2: Average Support Rating */}
      <Grid size={{ xs: 12, sm: 4, md: 2 }}>
        <MetricCardWithTooltip
          title="Avg Member Feedback"
          value={metrics.avgSupportRating !== null ? `${metrics.avgSupportRating}` : 'N/A'}
          subtitle="Members with low satisfaction score"
          icon={StarIcon}
          color={
            metrics.avgSupportRating === null ? '#9ca3af' : // grey for no data
            metrics.avgSupportRating >= 4 ? '#10b981' : // green for 4-5
            metrics.avgSupportRating >= 3 ? '#f59e0b' : // yellow for 3
            '#ef4444' // red for 2 and below
          }
          tooltipData={metrics.lowSupportRatingList}
          tooltipTitle="Members needing attention (score ≤ 2):"
        />
      </Grid>

      {/* Card 3: Programs Ending in 14 Days */}
      <Grid size={{ xs: 12, sm: 4, md: 2 }}>
        <MetricCardWithTooltip
          title="Programs Ending Soon"
          value={`${metrics.programsEndingSoon} programs`}
          subtitle="Ending in the next two weeks"
          icon={EventAvailableIcon}
          color="#f59e0b" // Warning orange
          tooltipData={metrics.endingSoonList}
          tooltipTitle="Programs ending in 14 days:"
        />
      </Grid>

      {/* Card 4: Worst MSQ Scores */}
      <Grid size={{ xs: 12, sm: 4, md: 2 }}>
        <MetricCardWithTooltip
          title="Highest MSQ Scores"
          value={`Average score of ${metrics.worstMsqAverage}`}
          subtitle="Worst 6 symptom scores"
          icon={WarningAmberIcon}
          color="#ef4444" // Error red
          tooltipData={metrics.worstMsqList}
          tooltipTitle="Members needing clinical attention:"
        />
      </Grid>

      {/* Card 5: Worst Compliance Scores */}
      <Grid size={{ xs: 12, sm: 4, md: 2 }}>
        <MetricCardWithTooltip
          title="Lowest Compliance"
          value={`Average compliance: ${metrics.worstComplianceAverage}%`}
          subtitle="Lowest 6 compliance scores"
          icon={TrendingDownIcon}
          color="#f97316" // Orange
          tooltipData={metrics.worstComplianceList}
          tooltipTitle="Members with low compliance:"
        />
      </Grid>

      {/* Card 6: Best Progress Scores */}
      <Grid size={{ xs: 12, sm: 4, md: 2 }}>
        <MetricCardWithTooltip
          title="Top Performers"
          value={`Average score: ${metrics.bestProgressAverage}%`}
          subtitle="Highest 6 progress scores"
          icon={EmojiEventsIcon}
          color="#10b981" // Success green
          tooltipData={metrics.bestProgressList}
          tooltipTitle="Top performers:"
        />
      </Grid>

      {/* 
        HIDDEN: Behind on Schedule card (data still available in API)
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <MetricCardWithTooltip
            title="Behind on Schedule"
            value={`${metrics.behindScheduleCount} members`}
            subtitle="Late or missed items"
            icon={NotificationsActiveIcon}
            color="#dc2626"
            tooltipData={metrics.behindScheduleList}
            tooltipTitle="Members behind schedule:"
          />
        </Grid>
      */}
    </Grid>
  );
}

