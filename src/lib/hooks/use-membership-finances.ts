import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MemberProgramMembershipFinancesFormData,
  MemberProgramMembershipFinancesUpdateData 
} from '@/lib/validations/member-program-membership-finances';
import { memberProgramKeys } from './use-member-programs';

export const membershipFinancesKeys = {
  all: ['membership-finances'] as const,
  byProgram: (programId: number) =>
    [...membershipFinancesKeys.all, 'program', programId] as const,
};

/**
 * Fetch membership finances for a membership program
 * Returns null if no record exists yet (not an error)
 */
export function useMembershipFinances(programId: number, enabled = true) {
  return useQuery<any, Error>({
    queryKey: membershipFinancesKeys.byProgram(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/membership-finances`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          return null; // No membership finances record exists yet
        }
        throw new Error(json.error || 'Failed to fetch membership finances');
      }
      return json.data;
    },
    enabled: !!programId && enabled,
  });
}

/**
 * Create membership finances record for a program
 * Should be called when membership program is activated
 */
export function useCreateMembershipFinances() {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { programId: number; data: Omit<MemberProgramMembershipFinancesFormData, 'member_program_id'> }
  >({
    mutationFn: async ({ programId, data }) => {
      const res = await fetch(`/api/member-programs/${programId}/membership-finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create membership finances');
      }
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: membershipFinancesKeys.byProgram(variables.programId),
      });
      queryClient.invalidateQueries({
        queryKey: memberProgramKeys.detail(variables.programId),
      });
    },
  });
}

/**
 * Update membership finances record
 */
export function useUpdateMembershipFinances() {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { programId: number; data: MemberProgramMembershipFinancesUpdateData }
  >({
    mutationFn: async ({ programId, data }) => {
      const res = await fetch(`/api/member-programs/${programId}/membership-finances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          (typeof json?.error === 'string' && json.error) ||
          'Failed to update membership finances';
        throw new Error(message);
      }
      return json.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: membershipFinancesKeys.byProgram(variables.programId),
      });
      queryClient.invalidateQueries({
        queryKey: memberProgramKeys.detail(variables.programId),
      });
    },
    onError: _err => {
      // Do not crash the app; caller shows toast and UI stays responsive
    },
  });
}

