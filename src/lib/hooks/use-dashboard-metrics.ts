import { useQuery } from '@tanstack/react-query';

export interface DashboardMetrics {
  activeMembers: number;
  newProgramsThisMonth: number;
  completedPrograms: number;
  pausedPrograms: number;
  membersOnMemberships: number;
}

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics, Error>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/metrics', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch dashboard metrics');
      return json.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
  });
}