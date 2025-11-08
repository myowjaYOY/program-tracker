'use client';

import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Grid, Alert, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown, Warning, CheckCircle, HelpOutline } from '@mui/icons-material';
import type { IndividualInsights } from '@/lib/hooks/use-individual-insights';

interface MemberRankingCardProps {
  insights: IndividualInsights;
}

export default function MemberRankingCard({ insights }: MemberRankingCardProps) {
  // Get ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return `${num}st`;
    if (j === 2 && k !== 12) return `${num}nd`;
    if (j === 3 && k !== 13) return `${num}rd`;
    return `${num}th`;
  };

  // Get quartile explanation
  const getQuartileTooltip = (quartile: number) => {
    switch (quartile) {
      case 1:
        return 'Top 25% - This member ranks in the top quarter of all members. Excellent performance across compliance and health metrics.';
      case 2:
        return 'Top 50% - This member ranks in the second quarter. Above-average performance with room for improvement.';
      case 3:
        return 'Bottom 50% - This member ranks in the third quarter. Below-average performance - may need additional support.';
      case 4:
        return 'Bottom 25% - This member ranks in the bottom quarter. Significant support needed to improve outcomes.';
      default:
        return 'Member ranking within the population based on overall status score.';
    }
  };

  // Get risk score explanation
  const getRiskScoreTooltip = (riskLevel: string, score: number) => {
    const baseExplanation = 'Status Score is calculated from: Compliance (35 pts), Curriculum Progress (35 pts), Health Vitals (20 pts), Wins (5 pts), Challenges (5 pts).';
    
    switch (riskLevel) {
      case 'green':
        return `${baseExplanation}\n\nLow Risk (≥70): Member is meeting expectations across compliance, curriculum, and health vitals. Continue current approach.`;
      case 'yellow':
        return `${baseExplanation}\n\nMedium Risk (40-69): Some areas need attention. Review compliance gaps, curriculum progress, and health trends. Targeted support recommended.`;
      case 'red':
        return `${baseExplanation}\n\nHigh Risk (<40): Urgent intervention needed. Multiple areas significantly below target. Immediate coordinator action required.`;
      default:
        return baseExplanation;
    }
  };

  // Get risk indicator details
  const getRiskDetails = (riskLevel: string) => {
    switch (riskLevel) {
      case 'green':
        return {
          label: 'Low Risk',
          color: 'success' as const,
          icon: <CheckCircle sx={{ fontSize: 32 }} />,
          bgcolor: 'success.lighter'
        };
      case 'yellow':
        return {
          label: 'Medium Risk',
          color: 'warning' as const,
          icon: <Warning sx={{ fontSize: 32 }} />,
          bgcolor: 'warning.lighter'
        };
      case 'red':
        return {
          label: 'High Risk',
          color: 'error' as const,
          icon: <Warning sx={{ fontSize: 32 }} />,
          bgcolor: 'error.lighter'
        };
      default:
        return {
          label: 'Unknown',
          color: 'default' as const,
          icon: <Warning sx={{ fontSize: 32 }} />,
          bgcolor: 'grey.100'
        };
    }
  };

  const riskDetails = getRiskDetails(insights.risk_level);

  // Get journey pattern details
  const getJourneyDetails = (pattern: string) => {
    switch (pattern) {
      case 'success_stories':
        return { label: 'Success Stories', description: 'High compliance + improving health', color: 'success' as const };
      case 'motivational_support':
        return { label: 'Motivational Support', description: 'Low compliance but improving', color: 'warning' as const };
      case 'clinical_attention':
        return { label: 'Clinical Attention', description: 'High compliance but not improving', color: 'info' as const };
      case 'high_priority':
        return { label: 'High Priority', description: 'Low compliance + worsening health', color: 'error' as const };
      default:
        return { label: 'Unknown', description: '', color: 'info' as const };
    }
  };

  const journeyDetails = getJourneyDetails(insights.journey_pattern);

  return (
    <Card sx={{ mb: 3, borderTop: (theme) => `4px solid ${theme.palette.primary.main}` }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Member Ranking & Risk Assessment
        </Typography>

        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Ranking Section */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ p: 2, bgcolor: 'primary.lighter', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
                  Population Ranking
                </Typography>
                <Tooltip 
                  title={getQuartileTooltip(insights.quartile)}
                  arrow
                  placement="top"
                >
                  <HelpOutline sx={{ fontSize: 16, color: 'primary.main', cursor: 'help' }} />
                </Tooltip>
              </Box>
              
              <Tooltip 
                title={getQuartileTooltip(insights.quartile)}
                arrow
                placement="right"
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1, cursor: 'help' }}>
                  <Typography variant="h3" fontWeight="bold" color="primary.main">
                    Q{insights.quartile}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    ({getOrdinalSuffix(insights.compliance_percentile)} percentile)
                  </Typography>
                </Box>
              </Tooltip>

              <Typography variant="body2" color="text.secondary">
                Rank #{insights.rank_in_population} of {insights.total_members_in_population} members
              </Typography>
            </Box>
          </Grid>

          {/* Risk Level Section */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Tooltip
              title={getRiskScoreTooltip(insights.risk_level, insights.risk_score)}
              arrow
              placement="top"
              componentsProps={{
                tooltip: {
                  sx: {
                    maxWidth: 400,
                    whiteSpace: 'pre-line',
                    fontSize: '0.875rem',
                    p: 2
                  }
                }
              }}
            >
              <Box sx={{ p: 2, bgcolor: riskDetails.bgcolor, borderRadius: 2, border: 2, borderColor: `${riskDetails.color}.main`, cursor: 'help' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ color: `${riskDetails.color}.main` }}>
                    {riskDetails.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600} color={`${riskDetails.color}.main`}>
                        {riskDetails.label}
                      </Typography>
                      <HelpOutline sx={{ fontSize: 16, color: `${riskDetails.color}.main` }} />
                    </Box>
                    <Typography variant="h4" fontWeight="bold" color={`${riskDetails.color}.main`}>
                      {insights.risk_score}/100
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Tooltip>
          </Grid>

          {/* Journey Pattern */}
          <Grid size={12}>
            <Alert severity={journeyDetails.color} icon={false}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Journey Pattern: {journeyDetails.label}
                  </Typography>
                  <Typography variant="body2">
                    {journeyDetails.description}
                  </Typography>
                </Box>
                <Chip 
                  label={journeyDetails.label} 
                  color={journeyDetails.color}
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            </Alert>
          </Grid>

          {/* Risk Factors */}
          {insights.risk_factors && insights.risk_factors.length > 0 && (
            <Grid size={12}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Risk Factors:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {insights.risk_factors.map((factor, index) => (
                  <Chip
                    key={index}
                    label={factor}
                    color="error"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
          )}

          {insights.risk_factors && insights.risk_factors.length === 0 && (
            <Grid size={12}>
              <Alert severity="success">
                <Typography variant="body2">
                  ✓ No risk factors identified - member is on track!
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}

