-- Create member_progress_summary table for pre-calculated dashboard metrics
-- This table is updated by the survey import edge function after each import

CREATE TABLE IF NOT EXISTS member_progress_summary (
  lead_id INTEGER PRIMARY KEY REFERENCES leads(lead_id),
  
  -- Profile metrics
  last_survey_date TIMESTAMPTZ,
  last_survey_name TEXT,
  total_surveys_completed INTEGER DEFAULT 0,
  days_in_program INTEGER,
  status_indicator TEXT CHECK (status_indicator IN ('green', 'yellow', 'red')),
  
  -- Health vitals (current values + trends)
  energy_score NUMERIC,
  energy_trend TEXT CHECK (energy_trend IN ('improving', 'stable', 'declining', 'no_data')),
  energy_sparkline JSONB, -- Array of historical scores for mini chart
  
  mood_score NUMERIC,
  mood_trend TEXT CHECK (mood_trend IN ('improving', 'stable', 'declining', 'no_data')),
  mood_sparkline JSONB,
  
  motivation_score NUMERIC,
  motivation_trend TEXT CHECK (motivation_trend IN ('improving', 'stable', 'declining', 'no_data')),
  motivation_sparkline JSONB,
  
  wellbeing_score NUMERIC,
  wellbeing_trend TEXT CHECK (wellbeing_trend IN ('improving', 'stable', 'declining', 'no_data')),
  wellbeing_sparkline JSONB,
  
  sleep_score NUMERIC,
  sleep_trend TEXT CHECK (sleep_trend IN ('improving', 'stable', 'declining', 'no_data')),
  sleep_sparkline JSONB,
  
  -- Compliance metrics (percentage 0-100)
  nutrition_compliance_pct NUMERIC,
  nutrition_streak INTEGER DEFAULT 0,
  supplements_compliance_pct NUMERIC,
  exercise_compliance_pct NUMERIC,
  exercise_days_per_week NUMERIC,
  meditation_compliance_pct NUMERIC,
  
  -- Latest wins/concerns (JSON arrays)
  latest_wins JSONB DEFAULT '[]'::jsonb,
  latest_concerns JSONB DEFAULT '[]'::jsonb,
  
  -- Timeline progress
  completed_milestones JSONB DEFAULT '[]'::jsonb,
  next_milestone TEXT,
  overdue_milestones JSONB DEFAULT '[]'::jsonb,
  
  -- Goals (from Goals & Whys survey)
  goals JSONB DEFAULT '[]'::jsonb,
  
  -- Weight tracking
  current_weight NUMERIC,
  weight_change NUMERIC, -- +/- from first survey
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  last_import_batch_id INTEGER REFERENCES data_import_jobs(import_batch_id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries (lead_id already indexed as PRIMARY KEY)
CREATE INDEX IF NOT EXISTS idx_member_progress_status ON member_progress_summary(status_indicator);
CREATE INDEX IF NOT EXISTS idx_member_progress_calculated_at ON member_progress_summary(calculated_at);

-- Add RLS policies
ALTER TABLE member_progress_summary ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all progress summaries
CREATE POLICY "Allow authenticated users to read progress summaries"
  ON member_progress_summary
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (done by edge function)
CREATE POLICY "Service role can insert/update progress summaries"
  ON member_progress_summary
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE member_progress_summary IS 'Pre-calculated member progress dashboard metrics, updated by survey import edge function';
COMMENT ON COLUMN member_progress_summary.status_indicator IS 'Overall health status: green (good), yellow (watch), red (attention needed)';
COMMENT ON COLUMN member_progress_summary.latest_wins IS 'Array of recent wins: [{date, message, type}]';
COMMENT ON COLUMN member_progress_summary.latest_concerns IS 'Array of recent concerns: [{date, message, severity}]';
COMMENT ON COLUMN member_progress_summary.goals IS 'Member goals with status: [{goal_text, status: win|at_risk|on_track}]';

