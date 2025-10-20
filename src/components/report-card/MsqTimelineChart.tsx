'use client';

import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Skeleton,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MsqScore } from '@/types/database.types';

interface MsqTimelineChartProps {
  data: MsqScore[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh?: () => void;
  isFetching?: boolean;
}

export default function MsqTimelineChart({
  data,
  isLoading,
  error,
  onRefresh,
  isFetching = false,
}: MsqTimelineChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader title="MSQ-95 Weekly Progress" />
        <CardContent>
          <Skeleton variant="rectangular" height={400} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="MSQ-95 Weekly Progress" />
        <CardContent>
          <Alert severity="error">{error.message}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader title="MSQ-95 Weekly Progress" />
        <CardContent>
          <Alert severity="info">
            No MSQ survey data available. Please select a participant with completed MSQ surveys.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Transform data for Recharts
  const chartData = data.map((score) => ({
    week: score.week_number,
    total: score.total_score,
    interpretation: score.interpretation,
  }));

  // Calculate score range for interpretation
  const maxScore = Math.max(...data.map((s) => s.total_score));
  const interpretationRanges = [
    { max: 10, label: 'Optimal', color: '#10b981' },
    { max: 30, label: 'Mild', color: '#84cc16' },
    { max: 60, label: 'Moderate', color: '#f59e0b' },
    { max: 100, label: 'Severe', color: '#ef4444' },
    { max: 999, label: 'Very Severe', color: '#991b1b' },
  ];

  return (
    <Card>
      <CardHeader
        title="MSQ-95 Weekly Progress"
        subheader={`${data.length} data points | ${data[0]?.lead_name || 'Participant'}`}
        action={
          onRefresh && (
            <Tooltip title="Refresh data">
              <IconButton onClick={onRefresh} disabled={isFetching} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <CardContent>
        {/* Score Interpretation Legend */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {interpretationRanges.slice(0, -1).map((range, idx) => {
            const prevMax = idx === 0 ? 0 : interpretationRanges[idx - 1]!.max + 1;
            return (
              <Chip
                key={range.label}
                label={`${range.label} (${prevMax}-${range.max})`}
                size="small"
                sx={{
                  backgroundColor: range.color,
                  color: 'white',
                  fontWeight: 500,
                }}
              />
            );
          })}
        </Box>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="week"
              label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Score (0-4 per question)', angle: -90, position: 'insideLeft' }}
              domain={[0, Math.max(maxScore, 100)]}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <Box
                      sx={{
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1.5,
                        boxShadow: 2,
                      }}
                    >
                      <Typography variant="body2" fontWeight="bold">
                        Week {data.week}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        {data.interpretation || 'Unknown'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Total Score:</strong> {data.total}
                      </Typography>
                    </Box>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />

            {/* Total Score Line */}
            <Line
              type="monotone"
              dataKey="total"
              stroke="#8e24ff"
              strokeWidth={3}
              name="Total MSQ Score"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Summary Stats */}
        {data.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Baseline
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {data[0]!.total_score} ({data[0]!.interpretation})
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Latest
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {data[data.length - 1]!.total_score} ({data[data.length - 1]!.interpretation})
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Change
              </Typography>
              <Typography
                variant="body2"
                fontWeight="bold"
                color={
                  data[0]!.total_score > data[data.length - 1]!.total_score
                    ? 'success.main'
                    : data[0]!.total_score < data[data.length - 1]!.total_score
                      ? 'error.main'
                      : 'textPrimary'
                }
              >
                {data[0]!.total_score - data[data.length - 1]!.total_score > 0 ? '-' : '+'}
                {Math.abs(data[0]!.total_score - data[data.length - 1]!.total_score)} points
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

