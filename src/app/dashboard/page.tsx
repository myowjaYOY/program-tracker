'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useDashboardMetrics } from '@/lib/hooks/use-dashboard-metrics';

export default function DashboardPage() {
  const { data: metrics, isLoading, error } = useDashboardMetrics();

  const metricCards = [
    {
      title: 'Active Members',
      value: metrics?.activeMembers ?? 0,
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: 'primary.main',
      description: 'Members on Active programs',
    },
    {
      title: 'New Programs This Month',
      value: metrics?.newProgramsThisMonth ?? 0,
      icon: <SchoolIcon sx={{ fontSize: 40 }} />,
      color: 'success.main',
      description: 'Programs started this month',
    },
    {
      title: 'Completed Programs',
      value: metrics?.completedPrograms ?? 0,
      icon: <CheckCircleIcon sx={{ fontSize: 40 }} />,
      color: 'info.main',
      description: 'Programs completed',
    },
    {
      title: 'Members on Memberships',
      value: metrics?.membersOnMemberships ?? 0,
      icon: <GroupAddIcon sx={{ fontSize: 40 }} />,
      color: 'warning.main',
      description: 'Placeholder for future feature',
    },
  ];

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load dashboard metrics: {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
          gutterBottom
        >
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your program tracking metrics
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metricCards.map((card, index) => (
          <Grid item xs={3} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: theme => {
                  const [paletteKey, colorKey] = card.color.split('.');
                  if (paletteKey && colorKey) {
                    return `4px solid ${(theme.palette as any)[paletteKey]?.[colorKey] || '#000'}`;
                  }
                  return '4px solid #000';
                },
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme => theme.shadows[4],
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
                      sx={{
                        fontWeight: 'bold',
                        color: card.color,
                        mt: 1,
                      }}
                    >
                      {isLoading ? (
                        <CircularProgress size={32} color="inherit" />
                      ) : (
                        card.value.toLocaleString()
                      )}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: card.color,
                      opacity: 0.8,
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.875rem' }}
                >
                  {card.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Additional Dashboard Content Placeholder */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Additional Dashboard Content
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This area is reserved for additional dashboard widgets, charts, and insights.
            Future enhancements could include:
          </Typography>
          <Box component="ul" sx={{ mt: 2, pl: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Program performance charts
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Recent activity feed
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Quick action buttons
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Upcoming deadlines and reminders
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}