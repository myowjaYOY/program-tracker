# PROMIS-29 Implementation Test Plan

## 📋 PRE-DEPLOYMENT CHECKLIST

- ✅ **Backup Created:** `supabase/functions/process-survey-import/index.ts.backup`
- ✅ **Code Review:** All changes reviewed and documented
- ✅ **Linting:** No errors found
- ✅ **Logic Verification:** Database-driven approach confirmed with schema queries

---

## 🧪 TESTING STEPS

### **Phase 1: Verify Database Schema**

1. **Confirm question-domain mappings exist:**
   ```sql
   SELECT COUNT(*) FROM survey_form_question_domain sfqd
   JOIN survey_domains sd ON sfqd.domain_key = sd.domain_key
   WHERE sd.survey_code = 'PROMIS';
   ```
   **Expected:** 29 rows (all PROMIS-29 questions)

2. **Verify PROMIS domains:**
   ```sql
   SELECT domain_key, domain_label FROM survey_domains
   WHERE survey_code = 'PROMIS'
   ORDER BY domain_key;
   ```
   **Expected:** 8 domains (physical_function, anxiety, depression, fatigue, sleep_disturbance, social_roles, pain_interference, pain_intensity)

---

### **Phase 2: Deploy Edge Function**

1. **Deploy to Supabase:**
   ```bash
   supabase functions deploy process-survey-import
   ```

2. **Verify deployment:**
   - Check Supabase Dashboard → Edge Functions
   - Confirm function is active and no deployment errors

---

### **Phase 3: Test with Sample PROMIS Data**

1. **Prepare Test CSV:**
   - Create a CSV with PROMIS-29 responses
   - Include text answers like "Never", "Rarely", "Sometimes", "Often", "Always"
   - Include numeric Pain Intensity answers (0-10)
   - Include Sleep Disturbance questions with different wordings

2. **Upload CSV:**
   - Use the survey import functionality
   - Monitor console logs for conversion messages

3. **Verify Responses Table:**
   ```sql
   SELECT 
     sr.response_id,
     sq.question_text,
     sr.answer_text,
     sr.answer_numeric,
     sfqd.domain_key,
     sd.survey_code
   FROM survey_responses sr
   JOIN survey_questions sq ON sr.question_id = sq.question_id
   JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
   LEFT JOIN survey_form_question_domain sfqd ON sq.question_id = sfqd.question_id
   LEFT JOIN survey_domains sd ON sfqd.domain_key = sd.domain_key
   WHERE srs.form_id = 6  -- PROMIS form
   ORDER BY sr.session_id, sq.question_id
   LIMIT 50;
   ```
   
   **Expected Results:**
   - `answer_text` = Original text (e.g., "Never", "Rarely")
   - `answer_numeric` = Converted value (e.g., 1, 2)
   - `survey_code` = 'PROMIS'

4. **Verify Domain Scores:**
   ```sql
   SELECT 
     sds.score_id,
     sds.session_id,
     sds.domain_key,
     sd.domain_label,
     sds.domain_total_score,
     sds.severity_assessment,
     sds.form_id
   FROM survey_domain_scores sds
   JOIN survey_domains sd ON sds.domain_key = sd.domain_key
   WHERE sds.form_id = 6  -- PROMIS form
   ORDER BY sds.session_id, sds.domain_key;
   ```
   
   **Expected Results:**
   - Domain scores calculated for all 8 PROMIS domains
   - `domain_total_score` = Sum of numeric answers for that domain
   - `severity_assessment` = 'minimal', 'mild', 'moderate', or 'severe'

---

### **Phase 4: Verify Conversion Accuracy**

**Test each domain with known answers:**

| Domain | Test Answer | Expected Numeric | Verify |
|--------|-------------|------------------|--------|
| Physical Function | "Without any difficulty" | 5 | ☐ |
| Physical Function | "Unable to do" | 1 | ☐ |
| Anxiety | "Never" | 1 | ☐ |
| Anxiety | "Always" | 5 | ☐ |
| Depression | "Rarely" | 2 | ☐ |
| Fatigue | "Somewhat" | 3 | ☐ |
| Sleep (quality) | "Very poor" | 5 | ☐ |
| Sleep (quality) | "Very good" | 1 | ☐ |
| Sleep (refreshing) | "Not at all" | 5 | ☐ |
| Sleep (standard) | "Quite a bit" | 4 | ☐ |
| Social Roles | "Never" | 5 | ☐ |
| Social Roles | "Always" | 1 | ☐ |
| Pain Interference | "Not at all" | 1 | ☐ |
| Pain Intensity | "7" | 7 | ☐ |

---

### **Phase 5: Verify MSQ Unchanged**

1. **Import MSQ Survey:**
   - Upload an MSQ CSV file
   - Verify import completes successfully

2. **Check MSQ Responses:**
   ```sql
   SELECT 
     sr.response_id,
     sq.question_text,
     sr.answer_text,
     sr.answer_numeric
   FROM survey_responses sr
   JOIN survey_questions sq ON sr.question_id = sq.question_id
   JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
   WHERE srs.form_id = 3  -- MSQ form
   ORDER BY sr.session_id DESC
   LIMIT 20;
   ```
   
   **Expected Results:**
   - MSQ responses work exactly as before
   - Numeric answers stored correctly
   - No PROMIS conversion applied to MSQ questions

3. **Check MSQ Domain Scores:**
   ```sql
   SELECT COUNT(*) FROM survey_domain_scores
   WHERE form_id = 3;
   ```
   
   **Expected:** Domain scores still calculated for MSQ surveys

---

### **Phase 6: Monitor Console Logs**

**Look for these log messages during import:**

1. ✅ `"Loaded X question-domain mappings"`
   - Should show ~100+ mappings (MSQ + PROMIS)

2. ✅ `"Converted PROMIS answer: \"Never\" -> 1 (domain: anxiety)"`
   - Should appear for each PROMIS text answer converted

3. ✅ `"Starting domain scoring for MSQ and PROMIS surveys..."`
   - Confirms both survey types are being scored

4. ✅ `"Found X sessions for domain scoring (MSQ and PROMIS)"`
   - Shows both types are included

---

### **Phase 7: Edge Cases**

Test these scenarios:

1. **Unknown text answer:**
   - Answer: "Maybe" (not in mappings)
   - Expected: `answer_numeric = null`, no error

2. **Mixed case text:**
   - Answer: "NEVER" or "NeVeR"
   - Expected: Converted to 1 (case-insensitive)

3. **Extra whitespace:**
   - Answer: "  Never  "
   - Expected: Converted to 1 (trimmed)

4. **Pain Intensity edge values:**
   - Answer: "0" → Expected: 0
   - Answer: "10" → Expected: 10

5. **Sleep Disturbance variations:**
   - Question with "sleep quality" → Verify reversed scoring
   - Question with "refreshing" → Verify reversed scoring
   - Question with "problem with sleep" → Verify normal scoring

---

## 🚨 ROLLBACK PROCEDURE

**If any issues are found:**

1. **Restore backup:**
   ```bash
   cp supabase/functions/process-survey-import/index.ts.backup supabase/functions/process-survey-import/index.ts
   ```

2. **Redeploy:**
   ```bash
   supabase functions deploy process-survey-import
   ```

3. **Verify rollback:**
   - Import a test file
   - Confirm old behavior restored

---

## ✅ SUCCESS CRITERIA

- ☐ All PROMIS text answers converted to numeric values
- ☐ Pain Intensity numeric values (0-10) stored correctly
- ☐ Sleep Disturbance special cases handled correctly
- ☐ Domain scores calculated for PROMIS sessions
- ☐ MSQ surveys continue to work unchanged
- ☐ No errors in console logs
- ☐ No performance degradation

---

## 📊 POST-DEPLOYMENT MONITORING

**Monitor for 24-48 hours:**

1. **Check error logs:**
   - Supabase Dashboard → Edge Functions → Logs
   - Look for any conversion errors

2. **Verify data quality:**
   - Spot-check random PROMIS responses
   - Confirm numeric values are reasonable

3. **Performance check:**
   - Monitor import times
   - Ensure no significant slowdown

---

## 📝 NOTES

- Backup file: `supabase/functions/process-survey-import/index.ts.backup`
- Implementation doc: `PROMIS_CONVERSION_IMPLEMENTATION.md`
- All changes are database-driven and use existing mappings
- No hardcoded question text matching
- MSQ functionality completely unaffected

