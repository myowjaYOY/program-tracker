/**
 * React Query Hooks for PROMIS-29 Assessment Dashboard
 * 
 * Provides hooks for fetching PROMIS-29 assessment data with T-scores,
 * domain cards, and trend analysis.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  PromisAssessmentSummary,
  PromisDomainCard,
} from '@/types/database.types';

// ============================================
// QUERY KEY FACTORY
// ============================================

export const promisAssessmentKeys = {
  all: ['promis-assessment'] as const,
  assessment: (memberId?: number | null) =>
    [...promisAssessmentKeys.all, 'assessment', memberId] as const,
};

// ============================================
// API RESPONSE TYPES
// ============================================

interface PromisAssessmentResponse {
  summary: PromisAssessmentSummary;
  domains: PromisDomainCard[];
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetch complete PROMIS-29 assessment for a member
 * Returns summary (mean T-score, trends, counts) and 8 domain cards
 * 
 * @param memberId - external_user_id from survey_user_mappings
 */
export function usePromisAssessment(memberId?: number | null) {
  return useQuery<PromisAssessmentResponse, Error>({
    queryKey: promisAssessmentKeys.assessment(memberId),
    queryFn: async () => {
      if (!memberId) throw new Error('Member ID is required');

      const res = await fetch(`/api/report-card/promis-assessment/${memberId}`, {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch PROMIS-29 assessment');
      }

      return json as PromisAssessmentResponse;
    },
    enabled: !!memberId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Composite hook to fetch all PROMIS-29 data for a member
 * 
 * Provides convenient access to summary, domains, loading states, and errors
 * 
 * @param memberId - external_user_id from survey_user_mappings
 */
export function usePromisAssessmentData(memberId?: number | null) {
  const assessment = usePromisAssessment(memberId);

  return {
    // Data
    summary: assessment.data?.summary,
    domains: assessment.data?.domains,

    // Loading states
    isLoading: assessment.isLoading,
    isFetching: assessment.isFetching,

    // Error states
    error: assessment.error,

    // Refetch function
    refetch: assessment.refetch,
  };
}

