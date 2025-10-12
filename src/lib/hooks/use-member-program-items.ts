import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MemberProgramItems } from '@/types/database.types';
import { memberProgramKeys } from './use-member-programs';
import { memberProgramFinancesKeys } from './use-member-program-finances';

export const memberProgramItemKeys = {
  all: ['member-program-items'] as const,
  list: () => [...memberProgramItemKeys.all, 'list'] as const,
  byProgram: (programId: number) =>
    [...memberProgramItemKeys.all, 'by-program', programId] as const,
  detail: (id: number) => [...memberProgramItemKeys.all, 'detail', id] as const,
};

export function useMemberProgramItems(programId: number) {
  return useQuery<MemberProgramItems[], Error>({
    queryKey: memberProgramItemKeys.byProgram(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/items`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch member program items');
      return json.data as MemberProgramItems[];
    },
    enabled: !!programId,
  });
}

export function useCreateMemberProgramItem() {
  const queryClient = useQueryClient();

  return useMutation<
    MemberProgramItems,
    Error,
    Partial<MemberProgramItems> & { member_program_id: number }
  >({
    mutationFn: async data => {
      const res = await fetch(
        `/api/member-programs/${data.member_program_id}/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        const error = new Error(json.error || 'Failed to create member program item');
        (error as any).status = res.status;
        throw error;
      }
      return json.data as MemberProgramItems;
    },
    onSuccess: data => {
      if (data.member_program_id) {
        queryClient.invalidateQueries({
          queryKey: memberProgramItemKeys.byProgram(data.member_program_id),
        });
        // Also invalidate the member program to update calculated fields
        queryClient.invalidateQueries({
          queryKey: memberProgramKeys.detail(data.member_program_id),
        });
        // Invalidate finances to update variance and margin calculations
        queryClient.invalidateQueries({
          queryKey: memberProgramFinancesKeys.byProgram(data.member_program_id),
        });
      }
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.list() });
    },
  });
}

export function useUpdateMemberProgramItem() {
  const queryClient = useQueryClient();

  return useMutation<
    MemberProgramItems,
    Error,
    { programId: number; itemId: number; data: Partial<MemberProgramItems> }
  >({
    mutationFn: async ({ programId, itemId, data }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/items/${itemId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        const error = new Error(json.error || 'Failed to update member program item');
        (error as any).status = res.status;
        throw error;
      }
      return json.data as MemberProgramItems;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramItemKeys.byProgram(variables.programId),
      });
      queryClient.invalidateQueries({
        queryKey: memberProgramItemKeys.detail(variables.itemId),
      });
      // Also invalidate the member program to update calculated fields
      queryClient.invalidateQueries({
        queryKey: memberProgramKeys.detail(variables.programId),
      });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.list() });
      // Invalidate finances to update variance and margin calculations
      queryClient.invalidateQueries({
        queryKey: memberProgramFinancesKeys.byProgram(variables.programId),
      });
    },
  });
}

export function useDeleteMemberProgramItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { programId: number; itemId: number }>({
    mutationFn: async ({ programId, itemId }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/items/${itemId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (!res.ok) {
        const json = await res.json();
        const error = new Error(json.error || 'Failed to delete member program item');
        (error as any).status = res.status;
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramItemKeys.byProgram(variables.programId),
      });
      queryClient.invalidateQueries({
        queryKey: memberProgramItemKeys.detail(variables.itemId),
      });
      // Also invalidate the member program to update calculated fields
      queryClient.invalidateQueries({
        queryKey: memberProgramKeys.detail(variables.programId),
      });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.list() });
      // Invalidate finances to update variance and margin calculations
      queryClient.invalidateQueries({
        queryKey: memberProgramFinancesKeys.byProgram(variables.programId),
      });
    },
  });
}
