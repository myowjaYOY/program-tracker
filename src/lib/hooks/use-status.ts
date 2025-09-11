import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Status } from '@/types/database.types';
import { StatusFormData, StatusUpdateData } from '@/lib/validations/status';

const statusKeys = {
  all: ['status'] as const,
  list: () => [...statusKeys.all, 'list'] as const,
  active: () => [...statusKeys.all, 'active'] as const,
  detail: (id: string) => [...statusKeys.all, 'detail', id] as const,
};

export function useStatus() {
  return useQuery<Status[], Error>({
    queryKey: statusKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/status', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch status');
      return json.data as Status[];
    },
  });
}

export function useActiveStatus() {
  return useQuery<Status[], Error>({
    queryKey: statusKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/status', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch status');
      return (json.data as Status[]).filter(s => s.active_flag);
    },
  });
}

export function useCreateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: StatusFormData) => {
      const res = await fetch('/api/status', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create status');
      return json.data as Status;
    },
    onSuccess: () => {
      toast.success('Status created');
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create status');
    },
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StatusUpdateData) => {
      const res = await fetch(`/api/status/${input.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update status');
      return json.data as Status;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update status');
    },
  });
}

export function useDeleteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/status/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete status');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: statusKeys.all });
      const prev = queryClient.getQueryData<Status[]>(statusKeys.list());
      if (prev) {
        queryClient.setQueryData(
          statusKeys.list(),
          prev.filter(s => s.status_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete status');
      if (context?.prev) {
        queryClient.setQueryData(statusKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Status deleted');
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
    },
  });
}
