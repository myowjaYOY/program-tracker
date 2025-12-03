'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { RatingTimelineEntry } from '@/lib/hooks/use-member-feedback';

interface RatingsOverTimeChartProps {
  data: RatingTimelineEntry[];
}

/**
 * Color configuration matching the summary card
 */
const LINE_COLORS = {
  provider: '#8b5cf6', // purple
  staff: '#06b6d4', // cyan
  curriculum: '#f59e0b', // amber
};

/**
 * Rating scale labels for Y-axis
 */
const RATING_LABELS: Record<number, string> = {
  1: 'N/A',
  2: 'Mild',
  3: 'Adequate',
  4: 'Very Good',
  5: 'Exceeding',
};

/**
 * Custom tooltip component
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

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
      <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
        {data.formName}
      </Typography>
      <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
        {new Date(data.date).toLocaleDateString()}
      </Typography>
      {data.provider !== null && (
        <Typography variant="body2" sx={{ color: LINE_COLORS.provider }}>
          Provider: {data.provider}/5
        </Typography>
      )}
      {data.staff !== null && (
        <Typography variant="body2" sx={{ color: LINE_COLORS.staff }}>
          Staff/Coach: {data.staff}/5
        </Typography>
      )}
      {data.curriculum !== null && (
        <Typography variant="body2" sx={{ color: LINE_COLORS.curriculum }}>
          Curriculum: {data.curriculum}/5
        </Typography>
      )}
    </Box>
  );
}

/**
 * Ratings Over Time Chart
 * 
 * Line chart showing how support ratings change across surveys
 */
export default function RatingsOverTimeChart({ data }: RatingsOverTimeChartProps) {
  // Need at least 2 data points for a meaningful chart
  if (!data || data.length < 2) {
    return null;
  }

  // Transform data for chart - use index as x-axis for even spacing
  const chartData = data.map((entry, index) => ({
    ...entry,
    index,
    // Format date for x-axis label
    dateLabel: new Date(entry.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
  }));

  // Check which dimensions have data
  const hasProvider = data.some(d => d.provider !== null);
  const hasStaff = data.some(d => d.staff !== null);
  const hasCurriculum = data.some(d => d.curriculum !== null);

  return (
    <Box sx={{ mb: 4 }}>
      <Card variant="outlined">
        <CardContent>
          {/* Chart */}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => RATING_LABELS[value] || value}
                width={70}
              />

              {/* Reference line at "Adequate" (3) */}
              <ReferenceLine 
                y={3} 
                stroke="#9ca3af" 
                strokeDasharray="5 5" 
                label={{ 
                  value: '', 
                  position: 'right',
                  fill: '#9ca3af',
                  fontSize: 10,
                }}
              />

              <RechartsTooltip content={<CustomTooltip />} />
              
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconType="line"
              />

              {/* Provider Line */}
              {hasProvider && (
                <Line
                  type="monotone"
                  dataKey="provider"
                  stroke={LINE_COLORS.provider}
                  strokeWidth={2}
                  name="Provider"
                  dot={{ r: 4, fill: LINE_COLORS.provider }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              )}

              {/* Staff/Coach Line */}
              {hasStaff && (
                <Line
                  type="monotone"
                  dataKey="staff"
                  stroke={LINE_COLORS.staff}
                  strokeWidth={2}
                  name="Staff/Coach"
                  dot={{ r: 4, fill: LINE_COLORS.staff }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              )}

              {/* Curriculum Line */}
              {hasCurriculum && (
                <Line
                  type="monotone"
                  dataKey="curriculum"
                  stroke={LINE_COLORS.curriculum}
                  strokeWidth={2}
                  name="Curriculum"
                  dot={{ r: 4, fill: LINE_COLORS.curriculum }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

