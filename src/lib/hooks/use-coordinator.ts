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
  });
}

export function useCoordinatorScript(params: {
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
  const url = `/api/coordinator/script${qs ? `?${qs}` : ''}`;
  return useQuery({
    queryKey: coordinatorKeys.script(qs),
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch script');
      return json.data || [];
    },
  });
}

export function useCoordinatorToDo(params: {
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
  const url = `/api/coordinator/todo${qs ? `?${qs}` : ''}`;
  return useQuery({
    queryKey: coordinatorKeys.todo(qs),
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch todo');
      return json.data || [];
    },
  });
}

export function useCoordinatorProgramChanges(params: {
  range?: string;
  start?: string | null;
  end?: string | null;
  sources?: string[];
}) {
  const sp = new URLSearchParams();
  if (params.range && params.range !== 'all') sp.set('range', params.range);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  if (params.sources && params.sources.length > 0)
    sp.set('sources', params.sources.join(','));
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
