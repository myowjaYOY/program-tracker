import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TherapyTasks } from '@/types/database.types';
import {
  TherapyTaskFormData,
  TherapyTaskUpdateData,
} from '@/lib/validations/therapy-task';

const therapyTaskKeys = {
  all: ['therapy-tasks'] as const,
  list: () => [...therapyTaskKeys.all, 'list'] as const,
  active: () => [...therapyTaskKeys.all, 'active'] as const,
  detail: (id: string) => [...therapyTaskKeys.all, 'detail', id] as const,
};

export function useTherapyTasks() {
  return useQuery<TherapyTasks[], Error>({
    queryKey: therapyTaskKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/therapy-tasks');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch therapy tasks');
      return json.data as TherapyTasks[];
    },
  });
}

export function useActiveTherapyTasks() {
  return useQuery<TherapyTasks[], Error>({
    queryKey: therapyTaskKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/therapy-tasks');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch therapy tasks');
      return (json.data as TherapyTasks[]).filter(t => t.active_flag);
    },
  });
}

export function useTherapyTasksByTherapy(therapyId?: number) {
  return useQuery<TherapyTasks[], Error>({
    queryKey: [...therapyTaskKeys.all, 'by-therapy', therapyId],
    queryFn: async () => {
      const res = await fetch('/api/therapy-tasks');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch therapy tasks');
      const allTasks = json.data as TherapyTasks[];
      return therapyId
        ? allTasks.filter(t => t.therapy_id === therapyId && t.active_flag)
        : allTasks;
    },
    enabled: !!therapyId,
  });
}

export function useCreateTherapyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TherapyTaskFormData) => {
      const res = await fetch('/api/therapy-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create therapy task');
      return json.data as TherapyTasks;
    },
    onSuccess: () => {
      toast.success('Therapy task created');
      queryClient.invalidateQueries({ queryKey: therapyTaskKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create therapy task');
    },
  });
}

export function useUpdateTherapyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapyTaskUpdateData & { id: string }) => {
      const res = await fetch(`/api/therapy-tasks/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update therapy task');
      return json.data as TherapyTasks;
    },
    onSuccess: () => {
      toast.success('Therapy task updated');
      queryClient.invalidateQueries({ queryKey: therapyTaskKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update therapy task');
    },
  });
}

export function useDeleteTherapyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/therapy-tasks/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete therapy task');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: therapyTaskKeys.all });
      const prev = queryClient.getQueryData<TherapyTasks[]>(
        therapyTaskKeys.list()
      );
      if (prev) {
        queryClient.setQueryData(
          therapyTaskKeys.list(),
          prev.filter(t => t.task_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete therapy task');
      if (context?.prev) {
        queryClient.setQueryData(therapyTaskKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Therapy task deleted');
      queryClient.invalidateQueries({ queryKey: therapyTaskKeys.all });
    },
  });
}
