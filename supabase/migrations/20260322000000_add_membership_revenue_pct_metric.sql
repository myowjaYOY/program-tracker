INSERT INTO metric_definitions (metric_key, label, value_type, period_types, display_order, active_flag, dashboard_section, visual_type, show_on_executive_dashboard)
VALUES ('membership_revenue_pct', 'Membership Revenue %', 'percent', ARRAY['MONTH']::text[], 16, true, 'FINANCIAL_HEALTH', 'GAUGE', true);
