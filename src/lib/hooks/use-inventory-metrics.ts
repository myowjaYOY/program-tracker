import { useQuery } from '@tanstack/react-query';

export interface InventoryMetrics {
  pending_approval_count: number;
  awaiting_receipt_count: number;
  open_po_value: number;
  low_stock_count: number;
}

export const inventoryMetricsKeys = {
  all: ['inventory-metrics'] as const,
};

export function useInventoryMetrics() {
  return useQuery({
    queryKey: inventoryMetricsKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/inventory-management/metrics');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch inventory metrics');
      return json.data as InventoryMetrics;
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

