/**
 * React Query Hook: Analytics Metrics
 * 
 * Fetches pre-calculated analytics metrics from the cache.
 * Used by the analytics dashboard to display program-level insights.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Analytics Cache Data Structure
 * Matches member_analytics_cache table schema
 */
export interface AnalyticsMetrics {
  cache_id: number;
  calculated_at: string;
  member_count: number;
  active_member_count: number;
  completed_member_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  calculation_duration_ms: number | null;
  
  // Tab 1: Compliance Patterns (actual SQL function fields)
  compliance_distribution: any | null;
  avg_compliance_by_category: any | null;
  compliance_timeline: any | null;
  
  // Tab 2: Health Outcomes (actual SQL function fields)
  compliance_msq_correlation: number | null; // DEPRECATED
  compliance_promis_correlation: number | null; // DEPRECATED
  compliance_success_rates: any | null; // NEW: MSQ success rates by tier
  compliance_effect_size: any | null; // NEW: MSQ effect size
  compliance_odds_ratio: any | null; // NEW: MSQ odds ratio
  promis_success_rates: any | null; // NEW: PROMIS-29 success rates by tier
  promis_effect_size: any | null; // NEW: PROMIS-29 effect size
  promis_odds_ratio: any | null; // NEW: PROMIS-29 odds ratio
  compliance_msq_scatter: any | null;
  health_vitals_by_tier: any | null;
  
  // Tab 3: Intervention Targeting (actual SQL function fields)
  at_risk_members: any | null;
  bottleneck_modules: any | null;
  missed_items_patterns: any | null;
  
  // Tab 5: Temporal Trends (actual SQL function fields)
  cohort_analysis: any | null;
  completion_statistics: any | null;
}

export interface RefreshResponse {
  success: boolean;
  message: string;
  calculation_time_ms: number;
  members_analyzed: number;
  total_api_time_ms: number;
}

/**
 * Query keys for analytics
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
  metrics: () => [...analyticsKeys.all, 'metrics'] as const,
  refreshStatus: () => [...analyticsKeys.all, 'refresh-status'] as const,
};

/**
 * Hook: Fetch Analytics Metrics
 * 
 * Fetches the latest pre-calculated analytics from cache.
 * 
 * @param options - React Query options
 * @returns Query result with analytics data
 */
export function useAnalyticsMetrics() {
  return useQuery<AnalyticsMetrics, Error>({
    queryKey: analyticsKeys.metrics(),
    queryFn: async () => {
      const res = await fetch('/api/analytics/metrics', {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to fetch analytics metrics');
      }

      return json.data as AnalyticsMetrics;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes (analytics don't change frequently)
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false, // Don't refetch on window focus (expensive query)
  });
}

/**
 * Hook: Refresh Analytics Metrics
 * 
 * Triggers recalculation of analytics metrics.
 * This is a long-running operation (5-10 seconds for 100 members).
 * 
 * @returns Mutation for triggering analytics refresh
 */
export function useRefreshAnalytics() {
  const queryClient = useQueryClient();

  return useMutation<RefreshResponse, Error>({
    mutationFn: async () => {
      const res = await fetch('/api/analytics/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to refresh analytics');
      }

      return json.data as RefreshResponse;
    },
    onSuccess: (data) => {
      console.log('[Analytics Refresh] Success:', data);
      // Invalidate and refetch analytics metrics
      queryClient.invalidateQueries({ queryKey: analyticsKeys.metrics() });
    },
    onError: (error) => {
      console.error('[Analytics Refresh] Error:', error);
    },
  });
}

/**
 * Hook: Get Refresh Status
 * 
 * Checks when the cache was last updated and how old it is.
 * Useful for showing "Last updated: X hours ago" in UI.
 * 
 * @returns Query result with cache status
 */
export function useAnalyticsRefreshStatus() {
  return useQuery<{
    has_cache: boolean;
    cache_id?: number;
    calculated_at?: string;
    cache_age?: string;
    calculation_duration_ms?: number;
    member_count?: number;
    message?: string;
  }, Error>({
    queryKey: analyticsKeys.refreshStatus(),
    queryFn: async () => {
      const res = await fetch('/api/analytics/refresh', {
        method: 'GET',
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to fetch refresh status');
      }

      return json.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}



