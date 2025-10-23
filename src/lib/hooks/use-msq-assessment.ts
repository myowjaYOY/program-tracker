/**
 * React Query Hooks for MSQ Clinical Dashboard
 * 
 * Provides hooks for fetching MSQ assessment data, domain cards,
 * food triggers, and AI-generated clinical plans.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  MsqAssessmentSummary,
  MsqDomainCard,
  FoodTriggerAnalysis,
  ClinicalActionPlan,
} from '@/types/database.types';

// ============================================
// QUERY KEY FACTORY
// ============================================

export const msqAssessmentKeys = {
  all: ['msq-assessment'] as const,
  assessment: (memberId?: number | null) =>
    [...msqAssessmentKeys.all, 'assessment', memberId] as const,
  foodTriggers: (memberId?: number | null) =>
    [...msqAssessmentKeys.all, 'food-triggers', memberId] as const,
  clinicalPlan: (memberId?: number | null) =>
    [...msqAssessmentKeys.all, 'clinical-plan', memberId] as const,
};

// ============================================
// API RESPONSE TYPES
// ============================================

interface MsqAssessmentResponse {
  summary: MsqAssessmentSummary;
  domains: MsqDomainCard[];
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetch complete MSQ assessment for a member
 * Returns summary (header cards + alerts) and domain cards
 */
export function useMsqAssessment(memberId?: number | null) {
  return useQuery<MsqAssessmentResponse, Error>({
    queryKey: msqAssessmentKeys.assessment(memberId),
    queryFn: async () => {
      if (!memberId) throw new Error('Member ID is required');

      const res = await fetch(`/api/report-card/msq-assessment/${memberId}`, {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch MSQ assessment');
      }

      return json.data as MsqAssessmentResponse;
    },
    enabled: !!memberId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Fetch food trigger analysis for a member
 * Returns 4 categories (high priority, moderate, consider testing, likely safe)
 */
export function useFoodTriggers(memberId?: number | null) {
  return useQuery<FoodTriggerAnalysis, Error>({
    queryKey: msqAssessmentKeys.foodTriggers(memberId),
    queryFn: async () => {
      if (!memberId) throw new Error('Member ID is required');

      const res = await fetch(`/api/report-card/food-triggers/${memberId}`, {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch food triggers');
      }

      return json.data as FoodTriggerAnalysis;
    },
    enabled: !!memberId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Fetch AI-generated clinical action plan for a member
 * Returns 4 action plan cards + 4 progress monitoring cards
 * 
 * NOTE: Requires OPENAI_API_KEY in .env.local
 */
export function useClinicalPlan(memberId?: number | null) {
  return useQuery<ClinicalActionPlan, Error>({
    queryKey: msqAssessmentKeys.clinicalPlan(memberId),
    queryFn: async () => {
      if (!memberId) throw new Error('Member ID is required');

      const res = await fetch(`/api/report-card/clinical-plan/${memberId}`, {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        // Check for specific error types
        if (res.status === 503) {
          throw new Error(
            json.message || 'AI features not configured. Please add OPENAI_API_KEY to .env.local'
          );
        }
        throw new Error(json.error || 'Failed to fetch clinical plan');
      }

      return json.data as ClinicalActionPlan;
    },
    enabled: !!memberId,
    staleTime: 1000 * 60 * 30, // 30 minutes (AI responses are expensive, cache longer)
    retry: 1, // Only retry once for AI calls
  });
}

/**
 * Composite hook to fetch all MSQ data for a member in parallel
 * 
 * @param memberId - external_user_id from survey_user_mappings
 * @param includeAI - Whether to fetch AI-generated clinical plan (default: true)
 */
export function useMsqAssessmentData(
  memberId?: number | null,
  includeAI = true
) {
  const assessment = useMsqAssessment(memberId);
  const foodTriggers = useFoodTriggers(memberId);
  const clinicalPlan = useClinicalPlan(includeAI ? memberId : null);

  return {
    // Data
    summary: assessment.data?.summary,
    domains: assessment.data?.domains,
    foodTriggers: foodTriggers.data,
    clinicalPlan: clinicalPlan.data,

    // Loading states
    isLoading: assessment.isLoading || foodTriggers.isLoading || (includeAI && clinicalPlan.isLoading),
    isFetching: assessment.isFetching || foodTriggers.isFetching || (includeAI && clinicalPlan.isFetching),

    // Error states
    error: assessment.error || foodTriggers.error || (includeAI && clinicalPlan.error),
    assessmentError: assessment.error,
    foodTriggersError: foodTriggers.error,
    clinicalPlanError: clinicalPlan.error,

    // Individual query states (for granular loading UX)
    assessmentLoading: assessment.isLoading,
    foodTriggersLoading: foodTriggers.isLoading,
    clinicalPlanLoading: clinicalPlan.isLoading,

    // Refetch functions
    refetchAssessment: assessment.refetch,
    refetchFoodTriggers: foodTriggers.refetch,
    refetchClinicalPlan: clinicalPlan.refetch,
  };
}




