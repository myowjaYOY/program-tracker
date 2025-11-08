'use client';

import React from 'react';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import { ArrowUpward, ArrowDownward, TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import type { IndividualInsights } from '@/lib/hooks/use-individual-insights';

interface ComparativeAnalysisCardProps {
  insights: IndividualInsights;
}

export default function ComparativeAnalysisCard({ insights }: ComparativeAnalysisCardProps) {
  // Helper to get comparison display
  const getComparisonDisplay = (diff: number) => {
    if (diff > 0) {
      return {
        icon: <ArrowUpward sx={{ fontSize: 20 }} />,
        color: 'success.main',
        prefix: '+'
      };
    } else if (diff < 0) {
      return {
        icon: <ArrowDownward sx={{ fontSize: 20 }} />,
        color: 'error.main',
        prefix: ''
      };
    }
    return {
      icon: <TrendingFlat sx={{ fontSize: 20 }} />,
      color: 'text.secondary',
      prefix: ''
    };
  };

  // Helper for trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp sx={{ fontSize: 18, color: 'success.main' }} />;
      case 'declining':
        return <TrendingDown sx={{ fontSize: 18, color: 'error.main' }} />;
      case 'stable':
        return <TrendingFlat sx={{ fontSize: 18, color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  return (
    <Card sx={{ mb: 3, borderTop: (theme) => `4px solid ${theme.palette.secondary.main}` }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Comparative Analysis (vs. All Members)
        </Typography>

        {/* Overall Compliance */}
        <Box sx={{ mb: 3, mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Overall Compliance
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4" fontWeight="bold">
              {insights.compliance_comparison.overall.member}%
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', color: getComparisonDisplay(insights.compliance_comparison.overall.diff).color }}>
              {getComparisonDisplay(insights.compliance_comparison.overall.diff).icon}
              <Typography variant="body1" fontWeight={600}>
                {getComparisonDisplay(insights.compliance_comparison.overall.diff).prefix}{insights.compliance_comparison.overall.diff}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              vs. avg {insights.compliance_comparison.overall.population_avg}%
            </Typography>
          </Box>
        </Box>

        {/* Compliance Categories */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Compliance by Category
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {(['nutrition', 'supplements', 'exercise', 'meditation'] as const).map((category) => {
            const data = insights.compliance_comparison[category];
            const display = getComparisonDisplay(data.diff);
            const isAboveAvg = data.diff > 0;
            
            return (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={category}>
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: isAboveAvg ? 'success.lighter' : (data.diff < -15 ? 'error.lighter' : 'grey.50'),
                    borderRadius: 2,
                    border: 1,
                    borderColor: isAboveAvg ? 'success.main' : (data.diff < -15 ? 'error.main' : 'grey.300')
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                    {category}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ my: 0.5 }}>
                    {data.member}%
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ color: display.color, display: 'flex', alignItems: 'center' }}>
                      {display.icon}
                    </Box>
                    <Typography variant="caption" color={display.color} fontWeight={600}>
                      {display.prefix}{data.diff}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      vs. {data.population_avg}%
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {/* Health Vitals Comparison */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Health Vitals (vs. Population Average)
        </Typography>

        <Grid container spacing={2}>
          {(['energy', 'mood', 'motivation', 'wellbeing', 'sleep'] as const).map((vital) => {
            const data = insights.vitals_comparison[vital];
            
            return (
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={vital}>
                <Box 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'grey.300'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                      {vital}
                    </Typography>
                    {getTrendIcon(data.member_trend)}
                  </Box>
                  <Typography variant="h6" fontWeight="bold">
                    {data.member_score !== null ? data.member_score.toFixed(1) : 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg: {data.population_avg !== null ? data.population_avg : 'N/A'}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}


