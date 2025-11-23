'use client';

import { Card, CardContent, Typography, Box, Skeleton, Alert } from '@mui/material';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MonthlySalesData } from '@/lib/hooks/use-sales-reports';

interface MonthlySalesChartProps {
  data: MonthlySalesData[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export default function MonthlySalesChart({ data, isLoading, error }: MonthlySalesChartProps) {
  // Helper function to format month label (2025-11 -> Nov '25)
  const formatMonthLabel = (monthString: string): string => {
    const [year, month] = monthString.split('-');
    if (!year || !month) return monthString;
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('en-US', { month: 'short' });
    const shortYear = year.slice(2);
    return `${monthName} '${shortYear}`;
  };

  // Colors
  const colors = {
    pmeWinRate: '#10b981',       // Green
    conversionRate: '#3b82f6',   // Blue
    totalRevenue: '#f59e0b',     // Orange
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
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
          {payload.map((entry: any) => {
            const isRevenue = entry.dataKey === 'totalRevenue';
            const value = isRevenue 
              ? `$${entry.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : `${entry.value.toFixed(1)}%`;
            
            return (
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
                  {value}
                </Typography>
              </Box>
            );
          })}
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
            Monthly Sales Trends
          </Typography>
          <Skeleton variant="rectangular" height={400} sx={{ mt: 2 }} />
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
            Monthly Sales Trends
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to load monthly sales data: {error.message}
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
            Monthly Sales Trends
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            No sales data available for the selected date range.
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
            Monthly Sales Trends
          </Typography>
        </Box>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={data}
            margin={{ top: 5, right: 60, left: 20, bottom: 5 }}
          >
            {/* Gradient definitions */}
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.totalRevenue} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={colors.totalRevenue} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorPmeWin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.pmeWinRate} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={colors.pmeWinRate} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorConversion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.conversionRate} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={colors.conversionRate} stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              stroke="#666"
              style={{ fontSize: '12px' }}
            />
            
            {/* Left Y-Axis for Revenue */}
            <YAxis
              yAxisId="revenue"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              stroke="#666"
              style={{ fontSize: '12px' }}
              label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            
            {/* Right Y-Axis for Percentages */}
            <YAxis
              yAxisId="percentage"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="#666"
              style={{ fontSize: '12px' }}
              label={{ value: 'Percentage %', angle: 90, position: 'insideRight', style: { fontSize: '12px' } }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="circle"
            />
            
            {/* Revenue Area (Left Axis) */}
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="totalRevenue"
              name="Total Revenue"
              stroke={colors.totalRevenue}
              strokeWidth={2.5}
              fill="url(#colorRevenue)"
              dot={{ r: 3, fill: colors.totalRevenue }}
              activeDot={{ r: 5, fill: colors.totalRevenue }}
              connectNulls
            />
            
            {/* PME Win % Area (Right Axis) */}
            <Area
              yAxisId="percentage"
              type="monotone"
              dataKey="pmeWinRate"
              name="PME → Win %"
              stroke={colors.pmeWinRate}
              strokeWidth={2.5}
              fill="url(#colorPmeWin)"
              dot={{ r: 3, fill: colors.pmeWinRate }}
              activeDot={{ r: 5, fill: colors.pmeWinRate }}
              connectNulls
            />
            
            {/* Conversion Rate Area (Right Axis) */}
            <Area
              yAxisId="percentage"
              type="monotone"
              dataKey="conversionRate"
              name="Conversion %"
              stroke={colors.conversionRate}
              strokeWidth={2.5}
              fill="url(#colorConversion)"
              dot={{ r: 3, fill: colors.conversionRate }}
              activeDot={{ r: 5, fill: colors.conversionRate }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

