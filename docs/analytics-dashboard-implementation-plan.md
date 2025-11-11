# Comprehensive Research-Grade Analytics Dashboard
## Implementation Plan

**Last Updated:** 2025-11-07  
**Status:** Planning → Implementation  

---

## 🎯 Business Goals

1. **Predict Compliance Struggles**: Identify members at risk of falling behind before it happens
2. **Identify Intervention Targets**: Pinpoint specific areas where interventions will be most effective
3. **Prove Program Effectiveness**: Demonstrate that compliance leads to improved health outcomes

---

## 📊 Current Data Inventory

### Available Data Sources

#### 1. **Member Progress Summary** (Pre-calculated)
**Table:** `member_progress_summary`  
**Fields:**
- `status_score` - Overall compliance percentage (0-100)
- `status_indicator` - Green/Yellow/Red
- `days_in_program` - Time since enrollment
- `total_surveys_completed` - Survey engagement count
- `last_survey_date` - Most recent survey completion
- Health Vitals (with trends and sparklines):
  - `energy_score`, `energy_trend`, `energy_sparkline`
  - `mood_score`, `mood_trend`, `mood_sparkline`
  - `motivation_score`, `motivation_trend`, `motivation_sparkline`
  - `wellbeing_score`, `wellbeing_trend`, `wellbeing_sparkline`
  - `sleep_score`, `sleep_trend`, `sleep_sparkline`
- Compliance Metrics:
  - `nutrition_compliance_pct`
  - `nutrition_streak`
  - `supplements_compliance_pct`
  - `exercise_compliance_pct`
  - `exercise_days_per_week`
  - `meditation_compliance_pct`
- Timeline Progress:
  - `module_sequence` - Full ordered list of modules
  - `completed_milestones` - Completed modules
  - `next_milestone` - Current module
  - `overdue_milestones` - Missed modules
  - `module_completion_dates` - Map of module → date
- Other:
  - `latest_wins`, `latest_concerns` - JSON alerts
  - `goals` - SMART goals with status
  - `current_weight`, `weight_change`

#### 2. **MSQ Assessment Data**
**Table:** `survey_domain_scores`  
**Form ID:** 3  
**Fields:**
- `total_score` - Overall MSQ severity (0-380+)
- `domain_scores` - JSON with 9 domains:
  - Head, Eyes, Ears, Nose, Mouth/Throat
  - Skin, Heart, Lungs, Digestive Tract
  - Joints/Muscles, Weight, Energy/Activity
  - Mind, Emotions
- `severity_assessment` - Mild/Moderate/Severe
- `worsening_count`, `improving_count` - Domain trends
- `assessment_dates` - Timeline of all assessments

**Pattern:** Taken 4 times throughout program (Intake, Start of Detox, Mid, End)

#### 3. **PROMIS-29 Assessment Data**
**Table:** `survey_domain_scores`  
**Form ID:** 6  
**Fields:**
- `mean_t_score` - Average T-score across 7 domains (standardized)
- `domain_scores` - JSON with 7 domains:
  - Physical Function
  - Anxiety
  - Depression
  - Fatigue
  - Sleep Disturbance
  - Social Role Participation
  - Pain Interference
  - Pain Intensity (raw score, not T-score)
- `severity_label` - None/Mild/Moderate/Severe/Very Severe
- `domain_trend` - Improving/Worsening/Stable
- `all_mean_t_scores` - Historical T-scores

**Pattern:** Taken 4 times throughout program

#### 4. **Schedule Adherence Data**

**member_program_item_schedule:**
- `scheduled_date` - When item was supposed to happen
- `completed_flag` - true/false/null
- Links to `member_program_items` (therapy items)

**member_program_items_task_schedule:**
- `due_date` - When task was due
- `completed_flag` - true/false/null
- Links to `member_program_item_tasks` (tasks within items)

**Late/Missed Logic:**
```
Late/Missed = completed_flag === false 
              OR (completed_flag === null AND scheduled_date/due_date < TODAY)
```

#### 5. **Program Data**
**Tables:** `member_programs`, `leads`, `program_status`  
**Fields:**
- `start_date`, `duration`, `status_name`
- `lead_id` → `leads` (first_name, last_name)
- Active programs defined by `ProgramStatusService`

#### 6. **Survey Response History**
**Tables:** `survey_response_sessions`, `survey_responses`  
**Use Cases:**
- Survey completion dates and frequency
- Raw response data for detailed analysis
- Engagement patterns

---

## 🏗️ Analytics Architecture

### Two-Tier Dashboard Approach

#### **Tier 1: Program-Level Analytics**
**New Page:** `/dashboard/analytics`  
**Purpose:** Population-level insights, trends, and predictive models  
**Audience:** Practice leadership, clinical team  

#### **Tier 2: Individual Member Analytics**
**Location:** New tab on Report Card page  
**Purpose:** Member-specific insights, risk scores, recommendations  
**Audience:** Care coordinators, clinicians  

---

## 📈 Program-Level Dashboard Design

### **Tab 1: Compliance Patterns & Predictors**

**Purpose:** Understand what predicts compliance success/failure

**Visualizations:**
1. **Compliance Distribution Histogram**
   - X-axis: Compliance score ranges (0-20%, 20-40%, ..., 80-100%)
   - Y-axis: Number of members
   - Color: Green (>70), Yellow (40-70), Red (<40)

2. **Compliance Breakdown by Category**
   - 4 bars: Nutrition, Supplements, Exercise, Meditation
   - Show average compliance % for each
   - Click to drill down to member list

3. **Early Warning Indicators**
   - Correlation matrix showing:
     - Days to first survey miss → Final compliance
     - First 30-day compliance → Program completion
     - Survey response rate → Compliance score
   - Heatmap visualization

4. **Compliance Timeline**
   - Line chart: Average compliance by program day (0-120)
   - Show when members typically drop off
   - Overlay: dropout/completion events

**Key Metrics Cards:**
- Average compliance: All members vs. Active only
- High-risk members: Count with <40% compliance
- Perfect adherence: Count with >90% compliance

---

### **Tab 2: Health Outcomes Analysis**

**Purpose:** Prove program effectiveness (compliance → improvement)

**Visualizations:**
1. **Compliance vs. MSQ Improvement Scatter Plot**
   - X-axis: Member compliance score (0-100%)
   - Y-axis: MSQ total score change (negative = improvement)
   - Point size: Number of surveys completed
   - Trend line with R² value

2. **Compliance vs. PROMIS-29 Improvement Scatter Plot**
   - X-axis: Member compliance score
   - Y-axis: Mean T-score change (negative = better for symptoms)
   - Trend line with R² value

3. **Health Vitals by Compliance Tier**
   - 3 groups: High (>70%), Medium (40-70%), Low (<40%)
   - Box plots for each vital: Energy, Mood, Motivation, Wellbeing, Sleep
   - Show median, quartiles, outliers

4. **Domain-Specific Analysis**
   - MSQ: Show which domains improve most with high compliance
   - PROMIS: Show which T-score domains respond best
   - Bar charts with confidence intervals

**Key Metrics Cards:**
- Correlation coefficient: Compliance ↔ MSQ improvement
- Correlation coefficient: Compliance ↔ PROMIS improvement
- Effect size: High vs. Low compliance groups
- Clinical significance: % showing meaningful improvement

---

### **Tab 3: Intervention Targeting**

**Purpose:** Identify where interventions will have maximum impact

**Visualizations:**
1. **At-Risk Member Segmentation**
   - Quadrant chart:
     - X-axis: Compliance score (low → high)
     - Y-axis: Health outcome improvement (worsening → improving)
     - 4 quadrants:
       - **Q1 (Low Compliance, Worsening)**: 🚨 High Priority
       - **Q2 (High Compliance, Worsening)**: ⚠️ Clinical Attention
       - **Q3 (Low Compliance, Improving)**: 💪 Motivational Support
       - **Q4 (High Compliance, Improving)**: ✅ Success Stories

2. **Bottleneck Analysis**
   - Identify where members get stuck:
     - Module completion rate by module name
     - Average time spent on each module
     - Drop-off points

3. **Missed Item Pattern Analysis**
   - Which therapy items are missed most often?
   - Which tasks are skipped most frequently?
   - Time-of-day/day-of-week patterns

4. **Survey Engagement Patterns**
   - Survey completion rate over time
   - Time lag between scheduled and actual completion
   - Correlation: Survey engagement ↔ Overall compliance

**Actionable Outputs:**
- **High-Priority List**: Members in Q1 (low compliance + worsening)
- **Module Redesign Targets**: Modules with <60% completion
- **Schedule Optimization**: Best times for reminders/check-ins

---

### **Tab 4: PROMIS-29 Deep Dive**

**Purpose:** Standardized health assessment analysis (T-scores are research-grade)

**Visualizations:**
1. **T-Score Distribution by Domain**
   - 7 domains: Physical Function, Anxiety, Depression, Fatigue, Sleep, Social Role, Pain
   - Show population distribution vs. US norms (T=50, SD=10)
   - Severity thresholds overlaid

2. **Domain Improvement Trajectories**
   - Multi-line chart: Each domain's average T-score over 4 assessment points
   - Show baseline → end of program
   - Confidence intervals

3. **Responder Analysis**
   - Define "responder": ≥5 point T-score improvement (clinically meaningful)
   - Bar chart: % of responders by domain
   - Filter by compliance tier

4. **Correlation Network**
   - Which PROMIS domains correlate with:
     - Specific compliance categories?
     - Health vitals?
     - MSQ domains?
   - Network graph visualization

---

### **Tab 5: Temporal Trends & Forecasting**

**Purpose:** Identify time-based patterns and predict future outcomes

**Visualizations:**
1. **Program Cohort Analysis**
   - Group members by start date (monthly cohorts)
   - Compare compliance rates across cohorts
   - Identify seasonal patterns or program improvements

2. **Time to Event Analysis**
   - Kaplan-Meier curve: Time to first compliance issue
   - Survival analysis: Likelihood of completing program
   - By baseline characteristics

3. **Predictive Model Dashboard**
   - Input: Member characteristics at Day 7, 14, 30
   - Output: Predicted final compliance score
   - Feature importance: What matters most?

4. **Trend Detection**
   - Is the program improving over time?
   - Are compliance rates increasing?
   - Are health outcomes improving?

**Key Metrics Cards:**
- Average time to first issue: Days
- Completion rate: % who finish program
- Best performing cohort: Month/Year
- Predicted at-risk count: Next 30 days

---

## 🔬 Individual Member Analytics

### **New Tab on Report Card Page: "Analytics & Insights"**

#### **Section 1: Member Performance Scorecard**

**Risk Score Card:**
- Overall risk level: Low/Medium/High
- Contributing factors:
  - Compliance trajectory
  - Survey engagement
  - Health outcome trends
  - Schedule adherence

**Predicted Outcome:**
- Forecasted final compliance score
- Likelihood of program completion
- Confidence interval

#### **Section 2: Comparative Analysis**

**Member vs. Population:**
- Compliance percentile (where they rank)
- MSQ improvement percentile
- PROMIS improvement percentile

**Similar Members Comparison:**
- "Members like you who had high compliance saw X% improvement"
- Reference group: Similar baseline characteristics

#### **Section 3: Compliance Breakdown**

**Compliance Timeline:**
- Line chart: Member's compliance score over time
- Overlay: Population average
- Highlight: Critical drop-off points

**Category Breakdown:**
- Nutrition: X% (🟢 Above avg / 🔴 Below avg)
- Supplements: X%
- Exercise: X%
- Meditation: X%

**Missed Items Detail:**
- Table: Most frequently missed items/tasks
- Pattern analysis: Time of day, day of week

#### **Section 4: Health Trajectory**

**MSQ Progress:**
- Current vs. Baseline
- Domain-specific breakdown
- Comparison to expected improvement at this stage

**PROMIS-29 Progress:**
- T-score changes by domain
- Clinical significance indicators

**Health Vitals Trends:**
- Mini sparklines for all 5 vitals
- Trend indicators: ↗️↘️→

#### **Section 5: Actionable Insights**

**Recommendations:**
- Based on risk profile and patterns
- Examples:
  - "Consider checking in about supplement compliance"
  - "Energy scores declining - review sleep schedule"
  - "Great progress! Keep up current routine"

**Intervention History:**
- Log of outreach/interventions
- Effectiveness tracking

---

## 🛠️ Implementation Phases

### **Phase 1: Data Pipeline & Foundation** (Week 1)
**Goal:** Create analytical data layer

**Tasks:**
1. Create new table: `member_analytics_cache`
   - Pre-calculate complex metrics
   - Scheduled refresh (daily or on-demand)

2. Create API endpoint: `/api/analytics/calculate-metrics`
   - Fetch all member data (active + completed)
   - Calculate correlations, statistics, predictions
   - Store in cache table

3. Create API endpoint: `/api/analytics/member-insights/[leadId]`
   - Individual member risk scores
   - Comparative analysis
   - Recommendations

**Deliverable:** Backend data layer ready

---

### **Phase 2: Program-Level Dashboard** (Week 2-3)
**Goal:** Build `/dashboard/analytics` page

**Tasks:**
1. Create page structure with 5 tabs
2. Build reusable chart components:
   - ScatterPlot.tsx
   - Histogram.tsx
   - BoxPlot.tsx
   - HeatMap.tsx
   - QuadrantChart.tsx
3. Implement Tab 1: Compliance Patterns
4. Implement Tab 2: Health Outcomes
5. Implement Tab 3: Intervention Targeting
6. Implement Tab 4: PROMIS Deep Dive
7. Implement Tab 5: Temporal Trends

**Deliverable:** Full program-level analytics dashboard

---

### **Phase 3: Individual Member Analytics** (Week 4)
**Goal:** Add "Analytics & Insights" tab to Report Card

**Tasks:**
1. Add new tab to Report Card page
2. Build member scorecard component
3. Implement comparative analysis
4. Build compliance breakdown visualizations
5. Add recommendation engine

**Deliverable:** Individual member analytics live

---

### **Phase 4: Predictive Models** (Week 5)
**Goal:** Add machine learning predictions

**Tasks:**
1. Train simple regression models:
   - Compliance prediction (based on first 30 days)
   - Outcome prediction (MSQ/PROMIS improvement)
2. Add prediction API endpoint
3. Integrate predictions into dashboards
4. Add confidence intervals

**Deliverable:** Predictive analytics functional

---

### **Phase 5: Refinement & Validation** (Week 6)
**Goal:** Polish and validate with real data

**Tasks:**
1. User testing with coordinators
2. Validate statistical methods
3. Performance optimization
4. Documentation
5. Training materials

**Deliverable:** Production-ready analytics platform

---

## 📋 Technical Stack

**Backend:**
- Next.js API routes (TypeScript)
- Supabase for data storage and queries
- Statistical calculations in TypeScript (avoid ML dependencies for now)

**Frontend:**
- React + Material-UI
- Recharts for visualizations (already in project)
- React Query for caching

**Data Storage:**
- `member_analytics_cache` table for pre-calculated metrics
- Refresh strategy: Daily + on-demand

---

## 🎯 Success Metrics

**For the Analytics Dashboard:**
1. **Adoption:** 100% of coordinators use it weekly
2. **Actionability:** X interventions triggered per month
3. **Validation:** Correlation coefficients match clinical expectations
4. **Performance:** <3 seconds load time for all pages

**For Program Outcomes:**
1. **Prediction Accuracy:** Within 10% of actual compliance score
2. **Early Detection:** Identify at-risk members 30+ days before crisis
3. **Intervention Effectiveness:** X% improvement in targeted members

---

## 📝 Next Steps

**Immediate (Today):**
1. ✅ Review this plan with user
2. Get approval on design and scope
3. Begin Phase 1: Data Pipeline

**This Week:**
1. Create `member_analytics_cache` table schema
2. Build metrics calculation functions
3. Create first API endpoint

**Next Week:**
1. Start building dashboard UI
2. Implement Tab 1: Compliance Patterns

---

## 🚀 Let's Begin!

**Question for you:**
1. Does this plan align with your vision?
2. Any changes to the proposed visualizations or metrics?
3. Ready to start Phase 1?








