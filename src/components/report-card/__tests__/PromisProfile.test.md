# PromisProfile Component - Test Documentation

## Component Overview
Top summary card for PROMIS-29 assessment displaying key metrics.

## Props
```typescript
interface PromisProfileProps {
  summary: PromisAssessmentSummary;
}
```

## Display Elements

### 1. Current Mean T-Score (Column 1)
- **Value:** `summary.current_mean_t_score` (formatted to 1 decimal)
- **Label:** Severity interpretation (e.g., "Within Normal Range")
- **Color:** Dynamic based on T-score
- **Tooltip:** Shows all historical mean T-scores with dates

### 2. Trend (Column 2)
- **Value:** Trend label ("Improving", "Worsening", "Stable")
- **Icon:** Dynamic (TrendingUp, TrendingDown, TrendingFlat)
- **Color:** Green (improving), Red (worsening), Blue (stable)
- **Description:** Context-specific text

### 3. Worsening Domains (Column 3)
- **Value:** `summary.worsening_domains_count`
- **Color:** Red (#ef4444)
- **Icon:** TrendingDown
- **Label:** "Domain" or "Domains" (singular/plural)

### 4. Improving Domains (Column 4)
- **Value:** `summary.improving_domains_count`
- **Color:** Green (#10b981)
- **Icon:** TrendingUp
- **Label:** "Domain" or "Domains" (singular/plural)

### 5. Assessment Period (Column 5)
- **Value:** Date range or single date
- **Format:** "Jan 15 - Mar 20, 2024" or "Jan 15, 2024"
- **Icon:** DateRange
- **Subtext:** Number of assessments

## Visual Design
- **Card:** Outlined with left border (4px, color matches severity)
- **Background:** Light tint of severity color (~8% opacity)
- **Grid:** 5 columns on desktop (2.4 each), stacks on mobile
- **Spacing:** Consistent with MSQ profile

## Test Cases

### Test 1: Normal Range Score
```typescript
summary = {
  current_mean_t_score: 50.0,
  // ... other fields
}
// Expected: Green color, "Within Normal Range" label
```

### Test 2: High Score (Concerns)
```typescript
summary = {
  current_mean_t_score: 68.5,
  // ... other fields
}
// Expected: Dark red color, "Significant Concerns" label
```

### Test 3: Improving Trend
```typescript
summary = {
  total_score_trend: 'improving',
  // ... other fields
}
// Expected: Green TrendingUp icon, "Improving" label
```

### Test 4: Multiple Assessments
```typescript
summary = {
  assessment_dates: ['2024-01-15', '2024-02-15', '2024-03-15'],
  all_mean_t_scores: [55.2, 52.8, 50.1],
  // ... other fields
}
// Expected: Tooltip shows all 3 scores with dates
```

### Test 5: Single Assessment
```typescript
summary = {
  assessment_dates: ['2024-01-15'],
  period_start: '2024-01-15',
  period_end: '2024-01-15',
  // ... other fields
}
// Expected: Single date shown, "1 assessment" label
```

## Integration Points
- **Parent:** `PromisAssessmentTab.tsx`
- **Data Source:** `usePromisAssessmentData()` hook
- **Utilities:** `interpretMeanTScoreSeverity()`, `getMeanTScoreColor()`

## Status
✅ **READY FOR USE**
- TypeScript: Compiled successfully (0 errors)
- Linting: No errors
- Follows MSQ pattern exactly
- All props properly typed

