'use client';

import { Box, Grid, Card, CardContent, Typography, Alert, Chip } from '@mui/material';
import { BatteryChargingFull, Mood, EmojiEvents, Spa, TrendingUp, TrendingFlat, TrendingDown } from '@mui/icons-material';

interface EngagementTabProps {
  metrics: any;
}

export default function EngagementTab({ metrics }: EngagementTabProps) {
  if (!metrics) {
    return <Alert severity="info">No analytics data available</Alert>;
  }

  // Parse JSONB fields from actual SQL function schema
  const healthVitals = typeof metrics.health_vitals_by_tier === 'string'
    ? JSON.parse(metrics.health_vitals_by_tier)
    : metrics.health_vitals_by_tier || {};
  
  const cohortAnalysis = typeof metrics.cohort_analysis === 'string'
    ? JSON.parse(metrics.cohort_analysis)
    : metrics.cohort_analysis || [];

  // Extract overall health from high compliance tier
  const highTier = healthVitals?.high || {};
  const avgEnergy = highTier?.energy?.median || 0;
  const avgMood = highTier?.mood?.median || 0;
  const avgMotivation = highTier?.motivation?.median || 0;
  const avgWellbeing = highTier?.wellbeing?.median || 0;

  // Generate engagement insight
  const avgHealth = (avgEnergy + avgMood + avgMotivation + avgWellbeing) / 4;
  const getEngagementInsight = () => {
    if (avgHealth >= 7) {
      return {
        severity: 'success' as const,
        title: 'Excellent Member Health Indicators',
        message: `Average health score is ${avgHealth.toFixed(1)}/10. Members are reporting strong energy, mood, motivation, and wellbeing. This suggests the program is delivering positive outcomes.`
      };
    }
    if (avgHealth >= 5) {
      return {
        severity: 'warning' as const,
        title: 'Moderate Member Health',
        message: `Average health score is ${avgHealth.toFixed(1)}/10. Some members may be struggling. Consider: (1) Check-in calls, (2) Adjust program intensity, (3) Identify specific pain points.`
      };
    }
    return {
      severity: 'error' as const,
      title: 'Low Member Health Indicators',
      message: `Average health score is ${avgHealth.toFixed(1)}/10. Members are reporting low energy, mood, motivation, or wellbeing. Immediate intervention recommended to prevent dropouts.`
    };
  };

  const engagementInsight = getEngagementInsight();

  return (
    <Box>
      {/* Engagement Insight */}
      <Alert severity={engagementInsight.severity} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {engagementInsight.title}
        </Typography>
        <Typography variant="body2">
          {engagementInsight.message}
        </Typography>
      </Alert>

      {/* Overall Health Trends - Row 1: 4 cards */}
      <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
        Overall Member Health
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.warning.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <BatteryChargingFull sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Energy Level
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="warning.main">
                    {avgEnergy.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Stable
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.secondary.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Mood sx={{ fontSize: 40, color: 'secondary.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Mood Score
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="secondary.main">
                    {avgMood.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Stable
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.primary.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <EmojiEvents sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Motivation
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="primary.main">
                    {avgMotivation.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Stable
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Spa sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Wellbeing
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="success.main">
                    {avgWellbeing.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Stable
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Engagement by Cohort */}
      <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
        Engagement by Time in Program
      </Typography>

      <Grid container spacing={3}>
        {cohortAnalysis.map((cohort: any) => (
          <Grid size={3} key={cohort.cohort}>
            <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {cohort.cohort}
                  </Typography>
                  <Chip
                    label={`${cohort.avg_compliance?.toFixed(0) || 0}%`}
                    size="small"
                    color={
                      cohort.avg_compliance >= 70
                        ? 'success'
                        : cohort.avg_compliance >= 40
                        ? 'warning'
                        : 'error'
                    }
                  />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Members
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {cohort.member_count}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Completed
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="success.main">
                      {cohort.completed_count || 0}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Completion Rate
                    </Typography>
                    <Typography variant="h5" fontWeight={600} color="primary">
                      {cohort.completion_rate?.toFixed(0) || 0}%
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {cohortAnalysis.length === 0 && (
        <Box textAlign="center" py={4}>
          <Alert severity="info">No cohort data available</Alert>
        </Box>
      )}
    </Box>
  );
}
