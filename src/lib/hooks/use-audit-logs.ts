import { useQuery } from '@tanstack/react-query';

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  operation: string;
  old_value: any;
  new_value: any;
  column_name: string | null;
  changed_by: string | null;
  changed_at: string;
  changed_fields: any;
  changed_by_email: string | null;
  changed_by_name: string | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
}

export interface AuditLogsFilters {
  table_name?: string;
  operation?: string;
  changed_by?: string;
  start_date?: string;
  end_date?: string;
  record_id?: string;
}

// Query keys
export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (filters: AuditLogsFilters) =>
    [...auditLogKeys.lists(), filters] as const,
  details: () => [...auditLogKeys.all, 'detail'] as const,
  detail: (table: string, recordId: string) =>
    [...auditLogKeys.details(), table, recordId] as const,
};

// Hook to fetch audit logs with filters
export function useAuditLogs(filters: AuditLogsFilters = {}) {
  return useQuery({
    queryKey: auditLogKeys.list(filters),
    queryFn: async (): Promise<AuditLogsResponse> => {
      const searchParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });

      const response = await fetch(
        `/api/audit-logs?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - longer cache for better performance
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch on window focus for better UX
    retry: 2, // Retry failed requests twice
  });
}

// Hook to fetch audit logs for a specific record
export function useAuditLogsForRecord(table: string, recordId: string) {
  return useQuery({
    queryKey: auditLogKeys.detail(table, recordId),
    queryFn: async (): Promise<{ data: AuditLog[] }> => {
      const response = await fetch(`/api/audit-logs/${table}/${recordId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs for record');
      }

      return response.json();
    },
    enabled: !!table && !!recordId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get available table names for filtering
export function useAuditTables() {
  return useQuery({
    queryKey: [...auditLogKeys.all, 'tables'],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch('/api/audit-logs?limit=1');

      if (!response.ok) {
        throw new Error('Failed to fetch audit tables');
      }

      const data = await response.json();
      // Extract unique table names from the response
      const tables = new Set(
        data.data?.map((log: AuditLog) => log.table_name) || []
      );
      return Array.from(tables).sort();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to get available operations for filtering
export function useAuditOperations() {
  return useQuery({
    queryKey: [...auditLogKeys.all, 'operations'],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch('/api/audit-logs?limit=1');

      if (!response.ok) {
        throw new Error('Failed to fetch audit operations');
      }

      const data = await response.json();
      // Extract unique operations from the response
      const operations = new Set(
        data.data?.map((log: AuditLog) => log.operation) || []
      );
      return Array.from(operations).sort();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to get available users for filtering
export function useAuditUsers() {
  return useQuery({
    queryKey: [...auditLogKeys.all, 'users'],
    queryFn: async (): Promise<
      { id: string; email: string; full_name: string }[]
    > => {
      const response = await fetch('/api/audit-logs?action=users');

      if (!response.ok) {
        throw new Error('Failed to fetch audit users');
      }

      const data = await response.json();
      return data.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
