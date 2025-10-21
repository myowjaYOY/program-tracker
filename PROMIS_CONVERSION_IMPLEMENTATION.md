# PROMIS-29 Text-to-Numeric Conversion Implementation

## ✅ IMPLEMENTATION COMPLETE

**Date:** October 21, 2025  
**File Modified:** `supabase/functions/process-survey-import/index.ts`  
**Backup Created:** `supabase/functions/process-survey-import/index.ts.backup`

---

## 📋 WHAT WAS IMPLEMENTED

### 1. **New Interface: `QuestionDomainMapping`**
- **Location:** Lines 30-34
- **Purpose:** Type definition for question-to-domain mappings with survey code

```typescript
interface QuestionDomainMapping {
  question_id: number;
  domain_key: string;
  survey_code: string;
}
```

---

### 2. **New Function: `convertPromisAnswerToNumeric()`**
- **Location:** Lines 36-163
- **Purpose:** Converts PROMIS-29 text responses to numeric scores based on domain-specific mappings
- **Parameters:**
  - `answerText`: The text answer from the survey
  - `domainKey`: The domain key from `survey_domains` table
  - `questionText`: The question text (used for Sleep Disturbance special cases)
- **Returns:** Numeric score (1-5 for most domains, 0-10 for pain_intensity) or null if not convertible

**Domain Mappings Implemented:**

| Domain | Scoring Direction | Scale |
|--------|------------------|-------|
| `physical_function` | Higher = Better | 1-5 |
| `anxiety` | Higher = Worse | 1-5 |
| `depression` | Higher = Worse | 1-5 |
| `fatigue` | Higher = Worse | 1-5 |
| `sleep_disturbance` | Mixed (question-dependent) | 1-5 |
| `social_roles` | Higher = Better (reversed) | 1-5 |
| `pain_interference` | Higher = Worse | 1-5 |
| `pain_intensity` | Direct numeric | 0-10 |

**Special Handling:**
- **Sleep Disturbance** has 3 different mappings based on question text:
  - "sleep quality" → Reversed scoring (Very poor=5, Very good=1)
  - "refreshing" → Reversed scoring (Not at all=5, Very much=1)
  - Standard questions → Normal scoring (Not at all=1, Very much=5)

---

### 3. **Enhanced Data Loading**
- **Location:** Lines 437-468
- **Changes:**
  - Added query to fetch question-domain mappings from `survey_form_question_domain` table
  - Joins with `survey_domains` to get `survey_code` (MSQ or PROMIS)
  - Creates `questionDomainMap` lookup: `questionId → { domain_key, survey_code }`
  - Logs count of loaded mappings

---

### 4. **Updated Answer Conversion Logic**
- **Location:** Lines 734-766
- **Changes:**
  - **Step 1:** Check if answer is already numeric (handles Pain Intensity and MSQ numeric responses)
  - **Step 2:** If text answer, look up question in `questionDomainMap`
  - **Step 3:** If question has PROMIS domain mapping (`survey_code === 'PROMIS'`), call `convertPromisAnswerToNumeric()`
  - **Step 4:** Store converted numeric value in `answer_numeric` field
  - **Logging:** Logs each PROMIS conversion for debugging

**Logic Flow:**
```
Is answer numeric? 
  YES → Use numeric value
  NO → Does question have domain mapping?
    YES → Is survey_code 'PROMIS'?
      YES → Convert text to numeric using domain mappings
      NO → Leave as null (MSQ text responses)
    NO → Leave as null
```

---

### 5. **Enhanced Domain Scoring**
- **Location:** Lines 835-880
- **Changes:**
  - Updated comments to mention both MSQ and PROMIS surveys
  - Changed `form_id` filter from `.eq('form_id', 3)` to `.in('form_id', [3, 6])`
  - Now processes both MSQ (form_id=3) and PROMIS (form_id=6) surveys
  - Domain scores automatically calculated for both survey types

---

## 🔄 COMPLETE DATA FLOW

### **When PROMIS Survey is Imported:**

1. **CSV Upload** → Parse rows
2. **Load Mappings** → Fetch question-domain-survey relationships from database
3. **Process Sessions** → Group responses by session
4. **Create Questions** → Get or create question records
5. **Convert Answers:**
   - If numeric → Store as-is
   - If text + PROMIS domain → Convert using `convertPromisAnswerToNumeric()`
   - If text + no domain → Store as null
6. **Insert Responses** → Store `answer_text` and `answer_numeric`
7. **Calculate Domain Scores** → Automatically runs for `form_id IN (3, 6)`
8. **Insert Domain Scores** → Populate `survey_domain_scores` table

---

## ✅ DATABASE-DRIVEN APPROACH

**Key Benefits:**
- ✅ Uses actual mappings from `survey_form_question_domain` table
- ✅ No hardcoded question text matching
- ✅ Flexible - if question mappings change, code doesn't need updates
- ✅ Only processes questions that have domain mappings
- ✅ MSQ questions without PROMIS mappings are unaffected
- ✅ Domain scores calculated automatically for both MSQ and PROMIS

---

## 📊 EXPECTED RESULTS

**After PROMIS Survey Import:**
- ✅ Text answers like "Never", "Rarely", "Sometimes" → Converted to 1, 2, 3
- ✅ Pain Intensity numeric answers (0-10) → Stored as-is
- ✅ Sleep Disturbance answers → Correctly scored based on question type
- ✅ Domain scores → Automatically calculated and inserted into `survey_domain_scores`
- ✅ MSQ surveys → Continue to work unchanged

---

## 🧪 TESTING RECOMMENDATIONS

1. **Import a PROMIS CSV file** with known text responses
2. **Check `survey_responses` table:**
   - Verify `answer_text` contains original text
   - Verify `answer_numeric` contains converted numeric values
3. **Check `survey_domain_scores` table:**
   - Verify domain scores are calculated for PROMIS sessions
   - Verify `form_id = 6` records exist
4. **Check console logs:**
   - Look for "Converted PROMIS answer" messages
   - Verify conversion mappings are correct

---

## 🔙 ROLLBACK INSTRUCTIONS

If issues arise, restore the backup:

```bash
cp supabase/functions/process-survey-import/index.ts.backup supabase/functions/process-survey-import/index.ts
```

Then redeploy the Edge Function.

---

## 📝 NOTES

- All PROMIS text-to-numeric mappings are based on official PROMIS-29 v2.1 scoring guidelines
- Sleep Disturbance domain has special handling for 3 different question types
- Pain Intensity (0-10 scale) is already numeric and passes through unchanged
- MSQ surveys are completely unaffected by these changes
- Domain scoring uses the same severity calculation logic for both MSQ and PROMIS

---

## ✅ IMPLEMENTATION STATUS

**Status:** COMPLETE ✅  
**Backup:** CREATED ✅  
**Linting:** PASSED ✅  
**Ready for Deployment:** YES ✅

