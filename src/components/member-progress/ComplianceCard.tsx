'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Restaurant as NutritionIcon,
  LocalPharmacy as SupplementsIcon,
  FitnessCenter as ExerciseIcon,
  SelfImprovement as MeditationIcon,
  LocalFireDepartment as StreakIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard } from '@/types/common';

interface ComplianceCardProps {
  data: MemberProgressDashboard;
}

/**
 * Get color based on compliance percentage
 */
function getComplianceColor(percentage: number | null): string {
  if (percentage === null) return '#9ca3af';
  if (percentage >= 80) return '#10b981'; // Green
  if (percentage >= 60) return '#f59e0b'; // Yellow
  return '#ef4444'; // Red
}

/**
 * Get compliance level label
 */
function getComplianceLevel(percentage: number | null): string {
  if (percentage === null) return 'No Data';
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Fair';
  return 'Needs Improvement';
}

/**
 * Individual Compliance Row Component
 */
interface ComplianceRowProps {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  percentage: number | null;
  subtitle?: string;
  streak?: number;
  target?: string;
}

function ComplianceRow({ 
  label, 
  icon: Icon, 
  iconColor, 
  percentage, 
  subtitle,
  streak,
  target,
}: ComplianceRowProps) {
  const color = getComplianceColor(percentage);
  const level = getComplianceLevel(percentage);

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ fontSize: 20, color: iconColor }} />
          <Typography variant="body2" fontWeight="medium">
            {label}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight="bold" color={color}>
            {percentage !== null ? `${Math.round(percentage)}%` : 'N/A'}
          </Typography>
          <Chip
            label={level}
            size="small"
            sx={{
              backgroundColor: `${color}20`,
              color: color,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>
      </Box>

      {/* Progress bar */}
      {percentage !== null && (
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
            },
          }}
        />
      )}

      {/* Subtitle info */}
      {(subtitle || streak !== undefined || target) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
          {subtitle && (
            <Typography variant="caption" color="textSecondary">
              {subtitle}
            </Typography>
          )}
          {streak !== undefined && streak > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StreakIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
              <Typography variant="caption" fontWeight="600" color="#f59e0b">
                {streak} day streak
              </Typography>
            </Box>
          )}
          {target && (
            <Typography variant="caption" color="textSecondary" fontStyle="italic">
              Target: {target}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Compliance Card Component
 * 
 * Displays compliance metrics for nutrition, supplements, exercise, and meditation
 */
export default function ComplianceCard({ data }: ComplianceCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <NutritionIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
            Protocol Compliance
          </Typography>
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Adherence to program protocols. Calculated from latest progress surveys.
        </Typography>

        {/* Nutrition Compliance */}
        <ComplianceRow
          label="Nutrition Protocol"
          icon={NutritionIcon}
          iconColor="#10b981"
          percentage={data.nutrition_compliance_pct}
          streak={data.nutrition_streak}
          subtitle="Following prescribed diet"
        />

        {/* Supplements Compliance */}
        <ComplianceRow
          label="Supplement Protocol"
          icon={SupplementsIcon}
          iconColor="#8b5cf6"
          percentage={data.supplements_compliance_pct}
          subtitle="Taking prescribed supplements"
        />

        {/* Exercise Compliance */}
        <ComplianceRow
          label="Exercise Protocol"
          icon={ExerciseIcon}
          iconColor="#06b6d4"
          percentage={data.exercise_compliance_pct}
          subtitle={
            data.exercise_days_per_week !== null
              ? `${data.exercise_days_per_week.toFixed(1)} days/week`
              : undefined
          }
          target="5 days/week"
        />

        {/* Meditation Compliance */}
        <ComplianceRow
          label="Meditation/Mindfulness"
          icon={MeditationIcon}
          iconColor="#ec4899"
          percentage={data.meditation_compliance_pct}
          subtitle="Daily practice"
        />

        {/* Overall Compliance Summary */}
        {[
          data.nutrition_compliance_pct,
          data.supplements_compliance_pct,
          data.exercise_compliance_pct,
          data.meditation_compliance_pct,
        ].some((val) => val !== null) && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
              Overall Program Adherence
            </Typography>
            {(() => {
              const values = [
                data.nutrition_compliance_pct,
                data.supplements_compliance_pct,
                data.exercise_compliance_pct,
                data.meditation_compliance_pct,
              ].filter((val): val is number => val !== null);

              if (values.length === 0) return null;

              const average = values.reduce((sum, val) => sum + val, 0) / values.length;
              const color = getComplianceColor(average);

              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" fontWeight="bold" color={color}>
                    {Math.round(average)}%
                  </Typography>
                  <Chip
                    label={getComplianceLevel(average)}
                    size="small"
                    sx={{
                      backgroundColor: `${color}20`,
                      color: color,
                      fontWeight: 600,
                    }}
                  />
                </Box>
              );
            })()}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

