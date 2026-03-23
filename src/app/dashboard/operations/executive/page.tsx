'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import MetricCard, { type MetricCardData, type MetricStatus } from '@/components/executive-dashboard/MetricCard';
import type { MetricDefinition } from '@/lib/hooks/use-metric-definitions';
import { usePaymentMetrics } from '@/lib/hooks/use-payments';
import { useExecutiveDashboard } from '@/lib/hooks/use-sales-reports';
import { useDashboardMetrics } from '@/lib/hooks/use-dashboard-metrics';
import { useReportCardDashboardMetrics } from '@/lib/hooks/use-dashboard-metrics-report-card';
import { useComplianceTrends } from '@/lib/hooks/use-compliance-trends';
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

function deriveStatus(
  actual: number,
  expected: number,
  direction: 'higher_is_better' | 'lower_is_better' = 'higher_is_better'
): MetricStatus {
  if (expected <= 0) return 'on_track';
  if (direction === 'lower_is_better') {
    const ratio = actual / expected;
    if (ratio <= 1) return 'on_track';
    if (ratio <= 1.1) return 'watch';
    return 'behind';
  }
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
  target_direction: 'higher_is_better',
};

const BOOKED_SALES_METRIC: MetricDefinition = {
  id: 2, metric_key: 'booked_sales', label: 'Booked Sales', value_type: 'currency',
  period_types: ['MONTH'], display_order: 2, active_flag: true,
  dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'SPARK', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const PROGRAM_MARGIN_METRIC: MetricDefinition = {
  id: 15, metric_key: 'program_margin', label: 'Program Margin', value_type: 'percent',
  period_types: ['MONTH'], display_order: 15, active_flag: true,
  dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const MEMBERSHIP_REVENUE_METRIC: MetricDefinition = {
  id: 16, metric_key: 'membership_revenue_pct', label: 'Membership Revenue %', value_type: 'percent',
  period_types: ['MONTH'], display_order: 16, active_flag: true,
  dashboard_section: 'FINANCIAL_HEALTH', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};


interface TargetRecord {
  metric_key: string;
  period_type: PeriodType;
  period_start: string;
  target_value: number;
}

const LEADS_METRIC: MetricDefinition = {
  id: 4, metric_key: 'leads', label: 'Leads', value_type: 'count',
  period_types: ['MONTH'], display_order: 5, active_flag: true,
  dashboard_section: 'MARKETING_ENGINE', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const SHOW_RATE_METRIC: MetricDefinition = {
  id: 5, metric_key: 'show_rate_pct', label: 'Show Rate', value_type: 'percent',
  period_types: ['MONTH'], display_order: 6, active_flag: true,
  dashboard_section: 'MARKETING_ENGINE', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const PMES_SCHEDULED_METRIC: MetricDefinition = {
  id: 8, metric_key: 'pmes_scheduled', label: 'PMEs Scheduled', value_type: 'count',
  period_types: ['MONTH'], display_order: 8, active_flag: true,
  dashboard_section: 'MARKETING_ENGINE', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const CLOSE_RATE_METRIC: MetricDefinition = {
  id: 10, metric_key: 'close_rate_pct', label: 'Close Rate', value_type: 'percent',
  period_types: ['MONTH'], display_order: 10, active_flag: true,
  dashboard_section: 'MARKETING_ENGINE', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const ACTIVE_CLIENTS_METRIC: MetricDefinition = {
  id: 12, metric_key: 'active_clients', label: 'Active Clients', value_type: 'count',
  period_types: ['MONTH'], display_order: 12, active_flag: true,
  dashboard_section: 'DELIVERY_MODEL_STRENGTH', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const AVG_SATISFACTION_METRIC: MetricDefinition = {
  id: 17, metric_key: 'avg_satisfaction_score', label: 'Avg Satisfaction Score', value_type: 'ratio',
  period_types: ['MONTH'], display_order: 17, active_flag: true,
  dashboard_section: 'DELIVERY_MODEL_STRENGTH', visual_type: 'STAR', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const OVERALL_COMPLIANCE_METRIC: MetricDefinition = {
  id: 18, metric_key: 'overall_compliance_pct', label: 'Overall Compliance %', value_type: 'percent',
  period_types: ['MONTH'], display_order: 18, active_flag: true,
  dashboard_section: 'DELIVERY_MODEL_STRENGTH', visual_type: 'GAUGE', show_on_executive_dashboard: true,
  target_direction: 'higher_is_better',
};

const DROPOUTS_METRIC: MetricDefinition = {
  id: 19, metric_key: 'dropouts', label: 'Dropouts', value_type: 'count',
  period_types: ['MONTH'], display_order: 19, active_flag: true,
  dashboard_section: 'DELIVERY_MODEL_STRENGTH', visual_type: 'PROGRESS_BAR', show_on_executive_dashboard: true,
  target_direction: 'lower_is_better',
};

export default function ExecutiveDashboardPage() {
  const [period, setPeriod] = useState<PeriodFilter>('month');

  // --- Real data sources ---
  const { data: paymentMetrics } = usePaymentMetrics();
  const { data: salesDashboard } = useExecutiveDashboard({ range: 'this_month' });
  const { data: dashboardMetrics } = useDashboardMetrics();
  const { data: reportCardMetrics } = useReportCardDashboardMetrics();
  const { data: complianceTrends } = useComplianceTrends();
  const { data: marketingMetrics } = useQuery<{ leadsCount: number; pmesScheduled: number; showRate: number }>({
    queryKey: ['marketing-executive'],
    queryFn: async () => {
      const res = await fetch('/api/reports/marketing-executive');
      if (!res.ok) throw new Error('Failed to fetch marketing metrics');
      return res.json();
    },
  });

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

  const membershipRevenueEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('membership_revenue_pct');
    const actual = paymentMetrics?.membershipRevenuePct ?? null;
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null ? deriveStatus(actual, target) : 'watch';

    return {
      metric: MEMBERSHIP_REVENUE_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [paymentMetrics, allTargets, currentMonthPrefix]);

  const financialHealthEntries = useMemo(
    () => [collectionsEntry, bookedSalesEntry, membershipRevenueEntry, programMarginEntry],
    [collectionsEntry, bookedSalesEntry, membershipRevenueEntry, programMarginEntry]
  );

  const leadsEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('leads');
    const actual = marketingMetrics?.leadsCount ?? null;
    const target = targetRecord?.target_value ?? null;
    const paceRatio = getMonthPaceRatio();
    const expected = target != null ? Math.round(target * paceRatio) : null;
    const status: MetricStatus =
      actual != null && expected != null ? deriveStatus(actual, expected) : 'watch';

    return {
      metric: LEADS_METRIC,
      data: { actual, target, expected, status },
    };
  }, [marketingMetrics, allTargets, currentMonthPrefix]);

  const showRateEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('show_rate_pct');
    const actual = marketingMetrics?.showRate ?? null;
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null ? deriveStatus(actual, target) : 'watch';

    return {
      metric: SHOW_RATE_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [marketingMetrics, allTargets, currentMonthPrefix]);

  const pmesEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('pmes_scheduled');
    const actual = marketingMetrics?.pmesScheduled ?? null;
    const target = targetRecord?.target_value ?? null;
    const paceRatio = getMonthPaceRatio();
    const expected = target != null ? Math.round(target * paceRatio) : null;
    const status: MetricStatus =
      actual != null && expected != null ? deriveStatus(actual, expected) : 'watch';

    return {
      metric: PMES_SCHEDULED_METRIC,
      data: { actual, target, expected, status },
    };
  }, [marketingMetrics, allTargets, currentMonthPrefix]);

  const closeRateEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('close_rate_pct');
    const summary = salesDashboard?.data?.summary;
    const actual = summary?.conversionRate != null ? parseFloat(summary.conversionRate.toFixed(1)) : null;
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null ? deriveStatus(actual, target) : 'watch';

    return {
      metric: CLOSE_RATE_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [salesDashboard, allTargets, currentMonthPrefix]);

  const marketingSalesEntries = useMemo(
    () => [leadsEntry, showRateEntry, pmesEntry, closeRateEntry],
    [leadsEntry, showRateEntry, pmesEntry, closeRateEntry]
  );

  const activeClientsEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('active_clients');
    const actual = dashboardMetrics?.activeMembers ?? null;
    const target = targetRecord?.target_value ?? null;
    const paceRatio = getMonthPaceRatio();
    const expected = target != null ? Math.round(target * paceRatio) : null;
    const status: MetricStatus =
      actual != null && expected != null ? deriveStatus(actual, expected) : 'watch';

    return {
      metric: ACTIVE_CLIENTS_METRIC,
      data: { actual, target, expected, status },
    };
  }, [dashboardMetrics, allTargets, currentMonthPrefix]);

  const satisfactionEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('avg_satisfaction_score');
    const actual = reportCardMetrics?.avgSupportRating ?? null;
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null ? deriveStatus(actual, target) : 'watch';

    return {
      metric: AVG_SATISFACTION_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [reportCardMetrics, allTargets, currentMonthPrefix]);

  const complianceEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('overall_compliance_pct');
    let actual: number | null = null;
    if (complianceTrends && complianceTrends.length > 0) {
      const latest = complianceTrends[complianceTrends.length - 1]!;
      const values = [latest.nutrition, latest.supplements, latest.exercise, latest.meditation]
        .filter((v): v is number => v != null);
      if (values.length > 0) {
        actual = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
      }
    }
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null ? deriveStatus(actual, target) : 'watch';

    return {
      metric: OVERALL_COMPLIANCE_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [complianceTrends, allTargets, currentMonthPrefix]);

  const dropoutsEntry: MockEntry = useMemo(() => {
    const targetRecord = findTarget('dropouts');
    const actual = dashboardMetrics?.cancelledThisMonth ?? null;
    const target = targetRecord?.target_value ?? null;
    const status: MetricStatus =
      actual != null && target != null
        ? deriveStatus(actual, target, 'lower_is_better')
        : 'watch';

    return {
      metric: DROPOUTS_METRIC,
      data: { actual, target, expected: null, expectedLabel: 'Not Applicable', status },
    };
  }, [dashboardMetrics, allTargets, currentMonthPrefix]);

  const deliveryModelEntries = useMemo(
    () => [activeClientsEntry, satisfactionEntry, complianceEntry, dropoutsEntry],
    [activeClientsEntry, satisfactionEntry, complianceEntry, dropoutsEntry]
  );

  const SECTIONS = [
    { key: 'financial_health', label: 'Financial Health', tagline: 'Top outcomes', entries: financialHealthEntries },
    { key: 'marketing_engine', label: 'Marketing / Sales Engine', tagline: 'Critical funnel and conversion pressure', entries: marketingSalesEntries },
    { key: 'delivery_model_strength', label: 'Delivery Model Strength', tagline: 'Long-term durability', entries: deliveryModelEntries },
  ];

  const allEntries = SECTIONS.flatMap((s) => s.entries);
  const strengthCount = allEntries.filter((e) => e.data?.status === 'on_track').length;
  const watchCount = allEntries.filter((e) => e.data?.status === 'watch').length;
  const behindCount = allEntries.filter((e) => e.data?.status === 'behind').length;

  const insightPayload = useMemo(() => {
    return allEntries.map((e) => ({
      label: e.metric.label,
      actual: e.data.actual ?? null,
      target: e.data.target ?? null,
      expected: e.data.expected ?? null,
      status: e.data.status,
      section: e.metric.dashboard_section ?? '',
      valueType: e.metric.value_type,
    }));
  }, [allEntries]);

  const insightHash = useMemo(
    () => insightPayload.map((m) => `${m.label}:${m.actual}:${m.target}:${m.status}`).join('|'),
    [insightPayload]
  );

  const metricsReady = allEntries.some((e) => e.data.actual != null);

  const { data: insightData, isFetching: insightLoading } = useQuery({
    queryKey: ['executive-insight', insightHash],
    queryFn: async () => {
      const res = await fetch('/api/operations/executive-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: insightPayload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ insight: string; constraint: string; cached: boolean; generatedAt: string }>;
    },
    enabled: metricsReady,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

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
            {/* Left: AI assessment */}
            <Box sx={{ flex: 1, minWidth: 320 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, mb: 1 }}
              >
                CEO Briefing
              </Typography>
              {insightLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body1" color="text.secondary">
                    Analyzing metrics…
                  </Typography>
                </Box>
              ) : (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6 }}
                >
                  {insightData?.insight ?? 'Loading…'}
                </Typography>
              )}
            </Box>

            {/* Right: behind + strength/watch */}
            <Box sx={{ minWidth: 280, maxWidth: 360 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: '#ffffff',
                  border: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'center',
                }}
              >
                <Typography
                  sx={{
                    color: '#d32f2f',
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                  }}
                >
                  Primary Bottleneck
                </Typography>
                <Typography
                  sx={{ color: '#d32f2f', fontWeight: 600, fontSize: '0.85rem', mt: 0.5 }}
                >
                  {insightData?.constraint || '—'}
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

          {/* Period filter buttons — hidden until filters are wired to cards */}
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
