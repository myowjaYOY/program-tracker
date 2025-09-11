import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bodies } from '@/types/database.types';
import { BodyFormData, BodyUpdateData } from '@/lib/validations/body';

const bodyKeys = {
  all: ['bodies'] as const,
  list: () => [...bodyKeys.all, 'list'] as const,
  active: () => [...bodyKeys.all, 'active'] as const,
  detail: (id: string) => [...bodyKeys.all, 'detail', id] as const,
};

export function useBodies() {
  return useQuery<Bodies[], Error>({
    queryKey: bodyKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/bodies');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch bodies');
      return json.data as Bodies[];
    },
  });
}

export function useActiveBodies() {
  return useQuery<Bodies[], Error>({
    queryKey: bodyKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/bodies');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch bodies');
      return (json.data as Bodies[]).filter(b => b.active_flag);
    },
  });
}

export function useCreateBody() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BodyFormData) => {
      const res = await fetch('/api/bodies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create body');
      return json.data as Bodies;
    },
    onSuccess: () => {
      toast.success('Body created');
      queryClient.invalidateQueries({ queryKey: bodyKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create body');
    },
  });
}

export function useUpdateBody() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BodyUpdateData) => {
      const res = await fetch(`/api/bodies/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update body');
      return json.data as Bodies;
    },
    onSuccess: () => {
      toast.success('Body updated');
      queryClient.invalidateQueries({ queryKey: bodyKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update body');
    },
  });
}

export function useDeleteBody() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bodies/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete body');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: bodyKeys.all });
      const prev = queryClient.getQueryData<Bodies[]>(bodyKeys.list());
      if (prev) {
        queryClient.setQueryData(
          bodyKeys.list(),
          prev.filter(b => b.body_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete body');
      if (context?.prev) {
        queryClient.setQueryData(bodyKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Body deleted');
      queryClient.invalidateQueries({ queryKey: bodyKeys.all });
    },
  });
}
