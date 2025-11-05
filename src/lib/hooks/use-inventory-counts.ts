import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface InventoryItem {
  inventory_item_id: number;
  therapy_id: number;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  last_counted_at: string | null;
  active_flag: boolean;
  therapy: {
    therapy_id: number;
    therapy_name: string;
    description?: string;
    cost: number;
    charge: number;
    therapy_type: {
      therapy_type_name: string;
    };
  };
}

export interface CountSession {
  count_session_id: number;
  session_number: string;
  session_date: string;
  count_type: 'cycle' | 'full' | 'custom';
  status: 'in_progress' | 'completed' | 'cancelled';
  counted_by: string | null;
  completed_at: string | null;
  notes: string | null;
  items_total: number;
  items_counted: number;
  items_with_variance: number;
  items_pending_approval: number;
  counted_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CountDetail {
  count_detail_id: number;
  count_session_id: number;
  inventory_item_id: number;
  expected_quantity: number;
  physical_quantity: number | null;
  variance: number;
  variance_pct: number;
  notes: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  status: 'pending' | 'counted' | 'approved' | 'rejected' | 'posted';
  inventory_item?: InventoryItem;
  approved_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CountSessionWithDetails extends CountSession {
  details: CountDetail[];
}

// ============================================================================
// Query Keys
// ============================================================================

export const inventoryCountKeys = {
  all: ['inventory-counts'] as const,
  items: () => [...inventoryCountKeys.all, 'items'] as const,
  sessions: () => [...inventoryCountKeys.all, 'sessions'] as const,
  sessionsList: (status?: string) =>
    [...inventoryCountKeys.sessions(), { status }] as const,
  sessionDetail: (id: number) =>
    [...inventoryCountKeys.sessions(), id] as const,
};

// ============================================================================
// Inventory Items
// ============================================================================

export function useInventoryItems() {
  return useQuery({
    queryKey: inventoryCountKeys.items(),
    queryFn: async (): Promise<InventoryItem[]> => {
      const response = await fetch('/api/inventory/items');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch inventory items');
      }
      const { data } = await response.json();
      return data;
    },
  });
}

// ============================================================================
// Count Sessions
// ============================================================================

export function useCountSessions(status?: string) {
  return useQuery({
    queryKey: inventoryCountKeys.sessionsList(status),
    queryFn: async (): Promise<CountSession[]> => {
      const url = status
        ? `/api/inventory/count-sessions?status=${status}`
        : '/api/inventory/count-sessions';
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch count sessions');
      }
      const { data } = await response.json();
      return data;
    },
  });
}

export function useCountSession(id: number | null) {
  return useQuery({
    queryKey: inventoryCountKeys.sessionDetail(id!),
    queryFn: async (): Promise<CountSessionWithDetails> => {
      const response = await fetch(`/api/inventory/count-sessions/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch count session');
      }
      const { data } = await response.json();
      return data;
    },
    enabled: !!id,
  });
}

export function useStartCountSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      count_type: 'cycle' | 'full' | 'custom';
      session_date: string;
      notes?: string;
      selected_item_ids?: number[];
    }) => {
      const response = await fetch('/api/inventory/count-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start count session');
      }

      const { data: session } = await response.json();
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.sessions() });
      toast.success('Count session started successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start count session');
    },
  });
}

export function useUpdateCountSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CountSession>;
    }) => {
      const response = await fetch(`/api/inventory/count-sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update count session');
      }

      const { data: session } = await response.json();
      return session;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: inventoryCountKeys.sessionDetail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.sessions() });
      toast.success('Count session updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update count session');
    },
  });
}

export function useCancelCountSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inventory/count-sessions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel count session');
      }

      const { data: session } = await response.json();
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.sessions() });
      toast.success('Count session cancelled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel count session');
    },
  });
}

// ============================================================================
// Count Details
// ============================================================================

export function useBatchUpdateCountDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      count_session_id: number;
      updates: Array<{
        count_detail_id: number;
        physical_quantity: number;
        notes?: string;
      }>;
    }) => {
      const response = await fetch('/api/inventory/count-details/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update count details');
      }

      const { data: result } = await response.json();
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: inventoryCountKeys.sessionDetail(variables.count_session_id),
      });
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.sessions() });
      toast.success('Count details updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update count details');
    },
  });
}

export function useApproveVariances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      count_session_id: number;
      approvals: Array<{
        count_detail_id: number;
        approved: boolean;
        notes?: string;
      }>;
    }) => {
      const response = await fetch('/api/inventory/count-details/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve variances');
      }

      const { data: result } = await response.json();
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: inventoryCountKeys.sessionDetail(variables.count_session_id),
      });
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.sessions() });
      toast.success('Variances processed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve variances');
    },
  });
}

export function usePostCountSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        `/api/inventory/count-sessions/${id}/post`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post count session');
      }

      const { data } = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: inventoryCountKeys.items() });
      queryClient.invalidateQueries({ queryKey: ['inventory-metrics'] }); // Invalidate dashboard metrics
      toast.success('Count session posted to inventory successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post count session');
    },
  });
}






