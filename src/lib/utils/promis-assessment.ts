/**
 * PROMIS-29 Assessment - Core Utility Functions
 * 
 * This file contains utility functions for:
 * - PROMIS domain configuration (emojis, labels, colors)
 * - Severity interpretation (T-score based)
 * - Trend descriptions
 * - Domain type detection (symptom vs. function)
 */

import type {
  PromisDomain,
  PromisSymptomSeverity,
  PromisFunctionSeverity,
  PromisSeverity,
} from '@/types/database.types';

// ============================================
// PROMIS DOMAIN CONFIGURATION
// ============================================

/**
 * Domain metadata with emojis, colors, and labels
 * Matches the 8 PROMIS-29 domains
 */
export const PROMIS_DOMAIN_CONFIG: Record<
  PromisDomain,
  { label: string; emoji: string; color: string; type: 'symptom' | 'function' }
> = {
  physical_function: {
    label: 'Physical Function',
    emoji: '🏃',
    color: '#10b981',
    type: 'function',
  },
  anxiety: {
    label: 'Anxiety',
    emoji: '😰',
    color: '#f59e0b',
    type: 'symptom',
  },
  depression: {
    label: 'Depression',
    emoji: '😔',
    color: '#6366f1',
    type: 'symptom',
  },
  fatigue: {
    label: 'Fatigue',
    emoji: '😴',
    color: '#8b5cf6',
    type: 'symptom',
  },
  sleep_disturbance: {
    label: 'Sleep Disturbance',
    emoji: '🌙',
    color: '#06b6d4',
    type: 'symptom',
  },
  social_roles: {
    label: 'Social Roles',
    emoji: '👥',
    color: '#14b8a6',
    type: 'function',
  },
  pain_interference: {
    label: 'Pain Interference',
    emoji: '⚡',
    color: '#ef4444',
    type: 'symptom',
  },
  pain_intensity: {
    label: 'Pain Intensity',
    emoji: '🔥',
    color: '#dc2626',
    type: 'symptom',
  },
};

// ============================================
// DOMAIN TYPE DETECTION
// ============================================

/**
 * Determines if a domain measures symptoms (higher = worse)
 * or function (higher = better)
 */
export function isDomainSymptom(domain: PromisDomain): boolean {
  return PROMIS_DOMAIN_CONFIG[domain].type === 'symptom';
}

export function isDomainFunction(domain: PromisDomain): boolean {
  return PROMIS_DOMAIN_CONFIG[domain].type === 'function';
}

// ============================================
// SEVERITY INTERPRETATION (T-SCORE BASED)
// ============================================

/**
 * Interprets T-score for SYMPTOM domains (higher = worse)
 * Based on PROMIS standards: Mean=50, SD=10
 * 
 * Reference: PROMIS Adult Profile Scoring Manual (16 Sept 2024)
 */
export function interpretSymptomSeverity(tScore: number | null): PromisSymptomSeverity {
  if (tScore === null || tScore < 55) return 'within_normal';
  if (tScore < 60) return 'mild';
  if (tScore < 70) return 'moderate';
  if (tScore < 80) return 'severe';
  return 'very_severe';
}

/**
 * Interprets T-score for FUNCTION domains (higher = better)
 * Inverted scale from symptom domains
 * 
 * For function domains: Higher T-score = Better function
 * T ≥ 55 = Within Normal (good function)
 * T < 55 = Some limitation
 */
export function interpretFunctionSeverity(tScore: number | null): PromisFunctionSeverity {
  if (tScore === null || tScore >= 55) return 'within_normal';
  if (tScore >= 45) return 'mild_limitation';
  if (tScore >= 35) return 'moderate_limitation';
  if (tScore >= 25) return 'severe_limitation';
  return 'very_severe_limitation';
}

/**
 * Universal severity interpreter that handles both symptom and function domains
 */
export function interpretPromisSeverity(
  tScore: number | null,
  domain: PromisDomain
): PromisSeverity {
  if (isDomainSymptom(domain)) {
    return interpretSymptomSeverity(tScore);
  } else {
    return interpretFunctionSeverity(tScore);
  }
}

// ============================================
// SEVERITY LABELS (USER-FRIENDLY)
// ============================================

/**
 * Converts severity enum to user-friendly label
 */
export function getSeverityLabel(severity: PromisSeverity): string {
  const labels: Record<PromisSeverity, string> = {
    within_normal: 'Within Normal Limits',
    mild: 'Mild',
    mild_limitation: 'Mild Limitation',
    moderate: 'Moderate',
    moderate_limitation: 'Moderate Limitation',
    severe: 'Severe',
    severe_limitation: 'Severe Limitation',
    very_severe: 'Very Severe',
    very_severe_limitation: 'Very Severe Limitation',
  };
  return labels[severity];
}

/**
 * Gets color for severity level (for UI badges)
 */
export function getSeverityColor(severity: PromisSeverity): string {
  const colors: Record<PromisSeverity, string> = {
    within_normal: '#10b981', // green
    mild: '#f59e0b', // amber
    mild_limitation: '#f59e0b', // amber
    moderate: '#ef4444', // red
    moderate_limitation: '#ef4444', // red
    severe: '#dc2626', // dark red
    severe_limitation: '#dc2626', // dark red
    very_severe: '#991b1b', // very dark red
    very_severe_limitation: '#991b1b', // very dark red
  };
  return colors[severity];
}

// ============================================
// TREND DESCRIPTIONS
// ============================================

/**
 * Generates user-friendly trend description
 * Accounts for domain type (symptom vs. function)
 */
export function getPromisTrendDescription(
  trend: string,
  domain: PromisDomain
): string {
  const isSymptom = isDomainSymptom(domain);

  switch (trend) {
    case 'improving':
      return isSymptom
        ? '📉 Improving - Symptoms decreasing'
        : '📈 Improving - Function increasing';
    case 'worsening':
      return isSymptom
        ? '📈 Worsening - Symptoms increasing'
        : '📉 Worsening - Function decreasing';
    case 'stable':
      return '➡️ Stable - No significant change';
    case 'insufficient_data':
      return '📊 Insufficient Data - Need more assessments';
    default:
      return '➡️ Stable';
  }
}

/**
 * Gets emoji for trend (simple version)
 */
export function getTrendEmoji(trend: string): string {
  switch (trend) {
    case 'improving':
      return '✅';
    case 'worsening':
      return '⚠️';
    case 'stable':
      return '➡️';
    case 'insufficient_data':
      return '📊';
    default:
      return '➡️';
  }
}

// ============================================
// OVERALL ASSESSMENT INTERPRETATION
// ============================================

/**
 * Interprets overall mean T-score (average of all domains)
 * Uses a balanced approach since domains have mixed directionality
 */
export function interpretMeanTScoreSeverity(meanTScore: number): string {
  // Since we have mixed symptom/function domains, we use a more nuanced approach
  // A mean around 50 is "normal" (average of U.S. population)
  if (meanTScore >= 45 && meanTScore <= 55) {
    return 'Within Normal Range';
  } else if (meanTScore < 45) {
    return 'Below Average Function'; // Lower mean suggests more function impairment
  } else if (meanTScore < 60) {
    return 'Mild Concerns';
  } else if (meanTScore < 65) {
    return 'Moderate Concerns';
  } else {
    return 'Significant Concerns';
  }
}

/**
 * Gets color for overall mean T-score
 */
export function getMeanTScoreColor(meanTScore: number): string {
  if (meanTScore >= 45 && meanTScore <= 55) {
    return '#10b981'; // green - normal
  } else if (meanTScore < 45 || meanTScore < 60) {
    return '#f59e0b'; // amber - mild
  } else if (meanTScore < 65) {
    return '#ef4444'; // red - moderate
  } else {
    return '#dc2626'; // dark red - severe
  }
}

// ============================================
// DOMAIN ORDERING
// ============================================

/**
 * Standard order for displaying PROMIS-29 domains
 * Groups by type: Physical → Mental → Social → Pain
 */
export const PROMIS_DOMAIN_ORDER: PromisDomain[] = [
  'physical_function',
  'anxiety',
  'depression',
  'fatigue',
  'sleep_disturbance',
  'social_roles',
  'pain_interference',
  'pain_intensity',
];

/**
 * Sorts domains by standard order
 */
export function sortPromisDomains<T extends { domain_key: PromisDomain }>(
  domains: T[]
): T[] {
  return [...domains].sort((a, b) => {
    const aIndex = PROMIS_DOMAIN_ORDER.indexOf(a.domain_key);
    const bIndex = PROMIS_DOMAIN_ORDER.indexOf(b.domain_key);
    return aIndex - bIndex;
  });
}

