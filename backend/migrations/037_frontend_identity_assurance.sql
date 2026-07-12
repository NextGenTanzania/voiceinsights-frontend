CREATE TABLE IF NOT EXISTS csp_violation_reports (
 id TEXT PRIMARY KEY, document_uri TEXT, violated_directive TEXT NOT NULL,
 blocked_uri TEXT, source_file TEXT, line_number INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_csp_violation_created ON csp_violation_reports(created_at);
CREATE TABLE IF NOT EXISTS identity_provider_live_evidence (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, provider TEXT NOT NULL,
 discovery_verified_at TEXT, token_exchange_verified_at TEXT, jwks_verified_at TEXT,
 login_verified_at TEXT, logout_verified_at TEXT, scim_verified_at TEXT,
 evidence_json TEXT NOT NULL DEFAULT '{}', reviewer_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(organization_id, provider)
);
CREATE TABLE IF NOT EXISTS frontend_assurance_runs (
 id TEXT PRIMARY KEY, commit_ref TEXT, pages_scanned INTEGER NOT NULL,
 ui_issues INTEGER NOT NULL, security_issues INTEGER NOT NULL, wcag_issues INTEGER NOT NULL,
 strict_csp_ready INTEGER NOT NULL DEFAULT 0, report_json TEXT NOT NULL, created_at TEXT NOT NULL
);
