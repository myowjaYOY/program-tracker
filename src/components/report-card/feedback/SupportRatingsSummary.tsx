'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Star as StarIcon,
  MedicalServices as ProviderIcon,
  Groups as StaffIcon,
  School as CurriculumIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  RemoveCircleOutline as NoDataIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import type { MemberFeedbackRatings, FeedbackTrend, RatingHistoryEntry } from '@/lib/hooks/use-member-feedback';

interface SupportRatingsSummaryProps {
  ratings: MemberFeedbackRatings;
}

/**
 * Color configuration for rating dimensions
 */
const DIMENSION_CONFIG = {
  overall: {
    label: 'Overall Score',
    icon: StarIcon,
    color: '#10b981', // green
    question: 'Average satisfaction across all support dimensions',
  },
  provider: {
    label: 'Provider',
    icon: ProviderIcon,
    color: '#8b5cf6', // purple
    question: 'How supportive has your provider been throughout your program?',
  },
  staff: {
    label: 'Staff/Coach',
    icon: StaffIcon,
    color: '#06b6d4', // cyan
    question: 'How supportive has the clinic staff and/or health coach been?',
  },
  curriculum: {
    label: 'Curriculum',
    icon: CurriculumIcon,
    color: '#f59e0b', // amber
    question: 'How supportive has the educational curriculum been for your health journey?',
  },
};

/**
 * Trend icon configuration
 */
const TREND_CONFIG: Record<FeedbackTrend, { icon: React.ElementType; color: string; label: string }> = {
  improving: {
    icon: TrendingUpIcon,
    color: '#10b981',
    label: 'Improving',
  },
  stable: {
    icon: TrendingFlatIcon,
    color: '#6b7280',
    label: 'Stable',
  },
  declining: {
    icon: TrendingDownIcon,
    color: '#ef4444',
    label: 'Declining',
  },
  no_data: {
    icon: NoDataIcon,
    color: '#9ca3af',
    label: 'No Data',
  },
};

/**
 * Get sub-label description for each dimension
 */
function getSubLabel(dimension: string): string {
  switch (dimension) {
    case 'overall':
      return 'Average satisfaction score';
    case 'provider':
      return 'Rating of provider support';
    case 'staff':
      return 'Rating of staff/coach support';
    case 'curriculum':
      return 'Rating of educational content';
    default:
      return 'Support rating';
  }
}

/**
 * Individual Rating Dimension Display
 */
interface RatingDimensionProps {
  dimension: 'overall' | 'provider' | 'staff' | 'curriculum';
  score: number | null;
  trend: FeedbackTrend;
  surveyCount?: number;
  history?: RatingHistoryEntry[];
}

function RatingDimension({ dimension, score, trend, surveyCount, history }: RatingDimensionProps) {
  const config = DIMENSION_CONFIG[dimension];
  const trendConfig = TREND_CONFIG[trend];
  const Icon = config.icon;
  const TrendIcon = trendConfig.icon;
  const subLabel = getSubLabel(dimension);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Icon sx={{ fontSize: 20, color: config.color }} />
        <Typography variant="body2" color="textSecondary" fontWeight="medium">
          {config.label}
        </Typography>
      </Box>

      <Tooltip
        title={
          <Box sx={{ p: 1.5, maxWidth: 300 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}
            >
              {config.question}
            </Typography>
            {dimension === 'overall' && surveyCount !== undefined ? (
              <Typography
                variant="body2"
                sx={{ fontSize: '0.8rem', color: 'text.primary' }}
              >
                Based on {surveyCount} survey{surveyCount !== 1 ? 's' : ''}
              </Typography>
            ) : history && history.length > 0 ? (
              history.map((entry, index) => (
                <Typography
                  key={index}
                  variant="body2"
                  sx={{
                    mb: 0.5,
                    fontSize: '0.8rem',
                    lineHeight: 1.3,
                    color: 'text.primary',
                  }}
                >
                  {new Date(entry.date).toLocaleDateString()}: {entry.value}/5
                </Typography>
              ))
            ) : (
              <Typography
                variant="body2"
                sx={{ fontSize: '0.8rem', color: 'text.primary' }}
              >
                No data available
              </Typography>
            )}
          </Box>
        }
        placement="top"
        arrow
        enterDelay={300}
        leaveDelay={200}
        componentsProps={{
          tooltip: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: 1,
              borderColor: 'divider',
              boxShadow: 3,
              '& .MuiTooltip-arrow': {
                color: 'background.paper',
                '&::before': {
                  border: 1,
                  borderColor: 'divider',
                },
              },
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            mb: 0.5,
            '&:hover .score-text': { opacity: 0.8 },
          }}
        >
          <Typography
            variant="h6"
            fontWeight="bold"
            className="score-text"
            sx={{ color: getRatingColor(score) }}
          >
            {score !== null ? `${score.toFixed(1)}/5` : 'N/A'}
          </Typography>
          <Tooltip title={trendConfig.label} placement="top" arrow>
            <TrendIcon sx={{ fontSize: 20, color: trendConfig.color }} />
          </Tooltip>
        </Box>
      </Tooltip>

      {/* Sub-label with info icon */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <InfoOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
        <Typography variant="caption" color="textSecondary">
          {subLabel}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Get color based on rating score
 * 4-5: Green, 3: Yellow, 2 and below: Red
 */
function getRatingColor(score: number | null): string {
  if (score === null) return '#9ca3af'; // grey for no data
  if (score >= 4) return '#10b981'; // green for 4-5
  if (score >= 3) return '#f59e0b'; // yellow for 3
  return '#ef4444'; // red for 2 and below
}

/**
 * Support Ratings Summary Card
 * 
 * Displays member satisfaction ratings at the top of the feedback tab
 * Shows overall score plus 3 individual dimensions with trends
 */
export default function SupportRatingsSummary({ ratings }: SupportRatingsSummaryProps) {
  const borderColor = getRatingColor(ratings.overall.current);
  const backgroundColor = `${borderColor}15`; // ~8% opacity

  return (
    <Box sx={{ mb: 4 }}>
      <Card
        variant="outlined"
        sx={{
          borderLeft: 4,
          borderLeftColor: borderColor,
          backgroundColor: backgroundColor,
        }}
      >
        <CardContent>
          <Grid container spacing={2}>
            {/* Overall Score */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <RatingDimension
                dimension="overall"
                score={ratings.overall.current}
                trend={ratings.overall.trend}
                surveyCount={ratings.overall.surveyCount}
              />
            </Grid>

            {/* Provider Support */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <RatingDimension
                dimension="provider"
                score={ratings.provider.current}
                trend={ratings.provider.trend}
                history={ratings.provider.history}
              />
            </Grid>

            {/* Staff/Coach Support */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <RatingDimension
                dimension="staff"
                score={ratings.staff.current}
                trend={ratings.staff.trend}
                history={ratings.staff.history}
              />
            </Grid>

            {/* Curriculum Support */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <RatingDimension
                dimension="curriculum"
                score={ratings.curriculum.current}
                trend={ratings.curriculum.trend}
                history={ratings.curriculum.history}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
