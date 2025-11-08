# Individual Member Analytics - Implementation Plan
**Phase 3: Analytics & Insights Tab on Report Card**

**Date:** 2024-11-08  
**Status:** Planning & Requirements Gathering  
**Goal:** Add cross-cutting, comparative analytics to Report Card page

---

## 📋 EXECUTIVE SUMMARY

### What We're Building
A new **"Analytics & Insights"** tab on the Report Card page that provides:
1. **Cross-cutting analysis** across the entire member journey (not repeating what's already shown)
2. **Comparative insights** showing how this member ranks vs. the population
3. **AI-powered recommendations** for coordinators based on patterns
4. **Risk scoring** to prioritize interventions

### Core Principle
**This is NOT about duplicating existing metrics.** The other tabs already show:
- ✅ Member Progress tab: Goals, wins, challenges, health vitals, compliance, timeline
- ✅ MSQ Assessment tab: Symptom burden scores and domain breakdown
- ✅ PROMIS-29 tab: Quality of life T-scores and domain analysis

**This tab answers:** "What does this member's OVERALL pattern tell us? How do they compare to others? What should we do about it?"

---

## 🔍 CURRENT STATE ANALYSIS

### A. Data Pipeline Architecture (CONFIRMED)

```
┌─────────────────────────────────────────────────────────────┐
│ WEEKLY WORKFLOW (Current System)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. YOU: Upload CSV file to Supabase Storage (weekly)       │
│                          ↓                                  │
│ 2. TRIGGER: Supabase Storage webhook                       │
│                          ↓                                  │
│ 3. EDGE FUNCTION: process-survey-import                    │
│    - Parse CSV (survey responses)                          │
│    - Insert into survey_response_sessions                  │
│    - Insert into survey_responses                          │
│    - Calculate MSQ domain scores (form_id = 3)             │
│    - Calculate PROMIS-29 domain scores (form_id = 6)       │
│                          ↓                                  │
│ 4. AUTO-TRIGGER: analyze-member-progress (batch mode)      │
│    - Fetch ALL survey data for each member                 │
│    - Calculate 40+ metrics (see below)                     │
│    - Call GPT-4o-mini for wins/challenges/goals            │
│    - Store in member_progress_summary table                │
│                          ↓                                  │
│ 5. DATA REMAINS STATIC for ~7 days until next upload       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Files:**
- **Import:** `supabase/functions/process-survey-import/index.ts` (1061 lines)
- **Analysis:** `supabase/functions/analyze-member-progress/index.ts` (1266 lines)
- **Storage:** `member_progress_summary` table (40+ columns)

---

### B. What Already Exists (✅ CONFIRMED)

#### 1. **Status Score Algorithm** (Lines 1091-1209)
**Calculation Logic:**
```
Total Score = 100 points distributed as:
├─ Protocol Compliance: 35 points (avg of 4 compliance metrics)
├─ Curriculum Progress: 35 points (On Track=100%, Behind=50%, Inactive=0%)
├─ Health Vitals: 20 points (5 metrics × 4 points: improving=4, stable=2, declining=0)
├─ Wins: 5 points (has wins = 5, no wins = 0)
└─ Challenges: 5 points (has challenges = 5, no challenges = 0)

Status Indicator:
├─ Green: ≥70 points
├─ Yellow: 40-69 points
└─ Red: <40 points
```

**Stored in:** `member_progress_summary.status_score` (integer, 0-100)

---

#### 2. **GPT-4o-mini Analysis** (Lines 700-895)
**What GPT Currently Does:**
- Analyzes last 10 survey sessions
- Extracts wins (positive progress, improvements)
- Extracts challenges (struggles, setbacks)
- Evaluates goal progress (on_track | at_risk | win | insufficient_data)

**Input Data:**
```json
{
  "member_goals": ["Goal 1", "Goal 2", "Goal 3"],
  "recent_surveys": [
    {
      "date": "2024-11-18",
      "responses": [
        {"question": "...", "answer": "..."}
      ]
    }
  ]
}
```

**Output Stored:**
- `latest_wins` (JSONB array, max 6 items)
- `latest_concerns` (JSONB array, max 6 items)
- `goals` (JSONB array with status tracking)

**GPT Caching:** Only runs when new surveys exist (compares `current_survey_count` vs. `last_analyzed_session_count`)

---

#### 3. **Health Vitals** (Lines 548-615)
**Metrics Tracked:**
- Energy, Mood, Motivation, Wellbeing, Sleep
- Each has: `score` (1-10), `trend` (improving/stable/declining), `sparkline` (last 10 values)

**Stored in:** `member_progress_summary` (15 columns total: 5 metrics × 3 fields)

---

#### 4. **Compliance Metrics** (Lines 620-698)
**Categories:**
- Nutrition: Yes/No responses → percentage
- Supplements: Yes/No responses → percentage
- Exercise: Days per week (target = 5) → percentage
- Meditation: Yes/Daily responses → percentage

**Stored in:** `member_progress_summary` (6 columns)

---

#### 5. **Timeline Progress** (Lines 910-985)
**Data Structure:**
- `module_sequence` (JSONB): Full ordered list of modules for member's program
- `completed_milestones` (JSONB): Modules finished
- `next_milestone` (string): Next module to work on
- `overdue_milestones` (JSONB): Modules behind schedule

**Logic:** Uses `survey_user_progress` table (`last_completed`, `working_on`, `status`)

---

#### 6. **Weight Tracking** (Lines 991-1038)
- Extracts weight from survey responses
- Calculates: `current_weight`, `weight_change` (vs. baseline)

---

#### 7. **Report Card Page Structure** (CONFIRMED)
**File:** `src/app/dashboard/report-card/page.tsx`

**Current Tabs:**
1. **Member Progress** (index 0): Goals, wins, challenges, vitals, compliance, timeline
2. **MSQ Assessment** (index 1): Symptom burden, domain scores, timeline chart
3. **PROMIS-29** (index 2): Quality of life T-scores, domain breakdown

**Member Selection:** Dropdown at top (sorted alphabetically by full name)

**Additional Features:**
- Notes icon button (opens `LeadNotesModal`)
- Export PDF button (opens `ExportReportModal`)

---

### C. What's Already Displayed (✅ NO DUPLICATION NEEDED)

| **Metric** | **Where Shown** | **Tab** |
|------------|-----------------|---------|
| Goals with progress status | GoalsCard | Member Progress |
| Wins (6 most recent) | WinsCard | Member Progress |
| Challenges (6 most recent) | ChallengesCard | Member Progress |
| Health vitals (5 metrics with trends) | HealthVitalsCard | Member Progress |
| Compliance (4 categories) | ComplianceCard | Member Progress |
| Timeline (modules completed/overdue) | TimelineCard | Member Progress |
| MSQ total score + domain breakdown | MSQ Assessment | MSQ Assessment |
| MSQ timeline chart | MSQ Assessment | MSQ Assessment |
| PROMIS-29 T-scores + domain breakdown | PROMIS-29 | PROMIS-29 |
| Profile info (days in program, surveys completed) | ProfileCard | Member Progress |
| Weight tracking | ProfileCard | Member Progress |

**Conclusion:** We do NOT need to re-display any of this. The new tab focuses on **analysis, comparison, and recommendations**.

---

## 🚧 WHAT'S MISSING (What We Need to Build)

### 1. **Quartile/Percentile Rankings** ❌
**Current State:** Status score (0-100) exists, but no comparative ranking.

**What's Needed:**
- Calculate which quartile member is in (Q1/Q2/Q3/Q4) based on `status_score`
- Track historical quartile movement (Q2 → Q3 this month)
- Show percentile rank (e.g., "67th percentile")

**Where to Add:** Extend `analyze-member-progress` edge function

---

### 2. **Risk Level Classification** ❌
**Current State:** Status indicator (green/yellow/red) exists, but not framed as "risk".

**What's Needed:**
- Map status score → Risk Level:
  - **Low Risk (Green):** ≥70 points, high compliance tier, improving
  - **Medium Risk (Yellow):** 40-69 points, medium compliance tier
  - **High Risk (Red):** <40 points, low compliance tier, declining
- List specific risk factors (e.g., "Nutrition 30% below average", "3 modules overdue")

**Where to Add:** New calculation in edge function, store as JSONB

---

### 3. **Population Comparison Metrics** ❌
**Current State:** Individual metrics exist, but no "vs. population" context.

**What's Needed:**
- **For each compliance category:** Member's % vs. population average
  - Example: "Nutrition: 85% (↑15% vs. avg)"
- **For each health vital:** Member's trend vs. population
  - Example: "Energy: improving (population avg: stable)"
- **Overall:** "You rank #12 out of 64 active members"

**Data Source:** Query `member_progress_summary` for all active members, calculate averages

**Where to Add:** New calculation in edge function

---

### 4. **AI-Powered Actionable Recommendations** ❌
**Current State:** GPT extracts wins/challenges but doesn't generate coordinator actions.

**What's Needed:**
- **Second GPT call** after initial analysis
- Input: Member's full profile + population benchmarks + program-level success patterns
- Output: 3-5 specific, prioritized recommendations
  - Example: "Focus on nutrition compliance - currently 30% below average. High compliance members (≥70%) have 80% improvement rate vs. 27% for low compliance."
  - Example: "3 modules overdue. Recommend catch-up plan. Members who fall behind >2 modules have 40% lower completion rate."

**Where to Add:** New function in `analyze-member-progress`, store as JSONB

---

### 5. **Lead Notes Integration** ⚠️ (CLARIFIED)
**Current State:** Notes exist in `lead_notes` table but not analyzed.

**What's Needed:**
- Display last 10-20 notes from past 60 days where `note_type IN ('wins', 'challenges')`
- Summary stats: "3 wins logged this week, 2 challenges flagged"
- **NOT for intervention effectiveness tracking** (this was a misunderstanding)
- Notes are just one data dimension - they don't "cause" outcomes

**Where to Add:** API endpoint (not edge function - this is real-time display)

---

### 6. **Cross-Journey Insights** ❌
**Current State:** Each tab shows one dimension (progress, MSQ, PROMIS). No holistic view.

**What's Needed:**
- **Insight Cards** that synthesize across dimensions:
  - "High compliance (82%) + MSQ improving (-35 points) + PROMIS stable → Pattern matches 'Success Stories' quadrant"
  - "Behind on curriculum (3 modules overdue) + declining energy (7→4) → Risk of dropout"
  - "Nutrition low (45%) but all other compliance high → Targeted nutrition intervention recommended"

**Where to Add:** AI recommendations in edge function

---

### 7. **Historical Tracking** ❌
**Current State:** Only current snapshot stored. No month-over-month tracking.

**What's Needed:**
- **Option A:** Create `member_analytics_history` table
  - Snapshot every time edge function runs
  - Track: `snapshot_date`, `status_score`, `quartile`, `risk_level`, `compliance_pct`
- **Option B:** Just compare current vs. 30 days ago
  - Store `previous_status_score`, `previous_quartile` in main table

**Where to Add:** New table + logic in edge function

---

## 🎯 PROPOSED NEW TAB: "Analytics & Insights"

### Section 1: Member Ranking & Risk
**Display:**
```
┌─────────────────────────────────────────────────────┐
│ MEMBER RANKING                                      │
├─────────────────────────────────────────────────────┤
│ Quartile: Q3 (67th percentile)                     │
│ ↗️ Up from Q2 last month - great progress!         │
│                                                     │
│ Risk Level: 🟡 MEDIUM RISK (Score: 58/100)         │
│                                                     │
│ Contributing Factors:                              │
│  • Nutrition compliance 30% below average          │
│  • 2 modules overdue                               │
│  • Energy declining (8→5 over 30 days)             │
└─────────────────────────────────────────────────────┘
```

---

### Section 2: Comparative Analysis
**Display:**
```
┌─────────────────────────────────────────────────────┐
│ HOW YOU COMPARE TO THE POPULATION                  │
├─────────────────────────────────────────────────────┤
│ Overall Compliance:  72% (↑12% vs. avg: 60%)       │
│                                                     │
│ Category Breakdown:                                │
│  Nutrition:     65% (🔴 -15% vs. avg: 80%)         │
│  Supplements:   85% (🟢 +10% vs. avg: 75%)         │
│  Exercise:      80% (🟢 +15% vs. avg: 65%)         │
│  Meditation:    60% (🔴 -10% vs. avg: 70%)         │
│                                                     │
│ Health Outcomes:                                   │
│  MSQ Improvement:  -35 pts (🟢 Above avg: -25 pts) │
│  PROMIS Improvement: +6 T-score (🟢 Above avg: +4) │
└─────────────────────────────────────────────────────┘
```

---

### Section 3: Cross-Journey Pattern Analysis
**Display:**
```
┌─────────────────────────────────────────────────────┐
│ OVERALL JOURNEY PATTERN                             │
├─────────────────────────────────────────────────────┤
│ Compliance Tier: MEDIUM (40-70%)                   │
│ Health Trajectory: IMPROVING (MSQ ↓, PROMIS ↑)     │
│                                                     │
│ Pattern Match: "MOTIVATIONAL SUPPORT" Quadrant     │
│  • Low compliance but improving health             │
│  • Success rate for this pattern: 55%              │
│  • Members who increased compliance to ≥70%        │
│    saw 80% improvement rate                        │
└─────────────────────────────────────────────────────┘
```

---

### Section 4: AI-Powered Recommendations
**Display:**
```
┌─────────────────────────────────────────────────────┐
│ RECOMMENDED ACTIONS (Priority Order)                │
├─────────────────────────────────────────────────────┤
│ 🔴 HIGH PRIORITY                                    │
│  1. Address Nutrition Compliance Gap               │
│     • Currently: 65% (15% below population avg)    │
│     • Impact: Members with ≥80% nutrition          │
│       compliance have 70% improvement rate vs.     │
│       46% for <40% compliance                      │
│     • Action: Review meal planning barriers        │
│                                                     │
│ 🟡 MEDIUM PRIORITY                                  │
│  2. Catch Up on Curriculum                         │
│     • 2 modules overdue (Module 7, Module 8)       │
│     • Impact: Members >2 modules behind have       │
│       40% lower completion rate                    │
│     • Action: Schedule catch-up sessions           │
│                                                     │
│  3. Investigate Energy Decline                     │
│     • Energy score dropped from 8→5 in 30 days     │
│     • Exercise compliance is high (80%)            │
│     • Pattern: May indicate overexertion or        │
│       sleep issues (check PROMIS Sleep domain)     │
│                                                     │
│ 🟢 POSITIVE REINFORCEMENT                          │
│  4. Leverage Strong Exercise Habit                 │
│     • 80% exercise compliance (top 25%)            │
│     • Use as model for improving other areas       │
└─────────────────────────────────────────────────────┘
```

---

### Section 5: Recent Coordinator Notes (Last 60 Days)
**Display:**
```
┌─────────────────────────────────────────────────────┐
│ RECENT COORDINATOR INTERACTIONS                     │
├─────────────────────────────────────────────────────┤
│ Summary: 3 wins logged, 2 challenges flagged       │
│                                                     │
│ 📅 Nov 5, 2024 - WIN                               │
│  "Member reported sleeping 8 hours consistently"   │
│                                                     │
│ 📅 Nov 3, 2024 - CHALLENGE                         │
│  "Struggling with meal prep on weekends"           │
│                                                     │
│ 📅 Oct 28, 2024 - WIN                              │
│  "Energy levels improved significantly"            │
│                                                     │
│ [View All Notes...]                                │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ TECHNICAL IMPLEMENTATION

### A. Database Schema Changes

#### Option 1: New Table (Recommended)
```sql
CREATE TABLE member_individual_insights (
  insight_id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(lead_id),
  calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ranking
  compliance_percentile INTEGER, -- 0-100
  quartile INTEGER, -- 1, 2, 3, 4
  quartile_label TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4'
  rank_in_population INTEGER, -- 1, 2, 3, ..., 64
  total_active_members INTEGER, -- 64 (for context)
  previous_quartile INTEGER, -- For tracking movement
  
  -- Risk
  risk_level TEXT, -- 'low', 'medium', 'high'
  risk_score INTEGER, -- same as status_score (0-100)
  risk_factors JSONB, -- ['Nutrition 30% below avg', '2 modules overdue']
  
  -- Comparative Analysis
  compliance_vs_population JSONB,
  -- {
  --   "overall": {"member": 72, "avg": 60, "diff": +12},
  --   "nutrition": {"member": 65, "avg": 80, "diff": -15},
  --   "supplements": {"member": 85, "avg": 75, "diff": +10},
  --   "exercise": {"member": 80, "avg": 65, "diff": +15},
  --   "meditation": {"member": 60, "avg": 70, "diff": -10}
  -- }
  
  vitals_vs_population JSONB,
  -- {
  --   "energy": {"member": 5, "avg": 6.5, "trend": "declining"},
  --   "mood": {"member": 7, "avg": 6.8, "trend": "improving"},
  --   ...
  -- }
  
  -- Cross-Journey Pattern
  journey_pattern TEXT, -- 'success_stories', 'clinical_attention', 'motivational_support', 'high_priority'
  journey_pattern_description TEXT, -- Human-readable description
  pattern_success_rate NUMERIC, -- 0.0 - 1.0
  
  -- AI Recommendations
  ai_recommendations JSONB,
  -- [
  --   {
  --     "priority": "high",
  --     "title": "Address Nutrition Compliance Gap",
  --     "current_state": "65% (15% below avg)",
  --     "impact": "Members ≥80% have 70% improvement vs 46% for <40%",
  --     "action": "Review meal planning barriers"
  --   },
  --   ...
  -- ]
  
  -- Cache tracking
  data_version INTEGER DEFAULT 1,
  
  UNIQUE(lead_id)
);

CREATE INDEX idx_member_insights_lead ON member_individual_insights(lead_id);
CREATE INDEX idx_member_insights_calculated ON member_individual_insights(calculated_at DESC);
```

#### Option 2: Extend Existing Table (Less Clean)
Add columns to `member_progress_summary`:
```sql
ALTER TABLE member_progress_summary
ADD COLUMN compliance_percentile INTEGER,
ADD COLUMN quartile INTEGER,
ADD COLUMN risk_level TEXT,
ADD COLUMN risk_factors JSONB,
ADD COLUMN compliance_vs_population JSONB,
ADD COLUMN ai_recommendations JSONB,
ADD COLUMN journey_pattern TEXT;
```

**Recommendation:** Option 1 (new table) for cleaner separation of concerns.

---

### B. Edge Function Changes

**File:** `supabase/functions/analyze-member-progress/index.ts`

**New Function to Add (after line 543):**
```typescript
/**
 * Calculate individual insights and comparative analytics
 * 
 * @param supabase - Supabase client
 * @param leadId - Lead ID
 * @param metrics - Member's calculated metrics (from calculateMemberMetrics)
 * @returns Individual insights object
 */
async function calculateIndividualInsights(
  supabase: any,
  leadId: number,
  metrics: any
) {
  // 1. Get all active members' status scores for ranking
  const { data: allMembers } = await supabase
    .from('member_progress_summary')
    .select('lead_id, status_score, nutrition_compliance_pct, supplements_compliance_pct, exercise_compliance_pct, meditation_compliance_pct')
    .not('status_score', 'is', null)
    .order('status_score', { ascending: false });

  // 2. Calculate percentile and quartile
  const memberScore = metrics.status_score;
  const scores = allMembers.map(m => m.status_score).sort((a, b) => b - a);
  const rank = scores.indexOf(memberScore) + 1;
  const percentile = Math.round((1 - (rank / scores.length)) * 100);
  const quartile = Math.ceil((rank / scores.length) * 4);

  // 3. Calculate population averages
  const avgNutrition = avg(allMembers.map(m => m.nutrition_compliance_pct).filter(v => v !== null));
  const avgSupplements = avg(allMembers.map(m => m.supplements_compliance_pct).filter(v => v !== null));
  const avgExercise = avg(allMembers.map(m => m.exercise_compliance_pct).filter(v => v !== null));
  const avgMeditation = avg(allMembers.map(m => m.meditation_compliance_pct).filter(v => v !== null));

  // 4. Build comparative analysis
  const complianceVsPopulation = {
    overall: {
      member: memberScore,
      avg: avg(scores),
      diff: memberScore - avg(scores)
    },
    nutrition: {
      member: metrics.nutrition_compliance_pct,
      avg: avgNutrition,
      diff: metrics.nutrition_compliance_pct - avgNutrition
    },
    // ... (supplements, exercise, meditation)
  };

  // 5. Determine risk factors
  const riskFactors = [];
  if (metrics.nutrition_compliance_pct < avgNutrition - 15) {
    riskFactors.push(`Nutrition ${Math.round(avgNutrition - metrics.nutrition_compliance_pct)}% below average`);
  }
  // ... (check other factors)

  // 6. Map to journey pattern (from program-level analytics quadrants)
  const journeyPattern = determineJourneyPattern(metrics);

  // 7. Generate AI recommendations
  const aiRecommendations = await generateAIRecommendations(
    metrics,
    complianceVsPopulation,
    riskFactors,
    journeyPattern
  );

  return {
    compliance_percentile: percentile,
    quartile: quartile,
    quartile_label: `Q${quartile}`,
    rank_in_population: rank,
    total_active_members: allMembers.length,
    risk_level: metrics.status_indicator, // 'green', 'yellow', 'red'
    risk_score: memberScore,
    risk_factors: riskFactors,
    compliance_vs_population: complianceVsPopulation,
    journey_pattern: journeyPattern.name,
    journey_pattern_description: journeyPattern.description,
    ai_recommendations: aiRecommendations
  };
}
```

**Integration Point (line 195):**
```typescript
// After calculating member metrics
const metrics = await calculateMemberMetrics(supabase, leadId, moduleSequenceCache);

// NEW: Calculate individual insights
const insights = await calculateIndividualInsights(supabase, leadId, metrics);

// Upsert to member_progress_summary (existing)
await supabase.from('member_progress_summary').upsert({...});

// NEW: Upsert to member_individual_insights
await supabase.from('member_individual_insights').upsert({
  lead_id: leadId,
  ...insights,
  calculated_at: new Date().toISOString()
}, { onConflict: 'lead_id' });
```

---

### C. API Endpoint

**New File:** `src/app/api/analytics/individual-insights/[leadId]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: { leadId: string } }
) {
  try {
    const supabase = await createClient();
    const leadId = parseInt(params.leadId);

    // 1. Get individual insights
    const { data: insights, error: insightsError } = await supabase
      .from('member_individual_insights')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (insightsError) throw insightsError;

    // 2. Get current metrics from progress summary
    const { data: progress, error: progressError } = await supabase
      .from('member_progress_summary')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (progressError) throw progressError;

    // 3. Get recent notes (last 60 days, wins/challenges only)
    const { data: notes, error: notesError } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', leadId)
      .in('note_type', ['wins', 'challenges'])
      .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (notesError) throw notesError;

    return NextResponse.json({
      insights,
      progress,
      notes
    });

  } catch (error: any) {
    console.error('Error fetching individual insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
```

---

### D. Frontend Components

**New File:** `src/components/report-card/AnalyticsInsightsTab.tsx`

```typescript
'use client';

import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Alert, Chip } from '@mui/material';
import { useIndividualInsights } from '@/lib/hooks/use-individual-insights';

interface AnalyticsInsightsTabProps {
  leadId: number | null;
}

export default function AnalyticsInsightsTab({ leadId }: AnalyticsInsightsTabProps) {
  const { data, isLoading, error } = useIndividualInsights(leadId);

  if (!leadId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="textSecondary">
          Select a member to view analytics
        </Typography>
      </Box>
    );
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!data) return null;

  return (
    <Box>
      {/* Section 1: Ranking & Risk */}
      <MemberRankingCard insights={data.insights} />

      {/* Section 2: Comparative Analysis */}
      <ComparativeAnalysisCard insights={data.insights} />

      {/* Section 3: Cross-Journey Pattern */}
      <JourneyPatternCard insights={data.insights} />

      {/* Section 4: AI Recommendations */}
      <AIRecommendationsCard recommendations={data.insights.ai_recommendations} />

      {/* Section 5: Recent Notes */}
      <RecentNotesCard notes={data.notes} />
    </Box>
  );
}
```

**Update:** `src/app/dashboard/report-card/page.tsx`

```typescript
// Add new tab (line 225)
<Tab
  icon={<InsightsIcon />}
  iconPosition="start"
  label="ANALYTICS & INSIGHTS"
  id="report-card-tab-3"
  aria-controls="report-card-tabpanel-3"
/>

// Add new tab panel (line 241)
<TabPanel value={tabValue} index={3}>
  <AnalyticsInsightsTab leadId={selectedMember?.lead_id || null} />
</TabPanel>
```

---

## ❓ QUESTIONS (Need Answers to Code This)

### **Q1: AI Recommendations - What Data Should We Feed?**

When generating AI recommendations, what specific data should we provide to GPT?

**Proposed Input:**
```json
{
  "member_profile": {
    "lead_id": 42,
    "days_in_program": 45,
    "status_score": 58,
    "compliance": {
      "nutrition": 65,
      "supplements": 85,
      "exercise": 80,
      "meditation": 60
    },
    "health_vitals": {
      "energy": {"score": 5, "trend": "declining"},
      "mood": {"score": 7, "trend": "stable"},
      "motivation": {"score": 6, "trend": "improving"},
      "wellbeing": {"score": 6, "trend": "stable"},
      "sleep": {"score": 4, "trend": "declining"}
    },
    "curriculum": {
      "completed_modules": 8,
      "total_modules": 13,
      "overdue_modules": 2
    },
    "goals": [
      {"goal": "Lose 10 lbs", "status": "on_track"},
      {"goal": "Improve energy", "status": "at_risk"}
    ],
    "wins": ["Sleeping 8 hours", "Energy improving"],
    "challenges": ["Meal prep on weekends", "Fatigue after exercise"]
  },
  "population_context": {
    "avg_nutrition": 80,
    "avg_supplements": 75,
    "avg_exercise": 65,
    "avg_meditation": 70,
    "avg_status_score": 65
  },
  "program_insights": {
    "high_compliance_success_rate": 0.80,
    "medium_compliance_success_rate": 0.55,
    "low_compliance_success_rate": 0.27,
    "nutrition_correlation": "High compliance (≥70%) in nutrition correlates with 70% improvement rate"
  }
}
```

**GPT Prompt:**
```
You are a health program analyst. Analyze this member's data and provide 3-5 specific, actionable recommendations for the care coordinator.

Focus on:
1. Compliance gaps (compare to population average)
2. Health vital trends (declining vitals = concern)
3. Curriculum progress (overdue modules = dropout risk)
4. Pattern matching (what do successful members with similar profiles do?)

Prioritize recommendations by impact (use program insights to estimate).

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Brief title",
      "current_state": "What's happening now",
      "impact": "Why this matters (cite program insights)",
      "action": "Specific next step for coordinator"
    }
  ]
}
```

**Questions:**
- ✅ **Is this the right data set?**
- ✅ **Should we include MSQ/PROMIS scores?**
- ✅ **Should we include lead notes in the AI input?**
- ❌ **What else should we include?**

---

### **Q2: Historical Tracking - Storage Strategy**

To show "John moved from Q2 → Q3 this month", we need historical data.

**Option A: New History Table**
```sql
CREATE TABLE member_analytics_history (
  history_id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(lead_id),
  snapshot_date DATE NOT NULL,
  status_score INTEGER,
  quartile INTEGER,
  risk_level TEXT,
  UNIQUE(lead_id, snapshot_date)
);
```
- **Pros:** Full history, can track trends over time
- **Cons:** More storage, more queries

**Option B: Previous Snapshot in Main Table**
```sql
ALTER TABLE member_individual_insights
ADD COLUMN previous_status_score INTEGER,
ADD COLUMN previous_quartile INTEGER,
ADD COLUMN last_snapshot_date TIMESTAMP;
```
- **Pros:** Simpler, faster queries
- **Cons:** Only tracks one previous period

**Question:** Which approach do you prefer? (A or B)

---

### **Q3: When Should Individual Insights Be Calculated?**

**Current Behavior:** `analyze-member-progress` runs when CSV is uploaded (weekly).

**Options for Individual Insights:**
1. **Same trigger (weekly):** Calculate insights during the batch process
2. **On-demand:** Calculate when user opens the Analytics tab (slow, but always fresh)
3. **Hybrid:** Calculate weekly, but allow manual refresh button

**Question:** Which approach? (Recommendation: Option 1 - weekly batch)

---

### **Q4: Population Averages - Active vs. All Members?**

When calculating "vs. population average," should we include:
- **A.** Only active members (`program_status_id = 1`)
- **B.** All members with data (active + completed)
- **C.** Only members from same cohort (started within 30 days)

**Question:** Which population should we compare against?

---

### **Q5: Risk Factors - What Thresholds?**

When should we flag something as a "risk factor"?

**Proposed Thresholds:**
- Compliance <40% (vs. population avg ≥60%) → "Low compliance" risk
- Compliance >15% below average → "[Category] significantly below average"
- ≥2 modules overdue → "Behind on curriculum"
- Any vital declining + score <5 → "[Vital] declining concern"
- ≥3 challenges with no wins in last 30 days → "High challenge burden"

**Question:** Do these thresholds make sense? Should we adjust?

---

### **Q6: Journey Pattern Mapping**

We have 4 quadrants from program-level analytics:
- **Q1:** Low compliance + worsening health → "High Priority"
- **Q2:** High compliance + worsening health → "Clinical Attention"
- **Q3:** Low compliance + improving health → "Motivational Support"
- **Q4:** High compliance + improving health → "Success Stories"

**For individual member:**
- Compliance tiers: Low (<40%), Medium (40-70%), High (≥70%)
- Health trajectory: Worsening (vitals declining), Stable, Improving (vitals improving)

**Question:** Should we map individuals to these same 4 quadrants? Or create a different classification?

---

### **Q7: Lead Notes Display - Filtering**

When showing recent notes (last 60 days), should we:
- **A.** Show ALL notes (wins + challenges)
- **B.** Show ONLY wins/challenges (not general notes)
- **C.** Include summary/stats at top (e.g., "3 wins, 2 challenges this month")

**Question:** Which approach? (Recommendation: B + C)

---

### **Q8: Comparative Metrics - What to Show?**

We can compare many dimensions. Which are most important?
- ✅ Compliance categories (4 metrics)
- ✅ Overall status score
- ❓ Health vitals (5 metrics)
- ❓ MSQ improvement (vs. population)
- ❓ PROMIS-29 improvement (vs. population)
- ❓ Weight change (vs. population)
- ❓ Days in program (vs. cohort average)

**Question:** Which comparisons are most useful for coordinators?

---

### **Q9: Performance - Caching Strategy**

Calculating percentiles requires querying all active members on every page load.

**Options:**
- **A.** Calculate during weekly batch (fast page load, data may be slightly stale)
- **B.** Calculate on-demand with caching (1 hour TTL)
- **C.** Hybrid: Use cached data, but show "Refresh" button

**Question:** Which approach? (Recommendation: A - weekly batch)

---

### **Q10: UI Design - Section Priority**

Which sections should appear first on the Analytics & Insights tab?

**Proposed Order:**
1. Member Ranking & Risk (most actionable)
2. AI Recommendations (what to do)
3. Comparative Analysis (context)
4. Cross-Journey Pattern (understanding)
5. Recent Notes (supplementary)

**Question:** Is this the right priority order? Should we reorder?

---

## 📝 NEXT STEPS

Once questions are answered:

1. **Create database schema** (`member_individual_insights` table)
2. **Extend edge function** (add `calculateIndividualInsights()`)
3. **Create API endpoint** (`/api/analytics/individual-insights/[leadId]`)
4. **Build React hook** (`use-individual-insights.ts`)
5. **Build UI components** (5 section cards)
6. **Add tab to Report Card** (wire it up)
7. **Test with real data**

**Estimated LOC:** ~800-1000 lines total
**Estimated Time:** 8-10 hours (after requirements finalized)

---

**END OF DOCUMENT**


