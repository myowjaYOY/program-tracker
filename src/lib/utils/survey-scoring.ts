/**
 * Survey Scoring Utilities
 * 
 * This module provides scoring and calculation functions for:
 * - MSQ-95 (Medical Symptoms Questionnaire)
 * - PROMIS-29 (Patient-Reported Outcomes Measurement Information System)
 * 
 * @module survey-scoring
 */

import type {
  MsqScore,
  MsqDomainScores,
  PromisScore,
  PromisTScores,
  PromisMilestone,
  SurveyResponse,
} from '@/types/database.types';

// ============================================
// MSQ-95 SCORING CONSTANTS
// ============================================

/**
 * MSQ-95 text answer to numeric score mapping
 * Scale: 0-4, where higher = more symptom burden
 */
export const MSQ_ANSWER_MAP: Record<string, number> = {
  Never: 0,
  Rarely: 1,
  Sometimes: 2,
  Frequently: 3,
  Always: 4,
};

/**
 * MSQ-95 question text patterns for domain categorization
 * Based on typical MSQ-95 structure used in functional medicine
 */
export const MSQ_DOMAIN_KEYWORDS: Record<string, string[]> = {
  head: ['headache', 'head', 'dizziness', 'faintness'],
  eyes: ['eyes', 'vision', 'watery', 'itchy eyes', 'swollen eyes', 'bags', 'dark circles'],
  ears: ['ears', 'ear', 'earaches', 'infections', 'drainage', 'itchy ears', 'hearing loss', 'ringing'],
  nose: ['nose', 'nasal', 'sinus', 'hay fever', 'sneezing', 'mucus', 'stuffy nose', 'congestion'],
  mouth_throat: ['mouth', 'throat', 'tongue', 'gums', 'lips', 'canker sores', 'sore throat'],
  skin: ['skin', 'hives', 'rashes', 'dry skin', 'itchy', 'acne', 'hair loss', 'flushing', 'sweating'],
  lungs_chest: ['chest', 'lung', 'asthma', 'bronchitis', 'shortness of breath', 'difficulty breathing', 'cough'],
  digestive: [
    'nausea',
    'vomit',
    'diarrhea',
    'constipation',
    'bloat',
    'belch',
    'heartburn',
    'intestinal',
    'stomach',
    'gas',
    'cramps',
    'bowel',
    'appetite',
    'weight',
  ],
  joints_muscles: ['joint', 'muscle', 'pain', 'aches', 'stiffness', 'arthritis', 'weakness', 'movement'],
  energy_mind_emotions: [
    'fatigue',
    'sluggish',
    'hyperactive',
    'restless',
    'insomnia',
    'sleep',
    'mood',
    'anxiety',
    'fear',
    'anger',
    'irritable',
    'aggressive',
    'depression',
    'memory',
    'concentration',
    'confusion',
    'coordination',
    'decision',
    'stuttering',
    'slurred',
    'learning',
  ],
};

/**
 * MSQ-95 total score interpretation thresholds
 */
export const MSQ_INTERPRETATION_RANGES = {
  optimal: { min: 0, max: 30 },
  mild: { min: 31, max: 60 },
  moderate: { min: 61, max: 90 },
  severe: { min: 91, max: 120 },
  very_severe: { min: 121, max: 999 },
} as const;

// ============================================
// PROMIS-29 SCORING CONSTANTS
// ============================================

/**
 * PROMIS-29 text answer to raw score mapping
 * Scale: 1-5 (varies by question type)
 */
export const PROMIS_ANSWER_MAP: Record<string, number> = {
  // Physical function scale
  'Without any difficulty': 5,
  'With a little difficulty': 4,
  'With some difficulty': 3,
  'With much difficulty': 2,
  'Unable to do': 1,
  // Frequency scale
  Never: 1,
  Rarely: 2,
  Sometimes: 3,
  Often: 4,
  Always: 5,
  // Intensity scale
  'Not at all': 1,
  'A little bit': 2,
  Somewhat: 3,
  'Quite a bit': 4,
  'Very much': 5,
  // Add common variations
  'None': 1,
  'Mild': 2,
  'Moderate': 3,
  'Severe': 4,
  'Very severe': 5,
};

/**
 * PROMIS-29 question text patterns for domain categorization
 */
export const PROMIS_DOMAIN_KEYWORDS: Record<string, string[]> = {
  physical_function: ['walk', 'climb', 'stairs', 'chores', 'errands', 'physical'],
  anxiety: ['anxious', 'worry', 'worries', 'fearful', 'uneasy', 'tense', 'anxiety'],
  depression: ['depressed', 'hopeless', 'worthless', 'helpless', 'unhappy', 'depression'],
  fatigue: ['fatigue', 'tired', 'exhausted', 'weary', 'run down', 'energy'],
  sleep_disturbance: ['sleep', 'fell asleep', 'stay asleep', 'awake', 'refreshing', 'insomnia', 'problem sleeping'],
  social_roles: ['social', 'activities', 'family', 'friends', 'leisure', 'work', 'regular activities'],
  pain_interference: ['pain', 'interfere', 'enjoy', 'concentrate', 'household', 'people'],
};

/**
 * PROMIS-29 Raw Score to T-Score Conversion Tables
 * Source: HealthMeasures PROMIS-29 Profile v2.1 Scoring Manual
 * 
 * Note: These are simplified lookup tables. For production use,
 * consider using the official PROMIS API or full conversion tables.
 */
export const PROMIS_T_SCORE_TABLES: Record<string, Record<number, number>> = {
  physical_function: {
    4: 24.8, 5: 27.1, 6: 29.0, 7: 30.7, 8: 32.3, 9: 33.9, 10: 35.4,
    11: 37.0, 12: 38.5, 13: 40.1, 14: 41.8, 15: 43.5, 16: 45.4, 17: 47.5,
    18: 50.0, 19: 52.9, 20: 56.6,
  },
  anxiety: {
    4: 40.3, 5: 44.5, 6: 48.2, 7: 51.5, 8: 54.5, 9: 57.4, 10: 60.2,
    11: 63.0, 12: 65.8, 13: 68.7, 14: 71.8, 15: 75.1, 16: 78.6, 17: 82.4,
    18: 86.5, 19: 90.9, 20: 95.6,
  },
  depression: {
    4: 38.2, 5: 41.8, 6: 45.0, 7: 48.0, 8: 50.9, 9: 53.7, 10: 56.5,
    11: 59.4, 12: 62.4, 13: 65.5, 14: 68.8, 15: 72.4, 16: 76.3, 17: 80.6,
    18: 85.4, 19: 90.9, 20: 97.2,
  },
  fatigue: {
    4: 33.7, 5: 37.9, 6: 41.4, 7: 44.7, 8: 47.8, 9: 50.8, 10: 53.8,
    11: 56.8, 12: 59.9, 13: 63.1, 14: 66.5, 15: 70.1, 16: 74.0, 17: 78.4,
    18: 83.2, 19: 88.6, 20: 94.8,
  },
  sleep_disturbance: {
    4: 28.7, 5: 32.0, 6: 35.0, 7: 38.0, 8: 40.9, 9: 43.8, 10: 46.8,
    11: 49.9, 12: 53.0, 13: 56.3, 14: 59.7, 15: 63.4, 16: 67.4, 17: 71.7,
    18: 76.5, 19: 81.9, 20: 88.1,
  },
  social_roles: {
    4: 25.5, 5: 28.4, 6: 31.0, 7: 33.5, 8: 35.9, 9: 38.3, 10: 40.7,
    11: 43.1, 12: 45.6, 13: 48.2, 14: 51.0, 15: 54.0, 16: 57.3, 17: 61.1,
    18: 65.5, 19: 70.9, 20: 77.9,
  },
  pain_interference: {
    4: 38.5, 5: 42.2, 6: 45.4, 7: 48.4, 8: 51.2, 9: 54.0, 10: 56.8,
    11: 59.6, 12: 62.5, 13: 65.5, 14: 68.7, 15: 72.1, 16: 75.9, 17: 80.1,
    18: 84.8, 19: 90.3, 20: 96.7,
  },
};

// ============================================
// MSQ-95 SCORING FUNCTIONS
// ============================================

/**
 * Maps MSQ-95 text answer to numeric score (0-4)
 */
export function mapMsqAnswer(answerText: string | null): number {
  if (!answerText) return 0;
  const normalized = answerText.trim();
  return MSQ_ANSWER_MAP[normalized] ?? 0;
}

/**
 * Categorizes an MSQ question into its domain based on question text
 */
export function categorizeMsqQuestion(questionText: string): keyof typeof MSQ_DOMAIN_KEYWORDS {
  const text = questionText.toLowerCase();

  // Check each domain's keywords
  for (const [domain, keywords] of Object.entries(MSQ_DOMAIN_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return domain as keyof typeof MSQ_DOMAIN_KEYWORDS;
    }
  }

  // Default to energy/mind/emotions if no match (most common catch-all)
  return 'energy_mind_emotions';
}

/**
 * Calculates MSQ-95 scores from raw survey responses
 */
export function calculateMsqScore(
  responses: SurveyResponse[],
  sessionId: number,
  leadId: number,
  completedOn: string,
  weekNumber: number
): MsqScore {
  // Initialize domain scores
  const domainScores: MsqDomainScores = {
    head: 0,
    eyes: 0,
    ears: 0,
    nose: 0,
    mouth_throat: 0,
    skin: 0,
    lungs_chest: 0,
    digestive: 0,
    joints_muscles: 0,
    energy_mind_emotions: 0,
  };

  // Process each response
  for (const response of responses) {
    if (!response.question_text) continue;

    const domain = categorizeMsqQuestion(response.question_text);
    const score = mapMsqAnswer(response.answer_text);
    domainScores[domain as keyof MsqDomainScores] += score;
  }

  // Calculate total score
  const totalScore = Object.values(domainScores).reduce((sum, score) => sum + score, 0);

  // Determine interpretation
  let interpretation: 'optimal' | 'mild' | 'moderate' | 'severe' | 'very_severe' = 'optimal';
  for (const [level, range] of Object.entries(MSQ_INTERPRETATION_RANGES)) {
    if (totalScore >= range.min && totalScore <= range.max) {
      interpretation = level as typeof interpretation;
      break;
    }
  }

  return {
    session_id: sessionId,
    lead_id: leadId,
    completed_on: completedOn,
    week_number: weekNumber,
    total_score: totalScore,
    domain_scores: domainScores,
    interpretation: interpretation,
  };
}

/**
 * Interprets MSQ-95 total score into severity category
 */
export function interpretMsqScore(totalScore: number): string {
  if (totalScore <= 30) return 'Optimal / Minimal Burden';
  if (totalScore <= 60) return 'Mild Dysfunction';
  if (totalScore <= 90) return 'Moderate Dysfunction';
  if (totalScore <= 120) return 'Severe';
  return 'Very Severe Toxicity / Imbalance';
}

// ============================================
// PROMIS-29 SCORING FUNCTIONS
// ============================================

/**
 * Maps PROMIS-29 text answer to raw score (1-5)
 */
export function mapPromisAnswer(answerText: string | null): number {
  if (!answerText) return 1;
  const normalized = answerText.trim();
  return PROMIS_ANSWER_MAP[normalized] ?? 1;
}

/**
 * Categorizes a PROMIS question into its domain based on question text
 */
export function categorizePromisQuestion(questionText: string): keyof typeof PROMIS_DOMAIN_KEYWORDS | null {
  const text = questionText.toLowerCase();

  // Check each domain's keywords
  for (const [domain, keywords] of Object.entries(PROMIS_DOMAIN_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return domain as keyof typeof PROMIS_DOMAIN_KEYWORDS;
    }
  }

  return null;
}

/**
 * Converts PROMIS raw score to T-score using lookup tables
 */
export function convertToTScore(domain: string, rawScore: number): number {
  const table = PROMIS_T_SCORE_TABLES[domain];
  if (!table) return 50; // Default to population mean if domain not found

  // Clamp raw score to valid range (4-20)
  const clampedScore = Math.max(4, Math.min(20, rawScore));
  return table[clampedScore] ?? 50;
}

/**
 * Calculates PROMIS-29 scores from raw survey responses
 */
export function calculatePromisScore(
  responses: SurveyResponse[],
  sessionId: number,
  leadId: number,
  completedOn: string,
  milestone: PromisMilestone
): PromisScore {
  // Group responses by domain
  const domainRawScores: Record<string, number[]> = {
    physical_function: [],
    anxiety: [],
    depression: [],
    fatigue: [],
    sleep_disturbance: [],
    social_roles: [],
    pain_interference: [],
  };

  let painIntensity: number | null = null;

  // Process each response
  for (const response of responses) {
    if (!response.question_text) continue;

    const text = response.question_text.toLowerCase();

    // Check for pain intensity (0-10 scale)
    if (text.includes('pain intensity') || text.includes('rate your pain')) {
      painIntensity = response.answer_numeric ?? null;
      continue;
    }

    const domain = categorizePromisQuestion(response.question_text);
    if (domain && domainRawScores[domain]) {
      const score = mapPromisAnswer(response.answer_text);
      domainRawScores[domain].push(score);
    }
  }

  // Calculate T-scores for each domain
  const tScores: PromisTScores = {
    physical_function: 50,
    anxiety: 50,
    depression: 50,
    fatigue: 50,
    sleep_disturbance: 50,
    social_roles: 50,
    pain_interference: 50,
  };

  for (const [domain, scores] of Object.entries(domainRawScores)) {
    if (scores.length > 0) {
      const rawTotal = scores.reduce((sum, score) => sum + score, 0);
      tScores[domain as keyof PromisTScores] = convertToTScore(domain, rawTotal);
    }
  }

  // Calculate overall mean T-score
  const tScoreValues = Object.values(tScores);
  const overallMean = tScoreValues.reduce((sum, score) => sum + score, 0) / tScoreValues.length;

  return {
    session_id: sessionId,
    lead_id: leadId,
    completed_on: completedOn,
    milestone,
    t_scores: tScores,
    pain_intensity: painIntensity,
    overall_mean: Math.round(overallMean * 10) / 10, // Round to 1 decimal
  };
}

// ============================================
// TIMELINE & MILESTONE UTILITIES
// ============================================

/**
 * Calculates week number from program start date
 */
export function calculateWeekNumber(surveyDate: Date, programStartDate: Date): number {
  const diffTime = surveyDate.getTime() - programStartDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
}

/**
 * Identifies PROMIS-29 milestone based on timing
 * Baseline: 0-2 weeks
 * Mid: 5-7 weeks
 * End: 11-13 weeks
 */
export function identifyPromisMilestone(surveyDate: Date, programStartDate: Date): PromisMilestone {
  const weekNumber = calculateWeekNumber(surveyDate, programStartDate);

  if (weekNumber <= 2) return 'baseline';
  if (weekNumber >= 5 && weekNumber <= 7) return 'mid';
  if (weekNumber >= 11) return 'end';

  // Default to closest milestone
  if (weekNumber < 5) return 'baseline';
  if (weekNumber < 11) return 'mid';
  return 'end';
}

/**
 * Formats week number with ordinal suffix (1st, 2nd, 3rd, etc.)
 */
export function formatWeekOrdinal(weekNumber: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = weekNumber % 100;
  return `${weekNumber}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

// ============================================
// IMPROVEMENT & CHANGE CALCULATIONS
// ============================================

/**
 * Calculates percentage improvement for MSQ scores
 * Negative change = improvement (lower scores are better)
 */
export function calculateMsqImprovement(baselineScore: number, currentScore: number): number {
  if (baselineScore === 0) return 0;
  const change = ((baselineScore - currentScore) / baselineScore) * 100;
  return Math.round(change * 10) / 10; // Round to 1 decimal
}

/**
 * Calculates T-score change for PROMIS domains
 * Positive change for symptom domains = worsening
 * Positive change for function domains = improvement
 */
export function calculatePromisChange(baselineTScore: number, currentTScore: number): number {
  const change = currentTScore - baselineTScore;
  return Math.round(change * 10) / 10; // Round to 1 decimal
}

/**
 * Determines clinical significance of PROMIS T-score change
 */
export function assessPromisSignificance(change: number): 'none' | 'small' | 'moderate' | 'large' {
  const absChange = Math.abs(change);
  if (absChange < 5) return 'none';
  if (absChange < 10) return 'small';
  if (absChange < 15) return 'moderate';
  return 'large';
}

/**
 * Generates a human-readable change description
 */
export function describeChange(
  value: number,
  type: 'percentage' | 'tscore',
  isImprovement: boolean
): string {
  const absValue = Math.abs(value);
  const direction = isImprovement ? 'improvement' : 'worsening';

  if (type === 'percentage') {
    return `${absValue.toFixed(1)}% ${direction}`;
  } else {
    return `${absValue.toFixed(1)} T-score point ${direction}`;
  }
}

