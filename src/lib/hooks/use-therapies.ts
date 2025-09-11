import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Therapies } from '@/types/database.types';
import { TherapyFormData, TherapyUpdateData } from '@/lib/validations/therapy';

const therapyKeys = {
  all: ['therapies'] as const,
  list: () => [...therapyKeys.all, 'list'] as const,
  active: () => [...therapyKeys.all, 'active'] as const,
  detail: (id: string) => [...therapyKeys.all, 'detail', id] as const,
};

export function useTherapies() {
  return useQuery<Therapies[], Error>({
    queryKey: therapyKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/therapies');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch therapies');
      return json.data as Therapies[];
    },
  });
}

export function useActiveTherapies() {
  return useQuery<Therapies[], Error>({
    queryKey: therapyKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/therapies');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch therapies');
      return (json.data as Therapies[]).filter(t => t.active_flag);
    },
  });
}

export function useCreateTherapy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TherapyFormData) => {
      const res = await fetch('/api/therapies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create therapy');
      return json.data as Therapies;
    },
    onSuccess: () => {
      toast.success('Therapy created');
      queryClient.invalidateQueries({ queryKey: therapyKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create therapy');
    },
  });
}

export function useUpdateTherapy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapyUpdateData) => {
      const res = await fetch(`/api/therapies/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update therapy');
      return json.data as Therapies;
    },
    onSuccess: () => {
      toast.success('Therapy updated');
      queryClient.invalidateQueries({ queryKey: therapyKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update therapy');
    },
  });
}

export function useDeleteTherapy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/therapies/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete therapy');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: therapyKeys.all });
      const prev = queryClient.getQueryData<Therapies[]>(therapyKeys.list());
      if (prev) {
        queryClient.setQueryData(
          therapyKeys.list(),
          prev.filter(t => t.therapy_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete therapy');
      if (context?.prev) {
        queryClient.setQueryData(therapyKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Therapy deleted');
      queryClient.invalidateQueries({ queryKey: therapyKeys.all });
    },
  });
}
