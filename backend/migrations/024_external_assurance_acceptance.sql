CREATE TABLE IF NOT EXISTS external_assurance_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  type TEXT NOT NULL,
  provider_or_auditor TEXT NOT NULL,
  result TEXT NOT NULL,
  evidence_reference TEXT,
  findings_json TEXT,
  executed_at TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_external_assurance_org_type ON external_assurance_evidence(organization_id,type,executed_at);

CREATE TABLE IF NOT EXISTS client_journey_acceptance_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  client_name TEXT,
  project_name TEXT,
  score_pct INTEGER NOT NULL,
  status TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  executed_by TEXT,
  executed_at TEXT NOT NULL
);
