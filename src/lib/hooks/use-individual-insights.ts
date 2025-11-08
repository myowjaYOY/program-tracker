import { useQuery } from '@tanstack/react-query';

export interface IndividualInsights {
  insight_id: number;
  lead_id: number;
  calculated_at: string;
  compliance_percentile: number;
  quartile: number;
  rank_in_population: number;
  total_members_in_population: number;
  risk_level: string;
  risk_score: number;
  risk_factors: string[];
  journey_pattern: string;
  compliance_comparison: {
    overall: { member: number; population_avg: number; diff: number };
    nutrition: { member: number; population_avg: number; diff: number };
    supplements: { member: number; population_avg: number; diff: number };
    exercise: { member: number; population_avg: number; diff: number };
    meditation: { member: number; population_avg: number; diff: number };
  };
  vitals_comparison: {
    energy: { member_score: number | null; member_trend: string; population_avg: number | null };
    mood: { member_score: number | null; member_trend: string; population_avg: number | null };
    motivation: { member_score: number | null; member_trend: string; population_avg: number | null };
    wellbeing: { member_score: number | null; member_trend: string; population_avg: number | null };
    sleep: { member_score: number | null; member_trend: string; population_avg: number | null };
  };
  outcomes_comparison: any | null;
  ai_recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    current_state: string;
    impact: string;
    action: string;
  }>;
}

export interface IndividualInsightsResponse {
  insights: IndividualInsights;
}

/**
 * React Query hook to fetch individual member analytics & insights
 * 
 * @param leadId - Lead ID of the member
 * @returns Query result with insights data
 */
export function useIndividualInsights(leadId: number | null) {
  return useQuery<IndividualInsightsResponse>({
    queryKey: ['individual-insights', leadId],
    queryFn: async () => {
      if (!leadId) throw new Error('Lead ID is required');
      
      const response = await fetch(`/api/analytics/individual-insights/${leadId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Analytics data not yet available. Will be generated during next survey import.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch insights');
      }
      
      return response.json();
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once
  });
}


