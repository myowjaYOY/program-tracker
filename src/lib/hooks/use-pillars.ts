import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pillars } from '@/types/database.types';
import { PillarFormData, PillarUpdateData } from '@/lib/validations/pillar';

const pillarKeys = {
  all: ['pillars'] as const,
  list: () => [...pillarKeys.all, 'list'] as const,
  active: () => [...pillarKeys.all, 'active'] as const,
  detail: (id: string) => [...pillarKeys.all, 'detail', id] as const,
};

export function usePillars() {
  return useQuery<Pillars[], Error>({
    queryKey: pillarKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/pillars');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch pillars');
      return json.data as Pillars[];
    },
  });
}

export function useActivePillars() {
  return useQuery<Pillars[], Error>({
    queryKey: pillarKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/pillars');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch pillars');
      return (json.data as Pillars[]).filter(p => p.active_flag);
    },
  });
}

export function useCreatePillar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PillarFormData) => {
      const res = await fetch('/api/pillars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create pillar');
      return json.data as Pillars;
    },
    onSuccess: () => {
      toast.success('Pillar created');
      queryClient.invalidateQueries({ queryKey: pillarKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create pillar');
    },
  });
}

export function useUpdatePillar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PillarUpdateData) => {
      const res = await fetch(`/api/pillars/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update pillar');
      return json.data as Pillars;
    },
    onSuccess: () => {
      toast.success('Pillar updated');
      queryClient.invalidateQueries({ queryKey: pillarKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update pillar');
    },
  });
}

export function useDeletePillar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pillars/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete pillar');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: pillarKeys.all });
      const prev = queryClient.getQueryData<Pillars[]>(pillarKeys.list());
      if (prev) {
        queryClient.setQueryData(
          pillarKeys.list(),
          prev.filter(b => b.pillar_id !== parseInt(id))
        );
      }
      return { prev };
    },

    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete pillar');
      if (context?.prev) {
        queryClient.setQueryData(pillarKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Pillar deleted');
      queryClient.invalidateQueries({ queryKey: pillarKeys.all });
    },
  });
}
