'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import MetricCard, { type MetricCardData, type MetricStatus } from '@/components/executive-dashboard/MetricCard';
import type { MetricDefinition } from '@/lib/hooks/use-metric-definitions';
import { usePaymentMetrics } from '@/lib/hooks/use-payments';
import { useExecutiveDashboard } from '@/lib/hooks/use-sales-reports';
import type { PeriodType } from '@/lib/hooks/use-metric-definitions';

type PeriodFilter = 'month' | 'week' | 'quarter' | 'custom';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
];

function getCurrentMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function getMonthPaceRatio(): number {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day / daysInMonth;
}

function deriveStatus(actual: number, expected: number): MetricStatus {
  if (expected <= 0) return 'on_track';
  const ratio = actual / expected;
  if (ratio >= 1) return 'on_track';
  if (ratio >= 0.9) return 'watch';
  return 'behind';
}

// ---------------------------------------------------------------------------
// Mock metric definitions & data — will be replaced with real API data later
// ---------------------------------------------------------------------------

type MockEntry = { metric: MetricDefinition; data: MetricCardData };

const COLLECTIONS_METRIC: MetricDefinition = {
  id: 1, metric_key: 'collections', label: 'Collections', value_type: 'currency',
  period_types: ['MONTH'], display_order: 1, active_flag: true,
  dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'GAUGE', show_on_executive_dashboard: true,
};

const BOOKED_SALES_METRIC: MetricDefinition = {
  id: 2, metric_key: 'booked_sales', label: 'Booked Sales', value_type: 'currency',
  period_types: ['MONTH'], display_order: 2, active_flag: true,
  dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'SPARK', show_on_executive_dashboard: true,
};

const PROGRAM_MARGIN_METRIC: MetricDefinition = {
  id: 15, metric_key: 'program_margin', label: 'Program Margin', value_type: 'percent',
  period_types: ['MONTH'], display_order: 15, active_flag: true,
  dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'GAUGE', show_on_executive_dashboard: true,
};

const FINANCIAL_HEALTH_MOCK: MockEntry[] = [
  {
    metric: { id: 3, metric_key: 'pipeline_value', label: 'Pipeline Value', value_type: 'currency', period_types: ['MONTH'], display_order: 3, active_flag: true, dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'SPARK', show_on_executive_dashboard: true },
    data: { actual: 388000, target: 350000, expected: 340000, status: 'on_track', trend: [280, 295, 310, 320, 335, 345, 355, 365, 378, 388] },
  },
];

interface TargetRecord {
  metric_key: string;
  period_type: PeriodType;
  period_start: string;
  target_value: number;
}

const MARKETING_ENGINE: MockEntry[] = [
  {
    metric: { id: 4, metric_key: 'leads', label: 'Leads', value_type: 'count', period_types: ['MONTH'], display_order: 5, active_flag: true, dashboard_section: 'MARKETING_ENGINE', visual_type: 'SPARK', show_on_executive_dashboard: true },
    data: { actual: 184, target: 200, expected: 190, status: 'watch', trend: [60, 85, 100, 115, 125, 140, 150, 162, 174, 184] },
  },
  {
    metric: { id: 5, metric_key: 'show_rate_pct', label: 'Show Rate', value_type: 'percent', period_types: ['MONTH'], display_order: 6, active_flag: true, dashboard_section: 'MARKETING_ENGINE', visual_type: 'GAUGE', show_on_executive_dashboard: true },
    data: { actual: 68, target: 75, expected: 72, status: 'behind' },
  },
  {
    metric: { id: 8, metric_key: 'pmes_scheduled', label: 'PMEs Scheduled', value_type: 'count', period_types: ['MONTH'], display_order: 7, active_flag: true, dashboard_section: 'MARKETING_ENGINE', visual_type: 'SPARK', show_on_executive_dashboard: true },
    data: { actual: 51, target: 56, expected: 53, status: 'watch', trend: [12, 18, 24, 28, 33, 37, 41, 44, 48, 51] },
  },
  {
    metric: { id: 10, metric_key: 'close_rate_pct', label: 'Close Rate', value_type: 'percent', period_types: ['MONTH'], display_order: 8, active_flag: true, dashboard_section: 'MARKETING_ENGINE', visual_type: 'GAUGE', show_on_executive_dashboard: true },
    data: { actual: 45, target: 48, expected: 46, status: 'watch' },
  },
];

const CLIENT_MODEL_STRENGTH: MockEntry[] = [
  {
    metric: { id: 12, metric_key: 'active_clients', label: 'Active Clients', value_type: 'count', period_types: ['MONTH'], display_order: 12, active_flag: true, dashboard_section: 'CLIENT_MODEL_STRENGTH', visual_type: 'SPARK', show_on_executive_dashboard: true },
    data: { actual: 317, target: 330, expected: null, status: 'watch', trend: [295, 300, 305, 308, 310, 312, 314, 315, 316, 317] },
  },
  {
    metric: { id: 13, metric_key: 'existing_client_revenue_pct', label: 'Existing Client Revenue %', value_type: 'percent', period_types: ['MONTH'], display_order: 13, active_flag: true, dashboard_section: 'CLIENT_MODEL_STRENGTH', visual_type: 'GAUGE', show_on_executive_dashboard: true },
    data: { actual: 36, target: 40, expected: null, status: 'watch' },
  },
  {
    metric: { id: 15, metric_key: 'ltv_avg', label: 'LTV Avg', value_type: 'currency', period_types: ['MONTH'], display_order: 14, active_flag: true, dashboard_section: 'CLIENT_MODEL_STRENGTH', visual_type: 'SPARK', show_on_executive_dashboard: true },
    data: { actual: 18200, target: 17000, expected: null, status: 'on_track', trend: [15800, 16200, 16500, 16900, 17100, 17400, 17600, 17800, 18000, 18200] },
  },
];

export default function ExecutiveDashboardPage() {
  const [period, setPeriod] = useState<PeriodFilter>('month');

  // --- Real data sources ---
  const { data: paymentMetrics } = usePaymentMetrics();
  const { data: salesDashboard } = useExecutiveDashboard({ range: 'this_month' });

  const currentMonthStart = useMemo(() => getCurrentMonthStart(), []);

  const { data: allTargets = [] } = useQuery({
    queryKey: ['operations-targets'],
    queryFn: async () => {
      const res = await fetch('/api/operations/targets');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as TargetRecord[];
    },
  });

  const currentMonthPrefix = currentMonthStart.slice(0, 7);

  const findTarget = (metricKey: string) =>
    allTargets.find(
      (t) =>
        t.metric_key === metricKey &&
        t.period_type === 'MONTH' &&
        t.period_start.startsWith(currentMonthPrefix)
    );

  const collectionsEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('collections');
    const actual = paymentMetrics?.totalAmountDue ?? null;
    const target = targetRecord?.target_value ?? null;
    const paceRatio = getMonthPaceRatio();
    const expected = target != null ? Math.round(target * paceRatio) : null;
    const status: MetricStatus =
      actual != null && expected != null ? deriveStatus(actual, expected) : 'watch';

    return {
      metric: COLLECTIONS_METRIC,
      data: { actual, target, expected, status },
    };
  }, [paymentMetrics, allTargets, currentMonthPrefix]);

  const bookedSalesEntry: MockEntry = useMemo(() => {
    const summary = salesDashboard?.data?.summary;
    const targetRecord = findTarget('booked_sales');
    const actual = summary?.totalRevenue ?? null;
    const target = targetRecord?.target_value ?? null;
    const paceRatio = getMonthPaceRatio();
    const expected = target != null ? Math.round(target * paceRatio) : null;
    const status: MetricStatus =
      actual != null && expected != null ? deriveStatus(actual, expected) : 'watch';
    const trend = summary?.revenueTrend ?? [];

    return {
      metric: BOOKED_SALES_METRIC,
      data: { actual, target, expected, status, trend },
    };
  }, [salesDashboard, allTargets, currentMonthPrefix]);

  const programMarginEntry: MockEntry = useMemo(() => {
    const summary = salesDashboard?.data?.summary;
    const targetRecord = findTarget('program_margin');
    const actual = summary?.avgMargin ?? null;
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null ? deriveStatus(actual, target) : 'watch';

    return {
      metric: PROGRAM_MARGIN_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [salesDashboard, allTargets, currentMonthPrefix]);

  const financialHealthEntries = useMemo(
    () => [collectionsEntry, bookedSalesEntry, ...FINANCIAL_HEALTH_MOCK, programMarginEntry],
    [collectionsEntry, bookedSalesEntry, programMarginEntry]
  );

  const SECTIONS = [
    { key: 'financial_health', label: 'Financial Health', tagline: 'Top outcomes', entries: financialHealthEntries },
    { key: 'marketing_engine', label: 'Marketing Engine', tagline: 'Critical funnel and conversion pressure', entries: MARKETING_ENGINE },
    { key: 'client_model_strength', label: 'Client Model Strength', tagline: 'Long-term durability', entries: CLIENT_MODEL_STRENGTH },
  ];

  const strengthCount = 7;
  const watchCount = 3;

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main">
          Executive Dashboard
        </Typography>
      </Box>

      {/* Summary Container */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* Left: summary */}
            <Box sx={{ flex: 1, minWidth: 320 }}>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.6, maxWidth: 560 }}
              >
                The business is still structurally healthy, but show-rate softness
                is compressing PMEs and now flowing downstream into wins and
                collections pacing.
              </Typography>
            </Box>

            {/* Right: primary bottleneck + strength/watch */}
            <Box sx={{ minWidth: 280, maxWidth: 360 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: '#ffffff',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="overline"
                  sx={{
                    color: '#d32f2f',
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    fontSize: '0.7rem',
                  }}
                >
                  Primary Bottleneck
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, color: 'text.primary', lineHeight: 1.5 }}
                >
                  Show-rate softness is reducing PMEs and downstream wins.
                </Typography>
              </Box>

              {/* Strength / Watch badges */}
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
                <Chip
                  label={`Strength  ${strengthCount}`}
                  size="small"
                  sx={{
                    flex: 1,
                    backgroundColor: '#ffffff',
                    color: '#2e7d32',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
                <Chip
                  label={`Watch  ${watchCount}`}
                  size="small"
                  sx={{
                    flex: 1,
                    backgroundColor: '#ffffff',
                    color: '#e65100',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Period filter buttons */}
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <ButtonGroup variant="outlined" size="small">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={period === opt.value ? 'contained' : 'outlined'}
                  onClick={() => setPeriod(opt.value)}
                  sx={{
                    fontWeight: 600,
                    px: 2.5,
                    ...(period === opt.value
                      ? {}
                      : {
                          color: 'text.primary',
                          borderColor: 'divider',
                          '&:hover': { borderColor: 'primary.main' },
                        }),
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <Box key={section.key} sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              mb: 2,
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              {section.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              {section.tagline}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: `repeat(${Math.min(section.entries.length, 4)}, 1fr)`,
              },
              gap: 2,
            }}
          >
            {section.entries.map((entry) => (
              <MetricCard
                key={entry.metric.metric_key}
                metric={entry.metric}
                data={entry.data}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
