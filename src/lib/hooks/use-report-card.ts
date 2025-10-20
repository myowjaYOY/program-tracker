import { useQuery } from '@tanstack/react-query';
import type {
  ReportCardSummary,
  ProgramOption,
  ParticipantOption,
  MsqScore,
  ReportCardInsights,
} from '@/types/database.types';

/**
 * Query key factory for Report Card queries
 * Ensures consistent cache keys and enables targeted invalidation
 */
export const reportCardKeys = {
  all: ['report-card'] as const,
  summary: (programId?: number, dateRange?: string) =>
    [...reportCardKeys.all, 'summary', programId, dateRange] as const,
  programs: () => [...reportCardKeys.all, 'programs'] as const,
  participants: () =>
    [...reportCardKeys.all, 'participants'] as const,
  msqTimeline: (
    externalUserId: number,
    startDate?: string,
    endDate?: string
  ) =>
    [
      ...reportCardKeys.all,
      'msq-timeline',
      externalUserId,
      startDate,
      endDate,
    ] as const,
  insights: (externalUserId: number) =>
    [...reportCardKeys.all, 'insights', externalUserId] as const,
};

/**
 * Hook: useReportCardSummary
 * 
 * Fetches summary metrics for the dashboard cards:
 * - Total participants with survey data
 * - Average MSQ improvement
 * - Survey completion rate
 * - Recent surveys count and trend
 * 
 * @param programId - Optional program filter
 * @param dateRange - Optional date range (e.g., "30d", "90d", "all")
 */
export function useReportCardSummary(
  programId?: number,
  dateRange?: string
) {
  return useQuery<ReportCardSummary, Error>({
    queryKey: reportCardKeys.summary(programId, dateRange),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (programId) params.set('program_id', programId.toString());
      if (dateRange) params.set('date_range', dateRange);

      const res = await fetch(`/api/report-card/summary?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch report card summary');
      return json.data as ReportCardSummary;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook: useReportCardPrograms
 * 
 * Fetches list of survey programs with participant counts
 * for program filter dropdown
 */
export function useReportCardPrograms() {
  return useQuery<ProgramOption[], Error>({
    queryKey: reportCardKeys.programs(),
    queryFn: async () => {
      const res = await fetch('/api/report-card/programs', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch programs');
      return json.data as ProgramOption[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes (programs don't change often)
  });
}

/**
 * Hook: useReportCardParticipants
 * 
 * Fetches list of members (survey participants from survey_user_mappings)
 * with MSQ-95 survey data for member filter dropdown
 */
export function useReportCardParticipants() {
  return useQuery<ParticipantOption[], Error>({
    queryKey: reportCardKeys.participants(),
    queryFn: async () => {
      const res = await fetch('/api/report-card/participants', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch members');
      return json.data as ParticipantOption[];
    },
    // Force fresh data so survey counts reflect latest MSQ-only numbers
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook: useMsqTimeline
 * 
 * Fetches MSQ-95 weekly scores for timeline chart visualization
 * 
 * @param externalUserId - Survey member ID (required)
 * @param startDate - Optional start date filter (ISO string)
 * @param endDate - Optional end date filter (ISO string)
 */
export function useMsqTimeline(
  externalUserId: number | null,
  startDate?: string,
  endDate?: string
) {
  return useQuery<MsqScore[], Error>({
    queryKey: reportCardKeys.msqTimeline(
      externalUserId || 0,
      startDate,
      endDate
    ),
    queryFn: async () => {
      if (!externalUserId) {
        throw new Error('external_user_id is required');
      }

      const params = new URLSearchParams({ external_user_id: externalUserId.toString() });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`/api/report-card/msq-timeline?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch MSQ timeline data');
      return json.data as MsqScore[];
    },
    enabled: !!externalUserId, // Only fetch when externalUserId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook: useReportCardInsights
 * 
 * Fetches auto-generated insights based on MSQ data trends
 * Returns improvements, concerns, stable areas, and overall summary
 * 
 * @param externalUserId - Survey member ID (required)
 */
export function useReportCardInsights(
  externalUserId: number | null
) {
  return useQuery<ReportCardInsights, Error>({
    queryKey: reportCardKeys.insights(externalUserId || 0),
    queryFn: async () => {
      if (!externalUserId) {
        throw new Error('external_user_id is required');
      }

      const params = new URLSearchParams({ external_user_id: externalUserId.toString() });

      const res = await fetch(`/api/report-card/insights?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'Failed to fetch insights');
      return json.data as ReportCardInsights;
    },
    enabled: !!externalUserId, // Only fetch when externalUserId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Utility hook: Combined data fetching for full dashboard
 * 
 * Fetches all report card data for a specific member in one hook
 * Useful for the main Progress Tab component
 * 
 * @param externalUserId - Survey member ID (required)
 */
export function useReportCardData(externalUserId: number | null) {
  const summary = useReportCardSummary();
  const msqTimeline = useMsqTimeline(externalUserId);
  const insights = useReportCardInsights(externalUserId);

  return {
    summary,
    msqTimeline,
    insights,
    // Aggregate loading state
    isLoading:
      summary.isLoading ||
      msqTimeline.isLoading ||
      insights.isLoading,
    // Aggregate error state
    error:
      summary.error ||
      msqTimeline.error ||
      insights.error,
    // Check if any query is fetching
    isFetching:
      summary.isFetching ||
      msqTimeline.isFetching ||
      insights.isFetching,
  };
}

