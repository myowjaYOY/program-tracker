-- One-Time Script: Convert Existing PROMIS-29 Text Answers to Numeric
-- This script updates existing survey_responses records that have text answers
-- but no numeric values, applying the PROMIS-29 conversion logic

-- Step 1: Create a temporary function to convert PROMIS answers
CREATE OR REPLACE FUNCTION convert_promis_text_to_numeric(
  answer_text TEXT,
  domain_key TEXT,
  question_text TEXT
) RETURNS INTEGER AS $$
DECLARE
  answer_lower TEXT;
  question_lower TEXT;
BEGIN
  -- Normalize answer text
  answer_lower := LOWER(TRIM(answer_text));
  question_lower := LOWER(question_text);
  
  -- Physical Function (higher = better)
  IF domain_key = 'physical_function' THEN
    RETURN CASE answer_lower
      WHEN 'without any difficulty' THEN 5
      WHEN 'with a little difficulty' THEN 4
      WHEN 'with some difficulty' THEN 3
      WHEN 'with much difficulty' THEN 2
      WHEN 'unable to do' THEN 1
      ELSE NULL
    END;
  
  -- Anxiety (higher = worse)
  ELSIF domain_key = 'anxiety' THEN
    RETURN CASE answer_lower
      WHEN 'never' THEN 1
      WHEN 'rarely' THEN 2
      WHEN 'sometimes' THEN 3
      WHEN 'often' THEN 4
      WHEN 'always' THEN 5
      ELSE NULL
    END;
  
  -- Depression (higher = worse)
  ELSIF domain_key = 'depression' THEN
    RETURN CASE answer_lower
      WHEN 'never' THEN 1
      WHEN 'rarely' THEN 2
      WHEN 'sometimes' THEN 3
      WHEN 'often' THEN 4
      WHEN 'always' THEN 5
      ELSE NULL
    END;
  
  -- Fatigue (higher = worse)
  ELSIF domain_key = 'fatigue' THEN
    RETURN CASE answer_lower
      WHEN 'not at all' THEN 1
      WHEN 'a little bit' THEN 2
      WHEN 'somewhat' THEN 3
      WHEN 'quite a bit' THEN 4
      WHEN 'very much' THEN 5
      ELSE NULL
    END;
  
  -- Sleep Disturbance (mixed wording)
  ELSIF domain_key = 'sleep_disturbance' THEN
    -- Check question text for special cases
    IF question_lower LIKE '%sleep quality%' THEN
      -- Reversed scoring
      RETURN CASE answer_lower
        WHEN 'very poor' THEN 5
        WHEN 'poor' THEN 4
        WHEN 'fair' THEN 3
        WHEN 'good' THEN 2
        WHEN 'very good' THEN 1
        ELSE NULL
      END;
    ELSIF question_lower LIKE '%refreshing%' THEN
      -- Reversed scoring
      RETURN CASE answer_lower
        WHEN 'not at all' THEN 5
        WHEN 'a little bit' THEN 4
        WHEN 'somewhat' THEN 3
        WHEN 'quite a bit' THEN 2
        WHEN 'very much' THEN 1
        ELSE NULL
      END;
    ELSE
      -- Standard sleep disturbance
      RETURN CASE answer_lower
        WHEN 'not at all' THEN 1
        WHEN 'a little bit' THEN 2
        WHEN 'somewhat' THEN 3
        WHEN 'quite a bit' THEN 4
        WHEN 'very much' THEN 5
        ELSE NULL
      END;
    END IF;
  
  -- Social Roles (higher = better, reversed)
  ELSIF domain_key = 'social_roles' THEN
    RETURN CASE answer_lower
      WHEN 'never' THEN 5
      WHEN 'rarely' THEN 4
      WHEN 'sometimes' THEN 3
      WHEN 'often' THEN 2
      WHEN 'always' THEN 1
      ELSE NULL
    END;
  
  -- Pain Interference (higher = worse)
  ELSIF domain_key = 'pain_interference' THEN
    RETURN CASE answer_lower
      WHEN 'not at all' THEN 1
      WHEN 'a little bit' THEN 2
      WHEN 'somewhat' THEN 3
      WHEN 'quite a bit' THEN 4
      WHEN 'very much' THEN 5
      ELSE NULL
    END;
  
  -- Pain Intensity (already numeric, return NULL to skip)
  ELSIF domain_key = 'pain_intensity' THEN
    RETURN NULL;
  
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Preview what will be converted (DRY RUN)
-- Uncomment to see what will change before running the update
/*
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
WHERE srs.form_id = 6  -- PROMIS form
  AND sr.answer_numeric IS NULL  -- No numeric value yet
  AND sr.answer_text IS NOT NULL  -- Has text answer
  AND sd.survey_code = 'PROMIS'  -- Is a PROMIS question
ORDER BY srs.session_id, sq.question_id
LIMIT 50;
*/

/* Step 3: Update existing PROMIS responses with converted numeric values
   CAUTION: This will modify data. Review the preview first! */
UPDATE survey_responses sr
SET answer_numeric = convert_promis_text_to_numeric(sr.answer_text, sfqd.domain_key, sq.question_text)
FROM survey_response_sessions srs,
     survey_questions sq,
     survey_form_question_domain sfqd,
     survey_domains sd
WHERE sr.session_id = srs.session_id
  AND sr.question_id = sq.question_id
  AND sq.question_id = sfqd.question_id
  AND sfqd.domain_key = sd.domain_key
  AND srs.form_id = 6  -- PROMIS form
  AND sr.answer_numeric IS NULL  -- No numeric value yet
  AND sr.answer_text IS NOT NULL  -- Has text answer
  AND sd.survey_code = 'PROMIS'  -- Is a PROMIS question
  AND convert_promis_text_to_numeric(sr.answer_text, sfqd.domain_key, sq.question_text) IS NOT NULL;  -- Only update if conversion succeeds

-- Step 4: Report on what was updated
SELECT 
  COUNT(*) as total_converted,
  COUNT(DISTINCT sr.session_id) as sessions_affected
FROM survey_responses sr
JOIN survey_response_sessions srs ON sr.session_id = srs.session_id
WHERE srs.form_id = 6
  AND sr.answer_numeric IS NOT NULL;

-- Step 5: Recalculate domain scores for PROMIS sessions
-- First, delete existing PROMIS domain scores (if any)
DELETE FROM survey_domain_scores
WHERE form_id = 6;

-- Then insert new calculated scores
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
WHERE srs.form_id = 6  -- PROMIS form
  AND sr.answer_numeric IS NOT NULL  -- Has numeric value
  AND sd.survey_code = 'PROMIS'
GROUP BY 
  srs.session_id,
  srs.external_user_id,
  srs.lead_id,
  srs.form_id,
  srs.completed_on,
  sfqd.domain_key;

-- Step 6: Report on domain scores created
SELECT 
  COUNT(*) as total_domain_scores,
  COUNT(DISTINCT session_id) as sessions_scored
FROM survey_domain_scores
WHERE form_id = 6;

-- Step 7: Clean up - Drop the temporary function
DROP FUNCTION IF EXISTS convert_promis_text_to_numeric(TEXT, TEXT, TEXT);

-- DONE! Check the results above.

