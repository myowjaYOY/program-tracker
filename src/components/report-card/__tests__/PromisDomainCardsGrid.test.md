# PromisDomainCardsGrid Component - Test Documentation

## Component Overview
Grid of 8 PROMIS-29 domain cards (3 per row) with expandable question details.

## Props
```typescript
interface PromisDomainCardsGridProps {
  domains: PromisDomainCard[];
}
```

## Layout
- **Grid:** 3 cards per row (xs=12, sm=6, md=4)
- **Sorting:** Domains sorted by standard PROMIS order
- **Title:** "Health Domains Analysis"

## Card Structure

### Collapsed State (Default)
1. **Header Row:**
   - Domain emoji (20px)
   - Domain label (bold, truncated)
   - "Trend:" label + emoji
   - Expand/collapse arrow

2. **Score Row:**
   - T-score chip (e.g., "T: 65")
   - Severity label (e.g., "Moderate")
   - Both color-coded by severity

### Expanded State
- **Question Table:**
  - Column 1: Question text
  - Column 2: Progress boxes (colored squares with scores)
  - Scrollable (max 300px height)
  - Sticky header

## Color Coding

### T-Score Severity Colors
- Within Normal: Green (#10b981)
- Mild: Amber (#f59e0b)
- Moderate: Red (#ef4444)
- Severe: Dark Red (#dc2626)
- Very Severe: Very Dark Red (#991b1b)

### Question Score Colors (1-5 scale)
- 1 (Never): Green (#10b981)
- 2 (Rarely): Light Green (#84cc16)
- 3 (Sometimes): Orange (#f59e0b)
- 4 (Often): Red (#ef4444)
- 5 (Always): Dark Red (#991b1b)

### Pain Intensity Colors (0-10 scale)
- 0: Green (#10b981)
- 1-3: Light Green (#84cc16)
- 4-6: Orange (#f59e0b)
- 7-8: Red (#ef4444)
- 9-10: Dark Red (#991b1b)

## Features
✅ Expandable/collapsible cards
✅ Color-coded by severity
✅ Trend emojis (✅ improving, ⚠️ worsening, ➡️ stable)
✅ Question-level progression
✅ Responsive grid (stacks on mobile)
✅ Sorted by standard PROMIS order
✅ Special handling for pain intensity (0-10 scale)

## Test Cases

### Test 1: 8 Domains Display
- Input: 8 domain cards
- Expected: 3 rows (3+3+2 cards)

### Test 2: Domain Sorting
- Input: Unsorted domains
- Expected: Displayed in PROMIS standard order

### Test 3: Expand/Collapse
- Action: Click expand arrow
- Expected: Question table appears

### Test 4: Pain Intensity Special Handling
- Input: pain_intensity domain with 0-10 scores
- Expected: Different color scale applied

### Test 5: Null T-Score
- Input: Domain with null T-score
- Expected: "N/A" displayed in chip

## Status
✅ TypeScript: 0 errors
✅ Linting: 0 errors
✅ Follows MSQ pattern
✅ Ready for integration

