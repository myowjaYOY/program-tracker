import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PaymentStatus } from '@/types/database.types';
import {
  PaymentStatusFormData,
  PaymentStatusUpdateData,
} from '@/lib/validations/payment-status';

const paymentStatusKeys = {
  all: ['payment-status'] as const,
  list: () => [...paymentStatusKeys.all, 'list'] as const,
  active: () => [...paymentStatusKeys.all, 'active'] as const,
  detail: (id: string) => [...paymentStatusKeys.all, 'detail', id] as const,
};

export function usePaymentStatus() {
  return useQuery<PaymentStatus[], Error>({
    queryKey: paymentStatusKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/payment-status');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch payment status');
      return json.data as PaymentStatus[];
    },
  });
}

export function useActivePaymentStatus() {
  return useQuery<PaymentStatus[], Error>({
    queryKey: paymentStatusKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/payment-status');
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch payment status');
      return (json.data as PaymentStatus[]).filter(
        status => status.active_flag
      );
    },
  });
}

export function useCreatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation<PaymentStatus, Error, PaymentStatusFormData>({
    mutationFn: async data => {
      const res = await fetch('/api/payment-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to create payment status');
      return json.data as PaymentStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentStatusKeys.all });
      toast.success('Payment status created successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to create payment status');
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentStatus,
    Error,
    { id: string; data: PaymentStatusUpdateData }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/payment-status/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to update payment status');
      return json.data as PaymentStatus;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentStatusKeys.all });
      queryClient.invalidateQueries({
        queryKey: paymentStatusKeys.detail(variables.id),
      });
      toast.success('Payment status updated successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to update payment status');
    },
  });
}

export function useDeletePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async id => {
      const res = await fetch(`/api/payment-status/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete payment status');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentStatusKeys.all });
      toast.success('Payment status deleted successfully');
    },
    onError: error => {
      toast.error(error.message || 'Failed to delete payment status');
    },
  });
}
