# Member Journey & Survey Timeline

## Overview
This document maps the complete member journey through the 4-Month AIP Program, detailing all modules and the surveys taken at each checkpoint.

**Last Updated:** October 26, 2025  
**Data Source:** Analysis of `survey_response_sessions`, `survey_forms`, `survey_modules`, and `survey_session_program_context` tables

---

## Complete 4-Month AIP Program Journey

### **MODULE 1 - PRE-PROGRAM**
**Purpose:** Baseline assessment and goal setting  
**Surveys:**
- Initial Program Report
- **MSQ #1** (Medical Symptoms Questionnaire - Baseline)
- **PROMIS-29 #1** (Health Assessment - Baseline)
- Goals & Whys

**Timing:** Day 0-7 of program

---

### **MODULE 2 - WEEK 1**
**Purpose:** First week of program implementation  
**Surveys:**
- Week 1 Progress Report

**Timing:** Week 1 (Days 1-7)

---

### **MODULE 3 - WEEK 2**
**Purpose:** Second week progress tracking  
**Surveys:**
- Week 2 Progress Report

**Timing:** Week 2 (Days 8-14)

---

### **MODULE 4 - START OF DETOX**
**Purpose:** Beginning of detoxification phase  
**Surveys:**
- Start of Detox Progress Report

**Timing:** Week 3-4 (Days 15-28)

---

### **MODULE 5 - WEEK 4**
**Purpose:** End of first month milestone  
**Surveys:**
- Week 4 Progress Report

**Timing:** Week 4 (Days 22-28)

---

### **MODULE 6 - MID-DETOX**
**Purpose:** Mid-detox assessment and progress check  
**Surveys:**
- Start of Detox Progress Report (taken again for comparison)
- **MSQ #2** (Mid-Detox Assessment - ~5 weeks in)
- **PROMIS-29 #2** (Mid-Detox Health Check - ~5 weeks in)

**Timing:** Week 5-6 (Days 29-42)

---

### **MODULE 7 - END OF DETOX**
**Purpose:** Completion of detoxification phase  
**Surveys:**
- End of Detox Progress Report
- Initial Results Survey

**Timing:** Week 6-7 (Days 43-49)

---

### **MODULE 8 - END OF MONTH 2**
**Purpose:** Two-month milestone  
**Surveys:**
- Module 8 Progress Report

**Timing:** Week 8 (Days 50-60)

---

### **MODULE 9 - START OF MONTH 3**
**Purpose:** Third month assessment and progress evaluation  
**Surveys:**
- Module 9 Progress Report
- **MSQ #3** (Month 3 Assessment - ~10 weeks in)
- **PROMIS-29 #3** (Month 3 Health Check - ~10 weeks in)

**Timing:** Week 9-10 (Days 61-70)

---

### **MODULE 10 - MID-MONTH 3**
**Purpose:** Mid-program comprehensive review  
**Surveys:**
- Module 10 Progress Report
- Mid-Program Results Survey

**Timing:** Week 11 (Days 71-77)

---

### **MODULE 11 - END OF MONTH 3**
**Purpose:** Three-month milestone  
**Surveys:**
- Module 11 Progress Report

**Timing:** Week 12 (Days 78-90)

---

### **MODULE 12 - START OF MONTH 4**
**Purpose:** Final month begins  
**Surveys:**
- Module 12 Progress Report

**Timing:** Week 13-14 (Days 91-98)

---

### **MODULE 13 - MID-MONTH 4** (Final)
**Purpose:** Program completion and final assessment  
**Surveys:**
- Final Results Survey
- **MSQ #4** (Final Assessment - ~16 weeks/4 months in)
- **PROMIS-29 #4** (Final Health Assessment - ~16 weeks/4 months in)

**Timing:** Week 15-16 (Days 99-120)

---

## Key Assessment Timeline

### MSQ & PROMIS-29 Assessment Schedule
These two critical assessments are taken at **4 key points** throughout the program:

| Instance | Module | Timing | Purpose |
|----------|--------|--------|---------|
| **#1** | MODULE 1 - PRE-PROGRAM | Day 0-7 | **Baseline** - Establish starting point |
| **#2** | MODULE 6 - MID-DETOX | ~Week 5-6 | **Early Progress** - Track detox phase improvements |
| **#3** | MODULE 9 - START OF MONTH 3 | ~Week 9-10 | **Mid-Program** - Evaluate sustained progress |
| **#4** | MODULE 13 - MID-MONTH 4 | ~Week 15-16 | **Final Results** - Measure overall transformation |

**Clinical Value:** These 4 data points allow providers to:
- Track symptom improvement trajectories
- Identify early intervention opportunities
- Celebrate wins at each milestone
- Measure program effectiveness over time

---

## Progress Tracking Data Model

### `survey_user_progress` Table
Tracks member curriculum progress through modules:

- **`last_completed`**: MODULE name (e.g., "MODULE 13 - MID-MONTH 4")
- **`working_on`**: MODULE name or "Finished"
- **`status`**: "Current" or "Behind"
- **`date_of_last_completed`**: Date of last module completion

### `survey_response_sessions` Table
Tracks actual survey submissions with dates and context:

- Links to specific `form_id` (survey type)
- `completed_on`: Timestamp of survey completion
- Connected to module context via `survey_session_program_context`

---

## Dashboard Implications

### Timeline Progress Card
- **Completed Milestones**: List of MODULES completed (from `survey_user_progress` and session history)
- **Current Milestone**: MODULE from `survey_user_progress.working_on`
- **Next Milestone**: Next MODULE in sequence
- **Overdue Milestones**: If `status = "Behind"`, calculate missing modules between `last_completed` and `working_on`

### Health Vitals Tracking
- Pull from weekly progress reports (Week 1-4, Modules 8-12)
- Track trends in energy, mood, motivation, wellbeing, sleep

### Compliance Metrics
- Extract from weekly/module progress reports
- Track nutrition, supplements, exercise, meditation adherence

### Assessment Trends
- MSQ domain scores across 4 instances
- PROMIS-29 T-scores across 4 instances
- Show improvement/decline trajectories

---

## Additional Survey Forms

### Other Forms in Database
- **Week 3 Progress Report** (rarely used)
- **[BONUS] HORMONE MODULE** (optional add-on)

These are not part of the standard 4-month journey but may appear in some member records.

---

## Notes for Developers

1. **Module Names are Canonical**: The MODULE names (e.g., "MODULE 6 - MID-DETOX") are the primary identifiers for curriculum progress.

2. **Survey Forms Can Repeat**: MSQ, PROMIS-29, and "Start of Detox Progress Report" are taken multiple times. Always use `completed_on` dates to determine instance number.

3. **Behind Status Logic**: 
   - Check `survey_user_progress.status`
   - If "Behind", compare `last_completed` vs `working_on` positions in module sequence
   - Calculate days since `date_of_last_completed` to determine urgency

4. **Program Duration**: Standard program is 120 days (4 months), stored in `member_programs.duration` field.

5. **Member Identification**:
   - Primary: `lead_id` from `leads` table
   - Survey data uses: `external_user_id` linked via `survey_user_mappings`

---

## Module-to-Form Relationship

The relationship between **Modules** (`survey_modules`) and **Survey Forms** (`survey_forms`) is **many-to-many** and **implicit**:

- **No Direct Junction Table**: The relationship is captured through `survey_session_program_context`
- **Contextual Binding**: When a member completes a survey, it's linked to the module they were in at that time
- **Flexible Design**: Same form can be used across multiple modules (e.g., MSQ appears in 4 modules)

**For detailed analysis**, see: `docs/survey-forms-to-modules-relationship.md`

### Official Module Sequence (from `survey_modules` table)

```
MODULE 1 - PRE-PROGRAM
MODULE 2 - WEEK 1
MODULE 3 - WEEK 2
MODULE 4 - START OF DETOX
MODULE 5 - WEEK 4
MODULE 6 - MID-DETOX
MODULE 7 - END OF DETOX
MODULE 8 - END OF MONTH 2
MODULE 9 - START OF MONTH 3
MODULE 10 - MID-MONTH 3
MODULE 11 - END OF MONTH 3
MODULE 12 - START OF MONTH 4
MODULE 13 - MID-MONTH 4
```

**Source**: `survey_modules` table, `program_id = 2` (4 Month AIP Program)

---

## References

- Database Schema: `YOY Program Tracker.sql`
- Survey Import Logic: `supabase/functions/process-survey-import/index.ts`
- Progress Import Logic: `supabase/functions/process-user-progress-import/index.ts`
- Report Card Implementation: `src/app/api/report-card/`
- Form-to-Module Mapping: `docs/survey-forms-to-modules-relationship.md`

