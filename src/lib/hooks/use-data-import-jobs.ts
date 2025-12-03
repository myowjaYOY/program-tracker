import { useQuery } from '@tanstack/react-query';

export interface DataImportError {
  import_error_id: number;
  import_batch_id: number;
  row_number: number;
  row_data: Record<string, unknown> | null;
  error_type: string;
  error_message: string;
  field_name: string | null;
  severity: 'error' | 'warning';
  created_at: string;
}

export interface DataImportJob {
  import_batch_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  entity_type: string;
  bucket_name: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  total_rows: number | null;
  successful_rows: number | null;
  failed_rows: number | null;
  skipped_rows: number | null;
  new_users_mapped: number | null;
  new_programs_created: number | null;
  new_modules_created: number | null;
  new_forms_created: number | null;
  new_questions_created: number | null;
  new_sessions_created: number | null;
  new_responses_created: number | null;
  started_at: string | null;
  completed_at: string | null;
  processing_duration: string | null; // PostgreSQL interval as string
  error_summary: string | null;
  warnings: Record<string, unknown>[] | null;
  created_at: string;
  created_by: string | null;
}

export const dataImportJobsKeys = {
  all: ['dataImportJobs'] as const,
  list: () => [...dataImportJobsKeys.all, 'list'] as const,
};

/**
 * Fetches data import jobs with auto-refresh every 30 seconds
 */
export function useDataImportJobs(refetchInterval = 30000) {
  return useQuery<DataImportJob[], Error>({
    queryKey: dataImportJobsKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/admin/data-import-jobs');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch data import jobs');
      return json.data as DataImportJob[];
    },
    refetchInterval,
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

/**
 * Fetches errors for a specific import job
 */
export function useDataImportErrors(importBatchId: number | null) {
  return useQuery<DataImportError[], Error>({
    queryKey: [...dataImportJobsKeys.all, 'errors', importBatchId],
    queryFn: async () => {
      if (!importBatchId) return [];
      const res = await fetch(`/api/admin/data-import-jobs/${importBatchId}/errors`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch import errors');
      return json.data as DataImportError[];
    },
    enabled: !!importBatchId,
    staleTime: 60000, // Errors don't change, cache for 1 minute
  });
}

