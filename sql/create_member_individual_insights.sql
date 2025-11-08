-- Create member_individual_insights table for Analytics & Insights tab
-- Stores pre-calculated individual analytics (ranking, comparison, AI recommendations)
-- No historical tracking - just current state

CREATE TABLE IF NOT EXISTS member_individual_insights (
  insight_id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Section 1: Ranking & Risk
  compliance_percentile INTEGER, -- 0-100 (where member ranks in population)
  quartile INTEGER, -- 1, 2, 3, or 4
  rank_in_population INTEGER, -- 1 = best, 64 = worst
  total_members_in_population INTEGER, -- Total members in comparison set
  risk_level TEXT, -- 'green', 'yellow', 'red' (maps to status_indicator)
  risk_score INTEGER, -- 0-100 (same as status_score)
  risk_factors JSONB, -- Array: ["Nutrition 15% below avg", "2 modules overdue"]
  journey_pattern TEXT, -- 'success_stories', 'clinical_attention', 'motivational_support', 'high_priority'
  
  -- Section 2: Comparative Analysis
  compliance_comparison JSONB,
  -- {
  --   "overall": {"member": 72, "population_avg": 60, "diff": +12},
  --   "nutrition": {"member": 65, "population_avg": 80, "diff": -15},
  --   "supplements": {"member": 85, "population_avg": 75, "diff": +10},
  --   "exercise": {"member": 80, "population_avg": 65, "diff": +15},
  --   "meditation": {"member": 60, "population_avg": 70, "diff": -10}
  -- }
  
  vitals_comparison JSONB,
  -- {
  --   "energy": {"member_score": 5, "member_trend": "declining", "population_avg": 6.5},
  --   "mood": {"member_score": 7, "member_trend": "improving", "population_avg": 6.8},
  --   ...
  -- }
  
  outcomes_comparison JSONB,
  -- {
  --   "msq_improvement": {"member": -35, "population_avg": -25, "member_better": true},
  --   "promis_improvement": {"member": +6, "population_avg": +4, "member_better": true}
  -- }
  
  -- Section 3: AI Recommendations
  ai_recommendations JSONB,
  -- [
  --   {
  --     "priority": "high",
  --     "title": "Address Nutrition Compliance Gap",
  --     "current_state": "65% (15% below population avg)",
  --     "impact": "Members ≥80% nutrition have 70% improvement rate vs 46% for <40%",
  --     "action": "Review meal planning barriers with member",
  --     "evidence": "Program data shows nutrition is strongest predictor"
  --   }
  -- ]
  
  UNIQUE(lead_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_insights_lead ON member_individual_insights(lead_id);
CREATE INDEX IF NOT EXISTS idx_member_insights_quartile ON member_individual_insights(quartile);
CREATE INDEX IF NOT EXISTS idx_member_insights_risk ON member_individual_insights(risk_level);
CREATE INDEX IF NOT EXISTS idx_member_insights_calculated ON member_individual_insights(calculated_at DESC);

-- Add comment
COMMENT ON TABLE member_individual_insights IS 'Individual member analytics: ranking, comparative analysis, and AI recommendations. Updated during weekly survey import batch process.';


