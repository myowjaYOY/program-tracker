import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ProgramRoles } from '@/types/database.types';
import {
  ProgramRolesFormData,
  ProgramRolesUpdateData,
} from '@/lib/validations/program-roles';

const programRolesKeys = {
  all: ['program-roles'] as const,
  list: () => [...programRolesKeys.all, 'list'] as const,
  active: () => [...programRolesKeys.all, 'active'] as const,
  detail: (id: string) => [...programRolesKeys.all, 'detail', id] as const,
};

export function useProgramRoles() {
  return useQuery<ProgramRoles[], Error>({
    queryKey: programRolesKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/program-roles');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program roles');
      return json.data as ProgramRoles[];
    },
  });
}

export function useActiveProgramRoles() {
  return useQuery<ProgramRoles[], Error>({
    queryKey: programRolesKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/program-roles');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program roles');
      return (json.data as ProgramRoles[])
        .filter(pr => pr.active_flag)
        .sort((a, b) => a.display_order - b.display_order);
    },
  });
}

export function useCreateProgramRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProgramRolesFormData) => {
      const res = await fetch('/api/program-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create program role');
      return json.data as ProgramRoles;
    },
    onSuccess: () => {
      toast.success('Program role created');
      queryClient.invalidateQueries({ queryKey: programRolesKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create program role');
    },
  });
}

export function useUpdateProgramRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProgramRolesUpdateData) => {
      const res = await fetch(`/api/program-roles/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update program role');
      return json.data as ProgramRoles;
    },
    onSuccess: () => {
      toast.success('Program role updated');
      queryClient.invalidateQueries({ queryKey: programRolesKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update program role');
    },
  });
}

export function useDeleteProgramRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/program-roles/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete program role');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: programRolesKeys.all });
      const prev = queryClient.getQueryData<ProgramRoles[]>(
        programRolesKeys.list()
      );
      if (prev) {
        queryClient.setQueryData(
          programRolesKeys.list(),
          prev.filter(pr => pr.program_role_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete program role');
      if (context?.prev) {
        queryClient.setQueryData(programRolesKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Program role deleted');
      queryClient.invalidateQueries({ queryKey: programRolesKeys.all });
    },
  });
}


