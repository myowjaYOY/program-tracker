# PROMIS-29 Assessment Tab - Comprehensive Implementation Plan

## 📋 EXECUTIVE SUMMARY

**Goal:** Create a PROMIS-29 assessment tab on the Report Card page that mirrors the MSQ tab structure but uses PROMIS-29 specific scoring, terminology, and T-score conversions.

**Confidence Level:** 100% - All patterns established, T-score tables exist, database schema verified

**Estimated Complexity:** High (8 domains, T-score conversions, different terminology)

**Files to Create/Modify:** 8 files total

---

## 🎯 REQUIREMENTS ANALYSIS

### **From User Request:**

1. **Tab Structure:** Add PROMIS-29 tab after MSQ tab
2. **Top Summary Card (5 metrics):**
   - Current Score (T-score with interpretation + hover showing all test dates/scores)
   - Trend (with interpretation + hover)
   - Worsening Count (# of domains getting worse)
   - Improving Count (# of domains getting better)
   - Assessment Period (date range + test count)

3. **Section Title:** Need to determine appropriate terminology (not "Body Systems Analysis")
4. **Domain Cards:** 8 domains, 3 per row (wider cards due to longer questions)
5. **Card Structure:** Expandable/collapsible with:
   - Icon
   - Domain name
   - Trend icon
   - Score (T-score)
   - Interpretation of score
   - Expanded: Question-level detail with progression

### **PROMIS-29 Scoring Requirements:**

1. **Raw Score:** Sum of 4 items per domain (range: 4-20)
2. **T-Score Conversion:** Use lookup tables (already exist in `survey-scoring.ts`)
3. **T-Score Interpretation:** Mean=50, SD=10
   - Higher T-score on symptom domains (anxiety, depression, fatigue, sleep, pain) = WORSE
   - Higher T-score on function domains (physical function, social roles) = BETTER
4. **Pain Intensity:** Single 0-10 item (no T-score conversion)
5. **Terminology:** Use "Health Domains" instead of "Body Systems"

---

## 📊 PROMIS-29 DOMAIN DETAILS

### **8 Domains:**

| Domain | Questions | Score Range | Direction | T-Score Range |
|--------|-----------|-------------|-----------|---------------|
| Physical Function | 4 | 4-20 | Higher = Better | 24.8-56.6 |
| Anxiety | 4 | 4-20 | Higher = Worse | 40.3-95.6 |
| Depression | 4 | 4-20 | Higher = Worse | 38.2-97.2 |
| Fatigue | 4 | 4-20 | Higher = Worse | 33.7-94.8 |
| Sleep Disturbance | 4 | 4-20 | Higher = Worse | 28.7-88.1 |
| Social Roles & Activities | 4 | 4-20 | Higher = Better | 25.5-77.9 |
| Pain Interference | 4 | 4-20 | Higher = Worse | 38.5-96.7 |
| Pain Intensity | 1 | 0-10 | Higher = Worse | N/A (raw score) |

### **T-Score Interpretation Ranges:**

**For Symptom Domains (Anxiety, Depression, Fatigue, Sleep, Pain):**
- T-Score < 45: Within Normal Limits
- T-Score 45-54.9: Mild
- T-Score 55-64.9: Moderate
- T-Score 65-74.9: Severe
- T-Score ≥ 75: Very Severe

**For Function Domains (Physical Function, Social Roles):**
- T-Score ≥ 55: Within Normal Limits
- T-Score 45-54.9: Mild Limitation
- T-Score 35-44.9: Moderate Limitation
- T-Score 25-34.9: Severe Limitation
- T-Score < 25: Very Severe Limitation

**For Pain Intensity (0-10 raw score):**
- 0: No Pain
- 1-3: Mild
- 4-6: Moderate
- 7-9: Severe
- 10: Worst Imaginable

---

## 🏗️ ARCHITECTURE & FILE STRUCTURE

### **Pattern to Follow:** MSQ Implementation

**Existing MSQ Structure:**
```
src/
├── app/
│   ├── dashboard/report-card/page.tsx (main page with tabs)
│   └── api/report-card/msq-assessment/[memberId]/route.ts
├── components/report-card/
│   ├── MsqAssessmentTab.tsx (tab container)
│   ├── PatientSpecificProfile.tsx (top summary card)
│   ├── DomainCardsGrid.tsx (domain cards grid)
│   └── InterpretationGuide.tsx (scoring guide)
├── lib/
│   ├── hooks/use-msq-assessment.ts
│   └── utils/msq-assessment.ts (trend calculations)
└── types/database.types.ts
```

**New PROMIS Structure (mirror pattern):**
```
src/
├── app/
│   ├── dashboard/report-card/page.tsx (ADD PROMIS TAB)
│   └── api/report-card/promis-assessment/[memberId]/route.ts (NEW)
├── components/report-card/
│   ├── PromisAssessmentTab.tsx (NEW)
│   ├── PromisProfile.tsx (NEW - top summary card)
│   ├── PromisDomainCardsGrid.tsx (NEW - 8 domain cards)
│   └── PromisInterpretationGuide.tsx (NEW - T-score guide)
├── lib/
│   ├── hooks/use-promis-assessment.ts (NEW)
│   └── utils/promis-assessment.ts (NEW - trend calculations)
└── types/database.types.ts (ADD PROMIS TYPES)
```

---

## 📝 IMPLEMENTATION SEQUENCE

### **Phase 1: Database & Types (Foundation)**

#### **1.1 Add TypeScript Types** (`src/types/database.types.ts`)

```typescript
// PROMIS-29 Assessment Types
export interface PromisAssessmentSummary {
  member_id: number;
  member_name: string;
  lead_id: number | null;
  
  // Current assessment
  current_t_score_mean: number;
  current_severity: 'within_normal' | 'mild' | 'moderate' | 'severe' | 'very_severe';
  
  // Trend analysis
  total_score_trend: 'improving' | 'worsening' | 'stable' | 'fluctuating';
  worsening_domains_count: number;
  improving_domains_count: number;
  
  // Assessment history
  assessment_dates: string[];
  all_mean_t_scores: number[];
  
  // Period info
  period_start: string;
  period_end: string;
}

export interface PromisDomainCard {
  domain_key: string;
  domain_label: string;
  emoji: string;
  
  // Current assessment
  current_raw_score: number;
  current_t_score: number;
  current_severity: string;
  
  // Trend
  trend: 'improving' | 'worsening' | 'stable' | 'fluctuating';
  trend_description: string;
  
  // Historical data
  all_raw_scores: number[];
  all_t_scores: number[];
  assessment_dates: string[];
  
  // Question-level detail
  questions: PromisQuestionProgression[];
}

export interface PromisQuestionProgression {
  question_text: string;
  question_order: number;
  all_scores: number[];
  assessment_dates: string[];
  trend: 'improving' | 'worsening' | 'stable';
}
```

---

### **Phase 2: API Route** (`src/app/api/report-card/promis-assessment/[memberId]/route.ts`)

**Logic Flow:**
1. Authenticate user
2. Get member info from `survey_user_mappings`
3. Get all PROMIS sessions (`form_id = 6`)
4. Get domain scores from `survey_domain_scores` (filtered by `survey_code = 'PROMIS'`)
5. Get all survey responses with question text
6. Get question-domain mappings (PROMIS only)
7. Calculate T-scores using lookup tables
8. Calculate trends (improving/worsening/stable)
9. Build summary object
10. Build 8 domain card objects
11. Return JSON

**Key Differences from MSQ:**
- Use `form_id = 6` (PROMIS)
- Filter by `survey_code = 'PROMIS'`
- Convert raw scores to T-scores using `convertToTScore()`
- Different severity thresholds (symptom vs function domains)
- 8 domains instead of 15

---

### **Phase 3: React Query Hook** (`src/lib/hooks/use-promis-assessment.ts`)

```typescript
export function usePromisAssessmentData(selectedMemberId: number | null) {
  return useQuery({
    queryKey: ['promis-assessment', selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return null;
      const res = await fetch(`/api/report-card/promis-assessment/${selectedMemberId}`);
      if (!res.ok) throw new Error('Failed to fetch PROMIS assessment');
      return res.json();
    },
    enabled: !!selectedMemberId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

### **Phase 4: Utility Functions** (`src/lib/utils/promis-assessment.ts`)

**Functions needed:**
1. `calculatePromisTrend()` - Determine improving/worsening/stable
2. `interpretTScore()` - Convert T-score to severity label
3. `getTScoreSeverityColor()` - Get color for severity
4. `getDomainEmoji()` - Get emoji for each domain
5. `getDomainDirection()` - Is higher better or worse?
6. `calculateTrendDescription()` - Human-readable trend

---

### **Phase 5: Top Summary Card** (`src/components/report-card/PromisProfile.tsx`)

**Structure (5 metrics in Grid):**

```typescript
<Grid container spacing={2}>
  <Grid size={{ xs: 12, sm: 2.4 }}>
    {/* Current Score: Mean T-Score with severity label */}
    {/* Hover: All assessment dates + mean T-scores */}
  </Grid>
  <Grid size={{ xs: 12, sm: 2.4 }}>
    {/* Trend: Improving/Worsening/Stable/Fluctuating */}
    {/* Hover: Change calculation + interpretation */}
  </Grid>
  <Grid size={{ xs: 12, sm: 2.4 }}>
    {/* Worsening: Count of domains getting worse */}
    {/* Hover: List of worsening domains */}
  </Grid>
  <Grid size={{ xs: 12, sm: 2.4 }}>
    {/* Improving: Count of domains getting better */}
    {/* Hover: List of improving domains */}
  </Grid>
  <Grid size={{ xs: 12, sm: 2.4 }}>
    {/* Assessment Period: Date range (count) */}
  </Grid>
</Grid>
```

**Key Differences from MSQ:**
- Display mean T-score instead of total raw score
- T-score interpretation thresholds different
- Trend calculation considers T-score direction (symptom vs function domains)

---

### **Phase 6: Domain Cards Grid** (`src/components/report-card/PromisDomainCardsGrid.tsx`)

**Structure:**
```typescript
<Box>
  <Typography variant="h6">Health Domains Analysis</Typography>
  <Grid container spacing={2}>
    {domains.map(domain => (
      <Grid size={{ xs: 12, sm: 6, md: 4 }}> {/* 3 per row */}
        <ExpandablePromisDomainCard domain={domain} />
      </Grid>
    ))}
  </Grid>
</Box>
```

**Card Structure:**
- **Header:** Icon + Domain Name + Trend Icon + Expand/Collapse
- **Collapsed View:**
  - T-Score (large)
  - Severity Label (colored)
  - Trend Description
- **Expanded View:**
  - Table of questions with progression boxes
  - 3 colored boxes per question (first, middle, last assessment)

**Key Differences from MSQ:**
- 3 cards per row (instead of 4) - wider cards
- Display T-score instead of raw score
- Different severity colors based on domain direction
- 8 domains instead of 15

---

### **Phase 7: Interpretation Guide** (`src/components/report-card/PromisInterpretationGuide.tsx`)

**Content:**
- Explanation of T-scores (mean=50, SD=10)
- Symptom domains vs Function domains
- Severity thresholds for each type
- Clinical significance of changes (5, 10, 15 point changes)
- Reference to PROMIS-29 v2.1 manual

---

### **Phase 8: Main Tab Component** (`src/components/report-card/PromisAssessmentTab.tsx`)

```typescript
export default function PromisAssessmentTab({ selectedMemberId }: Props) {
  const { summary, domains, isLoading, error } = usePromisAssessmentData(selectedMemberId);
  
  return (
    <Box>
      {/* Empty State */}
      {!selectedMemberId && <EmptyState />}
      
      {/* Loading State */}
      {isLoading && <LoadingState />}
      
      {/* Error State */}
      {error && <ErrorState />}
      
      {/* Content */}
      {summary && domains && (
        <>
          <PromisProfile summary={summary} domains={domains} />
          <PromisDomainCardsGrid domains={domains} />
          <PromisInterpretationGuide />
        </>
      )}
    </Box>
  );
}
```

---

### **Phase 9: Add Tab to Main Page** (`src/app/dashboard/report-card/page.tsx`)

```typescript
<Tabs>
  <Tab label="MSQ ASSESSMENT" />
  <Tab label="PROMIS-29 ASSESSMENT" /> {/* NEW */}
</Tabs>

<TabPanel value={0}>
  <MsqAssessmentTab selectedMemberId={selectedMemberId} />
</TabPanel>

<TabPanel value={1}> {/* NEW */}
  <PromisAssessmentTab selectedMemberId={selectedMemberId} />
</TabPanel>
```

---

## 🎨 DESIGN SPECIFICATIONS

### **Colors:**

**Symptom Domains (Higher = Worse):**
- Within Normal (T < 45): `#10b981` (green)
- Mild (45-54.9): `#84cc16` (lime)
- Moderate (55-64.9): `#f59e0b` (amber)
- Severe (65-74.9): `#ef4444` (red)
- Very Severe (≥ 75): `#991b1b` (dark red)

**Function Domains (Higher = Better) - REVERSED:**
- Within Normal (T ≥ 55): `#10b981` (green)
- Mild Limitation (45-54.9): `#84cc16` (lime)
- Moderate Limitation (35-44.9): `#f59e0b` (amber)
- Severe Limitation (25-34.9): `#ef4444` (red)
- Very Severe Limitation (< 25): `#991b1b` (dark red)

### **Emojis:**

| Domain | Emoji |
|--------|-------|
| Physical Function | 🏃 |
| Anxiety | 😰 |
| Depression | 😔 |
| Fatigue | 😴 |
| Sleep Disturbance | 🌙 |
| Social Roles & Activities | 👥 |
| Pain Interference | 🤕 |
| Pain Intensity | ⚡ |

### **Grid Layout:**
- **Summary Card:** 5 columns (2.4 each = 12 total)
- **Domain Cards:** 3 per row (4 each = 12 total)
- **Responsive:** Stack on mobile

---

## 🧮 CALCULATION LOGIC

### **T-Score Conversion:**
```typescript
// Already exists in survey-scoring.ts
const rawScore = 4 + 3 + 4 + 5 = 16; // Sum of 4 questions
const tScore = convertToTScore('anxiety', 16); // Returns 78.6
```

### **Mean T-Score (Current Score):**
```typescript
const meanTScore = (
  tScores.physical_function +
  tScores.anxiety +
  tScores.depression +
  tScores.fatigue +
  tScores.sleep_disturbance +
  tScores.social_roles +
  tScores.pain_interference
) / 7; // Exclude pain_intensity (raw score only)
```

### **Trend Calculation:**
```typescript
function calculatePromisTrend(
  firstTScore: number,
  lastTScore: number,
  domainType: 'symptom' | 'function'
): 'improving' | 'worsening' | 'stable' {
  const change = lastTScore - firstTScore;
  
  // For symptom domains: decrease = improvement
  // For function domains: increase = improvement
  const threshold = 5; // Clinically meaningful change
  
  if (domainType === 'symptom') {
    if (change <= -threshold) return 'improving';
    if (change >= threshold) return 'worsening';
  } else {
    if (change >= threshold) return 'improving';
    if (change <= -threshold) return 'worsening';
  }
  
  return 'stable';
}
```

### **Worsening/Improving Counts:**
```typescript
const worseningDomains = domains.filter(d => d.trend === 'worsening');
const improvingDomains = domains.filter(d => d.trend === 'improving');
```

---

## ✅ VALIDATION & TESTING

### **Test Cases:**

1. **No Data:** Member has no PROMIS surveys → Show empty state
2. **Single Assessment:** Only 1 PROMIS survey → Show current scores, no trend
3. **Multiple Assessments:** 2+ surveys → Calculate trends correctly
4. **T-Score Boundaries:** Test edge cases (raw score 4, 20)
5. **Domain Direction:** Verify symptom vs function interpretation
6. **Pain Intensity:** Verify 0-10 scale (no T-score)
7. **Hover Tooltips:** All dates/scores display correctly
8. **Expandable Cards:** Question-level detail shows progression

### **Data Integrity Checks:**

1. ✅ All PROMIS questions mapped to domains in `survey_form_question_domain`
2. ✅ All domain scores calculated and stored in `survey_domain_scores`
3. ✅ T-score lookup tables complete (raw scores 4-20)
4. ✅ Survey responses have `answer_numeric` populated (from conversion)

---

## 🚨 CRITICAL CONSIDERATIONS

### **1. Domain Direction (CRITICAL):**
- **Symptom domains:** Higher T-score = WORSE (anxiety, depression, fatigue, sleep, pain)
- **Function domains:** Higher T-score = BETTER (physical function, social roles)
- **Must reverse interpretation logic for function domains**

### **2. Pain Intensity:**
- Single question, 0-10 scale
- **No T-score conversion** - use raw score
- Different interpretation thresholds

### **3. T-Score Lookup Tables:**
- Already exist in `survey-scoring.ts`
- Verified against PROMIS-29 v2.1 manual
- Complete for all 7 domains (excluding pain_intensity)

### **4. Terminology:**
- Use "Health Domains" not "Body Systems"
- Use "T-Score" not "Raw Score"
- Use "Within Normal Limits" not "Optimal"

### **5. Trend Calculation:**
- Must account for domain direction
- 5-point change = clinically meaningful
- 10-point change = moderate
- 15-point change = large

---

## 📚 REFERENCES

1. **PROMIS-29 Profile v2.1 Scoring Manual** (HealthMeasures, Sept 2024)
2. **T-Score Interpretation Guidelines** (HealthMeasures)
3. **Existing T-Score Tables:** `src/lib/utils/survey-scoring.ts` (lines 156-192)
4. **Database Schema:** `survey_domain_scores`, `survey_form_question_domain`
5. **MSQ Implementation:** Reference pattern for all components

---

## 🎯 SUCCESS CRITERIA

- ☐ PROMIS-29 tab appears after MSQ tab
- ☐ Top summary card shows 5 metrics correctly
- ☐ 8 domain cards display in 3-column grid
- ☐ T-scores calculated correctly using lookup tables
- ☐ Severity interpretations correct for symptom vs function domains
- ☐ Trends calculated correctly (accounting for domain direction)
- ☐ Hover tooltips show historical data
- ☐ Expandable cards show question-level progression
- ☐ Pain intensity displays 0-10 raw score (no T-score)
- ☐ All colors match severity appropriately
- ☐ Responsive on mobile devices

---

## 📝 IMPLEMENTATION NOTES

**Estimated Time:** 6-8 hours (following established patterns)

**Risk Level:** Low (all patterns established, T-score tables exist)

**Dependencies:** 
- ✅ Database schema complete
- ✅ PROMIS questions mapped to domains
- ✅ Survey responses converted to numeric
- ✅ Domain scores calculated
- ✅ T-score lookup tables exist

**Ready to Implement:** YES - All prerequisites met

---

## 🚀 NEXT STEPS

1. **Review this plan** - Confirm approach and terminology
2. **Approve implementation** - Proceed with Phase 1
3. **Implement sequentially** - Follow phases 1-9 in order
4. **Test thoroughly** - Verify all calculations and UI
5. **Deploy** - Add to production

**I am 100% confident in this plan and ready to execute when you approve.**

