-- Extend metric_definitions to drive executive dashboard layout and visuals.
-- Each metric can be assigned to a dashboard section, given a visual type,
-- and flagged for inclusion on the executive dashboard.

-- 1. Add new columns
ALTER TABLE metric_definitions
  ADD COLUMN dashboard_section text,
  ADD COLUMN visual_type text,
  ADD COLUMN show_on_executive_dashboard boolean NOT NULL DEFAULT false;

-- 2. Add CHECK constraints for allowed values
ALTER TABLE metric_definitions
  ADD CONSTRAINT chk_dashboard_section CHECK (
    dashboard_section IS NULL OR dashboard_section IN (
      'FINANCIAL_HEALTH',
      'MARKETING_ENGINE',
      'SALES_PERFORMANCE',
      'CLIENT_MODEL_STRENGTH'
    )
  );

ALTER TABLE metric_definitions
  ADD CONSTRAINT chk_visual_type CHECK (
    visual_type IS NULL OR visual_type IN ('GAUGE', 'SPARK')
  );

-- 3. Index for efficient dashboard queries
CREATE INDEX idx_metric_definitions_dashboard
  ON metric_definitions (dashboard_section, display_order)
  WHERE show_on_executive_dashboard = true AND active_flag = true;

-- 4. Backfill existing metrics with section, visual type, and dashboard flag.
--
-- FINANCIAL_HEALTH: revenue and cash flow metrics
--   collections        → GAUGE (pace-to-target for cash collected)
--   booked_sales       → GAUGE (pace-to-target for booked revenue)
--   pipeline_value     → SPARK (trend of pipeline growth)
--
-- MARKETING_ENGINE: lead generation and cost efficiency
--   leads              → SPARK (lead volume trend)
--   show_rate_pct      → GAUGE (conversion rate target)
--   cost_per_lead      → SPARK (cost efficiency trend)
--   cost_per_attendee  → SPARK (cost efficiency trend)
--
-- SALES_PERFORMANCE: conversion and deal metrics
--   pmes_scheduled     → SPARK (activity momentum)
--   programs_won       → GAUGE (pace-to-target for closed deals)
--   close_rate_pct     → GAUGE (conversion rate target)
--   avg_program_value  → SPARK (deal size trend)
--
-- CLIENT_MODEL_STRENGTH: retention and lifetime value
--   active_clients              → SPARK (client base trend)
--   existing_client_revenue_pct → GAUGE (retention revenue target)
--   ltv_avg                     → SPARK (lifetime value trend)

UPDATE metric_definitions SET
  dashboard_section = 'FINANCIAL_HEALTH',
  visual_type = 'GAUGE',
  show_on_executive_dashboard = true
WHERE metric_key = 'collections';

UPDATE metric_definitions SET
  dashboard_section = 'FINANCIAL_HEALTH',
  visual_type = 'GAUGE',
  show_on_executive_dashboard = true
WHERE metric_key = 'booked_sales';

UPDATE metric_definitions SET
  dashboard_section = 'FINANCIAL_HEALTH',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'pipeline_value';

UPDATE metric_definitions SET
  dashboard_section = 'MARKETING_ENGINE',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'leads';

UPDATE metric_definitions SET
  dashboard_section = 'MARKETING_ENGINE',
  visual_type = 'GAUGE',
  show_on_executive_dashboard = true
WHERE metric_key = 'show_rate_pct';

UPDATE metric_definitions SET
  dashboard_section = 'MARKETING_ENGINE',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'cost_per_lead';

UPDATE metric_definitions SET
  dashboard_section = 'MARKETING_ENGINE',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'cost_per_attendee';

UPDATE metric_definitions SET
  dashboard_section = 'SALES_PERFORMANCE',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'pmes_scheduled';

UPDATE metric_definitions SET
  dashboard_section = 'SALES_PERFORMANCE',
  visual_type = 'GAUGE',
  show_on_executive_dashboard = true
WHERE metric_key = 'programs_won';

UPDATE metric_definitions SET
  dashboard_section = 'SALES_PERFORMANCE',
  visual_type = 'GAUGE',
  show_on_executive_dashboard = true
WHERE metric_key = 'close_rate_pct';

UPDATE metric_definitions SET
  dashboard_section = 'SALES_PERFORMANCE',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'avg_program_value';

UPDATE metric_definitions SET
  dashboard_section = 'CLIENT_MODEL_STRENGTH',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'active_clients';

UPDATE metric_definitions SET
  dashboard_section = 'CLIENT_MODEL_STRENGTH',
  visual_type = 'GAUGE',
  show_on_executive_dashboard = true
WHERE metric_key = 'existing_client_revenue_pct';

UPDATE metric_definitions SET
  dashboard_section = 'CLIENT_MODEL_STRENGTH',
  visual_type = 'SPARK',
  show_on_executive_dashboard = true
WHERE metric_key = 'ltv_avg';

COMMENT ON COLUMN metric_definitions.dashboard_section IS 'Executive dashboard section grouping. NULL means not assigned to any section.';
COMMENT ON COLUMN metric_definitions.visual_type IS 'Dashboard visual paradigm: GAUGE for pace-to-target, SPARK for trend/momentum.';
COMMENT ON COLUMN metric_definitions.show_on_executive_dashboard IS 'Whether this metric appears on the executive dashboard.';
