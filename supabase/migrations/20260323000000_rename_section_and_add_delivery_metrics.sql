-- Update check constraint for dashboard_section: replace CLIENT_MODEL_STRENGTH with DELIVERY_MODEL_STRENGTH
ALTER TABLE metric_definitions DROP CONSTRAINT chk_dashboard_section;
ALTER TABLE metric_definitions ADD CONSTRAINT chk_dashboard_section
  CHECK (dashboard_section IS NULL OR dashboard_section IN (
    'FINANCIAL_HEALTH', 'MARKETING_ENGINE', 'SALES_PERFORMANCE', 'DELIVERY_MODEL_STRENGTH'
  ));

-- Rename existing section
UPDATE metric_definitions
SET dashboard_section = 'DELIVERY_MODEL_STRENGTH'
WHERE dashboard_section = 'CLIENT_MODEL_STRENGTH';

-- Add STAR to visual_type check constraint
ALTER TABLE metric_definitions DROP CONSTRAINT chk_visual_type;
ALTER TABLE metric_definitions ADD CONSTRAINT chk_visual_type
  CHECK (visual_type IS NULL OR visual_type IN ('GAUGE', 'SPARK', 'STAR'));

-- Add new Delivery Model Strength metrics
INSERT INTO metric_definitions (metric_key, label, value_type, period_types, display_order, active_flag, dashboard_section, visual_type, show_on_executive_dashboard)
VALUES
  ('avg_satisfaction_score', 'Avg Satisfaction Score', 'ratio', ARRAY['MONTH']::text[], 17, true, 'DELIVERY_MODEL_STRENGTH', 'STAR', true),
  ('overall_compliance_pct', 'Overall Compliance %', 'percent', ARRAY['MONTH']::text[], 18, true, 'DELIVERY_MODEL_STRENGTH', 'GAUGE', true),
  ('dropouts', 'Dropouts', 'count', ARRAY['MONTH']::text[], 19, true, 'DELIVERY_MODEL_STRENGTH', 'SPARK', true);
