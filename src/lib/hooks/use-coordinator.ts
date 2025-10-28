import { useQuery } from '@tanstack/react-query';

export const coordinatorKeys = {
  all: ['coordinator'] as const,
  metrics: () => [...coordinatorKeys.all, 'metrics'] as const,
  script: (params: string) =>
    [...coordinatorKeys.all, 'script', params] as const,
  todo: (params: string) => [...coordinatorKeys.all, 'todo', params] as const,
  programChanges: (params: string) =>
    [...coordinatorKeys.all, 'program-changes', params] as const,
};

export function useCoordinatorMetrics() {
  return useQuery({
    queryKey: coordinatorKeys.metrics(),
    queryFn: async () => {
      const res = await fetch('/api/coordinator/metrics', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch coordinator metrics');
      return json.data as {
        lateTasks: number;
        tasksDueToday: number;
        apptsDueToday: number;
        programChangesThisWeek: number;
      };
    },
    staleTime: 30 * 1000, // 30 seconds - shorter cache for metrics
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}

export function useCoordinatorScript(params: {
  memberId?: number | null;
  range?: string;
  start?: string | null;
  end?: string | null;
  showCompleted?: boolean;
  hideMissed?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params.memberId) sp.set('memberId', String(params.memberId));
  if (params.range && params.range !== 'all') sp.set('range', params.range);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  if (params.showCompleted) sp.set('showCompleted', 'true');
  if (params.hideMissed) sp.set('hideMissed', 'true');
  const qs = sp.toString();
  const url = `/api/coordinator/script${qs ? `?${qs}` : ''}`;
  const queryKey = coordinatorKeys.script(qs);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch script');
      return json.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds - shorter cache for note counts
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}

export function useCoordinatorToDo(params: {
  memberId?: number | null;
  range?: string;
  start?: string | null;
  end?: string | null;
  showCompleted?: boolean;
  hideMissed?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params.memberId) sp.set('memberId', String(params.memberId));
  if (params.range && params.range !== 'all') sp.set('range', params.range);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  if (params.showCompleted) sp.set('showCompleted', 'true');
  if (params.hideMissed) sp.set('hideMissed', 'true');
  const qs = sp.toString();
  const url = `/api/coordinator/todo${qs ? `?${qs}` : ''}`;
  const queryKey = coordinatorKeys.todo(qs);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch todo');
      return json.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds - shorter cache for note counts
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}

export function useCoordinatorProgramChanges(params: {
  memberId?: number | null;
  range?: string;
  start?: string | null;
  end?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.memberId) sp.set('memberId', String(params.memberId));
  if (params.range && params.range !== 'all') sp.set('range', params.range);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  const qs = sp.toString();
  const url = `/api/coordinator/program-changes${qs ? `?${qs}` : ''}`;
  return useQuery({
    queryKey: coordinatorKeys.programChanges(qs),
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program changes');
      return json.data || [];
    },
  });
}
