import { useQuery } from '@tanstack/react-query';

export interface CronJobRun {
  run_id: number;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  memberships_found: number;
  memberships_processed: number;
  memberships_skipped: number;
  memberships_failed: number;
  total_payments_created: number;
  total_items_created: number;
  errors: Record<string, unknown>[] | null;
  triggered_by: string;
  duration_ms: number | null;
  created_at: string;
}

export const cronJobRunsKeys = {
  all: ['cronJobRuns'] as const,
  list: () => [...cronJobRunsKeys.all, 'list'] as const,
};

/**
 * Fetches cron job runs with auto-refresh every 30 seconds
 */
export function useCronJobRuns(refetchInterval = 30000) {
  return useQuery<CronJobRun[], Error>({
    queryKey: cronJobRunsKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/admin/cron-job-runs');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch cron job runs');
      return json.data as CronJobRun[];
    },
    refetchInterval,
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}










