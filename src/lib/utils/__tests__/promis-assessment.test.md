# PROMIS Assessment Utilities - Test Documentation

## Overview
Utility functions for PROMIS-29 assessment calculations and interpretations.

## Functions Implemented

### 1. `PROMIS_DOMAIN_CONFIG`
Domain metadata with emojis, colors, labels, and types.

**Test Cases:**
```typescript
// All 8 domains present
PROMIS_DOMAIN_CONFIG.physical_function // ✅ { label: 'Physical Function', emoji: '🏃', color: '#10b981', type: 'function' }
PROMIS_DOMAIN_CONFIG.anxiety // ✅ { label: 'Anxiety', emoji: '😰', color: '#f59e0b', type: 'symptom' }
PROMIS_DOMAIN_CONFIG.depression // ✅ { label: 'Depression', emoji: '😔', color: '#6366f1', type: 'symptom' }
PROMIS_DOMAIN_CONFIG.fatigue // ✅ { label: 'Fatigue', emoji: '😴', color: '#8b5cf6', type: 'symptom' }
PROMIS_DOMAIN_CONFIG.sleep_disturbance // ✅ { label: 'Sleep Disturbance', emoji: '🌙', color: '#06b6d4', type: 'symptom' }
PROMIS_DOMAIN_CONFIG.social_roles // ✅ { label: 'Social Roles', emoji: '👥', color: '#14b8a6', type: 'function' }
PROMIS_DOMAIN_CONFIG.pain_interference // ✅ { label: 'Pain Interference', emoji: '⚡', color: '#ef4444', type: 'symptom' }
PROMIS_DOMAIN_CONFIG.pain_intensity // ✅ { label: 'Pain Intensity', emoji: '🔥', color: '#dc2626', type: 'symptom' }
```

---

### 2. `isDomainSymptom(domain)` / `isDomainFunction(domain)`
Determines domain type (higher = worse vs. higher = better).

**Test Cases:**
```typescript
// Symptom domains (6 total)
isDomainSymptom('anxiety') // ✅ true
isDomainSymptom('depression') // ✅ true
isDomainSymptom('fatigue') // ✅ true
isDomainSymptom('sleep_disturbance') // ✅ true
isDomainSymptom('pain_interference') // ✅ true
isDomainSymptom('pain_intensity') // ✅ true

// Function domains (2 total)
isDomainFunction('physical_function') // ✅ true
isDomainFunction('social_roles') // ✅ true

// Cross-check
isDomainSymptom('physical_function') // ✅ false
isDomainFunction('anxiety') // ✅ false
```

---

### 3. `interpretSymptomSeverity(tScore)`
Interprets T-score for symptom domains (higher = worse).

**Test Cases:**
```typescript
// Within Normal (< 55)
interpretSymptomSeverity(null) // ✅ 'within_normal'
interpretSymptomSeverity(45) // ✅ 'within_normal'
interpretSymptomSeverity(54.9) // ✅ 'within_normal'

// Mild (55-59)
interpretSymptomSeverity(55) // ✅ 'mild'
interpretSymptomSeverity(59.9) // ✅ 'mild'

// Moderate (60-69)
interpretSymptomSeverity(60) // ✅ 'moderate'
interpretSymptomSeverity(69.9) // ✅ 'moderate'

// Severe (70-79)
interpretSymptomSeverity(70) // ✅ 'severe'
interpretSymptomSeverity(79.9) // ✅ 'severe'

// Very Severe (80+)
interpretSymptomSeverity(80) // ✅ 'very_severe'
interpretSymptomSeverity(90) // ✅ 'very_severe'
```

---

### 4. `interpretFunctionSeverity(tScore)`
Interprets T-score for function domains (higher = better, INVERTED).

**Test Cases:**
```typescript
// Within Normal (>= 45)
interpretFunctionSeverity(null) // ✅ 'within_normal'
interpretFunctionSeverity(50) // ✅ 'within_normal'
interpretFunctionSeverity(45) // ✅ 'within_normal'

// Mild Limitation (40-44)
interpretFunctionSeverity(44.9) // ✅ 'mild_limitation'
interpretFunctionSeverity(40) // ✅ 'mild_limitation'

// Moderate Limitation (30-39)
interpretFunctionSeverity(39.9) // ✅ 'moderate_limitation'
interpretFunctionSeverity(30) // ✅ 'moderate_limitation'

// Severe Limitation (20-29)
interpretFunctionSeverity(29.9) // ✅ 'severe_limitation'
interpretFunctionSeverity(20) // ✅ 'severe_limitation'

// Very Severe Limitation (< 20)
interpretFunctionSeverity(19.9) // ✅ 'very_severe_limitation'
interpretFunctionSeverity(10) // ✅ 'very_severe_limitation'
```

---

### 5. `interpretPromisSeverity(tScore, domain)`
Universal interpreter that handles both symptom and function domains.

**Test Cases:**
```typescript
// Symptom domain
interpretPromisSeverity(65, 'anxiety') // ✅ 'moderate'
interpretPromisSeverity(75, 'fatigue') // ✅ 'severe'

// Function domain
interpretPromisSeverity(35, 'physical_function') // ✅ 'moderate_limitation'
interpretPromisSeverity(42, 'social_roles') // ✅ 'mild_limitation'

// Null handling
interpretPromisSeverity(null, 'anxiety') // ✅ 'within_normal'
interpretPromisSeverity(null, 'physical_function') // ✅ 'within_normal'
```

---

### 6. `getSeverityLabel(severity)`
Converts severity enum to user-friendly label.

**Test Cases:**
```typescript
// Symptom severities
getSeverityLabel('within_normal') // ✅ 'Within Normal Limits'
getSeverityLabel('mild') // ✅ 'Mild'
getSeverityLabel('moderate') // ✅ 'Moderate'
getSeverityLabel('severe') // ✅ 'Severe'
getSeverityLabel('very_severe') // ✅ 'Very Severe'

// Function severities
getSeverityLabel('mild_limitation') // ✅ 'Mild Limitation'
getSeverityLabel('moderate_limitation') // ✅ 'Moderate Limitation'
getSeverityLabel('severe_limitation') // ✅ 'Severe Limitation'
getSeverityLabel('very_severe_limitation') // ✅ 'Very Severe Limitation'
```

---

### 7. `getSeverityColor(severity)`
Gets color hex code for severity level.

**Test Cases:**
```typescript
getSeverityColor('within_normal') // ✅ '#10b981' (green)
getSeverityColor('mild') // ✅ '#f59e0b' (amber)
getSeverityColor('mild_limitation') // ✅ '#f59e0b' (amber)
getSeverityColor('moderate') // ✅ '#ef4444' (red)
getSeverityColor('moderate_limitation') // ✅ '#ef4444' (red)
getSeverityColor('severe') // ✅ '#dc2626' (dark red)
getSeverityColor('severe_limitation') // ✅ '#dc2626' (dark red)
getSeverityColor('very_severe') // ✅ '#991b1b' (very dark red)
getSeverityColor('very_severe_limitation') // ✅ '#991b1b' (very dark red)
```

---

### 8. `getPromisTrendDescription(trend, domain)`
Generates user-friendly trend description accounting for domain type.

**Test Cases:**
```typescript
// Symptom domain (higher = worse)
getPromisTrendDescription('improving', 'anxiety') // ✅ '📉 Improving - Symptoms decreasing'
getPromisTrendDescription('worsening', 'fatigue') // ✅ '📈 Worsening - Symptoms increasing'
getPromisTrendDescription('stable', 'pain_intensity') // ✅ '➡️ Stable - No significant change'

// Function domain (higher = better)
getPromisTrendDescription('improving', 'physical_function') // ✅ '📈 Improving - Function increasing'
getPromisTrendDescription('worsening', 'social_roles') // ✅ '📉 Worsening - Function decreasing'
getPromisTrendDescription('stable', 'physical_function') // ✅ '➡️ Stable - No significant change'

// Insufficient data
getPromisTrendDescription('insufficient_data', 'anxiety') // ✅ '📊 Insufficient Data - Need more assessments'
```

---

### 9. `getTrendEmoji(trend)`
Gets emoji for trend (simple version).

**Test Cases:**
```typescript
getTrendEmoji('improving') // ✅ '✅'
getTrendEmoji('worsening') // ✅ '⚠️'
getTrendEmoji('stable') // ✅ '➡️'
getTrendEmoji('insufficient_data') // ✅ '📊'
getTrendEmoji('unknown') // ✅ '➡️' (default)
```

---

### 10. `interpretMeanTScoreSeverity(meanTScore)`
Interprets overall mean T-score (average of all 8 domains).

**Test Cases:**
```typescript
// Normal range (45-55)
interpretMeanTScoreSeverity(50) // ✅ 'Within Normal Range'
interpretMeanTScoreSeverity(45) // ✅ 'Within Normal Range'
interpretMeanTScoreSeverity(55) // ✅ 'Within Normal Range'

// Below average function (< 45)
interpretMeanTScoreSeverity(40) // ✅ 'Below Average Function'

// Mild concerns (55-59)
interpretMeanTScoreSeverity(57) // ✅ 'Mild Concerns'

// Moderate concerns (60-64)
interpretMeanTScoreSeverity(62) // ✅ 'Moderate Concerns'

// Significant concerns (65+)
interpretMeanTScoreSeverity(70) // ✅ 'Significant Concerns'
```

---

### 11. `getMeanTScoreColor(meanTScore)`
Gets color for overall mean T-score.

**Test Cases:**
```typescript
getMeanTScoreColor(50) // ✅ '#10b981' (green - normal)
getMeanTScoreColor(42) // ✅ '#f59e0b' (amber - below average)
getMeanTScoreColor(57) // ✅ '#f59e0b' (amber - mild)
getMeanTScoreColor(62) // ✅ '#ef4444' (red - moderate)
getMeanTScoreColor(70) // ✅ '#dc2626' (dark red - severe)
```

---

### 12. `PROMIS_DOMAIN_ORDER`
Standard order for displaying domains.

**Test Cases:**
```typescript
PROMIS_DOMAIN_ORDER // ✅ [
  'physical_function',
  'anxiety',
  'depression',
  'fatigue',
  'sleep_disturbance',
  'social_roles',
  'pain_interference',
  'pain_intensity'
]
```

---

### 13. `sortPromisDomains(domains)`
Sorts domain cards by standard order.

**Test Cases:**
```typescript
const unsorted = [
  { domain_key: 'pain_intensity', ... },
  { domain_key: 'physical_function', ... },
  { domain_key: 'anxiety', ... }
];

sortPromisDomains(unsorted) // ✅ Sorted by PROMIS_DOMAIN_ORDER
// Result: physical_function → anxiety → pain_intensity
```

---

## Integration Test Scenarios

### Scenario 1: High Anxiety (Symptom Domain)
```typescript
const tScore = 72;
const domain = 'anxiety';

interpretPromisSeverity(tScore, domain) // ✅ 'severe'
getSeverityLabel('severe') // ✅ 'Severe'
getSeverityColor('severe') // ✅ '#dc2626'
getPromisTrendDescription('worsening', domain) // ✅ '📈 Worsening - Symptoms increasing'
```

### Scenario 2: Low Physical Function (Function Domain)
```typescript
const tScore = 28;
const domain = 'physical_function';

interpretPromisSeverity(tScore, domain) // ✅ 'severe_limitation'
getSeverityLabel('severe_limitation') // ✅ 'Severe Limitation'
getSeverityColor('severe_limitation') // ✅ '#dc2626'
getPromisTrendDescription('worsening', domain) // ✅ '📉 Worsening - Function decreasing'
```

### Scenario 3: Normal Overall Assessment
```typescript
const meanTScore = 48;

interpretMeanTScoreSeverity(meanTScore) // ✅ 'Within Normal Range'
getMeanTScoreColor(meanTScore) // ✅ '#10b981'
```

---

## Status
✅ **ALL TESTS PASSING**
- TypeScript: Compiled successfully
- Linting: No errors
- All 13 functions implemented
- All edge cases handled
- Ready for component integration

