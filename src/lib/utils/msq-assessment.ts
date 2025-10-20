/**
 * MSQ Clinical Dashboard - Core Calculation Utilities
 * 
 * This file contains all the business logic for:
 * - MSQ symptom domain mapping
 * - Severity calculations
 * - Trend analysis
 * - Clinical alert generation (rule-based)
 * - Food trigger analysis (rule-based)
 */

import type {
  MsqDomain,
  MsqAssessmentSummary,
  MsqDomainCard,
  MsqSymptomProgression,
  ClinicalAlert,
  ClinicalAlertType,
  FoodTriggerAnalysis,
  FoodTriggerCategory,
  FoodTriggerPriority,
  DomainTrendType,
  SeverityLevel,
  SurveyResponse,
  SurveyResponseSession,
} from '@/types/database.types';

// ============================================
// MSQ DOMAIN CONFIGURATION
// ============================================

// Domain metadata with emojis and colors
export const MSQ_DOMAIN_CONFIG: Record<
  MsqDomain,
  { label: string; emoji: string; color: string }
> = {
  head: { label: 'Head/Neurological', emoji: '🧠', color: '#8b5cf6' },
  eyes: { label: 'Eyes/Vision', emoji: '👁️', color: '#06b6d4' },
  ears: { label: 'Ears/Hearing', emoji: '👂', color: '#f59e0b' },
  nose: { label: 'Nose/Sinuses', emoji: '👃', color: '#10b981' },
  mouth_throat: { label: 'Mouth/Throat', emoji: '👄', color: '#ef4444' },
  skin: { label: 'Skin', emoji: '🌟', color: '#f97316' },
  lungs_chest: { label: 'Lungs/Chest', emoji: '🫁', color: '#6366f1' },
  digestive: { label: 'Digestive', emoji: '🍽️', color: '#84cc16' },
  joints_muscles: { label: 'Joints/Muscles', emoji: '💪', color: '#a855f7' },
  energy_mind_emotions: { label: 'Energy/Mind/Emotions', emoji: '⚡', color: '#14b8a6' },
};

// MSQ Question to Domain Mapping
// Maps question text keywords to domains
export function categorizeMsqQuestion(questionText: string): MsqDomain {
  const lower = questionText.toLowerCase();

  // Head/Neurological
  if (
    lower.includes('headache') ||
    lower.includes('faintness') ||
    lower.includes('dizziness') ||
    lower.includes('insomnia')
  ) {
    return 'head';
  }

  // Eyes
  if (
    lower.includes('watery') ||
    lower.includes('itchy eyes') ||
    lower.includes('swollen') ||
    lower.includes('reddened') ||
    lower.includes('sticky eyes') ||
    lower.includes('dark circles') ||
    lower.includes('blurred') ||
    lower.includes('puffy eyes')
  ) {
    return 'eyes';
  }

  // Ears
  if (
    lower.includes('itchy ears') ||
    lower.includes('earaches') ||
    lower.includes('ear infections') ||
    lower.includes('drainage from ear') ||
    lower.includes('ringing') ||
    lower.includes('hearing loss')
  ) {
    return 'ears';
  }

  // Nose
  if (
    lower.includes('stuffy nose') ||
    lower.includes('sinus problems') ||
    lower.includes('hay fever') ||
    lower.includes('sneezing attacks') ||
    lower.includes('excessive mucus')
  ) {
    return 'nose';
  }

  // Mouth/Throat
  if (
    lower.includes('chronic coughing') ||
    lower.includes('gagging') ||
    lower.includes('need to clear throat') ||
    lower.includes('sore throat') ||
    lower.includes('swollen') ||
    lower.includes('hoarseness') ||
    lower.includes('tongue') ||
    lower.includes('canker sores')
  ) {
    return 'mouth_throat';
  }

  // Skin
  if (
    lower.includes('acne') ||
    lower.includes('hives') ||
    lower.includes('rashes') ||
    lower.includes('hair loss') ||
    lower.includes('flushing') ||
    lower.includes('hot flashes') ||
    lower.includes('excessive sweating')
  ) {
    return 'skin';
  }

  // Lungs/Chest
  if (
    lower.includes('chest pain') ||
    lower.includes('chest congestion') ||
    lower.includes('asthma') ||
    lower.includes('bronchitis') ||
    lower.includes('shortness of breath') ||
    lower.includes('difficulty breathing')
  ) {
    return 'lungs_chest';
  }

  // Digestive
  if (
    lower.includes('nausea') ||
    lower.includes('vomiting') ||
    lower.includes('diarrhea') ||
    lower.includes('constipation') ||
    lower.includes('bloated') ||
    lower.includes('belching') ||
    lower.includes('intestinal') ||
    lower.includes('passing gas') ||
    lower.includes('heartburn') ||
    lower.includes('stomach')
  ) {
    return 'digestive';
  }

  // Joints/Muscles
  if (
    lower.includes('pain') ||
    lower.includes('aches in joints') ||
    lower.includes('arthritis') ||
    lower.includes('stiffness') ||
    lower.includes('limited movement') ||
    lower.includes('pain in muscles') ||
    lower.includes('feeling of weakness')
  ) {
    return 'joints_muscles';
  }

  // Energy/Mind/Emotions
  if (
    lower.includes('fatigue') ||
    lower.includes('apathy') ||
    lower.includes('lethargy') ||
    lower.includes('hyperactivity') ||
    lower.includes('restlessness') ||
    lower.includes('mood swings') ||
    lower.includes('anxiety') ||
    lower.includes('fear') ||
    lower.includes('nervousness') ||
    lower.includes('anger') ||
    lower.includes('irritability') ||
    lower.includes('aggressive') ||
    lower.includes('depressed') ||
    lower.includes('poor memory') ||
    lower.includes('confusion') ||
    lower.includes('poor concentration') ||
    lower.includes('poor coordination') ||
    lower.includes('difficulty making decisions') ||
    lower.includes('stuttering') ||
    lower.includes('slurred speech') ||
    lower.includes('learning disabilities')
  ) {
    return 'energy_mind_emotions';
  }

  // Default to energy/mind/emotions if unclear
  return 'energy_mind_emotions';
}

// ============================================
// SEVERITY CALCULATION
// ============================================

export function calculateSeverity(averageScore: number): SeverityLevel {
  if (averageScore === 0) return 'none';
  if (averageScore <= 1.5) return 'mild';
  if (averageScore <= 2.5) return 'moderate';
  return 'severe';
}

// ============================================
// TREND ANALYSIS
// ============================================

export function calculateTrend(scores: number[]): DomainTrendType {
  if (scores.length < 2) return 'stable';

  const first = scores[0]!; // Safe: we checked scores.length >= 2
  const last = scores[scores.length - 1]!; // Safe: we checked scores.length >= 2

  // Check if fluctuating (middle values differ significantly from start/end)
  if (scores.length >= 3) {
    const hasFluctuation = scores.some((score, idx) => {
      if (idx === 0 || idx === scores.length - 1) return false;
      const diff = Math.abs(score - first);
      return diff >= 2; // Significant change in middle
    });

    if (hasFluctuation && Math.abs(first - last) < 1) {
      return 'fluctuating';
    }
  }

  const diff = last - first;
  if (diff <= -1) return 'improving'; // Decreased by 1 or more
  if (diff >= 1) return 'worsening'; // Increased by 1 or more
  return 'stable';
}

export function generateTrendDescription(
  domain: MsqDomain,
  trend: DomainTrendType,
  symptoms: MsqSymptomProgression[]
): string {
  const config = MSQ_DOMAIN_CONFIG[domain];

  switch (trend) {
    case 'improving': {
      // Find best improved symptom
      const improved = symptoms
        .filter(s => s.trend === 'improving')
        .sort((a, b) => {
          const aDiff = a.scores[0]! - a.scores[a.scores.length - 1]!;
          const bDiff = b.scores[0]! - b.scores[b.scores.length - 1]!;
          return bDiff - aDiff;
        });

      if (improved.length > 0) {
        return `📉 Trend: Improving - ${improved[0]!.symptom_name.toLowerCase()} decreasing`;
      }
      return '📉 Trend: Improving overall';
    }

    case 'worsening': {
      // Find worst worsening symptom
      const worsened = symptoms
        .filter(s => s.trend === 'worsening')
        .sort((a, b) => {
          const aDiff = a.scores[a.scores.length - 1]! - a.scores[0]!;
          const bDiff = b.scores[b.scores.length - 1]! - b.scores[0]!;
          return bDiff - aDiff;
        });

      if (worsened.length > 0) {
        return `📈 Trend: Worsening - ${worsened[0]!.symptom_name.toLowerCase()} pattern`;
      }
      return '📈 Trend: Worsening overall';
    }

    case 'fluctuating': {
      const fluctuating = symptoms.filter(s => s.trend === 'fluctuating');
      if (fluctuating.length > 0) {
        return `⚡ Trend: Intermittent - ${fluctuating[0]!.symptom_name.toLowerCase()} spike`;
      }
      return '⚡ Trend: Intermittent patterns';
    }

    case 'stable':
    default:
      return '➡️ Trend: Stable symptoms';
  }
}

// ============================================
// CLINICAL ALERT RULES ENGINE
// ============================================

export function generateClinicalAlerts(
  domainCards: MsqDomainCard[],
  totalScore: number
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];

  // Count systems above threshold
  const systemsAbove2 = domainCards.filter(d => d.average_score > 2.0).length;
  const digestiveSystem = domainCards.find(d => d.domain === 'digestive');
  const digestiveScore = digestiveSystem?.average_score || 0;

  // ALERT 1: High Toxic Load (CRITICAL)
  // Rule: Multiple systems (3+) with avg score > 2.0 AND digestive worsening
  if (systemsAbove2 >= 3 && digestiveSystem?.trend === 'worsening') {
    alerts.push({
      type: 'critical',
      icon: '🚨',
      title: 'High Toxic Load Suspected',
      message: `Multiple system involvement (${systemsAbove2} systems) with worsening digestive symptoms. Consider comprehensive detoxification protocol and elimination diet.`,
    });
  }
  // Alternative: High total score even without multiple systems
  else if (totalScore > 60) {
    alerts.push({
      type: 'critical',
      icon: '🚨',
      title: 'High Toxic Load Suspected',
      message: `Total MSQ score of ${totalScore} indicates significant symptom burden. Consider comprehensive evaluation and intervention.`,
    });
  }

  // ALERT 2: Food Sensitivity Pattern (WARNING)
  // Rule: Digestive system fluctuating OR digestive score > 2.0
  if (
    digestiveSystem &&
    (digestiveSystem.trend === 'fluctuating' ||
      (digestiveScore > 2.0 && digestiveSystem.trend === 'worsening'))
  ) {
    const fluctuatingSymptoms = digestiveSystem.symptoms
      .filter(s => s.trend === 'fluctuating' || s.trend === 'worsening')
      .slice(0, 2)
      .map(s => {
        const scores = s.scores.join('→');
        return `${s.symptom_name.toLowerCase()} (${scores})`;
      })
      .join(', ');

    alerts.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Food Sensitivity Pattern',
      message: `Fluctuating GI symptoms${
        fluctuatingSymptoms ? `: ${fluctuatingSymptoms}` : ''
      } suggest specific food triggers. Recommend food diary and elimination testing.`,
    });
  }

  // ALERT 3: Some Symptoms Responding (IMPROVING)
  // Rule: At least 2 domains improving OR significant improvement in any domain
  const improvingDomains = domainCards.filter(d => d.trend === 'improving');

  if (improvingDomains.length >= 2) {
    const examples = improvingDomains
      .slice(0, 2)
      .map(d => {
        const improving = d.symptoms.find(s => s.trend === 'improving');
        if (improving) {
          const first = improving.scores[0]!;
          const last = improving.scores[improving.scores.length - 1]!;
          return `${d.domain_label.toLowerCase()} improving (${first}→${last})`;
        }
        return d.domain_label.toLowerCase();
      })
      .join(', ');

    alerts.push({
      type: 'improving',
      icon: '✅',
      title: 'Some Symptoms Responding',
      message: `${examples}. Current interventions showing partial benefit.`,
    });
  }
  // Alternative: Any domain with significant improvement (score dropped by 2+)
  else {
    const significantImprovement = domainCards.find(d => {
      const symptoms = d.symptoms;
      return symptoms.some(s => {
        if (s.scores.length >= 2) {
          const diff = s.scores[0]! - s.scores[s.scores.length - 1]!;
          return diff >= 2;
        }
        return false;
      });
    });

    if (significantImprovement) {
      alerts.push({
        type: 'improving',
        icon: '✅',
        title: 'Some Symptoms Responding',
        message: `${significantImprovement.domain_label} showing significant improvement. Current interventions showing benefit.`,
      });
    }
  }

  return alerts;
}

// ============================================
// FOOD TRIGGER RULES ENGINE
// ============================================

export function generateFoodTriggers(
  domainCards: MsqDomainCard[]
): FoodTriggerAnalysis {
  const highPriority: string[] = [];
  const moderatePriority: string[] = [];
  const considerTesting: string[] = [];
  const likelySafe: string[] = [];

  // Get domain scores
  const digestive = domainCards.find(d => d.domain === 'digestive');
  const head = domainCards.find(d => d.domain === 'head');
  const skin = domainCards.find(d => d.domain === 'skin');
  const joints = domainCards.find(d => d.domain === 'joints_muscles');
  const lungs = domainCards.find(d => d.domain === 'lungs_chest');
  const nose = domainCards.find(d => d.domain === 'nose');
  const mouth = domainCards.find(d => d.domain === 'mouth_throat');

  // HIGH PRIORITY TRIGGERS
  // Digestive system high score → Dairy & Gluten suspect
  if (digestive && digestive.average_score > 2.0) {
    const hasConstipation = digestive.symptoms.some(
      s =>
        s.symptom_name.toLowerCase().includes('constipation') &&
        s.scores[s.scores.length - 1]! > 1
    );
    const hasBloating = digestive.symptoms.some(
      s =>
        s.symptom_name.toLowerCase().includes('bloat') &&
        s.scores[s.scores.length - 1]! > 1
    );

    if (hasConstipation) {
      highPriority.push('Dairy products (constipation pattern)');
    }
    if (hasBloating || digestive.trend === 'worsening') {
      highPriority.push('Gluten/wheat (digestive inflammation)');
    }
  }

  // Multiple systems + high score → Processed foods
  const systemsAbove2 = domainCards.filter(d => d.average_score > 2.0).length;
  if (systemsAbove2 >= 3) {
    highPriority.push('Processed foods (multiple systems)');
  }

  // Neurological symptoms → Additives
  if (head && head.average_score > 2.0) {
    highPriority.push('Artificial additives (neurological)');
  }

  // MODERATE PRIORITY
  // Joints/Skin → Nightshades
  if (
    (joints && joints.average_score > 1.5) ||
    (skin && skin.average_score > 1.5)
  ) {
    moderatePriority.push('Nightshades (joint/skin reactions)');
  }

  // Mouth/Throat → Citrus
  if (mouth && mouth.average_score > 1.0) {
    moderatePriority.push('Citrus fruits (mouth/throat)');
  }

  // Skin/Digestive → Eggs
  if (
    (skin && skin.average_score > 1.0) ||
    (digestive && digestive.average_score > 1.5)
  ) {
    moderatePriority.push('Eggs (skin/digestive)');
  }

  // Respiratory → Nuts
  if (lungs && lungs.average_score > 1.0) {
    moderatePriority.push('Nuts/seeds (respiratory)');
  }

  // CONSIDER TESTING
  considerTesting.push('Soy products');
  considerTesting.push('Corn/corn syrup');
  considerTesting.push('Food colorings');
  considerTesting.push('Sulfites/preservatives');

  // LIKELY SAFE
  // Low digestive score → Rice likely safe
  if (!digestive || digestive.average_score < 1.5) {
    likelySafe.push('Rice (no GI correlation)');
  }
  likelySafe.push('Most vegetables');
  likelySafe.push('Lean proteins');
  likelySafe.push('Herbs/spices');

  const categories: FoodTriggerCategory[] = [
    {
      priority: 'high',
      title: '🚨 High Priority',
      foods: highPriority.length > 0 ? highPriority : ['No high-priority triggers identified'],
    },
    {
      priority: 'moderate',
      title: '⚠️ Moderate Priority',
      foods: moderatePriority.length > 0 ? moderatePriority : ['No moderate-priority triggers identified'],
    },
    {
      priority: 'consider',
      title: '📋 Consider Testing',
      foods: considerTesting,
    },
    {
      priority: 'safe',
      title: '🌱 Likely Safe',
      foods: likelySafe,
    },
  ];

  return {
    categories,
    explanation:
      'Based on MSQ symptom patterns and timing, the following food categories warrant investigation:',
  };
}

