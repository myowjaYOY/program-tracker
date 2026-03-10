import { useQuery } from '@tanstack/react-query';
import type { CoordinatorMetrics } from '@/lib/data/coordinator';

export const coordinatorKeys = {
  all: ['coordinator'] as const,
  metrics: () => [...coordinatorKeys.all, 'metrics'] as const,
  script: (params: string) =>
    [...coordinatorKeys.all, 'script', params] as const,
  todo: (params: string) => [...coordinatorKeys.all, 'todo', params] as const,
  programChanges: (params: string) =>
    [...coordinatorKeys.all, 'program-changes', params] as const,
};

interface UseCoordinatorMetricsOptions {
  initialData?: CoordinatorMetrics;
}

export function useCoordinatorMetrics(options?: UseCoordinatorMetricsOptions) {
  return useQuery({
    queryKey: coordinatorKeys.metrics(),
    queryFn: async () => {
      const res = await fetch('/api/coordinator/metrics', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch coordinator metrics');
      return json.data as CoordinatorMetrics;
    },
    initialData: options?.initialData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

export function useCoordinatorScript(params: {
  memberId?: number | null;
  range?: string;
  start?: string | null;
  end?: string | null;
  showCompleted?: boolean;
  showMissed?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params.memberId) sp.set('memberId', String(params.memberId));
  if (params.range && params.range !== 'all') sp.set('range', params.range);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  if (params.showCompleted) sp.set('showCompleted', 'true');
  if (params.showMissed) sp.set('showMissed', 'true');
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
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCoordinatorToDo(params: {
  memberId?: number | null;
  range?: string;
  start?: string | null;
  end?: string | null;
  showCompleted?: boolean;
  showMissed?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params.memberId) sp.set('memberId', String(params.memberId));
  if (params.range && params.range !== 'all') sp.set('range', params.range);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  if (params.showCompleted) sp.set('showCompleted', 'true');
  if (params.showMissed) sp.set('showMissed', 'true');
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
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
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