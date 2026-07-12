-- Platform-wide SDG-aligned reference targets (Task 9.4). Illustrative,
-- editable defaults -- organizations can add their own donor-KPI-specific
-- targets in benchmark_targets scoped to their own organization_id.
INSERT INTO benchmark_targets (id, organization_id, metric_name, target_value, target_type, label) VALUES
('target_response_rate', NULL, 'response_rate_pct', 70, 'sdg', 'Target response rate for reliable SDG monitoring'),
('target_positive_sentiment', NULL, 'positive_sentiment_pct', 60, 'sdg', 'Target share of positive/neutral sentiment responses');
