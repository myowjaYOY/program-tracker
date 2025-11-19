import { useQuery } from '@tanstack/react-query';

export interface ComplianceTrendData {
  month: string;
  nutrition: number | null;
  supplements: number | null;
  exercise: number | null;
  meditation: number | null;
  member_count: number;
  survey_count: number;
}

async function fetchComplianceTrends(): Promise<ComplianceTrendData[]> {
  const response = await fetch('/api/analytics/compliance-trends');
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch compliance trends' }));
    throw new Error(error.error || 'Failed to fetch compliance trends');
  }
  
  return response.json();
}

export function useComplianceTrends() {
  return useQuery<ComplianceTrendData[], Error>({
    queryKey: ['compliance-trends'],
    queryFn: fetchComplianceTrends,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

