-- Add Program Margin metric definition.
INSERT INTO metric_definitions (metric_key, label, value_type, period_types, display_order, active_flag, dashboard_section, visual_type, show_on_executive_dashboard)
VALUES ('program_margin', 'Program Margin', 'percent', ARRAY['MONTH']::text[], 15, true, 'FINANCIAL_HEALTH', 'GAUGE', true);
