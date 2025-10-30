'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Tooltip,
  LinearProgress,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Restaurant as NutritionIcon,
  LocalPharmacy as SupplementsIcon,
  FitnessCenter as ExerciseIcon,
  SelfImprovement as MeditationIcon,
  LocalFireDepartment as StreakIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Icon sx={{ fontSize: 20, color: iconColor }} />
        <Typography variant="subtitle2" fontWeight="medium">
          {label}
        </Typography>
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

      {/* Subtitle info with chip and percentage */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          <Typography variant="caption" fontWeight="bold" color={color} sx={{ fontSize: '0.7rem' }}>
            {percentage !== null ? `${Math.round(percentage)}%` : 'N/A'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Compliance Card Component
 * 
 * Displays compliance metrics for nutrition, supplements, exercise, and meditation
 */
export default function ComplianceCard({ data }: ComplianceCardProps) {
  const [expanded, setExpanded] = useState(true);

  // Calculate overall adherence
  const complianceValues = [
    data.nutrition_compliance_pct,
    data.supplements_compliance_pct,
    data.exercise_compliance_pct,
    data.meditation_compliance_pct,
  ].filter((val): val is number => val !== null);

  const overallAdherence = complianceValues.length > 0
    ? Math.round(complianceValues.reduce((sum, val) => sum + val, 0) / complianceValues.length)
    : null;

  const adherenceColor = overallAdherence !== null ? getComplianceColor(overallAdherence) : '#9ca3af';
  const adherenceLevel = overallAdherence !== null ? getComplianceLevel(overallAdherence) : 'No Data';

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderTop: 3, borderTopColor: 'primary.main' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: expanded ? 2 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NutritionIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight="bold">
              Protocol Compliance
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {overallAdherence !== null && (
              <>
                <Typography variant="caption" color="textSecondary">
                  Overall Program Adherence
                </Typography>
                <Typography variant="body2" fontWeight="bold" color={adherenceColor}>
                  {overallAdherence}%
                </Typography>
              </>
            )}
            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.5 }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>

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
          {...(data.exercise_days_per_week !== null && {
            subtitle: `${data.exercise_days_per_week.toFixed(1)} days/week`,
          })}
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
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

