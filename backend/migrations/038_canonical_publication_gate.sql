CREATE TABLE IF NOT EXISTS publication_gate_evaluations (
 id TEXT PRIMARY KEY, report_id TEXT, report_version TEXT, dataset_version TEXT,
 organization_id TEXT, project_id TEXT, report_context TEXT NOT NULL DEFAULT 'CUSTOMER',
 canonical_engine_version TEXT NOT NULL, overall_score REAL, score_state TEXT NOT NULL,
 publication_status TEXT NOT NULL, export_allowed INTEGER NOT NULL DEFAULT 0,
 blocking_failures_json TEXT NOT NULL DEFAULT '[]', warnings_json TEXT NOT NULL DEFAULT '[]',
 domain_results_json TEXT NOT NULL DEFAULT '{}', validator_results_json TEXT NOT NULL DEFAULT '{}',
 required_approvals_json TEXT NOT NULL DEFAULT '[]', completed_approvals_json TEXT NOT NULL DEFAULT '[]',
 evaluated_by TEXT, evaluated_at TEXT NOT NULL, input_hash TEXT NOT NULL, result_hash TEXT NOT NULL,
 is_latest INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_publication_gate_report ON publication_gate_evaluations(report_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_gate_latest ON publication_gate_evaluations(report_id, is_latest);
