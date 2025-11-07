'use client';

import { Box, Grid, Card, CardContent, Typography, Alert } from '@mui/material';
import { Warning, CheckCircle, Group, TrendingUp, BatteryChargingFull, Mood, EmojiEvents, Spa, Restaurant, FitnessCenter, LocalPharmacy, SelfImprovement } from '@mui/icons-material';

interface OverviewTabProps {
  metrics: any;
}

export default function OverviewTab({ metrics }: OverviewTabProps) {
  if (!metrics) {
    return <Alert severity="info">No analytics data available</Alert>;
  }

  // Parse JSONB fields from actual SQL function schema
  const healthVitals = typeof metrics.health_vitals_by_tier === 'string' 
    ? JSON.parse(metrics.health_vitals_by_tier) 
    : metrics.health_vitals_by_tier || {};
  
  const complianceByCategory = typeof metrics.avg_compliance_by_category === 'string'
    ? JSON.parse(metrics.avg_compliance_by_category)
    : metrics.avg_compliance_by_category || {};
  
  const completionStats = typeof metrics.completion_statistics === 'string'
    ? JSON.parse(metrics.completion_statistics)
    : metrics.completion_statistics || {};

  // Extract health vitals (high tier values)
  const highTier = healthVitals?.high || {};
  const avgEnergy = highTier?.energy?.median || 0;
  const avgMood = highTier?.mood?.median || 0;
  const avgMotivation = highTier?.motivation?.median || 0;
  const avgWellbeing = highTier?.wellbeing?.median || 0;
  
  // Extract compliance rates
  const nutritionRate = complianceByCategory?.nutrition || 0;
  const exerciseRate = complianceByCategory?.exercise || 0;
  const supplementsRate = complianceByCategory?.supplements || 0;
  const meditationRate = complianceByCategory?.meditation || 0;

  // Extract completion stats
  const completedCount = completionStats?.completed_count || 0;
  const activeCount = completionStats?.active_count || 0;
  const avgProgress = completionStats?.completion_rate || 0;

  // Check for critical compliance issues
  const criticalAreas = [nutritionRate, exerciseRate, supplementsRate, meditationRate].filter(
    rate => rate < 50
  ).length;

  return (
    <Box>
      {/* Critical Alert */}
      {criticalAreas > 0 && (
        <Alert severity="error" icon={<Warning />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {criticalAreas} Compliance Area{criticalAreas > 1 ? 's' : ''} Below 50%
          </Typography>
          <Typography variant="body2">
            Immediate coordinator intervention recommended to prevent program dropouts
          </Typography>
        </Alert>
      )}

      {/* Insight Card */}
      {criticalAreas === 0 && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Program Health: Strong Performance
          </Typography>
          <Typography variant="body2">
            All compliance areas are at or above target levels. Continue current support strategies and monitor for early warning signs.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Row 1: Program Status (3 cards - full width) */}
        <Grid size={4}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Programs Completed
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="success.main">
                {completedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={4}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.primary.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Group sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Active Members
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                {activeCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={4}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Avg Completion Rate
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="info.main">
                {avgProgress.toFixed(0)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Row 2: Health Vitals (4 cards - full width) */}
        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.warning.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <BatteryChargingFull sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Energy Level
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="warning.main">
                {avgEnergy.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.secondary.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Mood sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Mood Score
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="secondary.main">
                {avgMood.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.primary.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <EmojiEvents sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Motivation
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                {avgMotivation.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Spa sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Wellbeing
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="success.main">
                {avgWellbeing.toFixed(1)}<Typography component="span" variant="h6" color="text.secondary">/10</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Row 3: Compliance Metrics (4 cards - full width) */}
        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${nutritionRate < 50 ? theme.palette.error.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Restaurant sx={{ mr: 1, color: nutritionRate < 50 ? 'error.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Nutrition Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={nutritionRate < 50 ? 'error.main' : 'success.main'}>
                {nutritionRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${exerciseRate < 50 ? theme.palette.error.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <FitnessCenter sx={{ mr: 1, color: exerciseRate < 50 ? 'error.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Exercise Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={exerciseRate < 50 ? 'error.main' : 'success.main'}>
                {exerciseRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${supplementsRate < 50 ? theme.palette.error.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <LocalPharmacy sx={{ mr: 1, color: supplementsRate < 50 ? 'error.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Supplements Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={supplementsRate < 50 ? 'error.main' : 'success.main'}>
                {supplementsRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${meditationRate < 50 ? theme.palette.error.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SelfImprovement sx={{ mr: 1, color: meditationRate < 50 ? 'error.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Meditation Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={meditationRate < 50 ? 'error.main' : 'success.main'}>
                {meditationRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
