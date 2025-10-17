import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RashaList } from '@/types/database.types';
import { RashaListFormData, RashaListUpdateData } from '@/lib/validations/rasha-list';

const rashaListKeys = {
  all: ['rasha-list'] as const,
  list: () => [...rashaListKeys.all, 'list'] as const,
  active: () => [...rashaListKeys.all, 'active'] as const,
  detail: (id: string) => [...rashaListKeys.all, 'detail', id] as const,
};

export function useRashaLists() {
  return useQuery<RashaList[], Error>({
    queryKey: rashaListKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/rasha-list');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch RASHA list');
      return json.data as RashaList[];
    },
  });
}

export function useActiveRashaLists() {
  return useQuery<RashaList[], Error>({
    queryKey: rashaListKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/rasha-list');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch RASHA list');
      return (json.data as RashaList[]).filter(item => item.active_flag);
    },
  });
}

export function useCreateRashaList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RashaListFormData) => {
      const res = await fetch('/api/rasha-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create RASHA item');
      return json.data as RashaList;
    },
    onSuccess: () => {
      toast.success('RASHA item created');
      queryClient.invalidateQueries({ queryKey: rashaListKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create RASHA item');
    },
  });
}

export function useUpdateRashaList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RashaListUpdateData) => {
      const res = await fetch(`/api/rasha-list/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update RASHA item');
      return json.data as RashaList;
    },
    onSuccess: () => {
      toast.success('RASHA item updated');
      queryClient.invalidateQueries({ queryKey: rashaListKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update RASHA item');
    },
  });
}

export function useDeleteRashaList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rasha-list/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete RASHA item');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: rashaListKeys.all });
      const prev = queryClient.getQueryData<RashaList[]>(rashaListKeys.list());
      if (prev) {
        queryClient.setQueryData(
          rashaListKeys.list(),
          prev.filter(item => item.rasha_list_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete RASHA item');
      if (context?.prev) {
        queryClient.setQueryData(rashaListKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('RASHA item deleted');
      queryClient.invalidateQueries({ queryKey: rashaListKeys.all });
    },
  });
}

