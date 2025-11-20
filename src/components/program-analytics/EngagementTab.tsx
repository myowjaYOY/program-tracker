'use client';

import { Box, Grid, Card, CardContent, Typography, Alert, Chip, Tooltip, IconButton } from '@mui/material';
import { BatteryChargingFull, Mood, EmojiEvents, Spa, InfoOutlined } from '@mui/icons-material';

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

  // Helper function to map score (1-5) to label
  const getHealthLabel = (score: number): string => {
    if (score < 2) return 'Poor';
    if (score < 3) return 'Fair';
    if (score < 4) return 'Average';
    if (score < 5) return 'Good';
    return 'Excellent';
  };

  // Helper function to get color based on score (1-5 scale)
  const getHealthColor = (score: number): 'error' | 'warning' | 'success' => {
    if (score < 3) return 'error';
    if (score < 4) return 'warning';
    return 'success';
  };

  // Calculate overall health across ALL tiers (low, medium, high) - weighted by member count
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

  // Generate engagement insight (1-5 scale)
  const avgHealth = (avgEnergy + avgMood + avgMotivation + avgWellbeing) / 4;
  const getEngagementInsight = () => {
    if (avgHealth >= 4.0) {
      return {
        severity: 'success' as const,
        title: 'Excellent Member Health Indicators',
        message: `Average health score is ${avgHealth.toFixed(1)} out of 5. Members are reporting strong energy, mood, motivation, and wellbeing. This suggests the program is delivering positive outcomes.`
      };
    }
    if (avgHealth >= 3.0) {
      return {
        severity: 'warning' as const,
        title: 'Moderate Member Health',
        message: `Average health score is ${avgHealth.toFixed(1)} out of 5. Some members may be struggling. Consider: (1) Check-in calls, (2) Adjust program intensity, (3) Identify specific pain points.`
      };
    }
    return {
      severity: 'error' as const,
      title: 'Low Member Health Indicators',
      message: `Average health score is ${avgHealth.toFixed(1)} out of 5. Members are reporting low energy, mood, motivation, or wellbeing. Immediate intervention recommended to prevent dropouts.`
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
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgEnergy)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <BatteryChargingFull sx={{ fontSize: 40, color: `${getHealthColor(avgEnergy)}.main`, mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Energy Level
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgEnergy)}.main`}>
                    {avgEnergy.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgEnergy)}.main`}>({getHealthLabel(avgEnergy)})</Typography>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgMood)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Mood sx={{ fontSize: 40, color: `${getHealthColor(avgMood)}.main`, mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Mood Score
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgMood)}.main`}>
                    {avgMood.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgMood)}.main`}>({getHealthLabel(avgMood)})</Typography>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgMotivation)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <EmojiEvents sx={{ fontSize: 40, color: `${getHealthColor(avgMotivation)}.main`, mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Motivation
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgMotivation)}.main`}>
                    {avgMotivation.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgMotivation)}.main`}>({getHealthLabel(avgMotivation)})</Typography>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getHealthColor(avgWellbeing)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Spa sx={{ fontSize: 40, color: `${getHealthColor(avgWellbeing)}.main`, mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Wellbeing
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color={`${getHealthColor(avgWellbeing)}.main`}>
                    {avgWellbeing.toFixed(1)} <Typography component="span" variant="h6" color={`${getHealthColor(avgWellbeing)}.main`}>({getHealthLabel(avgWellbeing)})</Typography>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Engagement by Cohort */}
      <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Engagement by Time in Program
        </Typography>
        <Tooltip 
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" display="block" fontWeight={600} sx={{ mb: 0.5 }}>
                Cohort Metrics:
              </Typography>
              <Typography variant="caption" display="block">
                • <strong>Month:</strong> Program start month
              </Typography>
              <Typography variant="caption" display="block">
                • <strong>Avg Compliance:</strong> Overall program adherence
              </Typography>
              <Typography variant="caption" display="block">
                • <strong>Members:</strong> Total enrolled in this cohort
              </Typography>
              <Typography variant="caption" display="block">
                • <strong>Completed:</strong> Number who finished the program
              </Typography>
            </Box>
          }
          arrow
          placement="right"
          componentsProps={{
            tooltip: {
              sx: {
                bgcolor: 'white',
                color: 'text.primary',
                boxShadow: 2,
                border: '1px solid',
                borderColor: 'divider',
                '& .MuiTooltip-arrow': {
                  color: 'white',
                  '&::before': {
                    border: '1px solid',
                    borderColor: 'divider',
                  }
                }
              }
            }
          }}
        >
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <InfoOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3}>
        {cohortAnalysis.map((cohort: any) => (
          <Grid size={3} key={cohort.cohort}>
            <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, height: '100%' }}>
              <CardContent sx={{ pb: 2, '&:last-child': { pb: 2 } }}>
                {/* Row 1: Month */}
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  {cohort.cohort}
                </Typography>

                {/* Row 2: Compliance Progress Bar */}
                <Box sx={{ mb: 1.5 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Avg Compliance
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {cohort.avg_compliance?.toFixed(0) || 0}%
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 8,
                      bgcolor: 'grey.200',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.min(cohort.avg_compliance || 0, 100)}%`,
                        height: '100%',
                        bgcolor:
                          cohort.avg_compliance >= 75
                            ? 'success.main'
                            : cohort.avg_compliance >= 50
                            ? 'warning.main'
                            : 'error.main',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                </Box>

                {/* Row 3: Member Count + Completed Count (inline) */}
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    {cohort.member_count} Members
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    •
                  </Typography>
                  <Typography variant="body2" color="success.main" fontWeight={600}>
                    {cohort.completed_count || 0} Completed
                  </Typography>
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
