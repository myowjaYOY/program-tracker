'use client';

import React from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { useMemberProgressDashboard } from '@/lib/hooks/use-member-progress';
import ProfileCard from './ProfileCard';
import WinsCard from './WinsCard';
import ChallengesCard from './ChallengesCard';
import HealthVitalsCard from './HealthVitalsCard';
import ComplianceCard from './ComplianceCard';
import TimelineCard from './TimelineCard';
import GoalsCard from './GoalsCard';

interface MemberProgressTabProps {
  leadId: number | null;
}

/**
 * Member Progress Tab
 * 
 * 4-Column Layout:
 * 
 * Row 1:
 * - Curriculum Progress (spans all 4 columns)
 * 
 * Row 2:
 * - Goals in Progress (column 1)
 * - Wins (column 2)
 * - Challenges (column 3)
 * - Health Vitals (column 4)
 * 
 * Row 3:
 * - Protocol Compliance (spans all 4 columns)
 */
export default function MemberProgressTab({ leadId }: MemberProgressTabProps) {
  // Fetch complete dashboard data
  const { data, isLoading, error } = useMemberProgressDashboard(leadId);

  return (
    <Box>
      {/* Empty State - No Member Selected */}
      {!leadId && (
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
            Choose a member from the dropdown above to view their progress dashboard
          </Typography>
        </Box>
      )}

      {/* Loading State */}
      {leadId && isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Loading member progress...
          </Typography>
        </Box>
      )}

      {/* Error State */}
      {leadId && error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold">
            Error loading dashboard data
          </Typography>
          <Typography variant="body2">{error.message}</Typography>
          {error.message.includes('404') && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              Dashboard data will be available after the next survey import.
            </Typography>
          )}
        </Alert>
      )}

      {/* Dashboard Content */}
      {leadId && !isLoading && data && (
        <Box>
          {/* Profile Card - Full Width at Top */}
          <ProfileCard data={data} />

          {/* Main Dashboard Grid - 4 columns */}
          <Grid container spacing={3}>
            {/* Row 1: Curriculum Progress (spans all 4 columns) */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ mb: 3 }}>
                <TimelineCard data={data} />
              </Box>
            </Grid>

            {/* Row 2: Goals + Wins + Challenges + Health Vitals */}
            <Grid size={{ xs: 12, lg: 3 }}>
              <Box sx={{ mb: 3 }}>
                <GoalsCard data={data} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, lg: 3 }}>
              <Box sx={{ mb: 3 }}>
                <WinsCard data={data} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, lg: 3 }}>
              <Box sx={{ mb: 3 }}>
                <ChallengesCard data={data} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, lg: 3 }}>
              <Box sx={{ mb: 3 }}>
                <HealthVitalsCard data={data} />
              </Box>
            </Grid>

            {/* Row 3: Protocol Compliance (spans all 4 columns) */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ mb: 3 }}>
                <ComplianceCard data={data} />
              </Box>
            </Grid>
          </Grid>

          {/* Data Freshness Note */}
          <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="textSecondary" fontStyle="italic">
              ℹ️ Dashboard metrics are pre-calculated and updated automatically after each survey import.
              Last calculated: {new Date(data.calculated_at).toLocaleString()}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

