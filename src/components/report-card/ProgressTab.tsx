'use client';

import React, { useState } from 'react';
import { Box, Grid, Alert } from '@mui/material';
import FilterPanel from './FilterPanel';
import MsqTimelineChart from './MsqTimelineChart';
import InsightsSummary from './InsightsSummary';
import {
  useReportCardParticipants,
  useMsqTimeline,
  useReportCardInsights,
} from '@/lib/hooks/use-report-card';

export default function ProgressTab() {
  const [externalUserId, setExternalUserId] = useState<number | null>(null);

  // Fetch filter options (members = all survey participants)
  const { data: members, isLoading: membersLoading } = useReportCardParticipants();

  // Fetch chart data (only when externalUserId is selected)
  const msqTimeline = useMsqTimeline(externalUserId);
  const insights = useReportCardInsights(externalUserId);

  return (
    <Box>
      {/* Filter Panel */}
      <FilterPanel
        members={members}
        membersLoading={membersLoading}
        selectedExternalUserId={externalUserId}
        onMemberChange={setExternalUserId}
      />

      {/* Charts Section */}
      {!externalUserId ? (
        <Alert severity="info">
          Please select a member to view their survey data and progress charts.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {/* MSQ Timeline - Full Width */}
          <Grid size={{ xs: 12 }}>
            <MsqTimelineChart
              data={msqTimeline.data}
              isLoading={msqTimeline.isLoading}
              error={msqTimeline.error}
              onRefresh={() => msqTimeline.refetch()}
              isFetching={msqTimeline.isFetching}
            />
          </Grid>

          {/* Insights - Full Width */}
          <Grid size={{ xs: 12 }}>
            <InsightsSummary
              data={insights.data}
              isLoading={insights.isLoading}
              error={insights.error}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

