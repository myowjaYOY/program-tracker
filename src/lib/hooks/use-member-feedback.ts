import { useQuery } from '@tanstack/react-query';

/**
 * Trend indicator type
 */
export type FeedbackTrend = 'improving' | 'stable' | 'declining' | 'no_data';

/**
 * Rating history entry for a single dimension
 */
export interface RatingHistoryEntry {
  date: string;
  value: number;
  formName: string;
}

/**
 * Rating data for a single dimension (provider, staff, curriculum)
 */
export interface DimensionRating {
  current: number | null;
  trend: FeedbackTrend;
  history: RatingHistoryEntry[];
}

/**
 * Overall rating summary
 */
export interface OverallRating {
  current: number | null;
  trend: FeedbackTrend;
  surveyCount: number;
}

/**
 * All ratings data
 */
export interface MemberFeedbackRatings {
  overall: OverallRating;
  provider: DimensionRating;
  staff: DimensionRating;
  curriculum: DimensionRating;
}

/**
 * Timeline entry for chart visualization
 */
export interface RatingTimelineEntry {
  date: string;
  formName: string;
  provider: number | null;
  staff: number | null;
  curriculum: number | null;
}

/**
 * Feedback category type
 */
export type FeedbackCategory = 'improvement' | 'education' | 'sentiment';

/**
 * Individual feedback item
 */
export interface FeedbackItem {
  category: FeedbackCategory;
  text: string;
  questionText: string;
}

/**
 * Feedback entry for a single survey session
 */
export interface FeedbackEntry {
  date: string;
  formName: string;
  items: FeedbackItem[];
}

/**
 * Complete member feedback data
 */
export interface MemberFeedbackData {
  ratings: MemberFeedbackRatings;
  ratingTimeline: RatingTimelineEntry[];
  feedback: FeedbackEntry[];
}

/**
 * API response wrapper
 */
export interface MemberFeedbackResponse {
  data: MemberFeedbackData;
}

/**
 * Query keys for member feedback
 */
export const memberFeedbackKeys = {
  all: ['member-feedback'] as const,
  detail: (leadId: number) => [...memberFeedbackKeys.all, leadId] as const,
};

/**
 * React Query hook to fetch member feedback data
 * 
 * Returns support ratings (provider, staff, curriculum) with trends,
 * rating timeline for charts, and text feedback entries.
 * 
 * @param leadId - Lead ID of the member
 * @returns Query result with feedback data
 */
export function useMemberFeedback(leadId: number | null) {
  return useQuery<MemberFeedbackResponse>({
    queryKey: memberFeedbackKeys.detail(leadId || 0),
    queryFn: async () => {
      if (!leadId) throw new Error('Lead ID is required');

      const response = await fetch(`/api/report-card/member-feedback/${leadId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Member not found');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch member feedback');
      }

      return response.json();
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Helper function to get trend label for display
 */
export function getTrendLabel(trend: FeedbackTrend): string {
  switch (trend) {
    case 'improving':
      return 'Improving';
    case 'stable':
      return 'Stable';
    case 'declining':
      return 'Declining';
    case 'no_data':
    default:
      return 'No Data';
  }
}

/**
 * Helper function to get rating label from numeric score
 */
export function getRatingLabel(score: number | null): string {
  if (score === null) return 'No Rating';
  if (score >= 4.5) return 'Exceeding Expectations';
  if (score >= 3.5) return 'Very Supportive';
  if (score >= 2.5) return 'Adequately Supportive';
  if (score >= 1.5) return 'Mildly Supportive';
  return 'Not Applicable';
}

/**
 * Helper function to get feedback category label
 */
export function getFeedbackCategoryLabel(category: FeedbackCategory): string {
  switch (category) {
    case 'improvement':
      return 'Improvement Suggestion';
    case 'education':
      return 'Education Request';
    case 'sentiment':
      return 'Program Sentiment';
    default:
      return 'Feedback';
  }
}


