import { useQuery } from '@tanstack/react-query';

export const paymentsKeys = {
  all: ['payments'] as const,
  list: (params: string) => [...paymentsKeys.all, 'list', params] as const,
  metrics: () => [...paymentsKeys.all, 'metrics'] as const,
};

export interface PaymentMetrics {
  totalAmountOwed: number;
  totalAmountDue: number;
  totalAmountLate: number;
  totalAmountCancelled: number;
  membersWithPaymentsDue: number;
  latePaymentsBreakdown: Array<{
    memberId: number;
    memberName: string;
    amount: number;
  }>;
  cancelledPaymentsBreakdown: Array<{
    memberId: number;
    memberName: string;
    amount: number;
  }>;
}

export function usePayments(params?: {
  memberId?: number | null;
  showAllPayments?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params?.memberId) sp.set('memberId', String(params.memberId));
  // Default behavior: show only pending. When showAllPayments is true, show all.
  if (!params?.showAllPayments) sp.set('pendingOnly', 'true');
  const qs = sp.toString();
  const url = `/api/payments${qs ? `?${qs}` : ''}`;

  return useQuery({
    queryKey: paymentsKeys.list(qs),
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch payments');
      return Array.isArray(json.data) ? json.data : [];
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

export function usePaymentMetrics() {
  return useQuery({
    queryKey: paymentsKeys.metrics(),
    queryFn: async () => {
      const res = await fetch('/api/payments/metrics', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch payment metrics');
      return json.data as PaymentMetrics;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

