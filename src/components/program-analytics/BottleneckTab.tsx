'use client';

import { Box, Grid, Card, CardContent, Typography, LinearProgress, Alert } from '@mui/material';
import { Warning, Assignment } from '@mui/icons-material';

interface BottleneckTabProps {
  metrics: any;
}

export default function BottleneckTab({ metrics }: BottleneckTabProps) {
  if (!metrics) {
    return <Alert severity="info">No analytics data available</Alert>;
  }

  // Parse JSONB field
  const bottleneckModules = typeof metrics.bottleneck_modules === 'string'
    ? JSON.parse(metrics.bottleneck_modules)
    : metrics.bottleneck_modules || [];

  // Sort by completion rate (lowest first)
  const sorted = [...bottleneckModules].sort((a, b) => a.completion_rate - b.completion_rate);

  // Identify critical bottlenecks (< 70%)
  const criticalCount = sorted.filter(item => item.completion_rate < 70).length;

  const getBorderColor = (rate: number): 'error' | 'warning' | 'success' => {
    if (rate < 70) return 'error';
    if (rate < 90) return 'warning';
    return 'success';
  };

  // Generate actionable insight
  const getBottleneckInsight = () => {
    if (sorted.length === 0) return null;
    const lowest = sorted[0];
    const totalMembers = metrics.member_count || 0;
    const dropoffCount = totalMembers - (lowest.completion_count || 0);
    
    return {
      surveyName: lowest.survey_name,
      completionRate: lowest.completion_rate,
      dropoffCount,
      recommendation: lowest.completion_rate < 70 
        ? `This is a major drop-off point. Investigate: (1) Survey complexity, (2) Member readiness, (3) Technical issues. Consider breaking into smaller parts or providing additional support.`
        : `Monitor this survey closely and provide proactive support to members approaching this milestone.`
    };
  };

  const bottleneckInsight = getBottleneckInsight();

  return (
    <Box>
      {/* Critical Alert */}
      {criticalCount > 0 && (
        <Alert severity="error" icon={<Warning />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {criticalCount} Survey{criticalCount > 1 ? 's' : ''} Below 70% Completion
          </Typography>
          <Typography variant="body2">
            These surveys have completion rates below 70%, indicating significant member drop-off
          </Typography>
        </Alert>
      )}

      {/* Bottleneck Insight */}
      {bottleneckInsight && (
        <Alert severity={bottleneckInsight.completionRate < 70 ? 'error' : 'warning'} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Primary Bottleneck: {bottleneckInsight.surveyName} ({bottleneckInsight.completionRate.toFixed(1)}%)
          </Typography>
          <Typography variant="body2">
            {bottleneckInsight.dropoffCount} members did not complete this survey. {bottleneckInsight.recommendation}
          </Typography>
        </Alert>
      )}

      {/* All survey cards: 6 per row, uniform size */}
      <Grid container spacing={3}>
        {sorted.map((item, index) => {
          const isRed = item.completion_rate < 70;
          const isYellow = item.completion_rate >= 70 && item.completion_rate < 90;
          const isGreen = item.completion_rate >= 90;

          const getColor = () => {
            if (isRed) return '#f44336';
            if (isYellow) return '#ff9800';
            return '#4caf50';
          };

          const getColorName = (): 'error' | 'warning' | 'success' => {
            if (isRed) return 'error';
            if (isYellow) return 'warning';
            return 'success';
          };

          return (
            <Grid size={2} key={item.survey_name}>
              <Card 
                sx={{ 
                  borderTop: (theme) => `4px solid ${theme.palette[getColorName()].main}`,
                  height: '100%',
                  backgroundColor: isRed ? '#ffebee' : 'inherit',
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography
                      variant="caption"
                      sx={{
                        minWidth: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        backgroundColor: getColor(),
                        color: 'white',
                        fontWeight: 700,
                        mr: 1,
                      }}
                    >
                      {index + 1}
                    </Typography>
                    <Assignment sx={{ color: getColorName(), fontSize: 20 }} />
                  </Box>
                  <Typography 
                    variant="body2" 
                    fontWeight={600}
                    sx={{
                      minHeight: 40,
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.survey_name}
                  </Typography>
                  <Typography 
                    variant="h3" 
                    fontWeight="bold" 
                    color={getColorName()}
                    gutterBottom
                  >
                    {item.completion_rate?.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(item.completion_rate, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#e0e0e0',
                      mb: 1,
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getColor(),
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {item.completion_count} members completed
                  </Typography>
                  {isRed && (
                    <Typography variant="caption" color="error.main" fontWeight={600} display="block" mt={1}>
                      ⚠️ Below 70%
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {sorted.length === 0 && (
        <Box textAlign="center" py={6}>
          <Alert severity="info">No bottleneck data available</Alert>
        </Box>
      )}
    </Box>
  );
}
