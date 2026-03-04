-- Enable RLS on metric_targets and metric_definitions, matching the pattern
-- used on other public tables (e.g. campaigns, leads): authenticated users
-- get full access, service_role bypasses.

ALTER TABLE metric_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_access_metric_targets
  ON metric_targets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_metric_targets
  ON metric_targets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY authenticated_access_metric_definitions
  ON metric_definitions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_metric_definitions
  ON metric_definitions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
