import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PaymentMethods } from '@/types/database.types';
import { PaymentMethodsFormData, PaymentMethodsUpdateData } from '@/lib/validations/payment-methods';

const paymentMethodsKeys = {
  all: ['payment-methods'] as const,
  list: () => [...paymentMethodsKeys.all, 'list'] as const,
  active: () => [...paymentMethodsKeys.all, 'active'] as const,
  detail: (id: string) => [...paymentMethodsKeys.all, 'detail', id] as const,
};

export function usePaymentMethods() {
  return useQuery<PaymentMethods[], Error>({
    queryKey: paymentMethodsKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/payment-methods');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch payment methods');
      return json.data as PaymentMethods[];
    },
  });
}

export function useActivePaymentMethods() {
  return useQuery<PaymentMethods[], Error>({
    queryKey: paymentMethodsKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/payment-methods');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch payment methods');
      return (json.data as PaymentMethods[]).filter(method => method.active_flag);
    },
  });
}

export function useCreatePaymentMethods() {
  const queryClient = useQueryClient();
  
  return useMutation<PaymentMethods, Error, PaymentMethodsFormData>({
    mutationFn: async (data) => {
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create payment method');
      return json.data as PaymentMethods;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.all });
      toast.success('Payment method created successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create payment method');
    },
  });
}

export function useUpdatePaymentMethods() {
  const queryClient = useQueryClient();
  
  return useMutation<PaymentMethods, Error, { id: string; data: PaymentMethodsUpdateData }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update payment method');
      return json.data as PaymentMethods;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.detail(variables.id) });
      toast.success('Payment method updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update payment method');
    },
  });
}

export function useDeletePaymentMethods() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete payment method');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.all });
      toast.success('Payment method deleted successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete payment method');
    },
  });
}

