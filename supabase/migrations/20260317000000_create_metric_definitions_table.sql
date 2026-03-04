-- Metric definitions: move from code to database
CREATE TABLE metric_definitions (
  id            bigserial PRIMARY KEY,
  metric_key    text NOT NULL UNIQUE,
  label         text NOT NULL,
  value_type    text NOT NULL CHECK (value_type IN ('currency', 'count', 'percent', 'ratio')),
  period_types  text[] NOT NULL DEFAULT '{}',
  display_order int NOT NULL DEFAULT 0,
  active_flag   boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_metric_definitions_active ON metric_definitions (active_flag) WHERE active_flag = true;

COMMENT ON TABLE metric_definitions IS 'Business performance metrics available for targets.';

-- Seed data (14 metrics from metric-definitions.ts)
INSERT INTO metric_definitions (metric_key, label, value_type, period_types, display_order) VALUES
  ('collections', 'Collections (Cash Collected)', 'currency', ARRAY['WEEK','MONTH']::text[], 1),
  ('booked_sales', 'Booked Sales', 'currency', ARRAY['MONTH']::text[], 2),
  ('pipeline_value', 'Pipeline Value', 'currency', ARRAY['MONTH']::text[], 3),
  ('leads', 'Leads', 'count', ARRAY['WEEK','MONTH']::text[], 4),
  ('show_rate_pct', 'Seminar Show Rate (%)', 'percent', ARRAY['WEEK','MONTH']::text[], 5),
  ('cost_per_lead', 'Cost per Lead', 'currency', ARRAY['WEEK','MONTH']::text[], 6),
  ('cost_per_attendee', 'Cost per Attendee', 'currency', ARRAY['WEEK','MONTH']::text[], 7),
  ('pmes_scheduled', 'PMEs Scheduled', 'count', ARRAY['WEEK','MONTH']::text[], 8),
  ('programs_won', 'Programs Won', 'count', ARRAY['WEEK','MONTH']::text[], 9),
  ('close_rate_pct', 'Close Rate (%)', 'percent', ARRAY['WEEK','MONTH']::text[], 10),
  ('avg_program_value', 'Avg Program Value', 'currency', ARRAY['MONTH']::text[], 11),
  ('active_clients', 'Active Clients', 'count', ARRAY['MONTH']::text[], 12),
  ('existing_client_revenue_pct', 'Revenue from Existing Clients (%)', 'percent', ARRAY['MONTH']::text[], 13),
  ('ltv_avg', 'Avg LTV', 'currency', ARRAY['MONTH']::text[], 14);

-- FK: metric_targets.metric_key references metric_definitions
ALTER TABLE metric_targets
  ADD CONSTRAINT fk_metric_targets_metric_definitions
  FOREIGN KEY (metric_key) REFERENCES metric_definitions(metric_key);
