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

  // Helper function to map score (1-5) to label
  const getHealthLabel = (score: number): string => {
    if (score < 2) return 'Poor';
    if (score < 3) return 'Fair';
    if (score < 4) return 'Average';
    if (score < 5) return 'Good';
    return 'Excellent';
  };

  // Helper function to get color based on score (1-5 scale)
  // MATCHES ENGAGEMENT TAB: < 3.0 = Red, 3.0-3.9 = Yellow, >= 4.0 = Green
  const getHealthColor = (score: number): 'error' | 'warning' | 'success' => {
    if (score < 3) return 'error';
    if (score < 4) return 'warning';
    return 'success';
  };

  // Calculate overall health across ALL tiers (low, medium, high)
  const calculateOverallHealth = (vital: string) => {
    const tiers = ['low', 'medium', 'high'];
    let totalScore = 0;
    let tierCount = 0;
    
    tiers.forEach(tier => {
      const tierData = healthVitals?.[tier];
      if (tierData && tierData[vital]?.median) {
        totalScore += tierData[vital].median;
        tierCount++;
      }
    });
    
    return tierCount > 0 ? totalScore / tierCount : 0;
  };

  const avgEnergy = calculateOverallHealth('energy');
  const avgMood = calculateOverallHealth('mood');
  const avgMotivation = calculateOverallHealth('motivation');
  const avgWellbeing = calculateOverallHealth('wellbeing');
  
  // Extract compliance rates
  const nutritionRate = complianceByCategory?.nutrition || 0;
  const exerciseRate = complianceByCategory?.exercise || 0;
  const supplementsRate = complianceByCategory?.supplements || 0;
  const meditationRate = complianceByCategory?.meditation || 0;

  // Extract top-level metrics for the 3 summary cards
  // UPDATED 2025-11-19: Changed Card 3 from "Avg Completion Rate" to "Avg Member Health"
  // - completedCount: Unique members with Completed status programs
  // - activeCount: Unique members with Active status programs (fixed to count all active, not just analyzed)
  // - avgMemberHealth: Average status_score (0-100) combining compliance, vitals, and progress
  const completedCount = metrics?.completed_member_count || 0;
  const activeCount = metrics?.active_member_count || 0;
  const avgMemberHealth = completionStats?.avg_member_health_score || 0;

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

        {/* CARD 3: Avg Member Health Score (0-100 scale)
            UPDATED 2025-11-19: Replaced "Avg Completion Rate" with a more meaningful metric
            that shows holistic program quality. The score combines:
            - Protocol Compliance: 35 points (nutrition, supplements, exercise, meditation)
            - Curriculum Progress: 35 points (on track vs behind vs inactive)
            - Wins: 5 points (has logged wins)
            - Challenges: 5 points (has logged challenges)
            - Health Vitals: 20 points (energy, mood, motivation, wellbeing, sleep trends)
            This provides a single, actionable metric for overall program performance. */}
        <Grid size={4}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Avg Member Health
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="info.main">
                {avgMemberHealth.toFixed(1)} <Typography component="span" variant="body2" color="text.secondary">/100</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Row 2: Health Vitals (4 cards - full width) */}
        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgEnergy)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <BatteryChargingFull sx={{ mr: 1, color: `${getHealthColor(avgEnergy)}.main` }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Energy Level
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgEnergy)}.main`}>
                {avgEnergy.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgEnergy)}.main`}>({getHealthLabel(avgEnergy)})</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgMood)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Mood sx={{ mr: 1, color: `${getHealthColor(avgMood)}.main` }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Mood Score
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgMood)}.main`}>
                {avgMood.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgMood)}.main`}>({getHealthLabel(avgMood)})</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgMotivation)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <EmojiEvents sx={{ mr: 1, color: `${getHealthColor(avgMotivation)}.main` }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Motivation
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgMotivation)}.main`}>
                {avgMotivation.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgMotivation)}.main`}>({getHealthLabel(avgMotivation)})</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgWellbeing)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Spa sx={{ mr: 1, color: `${getHealthColor(avgWellbeing)}.main` }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Wellbeing
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgWellbeing)}.main`}>
                {avgWellbeing.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgWellbeing)}.main`}>({getHealthLabel(avgWellbeing)})</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Row 3: Compliance Metrics (4 cards - full width) */}
        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${nutritionRate < 50 ? theme.palette.error.main : nutritionRate < 75 ? theme.palette.warning.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Restaurant sx={{ mr: 1, color: nutritionRate < 50 ? 'error.main' : nutritionRate < 75 ? 'warning.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Nutrition Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={nutritionRate < 50 ? 'error.main' : nutritionRate < 75 ? 'warning.main' : 'success.main'}>
                {nutritionRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${exerciseRate < 50 ? theme.palette.error.main : exerciseRate < 75 ? theme.palette.warning.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <FitnessCenter sx={{ mr: 1, color: exerciseRate < 50 ? 'error.main' : exerciseRate < 75 ? 'warning.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Exercise Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={exerciseRate < 50 ? 'error.main' : exerciseRate < 75 ? 'warning.main' : 'success.main'}>
                {exerciseRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${supplementsRate < 50 ? theme.palette.error.main : supplementsRate < 75 ? theme.palette.warning.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <LocalPharmacy sx={{ mr: 1, color: supplementsRate < 50 ? 'error.main' : supplementsRate < 75 ? 'warning.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Supplements Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={supplementsRate < 50 ? 'error.main' : supplementsRate < 75 ? 'warning.main' : 'success.main'}>
                {supplementsRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${meditationRate < 50 ? theme.palette.error.main : meditationRate < 75 ? theme.palette.warning.main : theme.palette.success.main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SelfImprovement sx={{ mr: 1, color: meditationRate < 50 ? 'error.main' : meditationRate < 75 ? 'warning.main' : 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Meditation Compliance
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={meditationRate < 50 ? 'error.main' : meditationRate < 75 ? 'warning.main' : 'success.main'}>
                {meditationRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
