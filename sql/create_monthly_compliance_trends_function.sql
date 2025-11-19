-- Function to calculate monthly compliance trends for the last 12 months
-- Only includes members on Active, Completed, or Paused programs
-- MATCHES EDGE FUNCTION LOGIC EXACTLY (even where edge function has bugs)

CREATE OR REPLACE FUNCTION get_monthly_compliance_trends()
RETURNS TABLE (
  month timestamp with time zone,
  nutrition numeric,
  supplements numeric,
  exercise numeric,
  meditation numeric,
  member_count bigint,
  survey_count bigint
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_sessions AS (
    SELECT 
      DATE_TRUNC('month', srs.completed_on) as survey_month,
      srs.session_id,
      srs.lead_id,
      srs.completed_on
    FROM survey_response_sessions srs
    INNER JOIN member_programs mp ON srs.lead_id = mp.lead_id
    INNER JOIN program_status ps ON mp.program_status_id = ps.program_status_id
    WHERE srs.completed_on >= NOW() - INTERVAL '12 months'
      AND srs.completed_on IS NOT NULL
      AND ps.status_name IN ('Active', 'Completed', 'Paused')
      AND mp.active_flag = true
  ),
  compliance_by_month AS (
    SELECT 
      ms.survey_month,
      ms.session_id,
      ms.lead_id,
      
      -- Nutrition: EXACT match to edge function (answer.includes('always follow') and answer.includes('usually follow'))
      SUM(CASE 
        WHEN LOWER(sq.question_text) LIKE '%following the nutritional plan%' 
          OR LOWER(sq.question_text) LIKE '%followed the nutritional plan%'
        THEN
          CASE 
            WHEN LOWER(sr.answer_text) = 'yes' OR LOWER(sr.answer_text) LIKE '%always follow%' THEN 1.0
            WHEN LOWER(sr.answer_text) LIKE '%usually follow%' THEN 0.5
            ELSE 0.0
          END
        ELSE 0
      END) as nutrition_points,
      
      COUNT(CASE 
        WHEN LOWER(sq.question_text) LIKE '%following the nutritional plan%' 
          OR LOWER(sq.question_text) LIKE '%followed the nutritional plan%'
        THEN 1 
      END) as nutrition_count,
      
      -- Supplements: EXACT match to edge function (answer.includes('always take') and answer.includes('usually take'))
      -- NOTE: This will miss "I usually remember to take my supplements" - but that matches the edge function
      SUM(CASE 
        WHEN (LOWER(sq.question_text) LIKE '%taken your supplements%' 
          OR LOWER(sq.question_text) LIKE '%taking supplements as prescribed%')
          AND LOWER(sr.answer_text) NOT IN ('not applicable', 'n/a')
        THEN
          CASE 
            WHEN LOWER(sr.answer_text) = 'yes' OR LOWER(sr.answer_text) LIKE '%always take%' THEN 1.0
            WHEN LOWER(sr.answer_text) LIKE '%usually take%' THEN 0.5
            ELSE 0.0
          END
        ELSE 0
      END) as supplements_points,
      
      COUNT(CASE 
        WHEN (LOWER(sq.question_text) LIKE '%taken your supplements%' 
          OR LOWER(sq.question_text) LIKE '%taking supplements as prescribed%')
          AND LOWER(sr.answer_text) NOT IN ('not applicable', 'n/a')
        THEN 1 
      END) as supplements_count,
      
      -- Exercise: EXACT match to edge function (questionText.includes('how many days per week do you exercise'))
      AVG(CASE 
        WHEN LOWER(sq.question_text) LIKE '%how many days per week do you exercise%'
        THEN sr.answer_numeric
      END) as exercise_days,
      
      -- Meditation: EXACT match to edge function (answer === 'yes' || answer === 'daily')
      -- NOTE: This will miss frequency-based answers - but that matches the edge function
      AVG(CASE 
        WHEN LOWER(sq.question_text) LIKE '%abdominal breathing%' 
          OR LOWER(sq.question_text) LIKE '%meditation%'
        THEN 
          CASE 
            WHEN LOWER(sr.answer_text) = 'yes' OR LOWER(sr.answer_text) = 'daily' THEN 1.0
            ELSE 0.0
          END
      END) as meditation_points
      
    FROM monthly_sessions ms
    INNER JOIN survey_responses sr ON ms.session_id = sr.session_id
    INNER JOIN survey_questions sq ON sr.question_id = sq.question_id
    GROUP BY ms.survey_month, ms.session_id, ms.lead_id
  )
  SELECT 
    survey_month as month,
    ROUND(AVG(CASE WHEN nutrition_count > 0 THEN (nutrition_points / nutrition_count) * 100 ELSE NULL END), 1) as nutrition,
    ROUND(AVG(CASE WHEN supplements_count > 0 THEN (supplements_points / supplements_count) * 100 ELSE NULL END), 1) as supplements,
    ROUND(AVG(CASE WHEN exercise_days IS NOT NULL THEN (exercise_days / 5.0) * 100 ELSE NULL END), 1) as exercise,
    ROUND(AVG(meditation_points * 100), 1) as meditation,
    COUNT(DISTINCT lead_id) as member_count,
    COUNT(DISTINCT session_id) as survey_count
  FROM compliance_by_month
  GROUP BY survey_month
  ORDER BY survey_month;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_monthly_compliance_trends() TO authenticated;
