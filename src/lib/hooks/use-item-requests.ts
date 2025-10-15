import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ItemRequest } from '@/types/database.types';
import type {
  ItemRequestFormData,
  ItemRequestUpdateData,
  CancelItemRequestData,
} from '@/lib/validations/item-requests';

// Query keys for cache management
export const itemRequestKeys = {
  all: ['item-requests'] as const,
  lists: () => [...itemRequestKeys.all, 'list'] as const,
  list: (filters?: string) => [...itemRequestKeys.lists(), filters] as const,
  details: () => [...itemRequestKeys.all, 'detail'] as const,
  detail: (id: number) => [...itemRequestKeys.details(), id] as const,
  metrics: () => [...itemRequestKeys.all, 'metrics'] as const,
};

// Fetch all item requests with optional filters
export function useItemRequests(params?: {
  status?: ('Pending' | 'Ordered' | 'Received' | 'Cancelled')[] | null;
  requestedBy?: string | null;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status && params.status.length > 0) {
    queryParams.append('status', params.status.join(','));
  }
  if (params?.requestedBy) {
    queryParams.append('requestedBy', params.requestedBy);
  }

  const queryString = queryParams.toString();
  const url = `/api/item-requests${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: itemRequestKeys.list(queryString),
    queryFn: async () => {
      const res = await fetch(url, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch item requests');
      }
      return (json.data || []) as ItemRequest[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch item request metrics for dashboard cards
export function useItemRequestMetrics() {
  return useQuery({
    queryKey: itemRequestKeys.metrics(),
    queryFn: async () => {
      const res = await fetch('/api/item-requests/metrics', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch metrics');
      }
      return json.data as {
        pendingCount: number;
        orderedThisMonth: number;
        receivedThisMonth: number;
        cancelledCount: number;
        totalRequests: number;
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create new item request
export function useCreateItemRequest() {
  const queryClient = useQueryClient();

  return useMutation<ItemRequest, Error, ItemRequestFormData>({
    mutationFn: async (data) => {
      const res = await fetch('/api/item-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create item request');
      }
      return json.data as ItemRequest;
    },
    onSuccess: () => {
      toast.success('Item request created successfully');
      // Invalidate all item request queries
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create item request');
    },
  });
}

// Update existing item request
export function useUpdateItemRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ItemRequest,
    Error,
    ItemRequestUpdateData & { id: number }
  >({
    mutationFn: async ({ id, ...data }) => {
      const res = await fetch(`/api/item-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update item request');
      }
      return json.data as ItemRequest;
    },
    onSuccess: () => {
      toast.success('Item request updated successfully');
      // Invalidate all item request queries
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update item request');
    },
  });
}

// Mark item request as ordered
export function useMarkOrdered() {
  const queryClient = useQueryClient();

  return useMutation<ItemRequest, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/item-requests/${id}/mark-ordered`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to mark as ordered');
      }
      return json.data as ItemRequest;
    },
    onSuccess: () => {
      toast.success('Item marked as ordered');
      // Invalidate all item request queries
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to mark as ordered');
    },
  });
}

// Mark item request as received
export function useMarkReceived() {
  const queryClient = useQueryClient();

  return useMutation<ItemRequest, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/item-requests/${id}/mark-received`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to mark as received');
      }
      return json.data as ItemRequest;
    },
    onSuccess: () => {
      toast.success('Item marked as received');
      // Invalidate all item request queries
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to mark as received');
    },
  });
}

// Cancel item request
export function useCancelItemRequest() {
  const queryClient = useQueryClient();

  return useMutation<ItemRequest, Error, { id: number; reason: string }>({
    mutationFn: async ({ id, reason }) => {
      const res = await fetch(`/api/item-requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancellation_reason: reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to cancel item request');
      }
      return json.data as ItemRequest;
    },
    onSuccess: () => {
      toast.success('Item request cancelled');
      // Invalidate all item request queries
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to cancel item request');
    },
  });
}

