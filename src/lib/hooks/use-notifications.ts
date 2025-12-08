import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types for notifications
export interface Notification {
  notification_id: number;
  lead_id: number;
  priority: 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  source_note_id: number | null;
  target_role_ids: number[];
  target_role_names?: string[];
  status: 'active' | 'acknowledged';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  response_note_id: number | null;
  created_by: string;
  created_at: string;
  // Joined data
  lead?: {
    lead_id: number;
    first_name: string;
    last_name: string;
  };
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  acknowledger?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  source_note?: {
    note_id: number;
    note: string;
    note_type: string;
  } | null;
  response_note?: {
    note_id: number;
    note: string;
    note_type: string;
  } | null;
}

export interface CreateNotificationData {
  lead_id: number;
  title: string;
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
  target_role_ids: number[];
  source_note_id?: number;
}

export interface AcknowledgeNotificationData {
  notification_id: number;
  response_note_id: number;
}

const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  active: () => [...notificationKeys.all, 'active'] as const,
  detail: (id: number) => [...notificationKeys.all, 'detail', id] as const,
};

export function useNotifications() {
  return useQuery<Notification[], Error>({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/notifications', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch notifications');
      return json.data as Notification[];
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

export function useActiveNotifications() {
  return useQuery<Notification[], Error>({
    queryKey: notificationKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/notifications', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch notifications');
      return (json.data as Notification[]).filter(n => n.status === 'active');
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateNotificationData) => {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create notification');
      return json.data as Notification;
    },
    onSuccess: () => {
      toast.success('Notification created');
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create notification');
    },
  });
}

export function useAcknowledgeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ notification_id, response_note_id }: AcknowledgeNotificationData) => {
      const res = await fetch(`/api/notifications/${notification_id}/acknowledge`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_note_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to acknowledge notification');
      return json.data as Notification;
    },
    onSuccess: () => {
      toast.success('Notification acknowledged');
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to acknowledge notification');
    },
  });
}

// Export keys for external use
export { notificationKeys };

