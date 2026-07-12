CREATE TABLE IF NOT EXISTS programme_results_frameworks (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, title TEXT NOT NULL,
 theory_of_change_json TEXT NOT NULL DEFAULT '{}', indicators_json TEXT NOT NULL DEFAULT '[]', assumptions_json TEXT NOT NULL DEFAULT '[]', risks_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prf_org_project ON programme_results_frameworks(organization_id,project_id,updated_at);
CREATE TABLE IF NOT EXISTS management_response_actions (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, report_id TEXT, recommendation TEXT NOT NULL,
 management_response TEXT NOT NULL, owner TEXT NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', evidence_url TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mra_org_status ON management_response_actions(organization_id,status,due_date);
CREATE TABLE IF NOT EXISTS role_acceptance_runs (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, role_name TEXT NOT NULL, journey_name TEXT NOT NULL, status TEXT NOT NULL,
 evidence_json TEXT NOT NULL DEFAULT '{}', executed_by TEXT NOT NULL, executed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rar_org_role ON role_acceptance_runs(organization_id,role_name,executed_at);
CREATE TABLE IF NOT EXISTS document_security_scans (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, object_key TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT,
 size_bytes INTEGER, sha256 TEXT, scan_status TEXT NOT NULL DEFAULT 'pending', scanner TEXT, findings_json TEXT NOT NULL DEFAULT '[]', scanned_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_scan_org_status ON document_security_scans(organization_id,scan_status,created_at);
