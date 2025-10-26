/**
 * React Query Hooks for Member Progress Dashboard
 * 
 * Provides hooks for fetching pre-calculated dashboard metrics from
 * the member_progress_summary table. Data is updated by the survey
 * import edge function on each import.
 */

import { useQuery } from '@tanstack/react-query';
import type { MemberProgressDashboard } from '@/types/common';

// ============================================
// QUERY KEY FACTORY
// ============================================

/**
 * Query key factory for Member Progress queries
 * Ensures consistent cache keys and enables targeted invalidation
 */
export const memberProgressKeys = {
  all: ['member-progress'] as const,
  dashboard: (leadId?: number | null) =>
    [...memberProgressKeys.all, 'dashboard', leadId] as const,
};

// ============================================
// HOOKS
// ============================================

/**
 * Hook: useMemberProgressDashboard
 * 
 * Fetches complete pre-calculated dashboard metrics for a member.
 * Returns all data needed for the 6 dashboard cards:
 * - Profile (status, days in program, surveys completed)
 * - Health Vitals (energy, mood, motivation, wellbeing, sleep)
 * - Compliance (nutrition, supplements, exercise, meditation)
 * - Alerts (latest wins and concerns)
 * - Timeline (completed, next, overdue milestones)
 * - Goals (from Goals & Whys survey)
 * 
 * @param leadId - lead_id from leads table (required)
 * @returns Dashboard data or error
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useMemberProgressDashboard(96);
 * 
 * if (isLoading) return <Skeleton />;
 * if (error) return <Alert severity="error">{error.message}</Alert>;
 * if (!data) return <Alert>No data available</Alert>;
 * 
 * return (
 *   <Grid container spacing={3}>
 *     <ProfileCard data={data} />
 *     <HealthVitalsCard data={data} />
 *     // ... other cards
 *   </Grid>
 * );
 * ```
 */
export function useMemberProgressDashboard(leadId?: number | null) {
  return useQuery<MemberProgressDashboard, Error>({
    queryKey: memberProgressKeys.dashboard(leadId),
    queryFn: async () => {
      if (!leadId) {
        throw new Error('Lead ID is required');
      }

      const res = await fetch(`/api/member-progress/${leadId}/dashboard`, {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        // Handle specific error types
        if (res.status === 404) {
          throw new Error(
            json.message || 
            'Dashboard data not available. Data will be populated after the next survey import.'
          );
        }
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in.');
        }
        throw new Error(json.error || 'Failed to fetch dashboard data');
      }

      return json.data as MemberProgressDashboard;
    },
    enabled: !!leadId, // Only fetch when leadId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes (dashboard updates on survey import)
    retry: 2, // Retry twice on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}

/**
 * Hook: useMultipleMemberProgressDashboards
 * 
 * Fetches dashboard data for multiple members in parallel.
 * Useful for comparative views or team dashboards.
 * 
 * @param leadIds - Array of lead_ids to fetch
 * @returns Array of query results
 * 
 * @example
 * ```tsx
 * const dashboards = useMultipleMemberProgressDashboards([96, 108, 622]);
 * 
 * const allLoaded = dashboards.every(q => !q.isLoading);
 * const anyErrors = dashboards.some(q => q.error);
 * 
 * return (
 *   <Grid container>
 *     {dashboards.map((query, idx) => (
 *       <MemberDashboardCard 
 *         key={leadIds[idx]} 
 *         data={query.data} 
 *         isLoading={query.isLoading}
 *         error={query.error}
 *       />
 *     ))}
 *   </Grid>
 * );
 * ```
 */
export function useMultipleMemberProgressDashboards(leadIds: number[]) {
  // Create a separate query for each lead
  const queries = leadIds.map((leadId) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMemberProgressDashboard(leadId)
  );

  return queries;
}

/**
 * Utility function to transform dashboard data into health vitals object
 * Useful for components that need structured vital data
 */
export function extractHealthVitals(
  dashboard: MemberProgressDashboard | undefined
) {
  if (!dashboard) return null;

  return {
    energy: {
      score: dashboard.energy_score,
      trend: dashboard.energy_trend,
      sparkline: dashboard.energy_sparkline,
    },
    mood: {
      score: dashboard.mood_score,
      trend: dashboard.mood_trend,
      sparkline: dashboard.mood_sparkline,
    },
    motivation: {
      score: dashboard.motivation_score,
      trend: dashboard.motivation_trend,
      sparkline: dashboard.motivation_sparkline,
    },
    wellbeing: {
      score: dashboard.wellbeing_score,
      trend: dashboard.wellbeing_trend,
      sparkline: dashboard.wellbeing_sparkline,
    },
    sleep: {
      score: dashboard.sleep_score,
      trend: dashboard.sleep_trend,
      sparkline: dashboard.sleep_sparkline,
    },
  };
}

/**
 * Utility function to transform dashboard data into compliance metrics object
 * Useful for components that need structured compliance data
 */
export function extractComplianceMetrics(
  dashboard: MemberProgressDashboard | undefined
) {
  if (!dashboard) return null;

  return {
    nutrition: {
      percentage: dashboard.nutrition_compliance_pct,
      streak: dashboard.nutrition_streak,
    },
    supplements: {
      percentage: dashboard.supplements_compliance_pct,
    },
    exercise: {
      percentage: dashboard.exercise_compliance_pct,
      daysPerWeek: dashboard.exercise_days_per_week,
    },
    meditation: {
      percentage: dashboard.meditation_compliance_pct,
    },
  };
}

/**
 * Utility function to extract timeline progress
 * Useful for components that need structured timeline data
 */
export function extractTimelineProgress(
  dashboard: MemberProgressDashboard | undefined
) {
  if (!dashboard) return null;

  return {
    completed: dashboard.completed_milestones,
    next: dashboard.next_milestone,
    overdue: dashboard.overdue_milestones,
  };
}

/**
 * Utility function to determine if member needs attention
 * Based on status indicator and overdue milestones
 */
export function needsAttention(
  dashboard: MemberProgressDashboard | undefined
): boolean {
  if (!dashboard) return false;
  
  return (
    dashboard.status_indicator === 'red' ||
    (dashboard.status_indicator === 'yellow' && 
     dashboard.overdue_milestones.length > 0)
  );
}

/**
 * Utility function to get human-readable status message
 */
export function getStatusMessage(
  dashboard: MemberProgressDashboard | undefined
): string {
  if (!dashboard) return 'No data available';

  switch (dashboard.status_indicator) {
    case 'green':
      return 'On track and progressing well';
    case 'yellow':
      if (dashboard.overdue_milestones.length > 0) {
        return 'Behind schedule - needs check-in';
      }
      return 'Monitor closely - some areas need attention';
    case 'red':
      return 'Needs immediate attention';
    default:
      return 'Status unknown';
  }
}

