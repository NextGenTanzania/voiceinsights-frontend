-- Enterprise Release 4: international standards, procurement and audit evidence
CREATE TABLE IF NOT EXISTS international_standards_runs (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_id TEXT NOT NULL, standards_version TEXT NOT NULL,
 score INTEGER NOT NULL, status TEXT NOT NULL, publication_allowed INTEGER NOT NULL DEFAULT 0,
 components_json TEXT NOT NULL, blockers_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_isr_org_report ON international_standards_runs(organization_id,report_id,created_at);
CREATE TABLE IF NOT EXISTS methodology_reviews (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_id TEXT NOT NULL, standards_run_id TEXT NOT NULL,
 reviewer_id TEXT, decision TEXT NOT NULL, comments TEXT, external_validation_required INTEGER NOT NULL DEFAULT 0, reviewed_at TEXT NOT NULL,
 FOREIGN KEY(standards_run_id) REFERENCES international_standards_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_methodology_reviews_run ON methodology_reviews(standards_run_id);
CREATE TABLE IF NOT EXISTS procurement_readiness_packs (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, score INTEGER NOT NULL, status TEXT NOT NULL,
 packs_json TEXT NOT NULL, blockers_json TEXT NOT NULL, generated_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_procurement_org ON procurement_readiness_packs(organization_id,created_at);
CREATE TABLE IF NOT EXISTS independent_audits (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, audit_version TEXT NOT NULL, verdict TEXT NOT NULL,
 dimensions_json TEXT NOT NULL, summary_json TEXT NOT NULL, findings_json TEXT NOT NULL, auditor_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON independent_audits(organization_id,created_at);
