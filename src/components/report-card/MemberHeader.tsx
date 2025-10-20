'use client';

import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Grid } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import type { MsqAssessmentSummary } from '@/types/database.types';

interface MemberHeaderProps {
  summary: MsqAssessmentSummary;
}

/**
 * Member Header Component
 * 
 * Displays member info and 4 summary cards:
 * 1. Total MSQ Score
 * 2. Active Symptoms
 * 3. Worsening Symptoms
 * 4. Improving Symptoms
 */
export default function MemberHeader({ summary }: MemberHeaderProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const cards = [
    {
      title: 'Total MSQ Score',
      value: summary.total_msq_score,
      icon: AssessmentIcon,
      color: getSeverityColor(summary.total_msq_score),
      subtitle: getScoreSeverity(summary.total_msq_score),
    },
    {
      title: 'Active Symptoms',
      value: summary.active_symptoms,
      icon: ErrorOutlineIcon,
      color: 'warning.main',
      subtitle: `of ${summary.total_symptoms_count} total`,
    },
    {
      title: 'Worsening',
      value: summary.worsening_count,
      icon: TrendingUpIcon,
      color: 'error.main',
      subtitle: 'symptoms increasing',
    },
    {
      title: 'Improving',
      value: summary.improving_count,
      icon: TrendingDownIcon,
      color: 'success.main',
      subtitle: 'symptoms decreasing',
    },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Member Info Header */}
      <Box
        sx={{
          mb: 3,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {summary.member_name}
            </Typography>
            {summary.program_name && (
              <Chip
                label={summary.program_name}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="textSecondary">
              Assessment Period
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatDate(summary.period_start)} - {formatDate(summary.period_end)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {summary.assessment_dates.length} assessment
              {summary.assessment_dates.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 4 Summary Cards */}
      <Grid container spacing={2}>
        {cards.map((card, index) => {
          const IconComponent = card.icon;
          return (
            <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: 3,
                  borderTopColor: card.color,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6,
                  },
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <IconComponent sx={{ color: card.color, fontSize: 20 }} />
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      fontWeight="medium"
                    >
                      {card.title}
                    </Typography>
                  </Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {card.subtitle}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSeverityColor(score: number): string {
  if (score <= 30) return '#10b981'; // Green - Optimal
  if (score <= 50) return '#f59e0b'; // Orange - Mild
  if (score <= 80) return '#ef4444'; // Red - Moderate
  return '#991b1b'; // Dark Red - Severe
}

function getScoreSeverity(score: number): string {
  if (score <= 30) return 'Optimal health';
  if (score <= 50) return 'Mild symptoms';
  if (score <= 80) return 'Moderate symptoms';
  return 'Severe symptoms';
}

