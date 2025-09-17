import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MemberProgramFinancesFormData } from '@/lib/validations/member-program-finances';
import { memberProgramKeys } from './use-member-programs';

export const memberProgramFinancesKeys = {
  all: ['member-program-finances'] as const,
  byProgram: (programId: number) => [...memberProgramFinancesKeys.all, 'program', programId] as const,
};

export function useMemberProgramFinances(programId: number) {
  return useQuery<any, Error>({
    queryKey: memberProgramFinancesKeys.byProgram(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/finances`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          return null; // No finances record exists yet
        }
        throw new Error(json.error || 'Failed to fetch program finances');
      }
      return json.data;
    },
    enabled: !!programId,
  });
}

export function useCreateMemberProgramFinances() {
  const queryClient = useQueryClient();
  
  return useMutation<any, Error, { programId: number; data: MemberProgramFinancesFormData }>({
    mutationFn: async ({ programId, data }) => {
      const res = await fetch(`/api/member-programs/${programId}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create program finances');
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: memberProgramFinancesKeys.byProgram(variables.programId) });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.list() });
    },
  });
}

export function useUpdateMemberProgramFinances() {
  const queryClient = useQueryClient();
  
  return useMutation<any, Error, { programId: number; data: Partial<MemberProgramFinancesFormData> }>({
    mutationFn: async ({ programId, data }) => {
      const res = await fetch(`/api/member-programs/${programId}/finances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        // Normalize server error into a user-friendly message without crashing
        const message =
          (typeof json?.error === 'string' && json.error) ||
          'Failed to update program finances';
        throw new Error(message);
      }
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: memberProgramFinancesKeys.byProgram(variables.programId) });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.detail(variables.programId) });
      queryClient.invalidateQueries({ queryKey: memberProgramKeys.list() });
    },
    onError: (_err) => {
      // Do not crash the app; caller shows toast and UI stays responsive
    }
  });
}

