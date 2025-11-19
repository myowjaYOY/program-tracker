'use client';

import { Box, Grid, Card, CardContent, Typography, LinearProgress, Alert } from '@mui/material';
import { Warning, Restaurant, FitnessCenter, LocalPharmacy, SelfImprovement } from '@mui/icons-material';
import { useComplianceTrends } from '@/lib/hooks/use-compliance-trends';
import ComplianceTrendChart from './ComplianceTrendChart';

interface ComplianceTabProps {
  metrics: any;
}

export default function ComplianceTab({ metrics }: ComplianceTabProps) {
  // Fetch compliance trends data
  const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useComplianceTrends();
  if (!metrics) {
    return <Alert severity="info">No analytics data available</Alert>;
  }

  // Parse JSONB fields from actual SQL function schema
  const complianceByCategory = typeof metrics.avg_compliance_by_category === 'string'
    ? JSON.parse(metrics.avg_compliance_by_category)
    : metrics.avg_compliance_by_category || {};
  
  const complianceDistribution = typeof metrics.compliance_distribution === 'string'
    ? JSON.parse(metrics.compliance_distribution)
    : metrics.compliance_distribution || {};

  const nutrition = complianceByCategory?.nutrition || 0;
  const exercise = complianceByCategory?.exercise || 0;
  const supplements = complianceByCategory?.supplements || 0;
  const meditation = complianceByCategory?.meditation || 0;

  // Map compliance_distribution array to expected categories
  // Database returns: [{"count":5,"range":"0-20%"}, {"count":6,"range":"20-40%"}, ...]
  // We need to map to: critical (<25%), at_risk (25-50%), moderate (50-75%), high_performers (>75%)
  const mapDistributionToCategories = (distribution: any[]) => {
    if (!Array.isArray(distribution)) return { critical: 0, atRisk: 0, moderate: 0, highPerformers: 0 };
    
    let critical = 0;
    let atRisk = 0;
    let moderate = 0;
    let highPerformers = 0;
    
    distribution.forEach(item => {
      const range = item.range;
      const count = item.count || 0;
      
      // Map ranges to categories:
      // 0-20% = critical (very low compliance)
      // 20-40% = at_risk (low compliance)
      // 40-60% = moderate (medium compliance)
      // 60-80%, 80-100% = high_performers (high compliance)
      
      if (range === '0-20%') {
        critical += count;
      } else if (range === '20-40%') {
        atRisk += count;
      } else if (range === '40-60%') {
        moderate += count;
      } else if (range === '60-80%') {
        highPerformers += count;
      } else if (range === '80-100%') {
        highPerformers += count;
      }
    });
    
    return { critical, atRisk, moderate, highPerformers };
  };
  
  const mappedDistribution = mapDistributionToCategories(complianceDistribution);
  const highPerformers = mappedDistribution.highPerformers;
  const moderate = mappedDistribution.moderate;
  const atRisk = mappedDistribution.atRisk;
  const critical = mappedDistribution.critical;

  const criticalAreas = [nutrition, exercise, supplements, meditation].filter(rate => rate < 50).length;

  const getColor = (value: number) => {
    if (value >= 75) return 'success.main';
    if (value >= 50) return 'warning.main';
    return 'error.main';
  };

  const getBorderColor = (value: number): 'success' | 'warning' | 'error' => {
    if (value >= 75) return 'success';
    if (value >= 50) return 'warning';
    return 'error';
  };

  const getInsight = () => {
    if (nutrition < 50 || exercise < 50 || supplements < 50 || meditation < 50) {
      const lowestArea = Object.entries({ nutrition, exercise, supplements, meditation })
        .reduce((min, [key, val]) => val < min[1] ? [key, val] : min, ['', 100]);
      return {
        severity: 'error' as const,
        title: 'Critical Compliance Gap Detected',
        message: `${lowestArea[0]} compliance is critically low at ${lowestArea[1].toFixed(1)}%. Members struggling with ${lowestArea[0]} are at high risk of program dropout. Recommend: (1) One-on-one coaching, (2) Identify barriers, (3) Simplify protocols.`
      };
    }
    if (criticalAreas === 0 && (nutrition + exercise + supplements + meditation) / 4 > 75) {
      return {
        severity: 'success' as const,
        title: 'Excellent Compliance Across All Areas',
        message: `Average compliance is ${((nutrition + exercise + supplements + meditation) / 4).toFixed(1)}%. Members are highly engaged. Focus on maintaining momentum and celebrating wins.`
      };
    }
    return {
      severity: 'warning' as const,
      title: 'Moderate Compliance Performance',
      message: 'Some areas show room for improvement. Consider targeted interventions for lower-performing categories.'
    };
  };

  const insight = getInsight();

  return (
    <Box>
      {/* Insight Alert */}
      <Alert severity={insight.severity} icon={<Warning />} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {insight.title}
        </Typography>
        <Typography variant="body2">
          {insight.message}
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Row 1: 4 Compliance Cards - Same Size */}
        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getBorderColor(nutrition)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Restaurant sx={{ mr: 1, color: getColor(nutrition) }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Nutrition
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={getColor(nutrition)} gutterBottom>
                {nutrition.toFixed(1)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(nutrition, 100)} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: nutrition < 50 ? '#f44336' : nutrition < 75 ? '#ff9800' : '#4caf50',
                  },
                }}
              />
              {nutrition < 50 && (
                <Typography variant="caption" color="error" fontWeight={600} display="block" mt={1}>
                  ⚠️ Below target
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getBorderColor(exercise)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <FitnessCenter sx={{ mr: 1, color: getColor(exercise) }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Exercise
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={getColor(exercise)} gutterBottom>
                {exercise.toFixed(1)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(exercise, 100)} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: exercise < 50 ? '#f44336' : exercise < 75 ? '#ff9800' : '#4caf50',
                  },
                }}
              />
              {exercise < 50 && (
                <Typography variant="caption" color="error" fontWeight={600} display="block" mt={1}>
                  ⚠️ Below target
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getBorderColor(supplements)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <LocalPharmacy sx={{ mr: 1, color: getColor(supplements) }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Supplements
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={getColor(supplements)} gutterBottom>
                {supplements.toFixed(1)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(supplements, 100)} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: supplements < 50 ? '#f44336' : supplements < 75 ? '#ff9800' : '#4caf50',
                  },
                }}
              />
              {supplements < 50 && (
                <Typography variant="caption" color="error" fontWeight={600} display="block" mt={1}>
                  ⚠️ Below target
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={3}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette[getBorderColor(meditation)].main}`, height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SelfImprovement sx={{ mr: 1, color: getColor(meditation) }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Meditation
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color={getColor(meditation)} gutterBottom>
                {meditation.toFixed(1)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(meditation, 100)} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: meditation < 50 ? '#f44336' : meditation < 75 ? '#ff9800' : '#4caf50',
                  },
                }}
              />
              {meditation < 50 && (
                <Typography variant="caption" color="error" fontWeight={600} display="block" mt={1}>
                  ⚠️ Below target
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Row 2: Compliance Trends Chart */}
        <Grid size={12}>
          <ComplianceTrendChart 
            data={trendsData} 
            isLoading={trendsLoading} 
            error={trendsError} 
          />
        </Grid>

        {/* Row 3: Compliance Distribution Card */}
        <Grid size={12}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}` }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Compliance Distribution
              </Typography>
              <Grid container spacing={3} mt={1}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="success.main" fontWeight="bold">
                      {highPerformers}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} mt={1}>
                      High Performers
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      &gt;75% compliance
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="primary" fontWeight="bold">
                      {moderate}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} mt={1}>
                      Moderate
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      50-75% compliance
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="warning.main" fontWeight="bold">
                      {atRisk}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} mt={1}>
                      At Risk
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      25-50% compliance
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="error.main" fontWeight="bold">
                      {critical}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} mt={1}>
                      Critical
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      &lt;25% compliance
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
