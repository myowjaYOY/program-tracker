import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MemberProgramRasha } from '@/types/database.types';
import { toast } from 'sonner';

export const memberProgramRashaKeys = {
  all: ['member-program-rasha'] as const,
  list: () => [...memberProgramRashaKeys.all, 'list'] as const,
  byProgram: (programId: number) =>
    [...memberProgramRashaKeys.all, 'by-program', programId] as const,
  detail: (id: number) =>
    [...memberProgramRashaKeys.all, 'detail', id] as const,
};

export function useMemberProgramRashaItems(programId: number) {
  return useQuery<MemberProgramRasha[], Error>({
    queryKey: memberProgramRashaKeys.byProgram(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/rasha`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch member program RASHA items');
      return json.data as MemberProgramRasha[];
    },
    enabled: !!programId,
  });
}

export function useCreateMemberProgramRashaItem() {
  const queryClient = useQueryClient();

  return useMutation<
    MemberProgramRasha,
    Error,
    Partial<MemberProgramRasha> & { member_program_id: number }
  >({
    mutationFn: async data => {
      const res = await fetch(
        `/api/member-programs/${data.member_program_id}/rasha`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create member program RASHA item');
      return json.data as MemberProgramRasha;
    },
    onSuccess: data => {
      if (data.member_program_id) {
        queryClient.invalidateQueries({
          queryKey: memberProgramRashaKeys.byProgram(data.member_program_id),
        });
      }
      toast.success('RASHA item added to program successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to add RASHA item to program');
    },
  });
}

export function useUpdateMemberProgramRashaItem() {
  const queryClient = useQueryClient();

  return useMutation<
    MemberProgramRasha,
    Error,
    { programId: number; rashaId: number; data: Partial<MemberProgramRasha> }
  >({
    mutationFn: async ({ programId, rashaId, data }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/rasha/${rashaId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update member program RASHA item');
      return json.data as MemberProgramRasha;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramRashaKeys.byProgram(variables.programId),
      });
      toast.success('RASHA item updated successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to update RASHA item');
    },
  });
}

export function useDeleteMemberProgramRashaItem() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { programId: number; rashaId: number }
  >({
    mutationFn: async ({ programId, rashaId }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/rasha/${rashaId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to delete member program RASHA item');
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramRashaKeys.byProgram(variables.programId),
      });
      toast.success('RASHA item removed from program successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to remove RASHA item from program');
    },
  });
}

