'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Bolt as EnergyIcon,
  Mood as MoodIcon,
  DirectionsRun as MotivationIcon,
  Favorite as WellbeingIcon,
  Bedtime as SleepIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  RemoveCircleOutline as NoDataIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard, TrendIndicator } from '@/types/common';

interface HealthVitalsCardProps {
  data: MemberProgressDashboard;
}

/**
 * Vital configuration for icons and display
 */
const VITAL_CONFIG = {
  energy: {
    label: 'Energy',
    icon: EnergyIcon,
    color: '#f59e0b',
  },
  mood: {
    label: 'Mood',
    icon: MoodIcon,
    color: '#8b5cf6',
  },
  motivation: {
    label: 'Motivation',
    icon: MotivationIcon,
    color: '#06b6d4',
  },
  wellbeing: {
    label: 'Overall Wellbeing',
    icon: WellbeingIcon,
    color: '#ec4899',
  },
  sleep: {
    label: 'Sleep Quality',
    icon: SleepIcon,
    color: '#6366f1',
  },
};

/**
 * Trend icon components
 */
const TREND_ICONS: Record<TrendIndicator, { icon: React.ElementType; color: string; label: string }> = {
  improving: {
    icon: TrendingUpIcon,
    color: '#10b981',
    label: 'Improving',
  },
  stable: {
    icon: TrendingFlatIcon,
    color: '#6b7280',
    label: 'Stable',
  },
  declining: {
    icon: TrendingDownIcon,
    color: '#ef4444',
    label: 'Declining',
  },
  no_data: {
    icon: NoDataIcon,
    color: '#9ca3af',
    label: 'No Data',
  },
};

/**
 * Individual Vital Display Component
 */
interface VitalRowProps {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  score: number | null;
  trend: TrendIndicator | null;
  sparkline: number[];
}

function VitalRow({ label, icon: Icon, iconColor, score, trend, sparkline }: VitalRowProps) {
  // Handle null trend values by defaulting to 'no_data'
  const safeTrend = trend || 'no_data';
  const trendConfig = TREND_ICONS[safeTrend];
  const TrendIcon = trendConfig.icon;

  // Calculate score percentage for progress bar (0-10 scale)
  const scorePercentage = score !== null ? (score / 10) * 100 : 0;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ fontSize: 20, color: iconColor }} />
          <Typography variant="body2" fontWeight="medium">
            {label}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            {score !== null ? score.toFixed(1) : 'N/A'}
          </Typography>
          <Tooltip title={trendConfig.label} placement="top" arrow>
            <TrendIcon sx={{ fontSize: 20, color: trendConfig.color }} />
          </Tooltip>
        </Box>
      </Box>
      
      {/* Progress bar */}
      {score !== null && (
        <LinearProgress
          variant="determinate"
          value={scorePercentage}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              backgroundColor: iconColor,
            },
          }}
        />
      )}
      
      {/* Sparkline visualization (simple dots) */}
      {sparkline.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, justifyContent: 'center' }}>
          {sparkline.slice(-10).map((value, idx) => {
            const height = Math.max(4, (value / 10) * 20); // Scale 0-10 to 4-20px height
            return (
              <Tooltip key={idx} title={`${value.toFixed(1)}`} placement="top" arrow>
                <Box
                  sx={{
                    width: 4,
                    height: `${height}px`,
                    backgroundColor: iconColor,
                    borderRadius: 1,
                    opacity: 0.6,
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * Health Vitals Card Component
 * 
 * Displays 5 key health metrics with trends and sparklines
 */
export default function HealthVitalsCard({ data }: HealthVitalsCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <WellbeingIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
            Health Vitals
          </Typography>
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Daily self-reported scores (0-10 scale). Trend based on last 3-5 surveys.
        </Typography>

        {/* Energy */}
        <VitalRow
          label={VITAL_CONFIG.energy.label}
          icon={VITAL_CONFIG.energy.icon}
          iconColor={VITAL_CONFIG.energy.color}
          score={data.energy_score}
          trend={data.energy_trend}
          sparkline={data.energy_sparkline}
        />

        {/* Mood */}
        <VitalRow
          label={VITAL_CONFIG.mood.label}
          icon={VITAL_CONFIG.mood.icon}
          iconColor={VITAL_CONFIG.mood.color}
          score={data.mood_score}
          trend={data.mood_trend}
          sparkline={data.mood_sparkline}
        />

        {/* Motivation */}
        <VitalRow
          label={VITAL_CONFIG.motivation.label}
          icon={VITAL_CONFIG.motivation.icon}
          iconColor={VITAL_CONFIG.motivation.color}
          score={data.motivation_score}
          trend={data.motivation_trend}
          sparkline={data.motivation_sparkline}
        />

        {/* Wellbeing */}
        <VitalRow
          label={VITAL_CONFIG.wellbeing.label}
          icon={VITAL_CONFIG.wellbeing.icon}
          iconColor={VITAL_CONFIG.wellbeing.color}
          score={data.wellbeing_score}
          trend={data.wellbeing_trend}
          sparkline={data.wellbeing_sparkline}
        />

        {/* Sleep */}
        <VitalRow
          label={VITAL_CONFIG.sleep.label}
          icon={VITAL_CONFIG.sleep.icon}
          iconColor={VITAL_CONFIG.sleep.color}
          score={data.sleep_score}
          trend={data.sleep_trend}
          sparkline={data.sleep_sparkline}
        />
      </CardContent>
    </Card>
  );
}

