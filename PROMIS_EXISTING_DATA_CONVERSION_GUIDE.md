# Converting Existing PROMIS Data - Step-by-Step Guide

## 🎯 GOAL
Convert existing PROMIS-29 survey responses that have text answers but no numeric values, then recalculate domain scores.

---

## 📋 PREREQUISITES

1. ✅ Edge Function deployed with PROMIS conversion logic
2. ✅ PROMIS questions mapped in `survey_form_question_domain` table
3. ✅ PROMIS domains exist in `survey_domains` with `survey_code = 'PROMIS'`
4. ✅ Existing PROMIS data in `survey_responses` table (form_id = 6)

---

## 🔍 STEP 1: CHECK IF YOU HAVE UNCONVERTED DATA

Run this query to see how many PROMIS responses need conversion:

```sql
SELECT 
  COUNT(*) as unconverted_responses,
  COUNT(DISTINCT sr.session_id) as sessions_affected
FROM survey_responses sr
JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
JOIN survey_questions sq ON sr.question_id = sq.question_id
LEFT JOIN survey_form_question_domain sfqd ON sq.question_id = sfqd.question_id
LEFT JOIN survey_domains sd ON sfqd.domain_key = sd.domain_key
WHERE srs.form_id = 6  -- PROMIS form
  AND sr.answer_numeric IS NULL  -- No numeric value yet
  AND sr.answer_text IS NOT NULL  -- Has text answer
  AND sd.survey_code = 'PROMIS';  -- Is a PROMIS question
```

**Expected Output:**
- If `unconverted_responses > 0` → You have data to convert
- If `unconverted_responses = 0` → All data is already converted

---

## 🧪 STEP 2: PREVIEW THE CONVERSION (DRY RUN)

**IMPORTANT:** Run this first to see what will change!

```sql
-- Create the conversion function temporarily
CREATE OR REPLACE FUNCTION convert_promis_text_to_numeric(
  answer_text TEXT,
  domain_key TEXT,
  question_text TEXT
) RETURNS INTEGER AS $$
DECLARE
  answer_lower TEXT;
  question_lower TEXT;
BEGIN
  answer_lower := LOWER(TRIM(answer_text));
  question_lower := LOWER(question_text);
  
  IF domain_key = 'physical_function' THEN
    RETURN CASE answer_lower
      WHEN 'without any difficulty' THEN 5
      WHEN 'with a little difficulty' THEN 4
      WHEN 'with some difficulty' THEN 3
      WHEN 'with much difficulty' THEN 2
      WHEN 'unable to do' THEN 1
      ELSE NULL
    END;
  ELSIF domain_key = 'anxiety' THEN
    RETURN CASE answer_lower
      WHEN 'never' THEN 1
      WHEN 'rarely' THEN 2
      WHEN 'sometimes' THEN 3
      WHEN 'often' THEN 4
      WHEN 'always' THEN 5
      ELSE NULL
    END;
  ELSIF domain_key = 'depression' THEN
    RETURN CASE answer_lower
      WHEN 'never' THEN 1
      WHEN 'rarely' THEN 2
      WHEN 'sometimes' THEN 3
      WHEN 'often' THEN 4
      WHEN 'always' THEN 5
      ELSE NULL
    END;
  ELSIF domain_key = 'fatigue' THEN
    RETURN CASE answer_lower
      WHEN 'not at all' THEN 1
      WHEN 'a little bit' THEN 2
      WHEN 'somewhat' THEN 3
      WHEN 'quite a bit' THEN 4
      WHEN 'very much' THEN 5
      ELSE NULL
    END;
  ELSIF domain_key = 'sleep_disturbance' THEN
    IF question_lower LIKE '%sleep quality%' THEN
      RETURN CASE answer_lower
        WHEN 'very poor' THEN 5
        WHEN 'poor' THEN 4
        WHEN 'fair' THEN 3
        WHEN 'good' THEN 2
        WHEN 'very good' THEN 1
        ELSE NULL
      END;
    ELSIF question_lower LIKE '%refreshing%' THEN
      RETURN CASE answer_lower
        WHEN 'not at all' THEN 5
        WHEN 'a little bit' THEN 4
        WHEN 'somewhat' THEN 3
        WHEN 'quite a bit' THEN 2
        WHEN 'very much' THEN 1
        ELSE NULL
      END;
    ELSE
      RETURN CASE answer_lower
        WHEN 'not at all' THEN 1
        WHEN 'a little bit' THEN 2
        WHEN 'somewhat' THEN 3
        WHEN 'quite a bit' THEN 4
        WHEN 'very much' THEN 5
        ELSE NULL
      END;
    END IF;
  ELSIF domain_key = 'social_roles' THEN
    RETURN CASE answer_lower
      WHEN 'never' THEN 5
      WHEN 'rarely' THEN 4
      WHEN 'sometimes' THEN 3
      WHEN 'often' THEN 2
      WHEN 'always' THEN 1
      ELSE NULL
    END;
  ELSIF domain_key = 'pain_interference' THEN
    RETURN CASE answer_lower
      WHEN 'not at all' THEN 1
      WHEN 'a little bit' THEN 2
      WHEN 'somewhat' THEN 3
      WHEN 'quite a bit' THEN 4
      WHEN 'very much' THEN 5
      ELSE NULL
    END;
  ELSIF domain_key = 'pain_intensity' THEN
    RETURN NULL;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Preview the conversions
SELECT 
  sr.response_id,
  srs.session_id,
  sq.question_text,
  sr.answer_text,
  sr.answer_numeric as current_numeric,
  sfqd.domain_key,
  sd.survey_code,
  convert_promis_text_to_numeric(sr.answer_text, sfqd.domain_key, sq.question_text) as new_numeric
FROM survey_responses sr
JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
JOIN survey_questions sq ON sr.question_id = sq.question_id
LEFT JOIN survey_form_question_domain sfqd ON sq.question_id = sfqd.question_id
LEFT JOIN survey_domains sd ON sfqd.domain_key = sd.domain_key
WHERE srs.form_id = 6
  AND sr.answer_numeric IS NULL
  AND sr.answer_text IS NOT NULL
  AND sd.survey_code = 'PROMIS'
ORDER BY srs.session_id, sq.question_id
LIMIT 50;
```

**Review the output:**
- ✅ Check that `new_numeric` values look correct
- ✅ Verify "Never" → 1, "Always" → 5, etc.
- ✅ Check Sleep Disturbance questions have correct reversed scoring

---

## ✅ STEP 3: RUN THE CONVERSION

**CAUTION:** This will modify your data. Make sure the preview looks good first!

```sql
-- Update existing PROMIS responses
UPDATE survey_responses sr
SET answer_numeric = convert_promis_text_to_numeric(sr.answer_text, sfqd.domain_key, sq.question_text)
FROM survey_response_sessions srs
JOIN survey_questions sq ON sr.question_id = sq.question_id
LEFT JOIN survey_form_question_domain sfqd ON sq.question_id = sfqd.question_id
LEFT JOIN survey_domains sd ON sfqd.domain_key = sd.domain_key
WHERE sr.session_id = srs.session_id
  AND srs.form_id = 6
  AND sr.answer_numeric IS NULL
  AND sr.answer_text IS NOT NULL
  AND sd.survey_code = 'PROMIS'
  AND convert_promis_text_to_numeric(sr.answer_text, sfqd.domain_key, sq.question_text) IS NOT NULL;
```

**Check the results:**
```sql
SELECT 
  COUNT(*) as total_converted,
  COUNT(DISTINCT sr.session_id) as sessions_affected
FROM survey_responses sr
JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
WHERE srs.form_id = 6
  AND sr.answer_numeric IS NOT NULL;
```

---

## 📊 STEP 4: RECALCULATE DOMAIN SCORES

Now that responses have numeric values, calculate domain scores:

```sql
-- Delete existing PROMIS domain scores (if any)
DELETE FROM survey_domain_scores
WHERE form_id = 6;

-- Insert new calculated scores
INSERT INTO survey_domain_scores (
  session_id,
  external_user_id,
  lead_id,
  form_id,
  completed_on,
  domain_key,
  domain_total_score,
  severity_assessment,
  created_at
)
SELECT 
  srs.session_id,
  srs.external_user_id,
  srs.lead_id,
  srs.form_id,
  srs.completed_on,
  sfqd.domain_key,
  SUM(sr.answer_numeric) as domain_total_score,
  CASE 
    WHEN SUM(sr.answer_numeric) <= (COUNT(*) * 4) / 4 THEN 'minimal'
    WHEN SUM(sr.answer_numeric) <= (COUNT(*) * 4) / 2 THEN 'mild'
    WHEN SUM(sr.answer_numeric) <= (COUNT(*) * 4) * 3 / 4 THEN 'moderate'
    ELSE 'severe'
  END as severity_assessment,
  NOW() as created_at
FROM survey_responses sr
JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
JOIN survey_questions sq ON sr.question_id = sq.question_id
JOIN survey_form_question_domain sfqd ON sq.question_id = sfqd.question_id
JOIN survey_domains sd ON sfqd.domain_key = sd.domain_key
WHERE srs.form_id = 6
  AND sr.answer_numeric IS NOT NULL
  AND sd.survey_code = 'PROMIS'
GROUP BY 
  srs.session_id,
  srs.external_user_id,
  srs.lead_id,
  srs.form_id,
  srs.completed_on,
  sfqd.domain_key;
```

**Verify domain scores:**
```sql
SELECT 
  COUNT(*) as total_domain_scores,
  COUNT(DISTINCT session_id) as sessions_scored,
  domain_key,
  COUNT(*) as count_per_domain
FROM survey_domain_scores
WHERE form_id = 6
GROUP BY domain_key
ORDER BY domain_key;
```

**Expected:** 8 domain scores per session (physical_function, anxiety, depression, fatigue, sleep_disturbance, social_roles, pain_interference, pain_intensity)

---

## 🧹 STEP 5: CLEANUP

```sql
-- Drop the temporary function
DROP FUNCTION IF EXISTS convert_promis_text_to_numeric(TEXT, TEXT, TEXT);
```

---

## ✅ STEP 6: VERIFY RESULTS

### **Check Sample Conversions:**
```sql
SELECT 
  srs.session_id,
  l.first_name,
  l.last_name,
  sq.question_text,
  sr.answer_text,
  sr.answer_numeric,
  sfqd.domain_key
FROM survey_responses sr
JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
JOIN survey_questions sq ON sr.question_id = sq.question_id
JOIN leads l ON srs.lead_id = l.lead_id
LEFT JOIN survey_form_question_domain sfqd ON sq.question_id = sfqd.question_id
WHERE srs.form_id = 6
  AND sr.answer_numeric IS NOT NULL
ORDER BY srs.session_id, sq.question_id
LIMIT 20;
```

### **Check Domain Scores:**
```sql
SELECT 
  sds.session_id,
  l.first_name,
  l.last_name,
  sd.domain_label,
  sds.domain_total_score,
  sds.severity_assessment
FROM survey_domain_scores sds
JOIN survey_domains sd ON sds.domain_key = sd.domain_key
JOIN leads l ON sds.lead_id = l.lead_id
WHERE sds.form_id = 6
ORDER BY sds.session_id, sd.domain_label;
```

---

## 🚀 ALTERNATIVE: USE THE COMPLETE SCRIPT

I've created a complete script at:
```
scripts/convert-existing-promis-data.sql
```

**To use it:**
1. Open the file in your SQL editor
2. Uncomment the preview section (Step 2) first
3. Review the preview results
4. If good, run the entire script

The script will:
- ✅ Create the conversion function
- ✅ Preview conversions (if uncommented)
- ✅ Update all PROMIS responses
- ✅ Recalculate domain scores
- ✅ Clean up the temporary function
- ✅ Report on results

---

## 📝 NOTES

- **Safe to run multiple times:** The script only updates NULL `answer_numeric` values
- **MSQ unaffected:** Only processes `form_id = 6` (PROMIS)
- **Backup recommended:** Consider backing up `survey_responses` and `survey_domain_scores` tables first
- **Performance:** For large datasets (>10,000 responses), consider running in batches

---

## ⚠️ TROUBLESHOOTING

**If some conversions fail (new_numeric is NULL):**
- Check for typos in answer text (e.g., "Nevr" instead of "Never")
- Check for extra spaces or special characters
- The function trims and lowercases, but unusual characters may cause issues

**If domain scores look wrong:**
- Verify all questions in a domain have numeric values
- Check that question-domain mappings are correct in `survey_form_question_domain`
- Verify severity calculation logic matches your requirements

---

## ✅ SUCCESS CRITERIA

- ☐ All PROMIS text answers converted to numeric
- ☐ Domain scores calculated for all PROMIS sessions
- ☐ 8 domain scores per session (or appropriate number based on data)
- ☐ Severity assessments look reasonable
- ☐ Sample spot-checks confirm accuracy

