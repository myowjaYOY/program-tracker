import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryMetricsKeys } from './use-inventory-metrics';
import { PurchaseOrderFormData, PurchaseOrderUpdateData } from '@/lib/validations/purchase-orders';

interface PurchaseOrder {
  po_id: number;
  po_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  subtotal_cost: number;
  tax_amount: number;
  shipping_cost: number;
  total_cost: number;
  notes: string | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  active_flag: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  created_by_email: string | null;
  created_by_full_name: string | null;
  updated_by_email: string | null;
  updated_by_full_name: string | null;
  item_count: number;
  total_ordered: number;
  total_received: number;
}

const purchaseOrderKeys = {
  all: ['purchase-orders'] as const,
  list: () => [...purchaseOrderKeys.all, 'list'] as const,
  active: () => [...purchaseOrderKeys.all, 'active'] as const,
  detail: (id: string) => [...purchaseOrderKeys.all, 'detail', id] as const,
};

export function usePurchaseOrders() {
  return useQuery<PurchaseOrder[], Error>({
    queryKey: purchaseOrderKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/purchase-orders');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch purchase orders');
      return json.data as PurchaseOrder[];
    },
  });
}

export function useActivePurchaseOrders() {
  return useQuery<PurchaseOrder[], Error>({
    queryKey: purchaseOrderKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/purchase-orders');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch purchase orders');
      return (json.data as PurchaseOrder[]).filter(po =>
        ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received'].includes(po.status)
      );
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create purchase order');
      return json.data as PurchaseOrder;
    },
    onSuccess: () => {
      toast.success('Purchase order created successfully');
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryMetricsKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create purchase order');
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PurchaseOrderUpdateData) => {
      const res = await fetch(`/api/purchase-orders/${input.po_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update purchase order');
      return json.data as PurchaseOrder;
    },
    onSuccess: () => {
      toast.success('Purchase order updated successfully');
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryMetricsKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update purchase order');
    },
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/purchase-orders/${id}/approve`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to approve purchase order');
      return json.data as PurchaseOrder;
    },
    onSuccess: () => {
      toast.success('Purchase order approved successfully');
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryMetricsKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve purchase order');
    },
  });
}

export function useOrderPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/purchase-orders/${id}/order`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to order purchase order');
      return json.data as PurchaseOrder;
    },
    onSuccess: () => {
      toast.success('Purchase order marked as ordered successfully');
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryMetricsKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to order purchase order');
    },
  });
}

export interface ReceiveItem {
  po_item_id: number;
  quantity_receiving: number;
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { po_id: number; items: ReceiveItem[] }) => {
      const res = await fetch(`/api/purchase-orders/${data.po_id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data.items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to receive purchase order items');
      return json.data as PurchaseOrder;
    },
    onSuccess: () => {
      toast.success('Items received successfully');
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryMetricsKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to receive items');
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete purchase order');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: purchaseOrderKeys.all });
      const prev = queryClient.getQueryData<PurchaseOrder[]>(purchaseOrderKeys.list());
      if (prev) {
        queryClient.setQueryData(
          purchaseOrderKeys.list(),
          prev.filter(po => po.po_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete purchase order');
      if (context?.prev) {
        queryClient.setQueryData(purchaseOrderKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Purchase order deleted successfully');
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
  });
}
