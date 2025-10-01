import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MemberProgramPayments } from '@/types/database.types';
import { toast } from 'sonner';
import {
  MemberProgramPaymentsFormData,
  MemberProgramPaymentsUpdateData,
} from '@/lib/validations/member-program-payments';

export const memberProgramPaymentKeys = {
  all: ['member-program-payments'] as const,
  byProgram: (programId: number) =>
    [...memberProgramPaymentKeys.all, 'by-program', programId] as const,
};

export function useMemberProgramPayments(programId: number) {
  return useQuery<MemberProgramPayments[], Error>({
    queryKey: memberProgramPaymentKeys.byProgram(programId),
    queryFn: async () => {
      const res = await fetch(`/api/member-programs/${programId}/payments`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch program payments');
      return json.data as MemberProgramPayments[];
    },
    enabled: !!programId,
  });
}

export function useRegenerateMemberProgramPayments() {
  const queryClient = useQueryClient();
  return useMutation<{ success?: boolean }, Error, { programId: number }>({
    mutationFn: async ({ programId }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/payments/regenerate`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to regenerate payments');
      return json.data;
    },
    onSuccess: (_data, { programId }) => {
      queryClient.invalidateQueries({
        queryKey: memberProgramPaymentKeys.byProgram(programId),
      });
    },
  });
}

export function useCreateMemberProgramPayment(programId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    MemberProgramPayments,
    Error,
    MemberProgramPaymentsFormData
  >({
    mutationFn: async data => {
      const res = await fetch(`/api/member-programs/${programId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create payment');
      return json.data as MemberProgramPayments;
    },
    onSuccess: () => {
      toast.success('Payment created successfully');
      queryClient.invalidateQueries({
        queryKey: memberProgramPaymentKeys.byProgram(programId),
      });
    },
    onError: err => {
      toast.error(err.message || 'Failed to create payment');
    },
  });
}

export function useUpdateMemberProgramPayment(programId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    MemberProgramPayments,
    Error,
    MemberProgramPaymentsUpdateData & { id: number }
  >({
    mutationFn: async ({ id, ...data }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/payments/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update payment');
      return json.data as MemberProgramPayments;
    },
    onSuccess: () => {
      toast.success('Payment updated successfully');
      queryClient.invalidateQueries({
        queryKey: memberProgramPaymentKeys.byProgram(programId),
      });
    },
    onError: err => {
      toast.error(err.message || 'Failed to update payment');
    },
  });
}

export function useDeleteMemberProgramPayment(programId: number) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: number }>({
    mutationFn: async ({ id }) => {
      const res = await fetch(
        `/api/member-programs/${programId}/payments/${id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete payment');
      return json as { success: boolean };
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({
        queryKey: memberProgramPaymentKeys.byProgram(programId),
      });
      const prev = queryClient.getQueryData<MemberProgramPayments[]>(
        memberProgramPaymentKeys.byProgram(programId)
      );
      if (prev) {
        queryClient.setQueryData<MemberProgramPayments[]>(
          memberProgramPaymentKeys.byProgram(programId),
          prev.filter(p => p.member_program_payment_id !== id)
        );
      }
      return { prev } as { prev?: MemberProgramPayments[] };
    },
    onError: (err, _vars, context) => {
      if (context && typeof context === 'object' && 'prev' in context && context.prev) {
        queryClient.setQueryData(
          memberProgramPaymentKeys.byProgram(programId),
          context.prev
        );
      }
      toast.error(err.message || 'Failed to delete payment');
    },
    onSuccess: () => {
      toast.success('Payment deleted successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: memberProgramPaymentKeys.byProgram(programId),
      });
    },
  });
}

export function useBatchUpdateMemberProgramPayments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ programId, paymentUpdates }: { programId: number; paymentUpdates: any[] }) => {
      const res = await fetch(`/api/member-programs/${programId}/payments/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ paymentUpdates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to batch update payments');
      return json.data;
    },
    onSuccess: (_, { programId }) => {
      toast.success('Payments updated successfully');
      queryClient.invalidateQueries({
        queryKey: memberProgramPaymentKeys.byProgram(programId),
      });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update payments');
    },
  });
}