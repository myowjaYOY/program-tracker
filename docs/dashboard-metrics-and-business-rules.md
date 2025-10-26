# Member Progress Dashboard - Metrics & Business Rules

## Overview
This document explains how every metric on the Member Progress Dashboard is calculated, what it means, and how to interpret it. This information should be made available to users through tooltips, help icons, or an info panel on the dashboard.

**Last Updated:** October 26, 2025  
**Version:** 1.0

---

## 1. PROFILE CARD METRICS

### Days in Program
**What it is:** The number of days since the member enrolled in their active program.

**How it's calculated:**
```
Days in Program = Current Date - Program Start Date
```

**Data source:** `member_programs.start_date` (for active program only)

**User interpretation:**
- Shows how long the member has been in the program
- Used to assess if they're progressing at expected pace
- Standard 4-Month AIP Program = 120 days

---

### Last Survey Date & Name
**What it is:** The most recent survey the member completed and when they completed it.

**How it's calculated:**
- Query all survey sessions for the member
- Select the one with the most recent `completed_on` timestamp
- Display the form name and date

**Data source:** `survey_response_sessions.completed_on` and `survey_forms.form_name`

**User interpretation:**
- Helps identify if member is staying current with surveys
- Stale date (>14 days) may indicate member is falling behind

---

### Total Surveys Completed
**What it is:** Count of all survey forms the member has completed.

**How it's calculated:**
```
Total Surveys = COUNT(DISTINCT survey_response_sessions)
```

**Data source:** `survey_response_sessions`

**User interpretation:**
- Typical member completes 15-25 surveys over 4 months
- Includes weekly reports, module reports, MSQ, PROMIS-29, etc.
- Does NOT include individual questions, only complete survey submissions

---

### Status Indicator (Red/Yellow/Green)
**What it is:** Overall health status of the member across all tracked metrics.

**How it's calculated:**

#### 🔴 RED - Needs Immediate Attention
Member gets RED status if ANY of these conditions are met:
- **3+ concerns** reported in recent surveys
- **Nutrition compliance < 40%** (critically low)
- **3+ health vitals declining** (Energy, Mood, Motivation, Wellbeing, or Sleep)
- **Behind on curriculum AND >14 days** since last survey completion

#### 🟡 YELLOW - Watch/At Risk
Member gets YELLOW status if ANY of these conditions are met:
- **1+ concerns** reported in recent surveys
- **Nutrition compliance 40-69%** (below target)
- **1+ health vitals declining**
- **Behind on curriculum** (any amount)

#### 🟢 GREEN - On Track
Member gets GREEN status if:
- None of the RED or YELLOW conditions are met
- This is the default/healthy state

**Data sources:**
- Alerts (concerns count)
- Compliance metrics
- Health vitals trends
- `survey_user_progress.status` field

**User interpretation:**
- Quick visual indicator of member health
- RED = Take action immediately
- YELLOW = Monitor closely, may need intervention
- GREEN = Member is progressing well

---

## 2. HEALTH VITALS CARD

Health vitals are self-reported scores from weekly and module progress reports. Members rate these on a scale (typically 1-10).

### Energy Score
**What it is:** Member's current energy level rating.

**How it's calculated:**
- Search all survey responses for questions containing: "rate your energy" or "energy level"
- Extract numeric answers
- Current score = most recent value
- Previous score = second most recent value

**Trend calculation:**
- **Improving (↑)**: Current score is >0.5 points higher than previous
- **Declining (↓)**: Current score is >0.5 points lower than previous
- **Stable (→)**: Change is ≤0.5 points in either direction
- **No Data**: Less than 2 data points available

**Typical scale:** 1-10 (1 = Very Low Energy, 10 = Excellent Energy)

**User interpretation:**
- Higher is better
- Declining energy may indicate:
  - Insufficient sleep
  - Nutritional deficiencies
  - Overexertion
  - Underlying health issues
- Improving energy is a key win to celebrate!

---

### Mood Score
**What it is:** Member's current mood/emotional state rating.

**How it's calculated:**
- Search for questions containing: "rate your mood" or "mood /"
- Extract numeric answers
- Same trend logic as Energy (>0.5 point change)

**Typical scale:** 1-10 (1 = Very Low/Depressed, 10 = Excellent/Happy)

**User interpretation:**
- Higher is better
- Declining mood requires attention
- May correlate with program challenges or external stressors
- Track alongside motivation and wellbeing for full picture

---

### Motivation Score
**What it is:** Member's current motivation level to continue the program.

**How it's calculated:**
- Search for questions containing: "rate your motivation" or "motivation level"
- Extract numeric answers
- Same trend logic (>0.5 point change)

**Typical scale:** 1-10 (1 = No Motivation, 10 = Highly Motivated)

**User interpretation:**
- Higher is better
- Declining motivation is RED FLAG - member may be at risk of dropping out
- Early intervention critical if motivation declining
- Often improves when member sees health improvements (vitals, symptoms)

---

### Wellbeing Score
**What it is:** Member's overall sense of health and wellbeing.

**How it's calculated:**
- Search for questions containing: "rate your wellbeing", "well-being", or "overall health"
- Extract numeric answers
- Same trend logic (>0.5 point change)

**Typical scale:** 1-10 (1 = Very Poor, 10 = Excellent)

**User interpretation:**
- Higher is better
- Most comprehensive single metric
- Often correlates with MSQ symptom scores
- Improving wellbeing = program is working!

---

### Sleep Score
**What it is:** Member's sleep quality rating.

**How it's calculated:**
- Search for questions containing: "rate your sleep" or "sleep quality"
- Extract numeric answers
- Same trend logic (>0.5 point change)

**Typical scale:** 1-10 (1 = Very Poor Sleep, 10 = Excellent Sleep)

**User interpretation:**
- Higher is better
- Poor sleep affects all other vitals
- Declining sleep may indicate:
  - Detox symptoms
  - Dietary issues
  - Stress
  - Need for sleep hygiene coaching

---

### Sparkline Charts
**What they show:** Visual trend of the last 10 data points for each vital.

**How to read them:**
- **Upward trend** = Improving over time (GOOD)
- **Downward trend** = Declining over time (CONCERNING)
- **Flat/stable** = No significant change
- **Zigzag pattern** = Inconsistent, investigate further

---

## 3. COMPLIANCE CARD

Compliance metrics track how well the member is following the program protocols.

### Nutrition Compliance
**What it is:** Percentage of time the member is following the nutritional plan.

**How it's calculated:**
```
Nutrition Compliance % = (Yes answers / Total answers) × 100
```

**Questions tracked:**
- "Are you following the nutritional plan?"
- "Have you followed the nutritional plan this week?"
- Looks for "yes" answers

**Thresholds:**
- **90-100%** = Excellent (GREEN)
- **70-89%** = Good but watch (YELLOW)
- **40-69%** = Below target (YELLOW)
- **<40%** = Critical - needs intervention (RED)

**User interpretation:**
- AIP requires strict adherence for best results
- <90% may slow progress
- Non-compliance often due to:
  - Social situations
  - Travel
  - Budget constraints
  - Lack of preparation
- Celebrate streaks of consecutive compliance!

---

### Nutrition Streak
**What it is:** Number of consecutive surveys where member answered "yes" to nutrition compliance.

**How it's calculated:**
- Count consecutive "yes" answers from most recent backward
- Resets to 0 on first "no" answer

**User interpretation:**
- Longer streaks = better habit formation
- Celebrate milestones (7 days, 14 days, 30 days)
- Broken streak? Time for recommitment coaching

---

### Supplements Compliance
**What it is:** Percentage of time the member is taking prescribed supplements.

**How it's calculated:**
```
Supplements Compliance % = (Yes answers / Total answers) × 100
```

**Questions tracked:**
- "Have you taken your supplements?"
- "Are you taking supplements as prescribed?"

**Thresholds:**
- **90-100%** = Excellent
- **70-89%** = Good but watch
- **<70%** = Below target, coaching needed

**User interpretation:**
- Supplements critical for addressing deficiencies
- Common reasons for non-compliance:
  - Forgot
  - Ran out
  - Side effects
  - Cost
- Help member set up reminders/systems

---

### Exercise Compliance
**What it is:** How member's exercise frequency compares to the target.

**How it's calculated:**
```
Exercise Compliance % = (Actual days per week / Target days per week) × 100
```

**Target:** 5 days per week (standard recommendation)

**Questions tracked:**
- "How many days per week do you exercise?"
- Extracts numeric answer

**Examples:**
- 5 days/week = 100% (meeting target)
- 3 days/week = 60% (below target)
- 7 days/week = 140% (exceeding target)

**Thresholds:**
- **100%+** = Meeting or exceeding target (EXCELLENT)
- **80-99%** = Close to target (4 days/week = GOOD)
- **60-79%** = Below target (3 days/week = NEEDS IMPROVEMENT)
- **<60%** = Well below target (<3 days/week = RED FLAG)

**User interpretation:**
- Exercise supports detox, circulation, mood, energy
- Some is better than none
- Overexercise (>7 days/week) may indicate need for rest
- Adjust target for individual limitations

---

### Exercise Days Per Week
**What it is:** Actual number of days member exercised in the past week.

**Display:** Shows both actual number and percentage vs target.

**Example display:**
```
Exercise: 4 days/week (80%)
```

---

### Meditation Compliance
**What it is:** Percentage of time the member is practicing abdominal breathing/meditation.

**How it's calculated:**
```
Meditation Compliance % = (Yes/Daily answers / Total answers) × 100
```

**Questions tracked:**
- "Are you doing abdominal breathing?"
- "Have you practiced meditation?"
- Looks for "yes" or "daily" answers

**Thresholds:**
- **80-100%** = Excellent
- **60-79%** = Good but inconsistent
- **<60%** = Needs encouragement

**User interpretation:**
- Supports stress management and nervous system regulation
- Even 5-10 minutes daily is beneficial
- Often first habit to slip when busy

---

## 4. ALERTS CARD

Alerts highlight explicit wins and concerns the member has reported in open-ended survey questions.

### Wins (Latest 5)
**What they are:** Positive results, improvements, or breakthroughs the member has shared.

**How they're extracted:**
- Search recent surveys (last 5 sessions)
- Look for questions containing:
  - "benefits"
  - "successes"
  - "positive health results"
  - "improvements"
  - "victories"
- Extract answer text (non-empty, not "none" or "n/a")

**Display:**
- Green background
- Date stamp
- Message (truncated to 200 characters)
- Most recent at top

**User interpretation:**
- Celebrate these with the member!
- Use in progress reports and check-ins
- Track themes (energy, digestion, pain reduction, etc.)
- Share as testimonials (with permission)

---

### Concerns (Latest 5)
**What they are:** Challenges, obstacles, symptoms, or worries the member has reported.

**How they're extracted:**
- Search recent surveys (last 5 sessions)
- Look for questions containing:
  - "obstacles"
  - "concerns"
  - "challenges"
  - "struggles"
  - "hesitations"
  - "symptoms"
  - "problems"
- Extract answer text (non-empty, not "none" or "n/a")

**Severity levels:**
- Currently all flagged as "medium" (yellow)
- Future: keyword analysis for "severe", "emergency", "urgent" = high severity (red)

**Display:**
- Yellow/red background based on severity
- Date stamp
- Message (truncated to 200 characters)
- Most recent at top

**User interpretation:**
- Require follow-up action
- 3+ concerns = RED status, immediate attention needed
- Common themes:
  - Detox symptoms
  - Social challenges
  - Time/preparation challenges
  - Budget/affordability
  - Lack of results/frustration
- Address promptly to prevent dropout

---

## 5. TIMELINE CARD

The timeline shows the member's progress through the 13-module curriculum.

### Module Sequence
The standard 4-Month AIP Program has these modules in order:

1. **MODULE 1 - PRE-PROGRAM** (Week 0)
2. **MODULE 2 - WEEK 1** (Days 1-7)
3. **MODULE 3 - WEEK 2** (Days 8-14)
4. **MODULE 4 - START OF DETOX** (Days 15-21)
5. **MODULE 5 - WEEK 4** (Days 22-28)
6. **MODULE 6 - MID-DETOX** (Days 29-42)
7. **MODULE 7 - END OF DETOX** (Days 43-56)
8. **MODULE 8 - END OF MONTH 2** (Days 57-70)
9. **MODULE 9 - START OF MONTH 3** (Days 71-84)
10. **MODULE 10 - MID-MONTH 3** (Days 85-91)
11. **MODULE 11 - END OF MONTH 3** (Days 92-98)
12. **MODULE 12 - START OF MONTH 4** (Days 99-112)
13. **MODULE 13 - MID-MONTH 4** (Days 113-120) - FINAL

---

### Completed Milestones
**What they are:** Modules the member has finished.

**How it's determined:**
- Source: `survey_user_progress.last_completed` field
- Shows all modules up to and including the last completed one
- Example: If `last_completed = "MODULE 6 - MID-DETOX"`, then modules 1-6 are shown as completed

**Display:**
- Green checkmarks ✓
- Module name
- Completed date (if available)

**User interpretation:**
- Visual progress through the program
- Celebrate milestone completions!
- Standard pace: ~1 module per week

---

### Next Milestone
**What it is:** The module the member should work on next.

**How it's determined:**
```
Next Milestone = Module immediately after last_completed
```

**Simple logic:**
- Always shows the next module in sequence after what they've completed
- Example: If `last_completed = "MODULE 3"`, then `Next Milestone = "MODULE 4"`
- If `working_on = "Finished"`, shows "Program Complete"

**Display:**
- Yellow "in progress" icon
- Module name
- May include "URGENT" badge if it appears in overdue list

**User interpretation:**
- Focus area for the member
- The very next thing they should complete
- Provider should reference this in coaching calls

---

### Overdue Milestones
**What they are:** Modules the member should have completed but hasn't.

**CRITICAL UNDERSTANDING:**
- `survey_user_progress.working_on` = module they **SHOULD BE** on (not currently on)
- This field indicates where they're expected to be in the curriculum

**How it's determined:**

**Simple calculation:**
1. Find position of `last_completed` in module sequence
2. Find position of `working_on` in module sequence  
3. **If working_on index > last_completed index:**
   - ALL modules from (last_completed + 1) to working_on are overdue
   - **INCLUDING working_on itself**

**Example 1: Member Behind**
```
Last Completed: MODULE 3 - WEEK 2
Working On (Should Be On): MODULE 6 - MID-DETOX

Overdue Milestones:
- MODULE 4 - START OF DETOX
- MODULE 5 - WEEK 4
- MODULE 6 - MID-DETOX  ← includes this too!
```

**Example 2: Member Caught Up**
```
Last Completed: MODULE 5 - WEEK 4
Working On (Should Be On): MODULE 6 - MID-DETOX

Overdue Milestones: (none - they should be on MODULE 6 next, and that's their next milestone)
```

**Example 3: Member On Track**
```
Last Completed: MODULE 5 - WEEK 4
Working On (Should Be On): MODULE 5 - WEEK 4

Overdue Milestones: (empty - caught up!)
```

**The Math:**
- If `working_on` is 3 modules ahead of `last_completed`, then 3 modules are overdue
- The gap shows how far behind they are
- No time-based calculations needed

**Display:**
- Red alert badges
- Module names
- Count of overdue items

**User interpretation:**
- RED FLAG - member is falling behind
- Number of overdue items = severity of issue
- Risk of dropout increases with more overdue items
- Reach out proactively
- Identify and remove barriers
- May need to adjust timeline expectations

---

## 6. GOALS CARD

Goals are captured from the "Goals & Whys" survey taken in MODULE 1.

### Goal Status

**On Track (Blue Badge)**
- Default status
- Goal is progressing normally
- No specific wins or concerns related to this goal

**Win (Green Badge)**
- Goal-related keyword found in recent wins/alerts
- Member is making progress or achieved a milestone
- Celebrate this!

**At Risk (Yellow/Red Badge)**
- Goal-related keyword found in recent concerns
- Member is struggling with this goal
- May need coaching or goal adjustment

**How status is determined:**
- Search win/concern text for keywords from goal text
- Example: Goal "Lose 20 pounds" + Win "Lost 5 pounds" = WIN status
- Example: Goal "Improve energy" + Concern "Still tired" = AT RISK status

**User interpretation:**
- Helps track progress toward personal objectives
- Use in progress reports
- Adjust goals if needed (SMART goal principles)
- Celebrate wins toward goals!

---

## 7. WEIGHT TRACKING (Profile Card)

### Current Weight
**What it is:** Member's most recent weight measurement.

**How it's calculated:**
- Search all survey responses for questions containing:
  - "weight"
  - "current weight"
  - "body weight"
- Extract numeric answer from most recent survey
- Filter for reasonable range (0-500 lbs)

**Display:** Shows in pounds (lbs)

---

### Weight Change
**What it is:** Total weight change since program start.

**How it's calculated:**
```
Weight Change = Current Weight - First Recorded Weight
```

**Display:**
- **Negative** (e.g., -12 lbs) = Weight loss (typically goal)
- **Positive** (e.g., +5 lbs) = Weight gain
- Color coded: Green for loss, red for gain (unless gain is goal)

**User interpretation:**
- Many members join to lose weight
- Weight loss is common benefit of AIP
- Weight gain may be:
  - Muscle gain (if exercising)
  - Fluid retention
  - Healing weight gain (if was underweight)
- Context matters - discuss with member

---

## 8. DATA FRESHNESS & ACCURACY

### When Dashboard Updates
**Automatic updates:** Dashboard data is recalculated every time:
- A new survey CSV file is uploaded and processed
- The import completes successfully
- Edge function runs in background

**Data lag:** 
- Dashboard shows data as of last survey import
- Timestamp shown: `calculated_at` field

**Real-time vs Cached:**
- Dashboard data is PRE-CALCULATED (cached in database)
- Ensures instant load times
- Trade-off: Not real-time, but plenty fresh for coaching purposes

---

### Data Sources
All metrics are derived from:
1. **`survey_response_sessions`** - Survey submissions
2. **`survey_responses`** - Individual question answers
3. **`survey_user_progress`** - Curriculum status (updated by separate import)
4. **`member_programs`** - Program enrollment details
5. **`survey_user_mappings`** - Links survey data to lead records

---

## 9. BUSINESS RULES SUMMARY

### Key Thresholds
| Metric | Good | Watch | Critical |
|--------|------|-------|----------|
| Nutrition Compliance | ≥90% | 70-89% | <40% |
| Exercise | ≥100% target | 80-99% | <60% |
| Health Vitals | Improving/Stable | 1 declining | 3+ declining |
| Survey Currency | <7 days | 7-14 days | >14 days |
| Concerns | 0 | 1-2 | 3+ |

### Status Indicator Logic
```
RED if any:
  - 3+ concerns
  - Nutrition < 40%
  - 3+ vitals declining  
  - Behind AND >14 days since last survey

YELLOW if any:
  - 1+ concerns
  - Nutrition 40-69%
  - 1+ vitals declining
  - Behind on curriculum

GREEN otherwise
```

### Trend Calculation
```
Score difference > +0.5 = Improving ↑
Score difference < -0.5 = Declining ↓
Score difference ±0.5 = Stable →
```

### Overdue Detection
```
Overdue Milestones = ALL modules from (last_completed + 1) to working_on (INCLUSIVE)

Where:
  - last_completed = Last module they finished
  - working_on = Module they SHOULD BE on
  
If working_on index > last_completed index:
  → Member is behind
  → Gap indicates how many modules overdue
```

---

## 10. USER EDUCATION TIPS

### For Dashboard Display
Every metric should have:
1. **Tooltip/Info Icon** - Brief explanation (1-2 sentences)
2. **"What this means" section** - User-friendly interpretation
3. **Color coding** - Visual quick-reference
4. **Trend indicators** - Arrows for directional change
5. **Help link** - Link to full documentation

### Example Tooltip Text

**Energy Score:**
> "Your self-reported energy level from 1-10. Higher is better. We track how this changes over time to see if the program is improving your energy."

**Status Indicator:**
> "🔴 RED: Needs immediate attention | 🟡 YELLOW: Monitor closely | 🟢 GREEN: On track and progressing well"

**Overdue Milestones:**
> "Modules you should have completed but haven't. If you see items here, let's talk about what's blocking your progress!"

---

## 11. FUTURE ENHANCEMENTS

### Potential Additions
- **MSQ Score Integration** - Show MSQ symptom improvements
- **PROMIS T-Score Integration** - Track health outcomes
- **Comparative Analytics** - "How you compare to similar members"
- **Predictive Alerts** - "Based on patterns, you may need..."
- **Goal Progress Bars** - Visual % complete for quantifiable goals
- **Social Features** - Share wins with community
- **Provider Notes** - Allow providers to add context to metrics

### AI/ML Opportunities
- Predict dropout risk
- Recommend interventions based on patterns
- Identify optimal check-in timing
- Personalize module pacing recommendations

---

## DOCUMENT VERSION HISTORY

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-26 | Initial documentation of all metrics and business rules | AI Assistant |

---

**For Questions or Updates:**
This document should be updated whenever calculation logic changes in the edge function (`supabase/functions/process-survey-import/index.ts`).

