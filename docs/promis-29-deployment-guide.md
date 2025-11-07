# PROMIS-29 Analysis Deployment Guide

**Date:** 2025-11-07  
**Task:** Add PROMIS-29 statistical analysis (side-by-side with MSQ)

---

## ✅ COMPLETED IMPLEMENTATION

All code changes are complete! Here's what was implemented:

### 1. **Database Schema** ✅
- Added 3 new JSONB columns to `member_analytics_cache`:
  - `promis_success_rates`
  - `promis_effect_size`
  - `promis_odds_ratio`

### 2. **SQL Function** ✅
- Added PROMIS-29 calculation logic (148 new lines)
- Calculates same 3 metrics as MSQ:
  - Success rates by compliance tier (Low, Medium, High)
  - Effect size (High vs Low compliance comparison)
  - Odds ratio (likelihood of improvement)
- Uses `survey_response_sessions` with `form_id = 2` (PROMIS form)

### 3. **Frontend UI** ✅
- Updated `InsightsTab.tsx` for side-by-side comparison
- Left column: MSQ (Medical Symptoms Questionnaire)
- Right column: PROMIS-29 (Quality of Life Assessment)
- Clean, compact layout with matching card structures

### 4. **TypeScript Interfaces** ✅
- Updated `use-analytics-metrics.ts` with new fields
- Proper typing for all new JSONB columns

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Update Database Schema (2 minutes)

Open **Supabase SQL Editor** and run:

```sql
-- File: sql/add_promis_analytics_columns.sql

ALTER TABLE member_analytics_cache
ADD COLUMN IF NOT EXISTS promis_success_rates JSONB,
ADD COLUMN IF NOT EXISTS promis_effect_size JSONB,
ADD COLUMN IF NOT EXISTS promis_odds_ratio JSONB;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'member_analytics_cache' 
  AND column_name LIKE '%promis%'
ORDER BY ordinal_position;
```

**Expected Output:** 3 rows showing the new columns

---

### Step 2: Update SQL Function (2 minutes)

Copy the **entire contents** of `sql/create_calculate_analytics_function.sql` (now 857 lines) and run in Supabase SQL Editor.

**Expected Output:** `CREATE FUNCTION` success message

---

### Step 3: Refresh Analytics (1 minute)

1. Go to **Program Analytics** → **Insights** tab
2. Click **"Refresh Analytics"** button
3. Wait 5-10 seconds

**Expected Output:** 
- No errors in console
- Page reloads automatically
- Both MSQ and PROMIS-29 data display

---

## 📊 WHAT YOU'LL SEE

### **Before Refresh:**
- MSQ data: ✅ Success rates, effect size, odds ratio
- PROMIS-29 data: ❌ All zeros

### **After Refresh:**
- MSQ data: ✅ Updated with latest calculations
- PROMIS-29 data: ✅ Success rates, effect size, odds ratio populated

---

## 🔍 HOW TO VERIFY IT'S WORKING

### 1. Check SQL Function Logs
In Supabase SQL Editor, run:
```sql
SELECT calculate_analytics_metrics();
```

**Look for these log messages:**
```
NOTICE: Calculating Tab 2: Health Outcomes...
NOTICE: Success rates: [...], Effect size: {...}, Odds ratio: {...}
NOTICE: Calculating PROMIS-29 statistical measures...
NOTICE: PROMIS-29 Success rates: [...], Effect size: {...}, Odds ratio: {...}
```

### 2. Check Database Cache
```sql
SELECT 
  cache_id,
  calculated_at,
  promis_success_rates IS NOT NULL as has_promis_success,
  promis_effect_size IS NOT NULL as has_promis_effect,
  promis_odds_ratio IS NOT NULL as has_promis_odds
FROM member_analytics_cache
ORDER BY calculated_at DESC
LIMIT 1;
```

**Expected:** All three `has_promis_*` columns should be `true`

### 3. Check UI Display
**Insights Tab should show:**
- **Left column (MSQ):** Purple header, 3 tier boxes, effect size card, odds ratio card
- **Right column (PROMIS-29):** Pink/secondary header, 3 tier boxes, effect size card, odds ratio card
- **Alert at top:** "Comparing Two Outcomes..." explanation

---

## 💡 WHAT THE DATA MEANS

### **MSQ (Medical Symptoms Questionnaire)**
- Measures: Symptom burden
- Scoring: Higher score = more symptoms
- Improvement: First score - Last score = positive means fewer symptoms

### **PROMIS-29 (Quality of Life)**
- Measures: 7 domains (physical function, anxiety, depression, fatigue, sleep, social, pain)
- Scoring: T-scores (50 = US average)
- Improvement: First score - Last score = positive means lower T-scores (better for most domains)

### **Key Question to Answer:**
**Do MSQ and PROMIS-29 show the same patterns?**
- If YES → Compliance improves both symptoms AND quality of life
- If NO → Compliance might reduce symptoms but not improve QOL (or vice versa)
- This tells you if the program is holistically effective or just treating symptoms

---

## 🐛 TROUBLESHOOTING

### Issue: "Refresh Analytics" button shows error

**Check:**
1. Did you run BOTH SQL scripts? (schema first, then function)
2. Any syntax errors in SQL Editor?
3. Check browser console for specific error message

### Issue: PROMIS-29 data still shows zeros

**Check:**
1. Does your database have PROMIS-29 data? (`survey_response_sessions` with `form_id = 2`)
2. Run this query:
```sql
SELECT COUNT(*) 
FROM survey_response_sessions 
WHERE form_id = 2 AND completed_on IS NOT NULL;
```
If result is 0, you have no PROMIS data to analyze.

### Issue: Only MSQ data shows, PROMIS columns are NULL

**Check:**
1. Did you run the schema migration? (`ADD COLUMN` statements)
2. Verify columns exist:
```sql
\d member_analytics_cache
```

---

## 📝 FILES MODIFIED

1. ✅ `sql/add_promis_analytics_columns.sql` (NEW - schema migration)
2. ✅ `sql/create_calculate_analytics_function.sql` (MODIFIED - added PROMIS logic, now 857 lines)
3. ✅ `src/components/program-analytics/InsightsTab.tsx` (MODIFIED - side-by-side layout)
4. ✅ `src/lib/hooks/use-analytics-metrics.ts` (MODIFIED - added PROMIS fields to interface)

---

## ✅ SUCCESS CRITERIA

- [ ] Schema migration runs without errors
- [ ] SQL function updates without errors
- [ ] Refresh analytics completes in 5-10 seconds
- [ ] MSQ column shows data (left side)
- [ ] PROMIS-29 column shows data (right side)
- [ ] Success rates add up to 100% for each outcome
- [ ] Effect sizes show real numbers (not zeros)
- [ ] Odds ratios show real multipliers (e.g., "5.2x")

---

**READY TO DEPLOY!** 🚀

All code is written, tested for syntax errors, and ready to run.
Follow the 3 steps above and you'll have full MSQ + PROMIS-29 analysis!



