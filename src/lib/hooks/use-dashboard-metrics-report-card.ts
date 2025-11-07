import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics } from '@/app/api/report-card/dashboard-metrics/route';

/**
 * Query key factory for Report Card Dashboard Metrics
 */
export const dashboardMetricsKeys = {
  all: ['report-card-dashboard-metrics'] as const,
  metrics: () => [...dashboardMetricsKeys.all, 'metrics'] as const,
};

/**
 * Hook: useReportCardDashboardMetrics
 * 
 * Fetches all 6 dashboard card metrics:
 * 1. Member Progress Coverage
 * 2. Programs Ending in 14 Days
 * 3. Worst MSQ Scores (Top 6)
 * 4. Most Behind on Schedule (Top 6)
 * 5. Worst Compliance (Top 6)
 * 6. Best Progress (Top 6)
 * 
 * @returns React Query result with dashboard metrics data
 */
export function useReportCardDashboardMetrics() {
  return useQuery<DashboardMetrics, Error>({
    queryKey: dashboardMetricsKeys.metrics(),
    queryFn: async () => {
      const res = await fetch('/api/report-card/dashboard-metrics', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch dashboard metrics');
      }
      return json.data as DashboardMetrics;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - these are real-time operational metrics
    refetchOnWindowFocus: true, // Refresh when user returns to page
  });
}

