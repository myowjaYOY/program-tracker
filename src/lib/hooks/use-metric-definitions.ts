'use client';

import { useQuery } from '@tanstack/react-query';

export type MetricValueType = 'currency' | 'count' | 'percent' | 'ratio';
export type PeriodType = 'WEEK' | 'MONTH';
export type DashboardSection =
  | 'FINANCIAL_HEALTH'
  | 'MARKETING_ENGINE'
  | 'SALES_PERFORMANCE'
  | 'DELIVERY_MODEL_STRENGTH';
export type VisualType = 'GAUGE' | 'SPARK' | 'STAR' | 'SLIDER' | 'PROGRESS_BAR';
export type TargetDirection = 'higher_is_better' | 'lower_is_better';

export interface MetricDefinition {
  id: number;
  metric_key: string;
  label: string;
  value_type: MetricValueType;
  period_types: string[];
  display_order: number;
  active_flag: boolean;
  dashboard_section: DashboardSection | null;
  visual_type: VisualType | null;
  show_on_executive_dashboard: boolean;
  target_direction: TargetDirection;
}

export function useMetricDefinitions() {
  return useQuery({
    queryKey: ['metric-definitions'],
    queryFn: async () => {
      const res = await fetch('/api/operations/metrics');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      const json = await res.json();
      return (json.data ?? []) as MetricDefinition[];
    },
  });
}

export function getMetricKeysForPeriod(
  metrics: MetricDefinition[] | undefined,
  periodType: PeriodType
): string[] {
  if (!metrics?.length) return [];
  return metrics
    .filter((m) => m.period_types?.includes(periodType))
    .sort((a, b) => a.display_order - b.display_order)
    .map((m) => m.metric_key);
}

export function getMetricDefinition(
  metrics: MetricDefinition[] | undefined,
  key: string
): MetricDefinition | undefined {
  return metrics?.find((m) => m.metric_key === key);
}
