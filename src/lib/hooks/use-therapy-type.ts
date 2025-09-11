import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TherapyType } from '@/types/database.types';
import {
  TherapyTypeFormData,
  TherapyTypeUpdateData,
} from '@/lib/validations/therapy-type';

const therapyTypeKeys = {
  all: ['therapy-type'] as const,
  list: () => [...therapyTypeKeys.all, 'list'] as const,
  active: () => [...therapyTypeKeys.all, 'active'] as const,
  detail: (id: string) => [...therapyTypeKeys.all, 'detail', id] as const,
};

export function useTherapyTypes() {
  return useQuery<TherapyType[], Error>({
    queryKey: therapyTypeKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/therapy-type');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch therapy types');
      return json.data as TherapyType[];
    },
  });
}

export function useActiveTherapyTypes() {
  return useQuery<TherapyType[], Error>({
    queryKey: therapyTypeKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/therapy-type');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch therapy types');
      return (json.data as TherapyType[]).filter(t => t.active_flag);
    },
  });
}

export function useCreateTherapyType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TherapyTypeFormData) => {
      const res = await fetch('/api/therapy-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create therapy type');
      return json.data as TherapyType;
    },
    onSuccess: () => {
      toast.success('Therapy type created');
      queryClient.invalidateQueries({ queryKey: therapyTypeKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create therapy type');
    },
  });
}

export function useUpdateTherapyType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapyTypeUpdateData) => {
      const res = await fetch(`/api/therapy-type/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update therapy type');
      return json.data as TherapyType;
    },
    onSuccess: () => {
      toast.success('Therapy type updated');
      queryClient.invalidateQueries({ queryKey: therapyTypeKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update therapy type');
    },
  });
}

export function useDeleteTherapyType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/therapy-type/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete therapy type');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: therapyTypeKeys.all });
      const prev = queryClient.getQueryData<TherapyType[]>(
        therapyTypeKeys.list()
      );
      if (prev) {
        queryClient.setQueryData(
          therapyTypeKeys.list(),
          prev.filter(t => t.therapy_type_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete therapy type');
      if (context?.prev) {
        queryClient.setQueryData(therapyTypeKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Therapy type deleted');
      queryClient.invalidateQueries({ queryKey: therapyTypeKeys.all });
    },
  });
}
