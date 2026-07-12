-- Production hardening persistence: idempotent security, identity, offline and assurance evidence.
CREATE TABLE IF NOT EXISTS revoked_token_versions (
  user_id TEXT PRIMARY KEY, token_version INTEGER NOT NULL DEFAULT 0,
  reason TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS offline_packages (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL, survey_id TEXT NOT NULL, survey_version TEXT NOT NULL,
  checksum TEXT NOT NULL, signature TEXT, encrypted INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', expires_at TEXT NOT NULL, revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, assignment_id, survey_version)
);
CREATE TABLE IF NOT EXISTS offline_conflicts (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL,
  response_id TEXT NOT NULL, local_json TEXT NOT NULL, server_json TEXT NOT NULL,
  fields_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  supervisor_id TEXT, supervisor_decision TEXT, me_approver_id TEXT, approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offline_conflicts_tenant_status ON offline_conflicts(organization_id,status,created_at);
CREATE TABLE IF NOT EXISTS identity_provider_tests (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, provider TEXT NOT NULL,
  test_type TEXT NOT NULL, status TEXT NOT NULL, evidence_ref TEXT,
  tested_by TEXT, tested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id,provider,test_type)
);
CREATE TABLE IF NOT EXISTS placeholder_scan_runs (
  id TEXT PRIMARY KEY, commit_ref TEXT, files_scanned INTEGER NOT NULL,
  findings_count INTEGER NOT NULL, findings_json TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS accessibility_audit_runs (
  id TEXT PRIMARY KEY, page_path TEXT NOT NULL, standard TEXT NOT NULL DEFAULT 'WCAG 2.2 AA',
  automated_issues_json TEXT NOT NULL, manual_checklist_json TEXT,
  status TEXT NOT NULL, reviewed_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
