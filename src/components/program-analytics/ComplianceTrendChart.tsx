'use client';

import { Card, CardContent, Typography, Box, Skeleton, Alert } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ComplianceTrendData } from '@/lib/hooks/use-compliance-trends';

interface ComplianceTrendChartProps {
  data: ComplianceTrendData[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export default function ComplianceTrendChart({ data, isLoading, error }: ComplianceTrendChartProps) {
  // Helper function to format month label (2025-11 -> Nov '25)
  const formatMonthLabel = (monthString: string): string => {
    const [year, month] = monthString.split('-');
    if (!year || !month) return monthString;
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('en-US', { month: 'short' });
    const shortYear = year.slice(2);
    return `${monthName} '${shortYear}`;
  };

  // Distinct colors for each category
  const colors = {
    nutrition: '#10b981',    // Green
    supplements: '#3b82f6',  // Blue
    exercise: '#f59e0b',     // Orange
    meditation: '#8b5cf6',   // Purple
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const monthData = data?.find(d => d.month === label);
      
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
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {formatMonthLabel(label)}
          </Typography>
          {payload.map((entry: any) => (
            <Box key={entry.name} display="flex" alignItems="center" gap={1} mb={0.5}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {entry.name}:
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {entry.value !== null ? `${entry.value.toFixed(1)}%` : 'N/A'}
              </Typography>
            </Box>
          ))}
          {monthData && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              {monthData.member_count} members • {monthData.survey_count} surveys
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}` }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Compliance Trends - Last 12 Months
          </Typography>
          <Skeleton variant="rectangular" height={300} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.error.main}` }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Compliance Trends - Last 12 Months
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to load compliance trends: {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}` }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Compliance Trends - Last 12 Months
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            No compliance data available for the last 12 months. Start tracking compliance by collecting survey responses.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}` }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            Compliance Trends - Last 12 Months
          </Typography>
        </Box>

        <ResponsiveContainer width="100%" height={350}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            {/* Gradient definitions */}
            <defs>
              <linearGradient id="colorNutrition" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.nutrition} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={colors.nutrition} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorSupplements" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.supplements} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={colors.supplements} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorExercise" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.exercise} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={colors.exercise} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorMeditation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.meditation} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={colors.meditation} stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            
            {/* Reference lines for compliance thresholds */}
            <ReferenceLine y={75} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.3} />
            
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              stroke="#666"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="#666"
              style={{ fontSize: '12px' }}
              label={{ value: 'Compliance %', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="circle"
            />
            
            {/* Area components with gradients */}
            <Area
              type="monotone"
              dataKey="nutrition"
              name="Nutrition"
              stroke={colors.nutrition}
              strokeWidth={2.5}
              fill="url(#colorNutrition)"
              dot={{ r: 3, fill: colors.nutrition }}
              activeDot={{ r: 5, fill: colors.nutrition }}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="supplements"
              name="Supplements"
              stroke={colors.supplements}
              strokeWidth={2.5}
              fill="url(#colorSupplements)"
              dot={{ r: 3, fill: colors.supplements }}
              activeDot={{ r: 5, fill: colors.supplements }}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="exercise"
              name="Exercise"
              stroke={colors.exercise}
              strokeWidth={2.5}
              fill="url(#colorExercise)"
              dot={{ r: 3, fill: colors.exercise }}
              activeDot={{ r: 5, fill: colors.exercise }}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="meditation"
              name="Meditation"
              stroke={colors.meditation}
              strokeWidth={2.5}
              fill="url(#colorMeditation)"
              dot={{ r: 3, fill: colors.meditation }}
              activeDot={{ r: 5, fill: colors.meditation }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

