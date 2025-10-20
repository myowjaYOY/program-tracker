'use client';

import React from 'react';
import { Box, Card, CardContent, Typography, Grid, Skeleton } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import type { ReportCardSummary } from '@/types/database.types';

interface SummaryCardsProps {
  data: ReportCardSummary | undefined;
  isLoading: boolean;
}

export default function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton variant="rectangular" height={140} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!data) return null;

  const cards = [
    {
      title: 'Total Members',
      value: data.total_participants,
      subtitle: `${data.participants_with_baseline} with MSQ data`,
      icon: PeopleIcon,
      color: 'primary.main',
      trend: null,
    },
    {
      title: 'Avg MSQ Improvement',
      value: `${data.avg_msq_improvement > 0 ? '+' : ''}${data.avg_msq_improvement.toFixed(1)}%`,
      subtitle: 'Symptom burden reduction',
      icon: TrendingUpIcon,
      color: data.avg_msq_improvement > 0 ? 'success.main' : data.avg_msq_improvement < 0 ? 'error.main' : 'warning.main',
      trend: data.avg_msq_improvement,
    },
    {
      title: 'Survey Completion',
      value: `${data.completion_rate.toFixed(1)}%`,
      subtitle: `${data.recent_surveys_count} recent surveys`,
      icon: AssignmentTurnedInIcon,
      color: data.completion_rate >= 80 ? 'success.main' : data.completion_rate >= 60 ? 'warning.main' : 'error.main',
      trend: data.recent_surveys_change,
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, index) => (
        <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette[card.color.split('.')[0] as 'primary' | 'success' | 'error' | 'warning'].main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    {card.title}
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{ fontWeight: 'bold', mt: 1 }}
                  >
                    {card.value}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? 'grey.100' : 'grey.800',
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <card.icon sx={{ fontSize: 32, color: card.color }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="textSecondary">
                  {card.subtitle}
                </Typography>
                {card.trend !== null && card.trend !== 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: card.trend > 0 ? 'success.main' : 'error.main',
                      fontWeight: 600,
                    }}
                  >
                    {card.trend > 0 ? '↑' : '↓'} {Math.abs(card.trend).toFixed(1)}%
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

