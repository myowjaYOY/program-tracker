'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  MonitorWeight as WeightIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard, StatusIndicator } from '@/types/common';

interface ProfileCardProps {
  data: MemberProgressDashboard;
}

/**
 * Status indicator colors and messages
 */
const STATUS_CONFIG: Record<StatusIndicator, { color: string; label: string; description: string }> = {
  green: {
    color: '#10b981',
    label: 'On Track',
    description: 'Member is progressing well with no major concerns',
  },
  yellow: {
    color: '#f59e0b',
    label: 'Needs Monitoring',
    description: 'Some areas need attention or member is behind schedule',
  },
  red: {
    color: '#ef4444',
    label: 'Needs Attention',
    description: 'Immediate intervention recommended - multiple concerns or significantly behind',
  },
};

/**
 * Profile Card Component
 * 
 * Displays member's overall status and key metrics at the top of the dashboard
 */
export default function ProfileCard({ data }: ProfileCardProps) {
  const statusConfig = STATUS_CONFIG[data.status_indicator];
  const backgroundColor = `${statusConfig.color}15`; // 8% opacity

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Card
        variant="outlined"
        sx={{
          borderLeft: 4,
          borderLeftColor: statusConfig.color,
          backgroundColor: backgroundColor,
        }}
      >
        <CardContent>
          <Grid container spacing={2}>
            {/* Overall Status */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Status
                </Typography>
              </Box>
              <Tooltip title={statusConfig.description} placement="top" arrow>
                <Box>
                  <Chip
                    label={statusConfig.label}
                    sx={{
                      backgroundColor: statusConfig.color,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  />
                </Box>
              </Tooltip>
            </Grid>

            {/* Days in Program */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <ScheduleIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Days in Program
                </Typography>
                <Tooltip 
                  title="Days since program start date (from member_programs table)"
                  placement="top"
                  arrow
                >
                  <InfoIcon sx={{ fontSize: 16, color: 'action.disabled', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Typography variant="h5" fontWeight="bold" color={statusConfig.color}>
                {data.days_in_program ?? 'N/A'}
              </Typography>
              {data.days_in_program && (
                <Typography variant="caption" color="textSecondary">
                  {Math.floor(data.days_in_program / 7)} weeks
                </Typography>
              )}
            </Grid>

            {/* Total Surveys Completed */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <AssessmentIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Surveys Completed
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold" color="text.primary">
                {data.total_surveys_completed}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                All survey forms
              </Typography>
            </Grid>

            {/* Last Survey */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Last Survey
                </Typography>
              </Box>
              <Typography variant="body1" fontWeight="600" color="text.primary">
                {data.last_survey_name || 'No surveys yet'}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {formatDate(data.last_survey_date)}
              </Typography>
            </Grid>

            {/* Weight Change (if available) */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <WeightIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Weight Change
                </Typography>
              </Box>
              {data.current_weight !== null ? (
                <>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold" 
                    color={
                      data.weight_change === null 
                        ? 'text.primary'
                        : data.weight_change < 0 
                          ? '#10b981' // Green for loss
                          : data.weight_change > 0
                            ? '#ef4444' // Red for gain
                            : 'text.primary'
                    }
                  >
                    {data.weight_change !== null ? (
                      <>
                        {data.weight_change > 0 ? '+' : ''}
                        {data.weight_change.toFixed(1)} lbs
                      </>
                    ) : (
                      `${data.current_weight.toFixed(1)} lbs`
                    )}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Current: {data.current_weight.toFixed(1)} lbs
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No weight data
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

