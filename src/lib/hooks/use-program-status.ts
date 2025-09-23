import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ProgramStatus } from '@/types/database.types';
import {
  ProgramStatusFormData,
  ProgramStatusUpdateData,
} from '@/lib/validations/program-status';

const programStatusKeys = {
  all: ['program-status'] as const,
  list: () => [...programStatusKeys.all, 'list'] as const,
  active: () => [...programStatusKeys.all, 'active'] as const,
  detail: (id: string) => [...programStatusKeys.all, 'detail', id] as const,
};

export function useProgramStatus() {
  return useQuery<ProgramStatus[], Error>({
    queryKey: programStatusKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/program-status');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program status');
      return json.data as ProgramStatus[];
    },
  });
}

export function useActiveProgramStatus() {
  return useQuery<ProgramStatus[], Error>({
    queryKey: programStatusKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/program-status');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program status');
      return (json.data as ProgramStatus[])
        .filter(ps => ps.active_flag)
        .sort((a, b) =>
          a.status_name.localeCompare(b.status_name, undefined, {
            sensitivity: 'accent',
          })
        );
    },
  });
}

export function useCreateProgramStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProgramStatusFormData) => {
      const res = await fetch('/api/program-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create program status');
      return json.data as ProgramStatus;
    },
    onSuccess: () => {
      toast.success('Program status created');
      queryClient.invalidateQueries({ queryKey: programStatusKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create program status');
    },
  });
}

export function useUpdateProgramStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProgramStatusUpdateData) => {
      const res = await fetch(`/api/program-status/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update program status');
      return json.data as ProgramStatus;
    },
    onSuccess: () => {
      toast.success('Program status updated');
      queryClient.invalidateQueries({ queryKey: programStatusKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update program status');
    },
  });
}

export function useDeleteProgramStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/program-status/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete program status');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: programStatusKeys.all });
      const prev = queryClient.getQueryData<ProgramStatus[]>(
        programStatusKeys.list()
      );
      if (prev) {
        queryClient.setQueryData(
          programStatusKeys.list(),
          prev.filter(ps => ps.program_status_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete program status');
      if (context?.prev) {
        queryClient.setQueryData(programStatusKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Program status deleted');
      queryClient.invalidateQueries({ queryKey: programStatusKeys.all });
    },
  });
}
