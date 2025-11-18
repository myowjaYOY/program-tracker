'use client';

import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import { 
  ArrowUpward, 
  ArrowDownward, 
  TrendingFlat, 
  TrendingUp, 
  TrendingDown,
} from '@mui/icons-material';
import type { IndividualInsights } from '@/lib/hooks/use-individual-insights';

interface ComparativeAnalysisGridProps {
  insights: IndividualInsights;
}

/**
 * Comparative Analysis Grid Component
 * 
 * Displays two sections:
 * 1. Compliance Comparison (5 cards: Overall, Nutrition, Supplements, Exercise, Meditation)
 * 2. Health Vitals Comparison (5 cards: Energy, Mood, Motivation, Wellbeing, Sleep)
 */
export default function ComparativeAnalysisGrid({ insights }: ComparativeAnalysisGridProps) {
  return (
    <Box>
      {/* Section 1: Compliance Comparison */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Comparative Analysis vs. All Members
        </Typography>

        <Grid container spacing={2}>
          {/* Overall Compliance Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <ComplianceCard
              label="Overall"
              emoji="✅"
              memberScore={insights.compliance_comparison.overall.member}
              populationAvg={insights.compliance_comparison.overall.population_avg}
              diff={insights.compliance_comparison.overall.diff}
              isOverall={true}
            />
          </Grid>

          {/* Nutrition Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <ComplianceCard
              label="Nutrition"
              emoji="🥗"
              memberScore={insights.compliance_comparison.nutrition.member}
              populationAvg={insights.compliance_comparison.nutrition.population_avg}
              diff={insights.compliance_comparison.nutrition.diff}
            />
          </Grid>

          {/* Supplements Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <ComplianceCard
              label="Supplements"
              emoji="💊"
              memberScore={insights.compliance_comparison.supplements.member}
              populationAvg={insights.compliance_comparison.supplements.population_avg}
              diff={insights.compliance_comparison.supplements.diff}
            />
          </Grid>

          {/* Exercise Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <ComplianceCard
              label="Exercise"
              emoji="💪"
              memberScore={insights.compliance_comparison.exercise.member}
              populationAvg={insights.compliance_comparison.exercise.population_avg}
              diff={insights.compliance_comparison.exercise.diff}
            />
          </Grid>

          {/* Meditation Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <ComplianceCard
              label="Meditation"
              emoji="🧘"
              memberScore={insights.compliance_comparison.meditation.member}
              populationAvg={insights.compliance_comparison.meditation.population_avg}
              diff={insights.compliance_comparison.meditation.diff}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Section 2: Health Vitals Comparison */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Health Vitals vs. Population Average
        </Typography>

        <Grid container spacing={2}>
          {/* Energy Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <VitalCard
              label="Energy"
              emoji="⚡"
              memberScore={insights.vitals_comparison.energy.member_score}
              memberTrend={insights.vitals_comparison.energy.member_trend}
              populationAvg={insights.vitals_comparison.energy.population_avg}
            />
          </Grid>

          {/* Mood Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <VitalCard
              label="Mood"
              emoji="😊"
              memberScore={insights.vitals_comparison.mood.member_score}
              memberTrend={insights.vitals_comparison.mood.member_trend}
              populationAvg={insights.vitals_comparison.mood.population_avg}
            />
          </Grid>

          {/* Motivation Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <VitalCard
              label="Motivation"
              emoji="🎯"
              memberScore={insights.vitals_comparison.motivation.member_score}
              memberTrend={insights.vitals_comparison.motivation.member_trend}
              populationAvg={insights.vitals_comparison.motivation.population_avg}
            />
          </Grid>

          {/* Wellbeing Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <VitalCard
              label="Wellbeing"
              emoji="💚"
              memberScore={insights.vitals_comparison.wellbeing.member_score}
              memberTrend={insights.vitals_comparison.wellbeing.member_trend}
              populationAvg={insights.vitals_comparison.wellbeing.population_avg}
            />
          </Grid>

          {/* Sleep Card */}
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <VitalCard
              label="Sleep"
              emoji="😴"
              memberScore={insights.vitals_comparison.sleep.member_score}
              memberTrend={insights.vitals_comparison.sleep.member_trend}
              populationAvg={insights.vitals_comparison.sleep.population_avg}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

// ============================================
// COMPLIANCE CARD COMPONENT
// ============================================

interface ComplianceCardProps {
  label: string;
  emoji: string;
  memberScore: number | null;
  populationAvg: number;
  diff: number | null;
  isOverall?: boolean;
}

function ComplianceCard({ label, emoji, memberScore, populationAvg, diff, isOverall = false }: ComplianceCardProps) {
  // Check if data exists
  const hasData = memberScore !== null && memberScore !== undefined;

  // Get comparison display details
  const getComparisonDetails = (diff: number) => {
    if (diff > 0) {
      return {
        icon: <ArrowUpward sx={{ fontSize: 16 }} />,
        color: '#10b981', // success.main
        prefix: '+',
        borderColor: '#10b981',
      };
    } else if (diff < 0) {
      return {
        icon: <ArrowDownward sx={{ fontSize: 16 }} />,
        color: '#ef4444', // error.main
        prefix: '',
        borderColor: diff < -15 ? '#ef4444' : '#6b7280',
      };
    }
    return {
      icon: <TrendingFlat sx={{ fontSize: 16 }} />,
      color: '#6b7280',
      prefix: '',
      borderColor: '#6b7280',
    };
  };

  const details = hasData && diff !== null ? getComparisonDetails(diff) : null;
  const borderColor = hasData && details ? details.borderColor : '#e5e7eb'; // grey.200

  return (
    <Card
      sx={{
        height: '100%',
        borderTop: 3,
        borderTopColor: borderColor,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header with Emoji */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
          <Typography sx={{ fontSize: 20, flexShrink: 0 }}>{emoji}</Typography>
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            textTransform="uppercase"
          >
            {label}
          </Typography>
        </Box>

        {/* Member Score + Comparison on Same Row */}
        {hasData ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h5" fontWeight="bold">
                {memberScore}%
              </Typography>
              {details && diff !== null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ color: details.color, display: 'flex', alignItems: 'center' }}>
                    {details.icon}
                  </Box>
                  <Typography variant="body2" color={details.color} fontWeight={600}>
                    {details.prefix}{diff}%
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Population Average */}
            <Typography variant="caption" color="textSecondary">
              vs. avg {populationAvg}%
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
              N/A
            </Typography>
            <Typography variant="caption" color="textSecondary">
              No data yet
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// VITAL CARD COMPONENT
// ============================================

interface VitalCardProps {
  label: string;
  emoji: string;
  memberScore: number | null;
  memberTrend: string;
  populationAvg: number | null;
}

function VitalCard({ label, emoji, memberScore, memberTrend, populationAvg }: VitalCardProps) {
  // Get trend icon and color
  const getTrendDetails = (trend: string) => {
    switch (trend) {
      case 'improving':
        return {
          icon: <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />,
          color: '#10b981',
        };
      case 'declining':
        return {
          icon: <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />,
          color: '#ef4444',
        };
      case 'stable':
        return {
          icon: <TrendingFlat sx={{ fontSize: 16, color: 'warning.main' }} />,
          color: '#f59e0b',
        };
      default:
        return {
          icon: <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />,
          color: '#6b7280',
        };
    }
  };

  const trendDetails = getTrendDetails(memberTrend);

  // Border color matches the trend color (like MSQ/PROMIS cards)
  const borderColor = trendDetails.color;

  return (
    <Card
      sx={{
        height: '100%',
        borderTop: 3,
        borderTopColor: borderColor,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header with Emoji */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
          <Typography sx={{ fontSize: 20, flexShrink: 0 }}>{emoji}</Typography>
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            textTransform="uppercase"
          >
            {label}
          </Typography>
        </Box>

        {/* Member Score + Trend Icon on Same Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h5" fontWeight="bold">
            {memberScore !== null ? memberScore.toFixed(1) : 'N/A'}
          </Typography>
          {trendDetails.icon}
        </Box>

        {/* Population Average */}
        <Typography variant="caption" color="textSecondary">
          Avg: {populationAvg !== null ? populationAvg.toFixed(1) : 'N/A'}
        </Typography>
      </CardContent>
    </Card>
  );
}

