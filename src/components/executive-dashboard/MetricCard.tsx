import React from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import type { MetricDefinition, MetricValueType, VisualType } from '@/lib/hooks/use-metric-definitions';
import GaugeVisual from './GaugeVisual';
import SparkVisual from './SparkVisual';
import StarVisual from './StarVisual';
import SliderVisual from './SliderVisual';
import ProgressBarVisual from './ProgressBarVisual';

export type MetricStatus = 'behind' | 'watch' | 'on_track';

const STATUS_CONFIG: Record<MetricStatus, { label: string; color: string; bg: string }> = {
  behind:   { label: 'Behind',   color: '#d32f2f', bg: '#ffebee' },
  watch:    { label: 'Watch',    color: '#e65100', bg: '#fff3e0' },
  on_track: { label: 'On Track', color: '#2e7d32', bg: '#e8f5e9' },
};

export interface MetricCardData {
  actual?: number | null;
  target?: number | null;
  expected?: number | null;
  expectedLabel?: string;
  status?: MetricStatus;
  trend?: number[];
}

interface MetricCardProps {
  metric: MetricDefinition;
  data?: MetricCardData;
}

function formatValue(value: number | null | undefined, valueType: MetricValueType): string {
  if (value == null) return '\u2014';
  switch (valueType) {
    case 'currency': {
      if (Math.abs(value) >= 1000) {
        return `$${Math.round(value / 1000)}k`;
      }
      return `$${value.toLocaleString()}`;
    }
    case 'percent':
      return `${parseFloat(value.toFixed(2))}%`;
    case 'count':
      return value.toLocaleString();
    case 'ratio':
      return value.toFixed(2);
    default:
      return String(value);
  }
}

function getStatusColor(status?: MetricStatus): string {
  if (!status) return '#78909c';
  return STATUS_CONFIG[status].color;
}

export default function MetricCard({ metric, data }: MetricCardProps) {
  const { actual, target, expected, expectedLabel, status, trend } = data ?? {};
  const hasData = actual != null && target != null;
  const progress = hasData && target ? actual / target : 0;
  const visualType: VisualType = metric.visual_type ?? 'SPARK';
  const accentColor = getStatusColor(status);
  const expectedDisplay = expectedLabel ?? formatValue(expected, metric.value_type);

  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Header row: label + status badge */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: 1,
              fontSize: '0.65rem',
              lineHeight: 1.5,
            }}
          >
            {metric.label}
          </Typography>
          {status && (
            <Chip
              label={STATUS_CONFIG[status].label}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: STATUS_CONFIG[status].color,
                backgroundColor: STATUS_CONFIG[status].bg,
                ml: 1,
              }}
            />
          )}
        </Box>

        {/* Current value */}
        <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
          {formatValue(actual, metric.value_type)}
        </Typography>

        {/* Target */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Target {formatValue(target, metric.value_type)}
        </Typography>

        {/* Visual + stats */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {visualType === 'GAUGE' && (
              <GaugeVisual progress={progress} color={accentColor} />
            )}
            {visualType === 'SPARK' && (
              <SparkVisual trend={trend ?? []} color={accentColor} />
            )}
            {visualType === 'STAR' && (
              <StarVisual value={actual} color={accentColor} />
            )}
            {visualType === 'SLIDER' && (
              <SliderVisual progress={progress} color={accentColor} />
            )}
            {visualType === 'PROGRESS_BAR' && (
              <ProgressBarVisual progress={progress} color={accentColor} />
            )}
            <Box>
              <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: 0.8 }}>
                Expected by Today
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {expectedDisplay}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
