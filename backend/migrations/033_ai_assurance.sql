-- Enterprise Release 3: AI assurance, evidence traceability and publication governance
CREATE TABLE IF NOT EXISTS ai_assurance_runs (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL, dataset_version TEXT NOT NULL, model TEXT, prompt_version TEXT,
  temperature REAL NOT NULL DEFAULT 0, latency_ms INTEGER, cost REAL, currency TEXT DEFAULT 'USD',
  assurance_score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, publication_status TEXT NOT NULL,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_assurance_org_report ON ai_assurance_runs(organization_id, report_id, created_at);

CREATE TABLE IF NOT EXISTS evidence_registry (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, dataset_id TEXT NOT NULL, dataset_version TEXT NOT NULL,
  source_interview_id TEXT, question_id TEXT, question_text TEXT, respondent_group TEXT,
  quote_text TEXT, source_type TEXT NOT NULL DEFAULT 'interview', sample_size INTEGER,
  consent_verified INTEGER NOT NULL DEFAULT 0, source_verified INTEGER NOT NULL DEFAULT 0,
  checksum TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evidence_dataset_version ON evidence_registry(organization_id, dataset_id, dataset_version);
CREATE INDEX IF NOT EXISTS idx_evidence_interview_question ON evidence_registry(source_interview_id, question_id);

CREATE TABLE IF NOT EXISTS report_claims_assurance (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_id TEXT NOT NULL, assurance_run_id TEXT NOT NULL,
  claim_type TEXT NOT NULL, claim_text TEXT NOT NULL, citation_ids_json TEXT NOT NULL DEFAULT '[]',
  confidence_score INTEGER NOT NULL DEFAULT 0, verification_status TEXT NOT NULL,
  hallucination_flags_json TEXT NOT NULL DEFAULT '{}', contradiction_flags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assurance_run_id) REFERENCES ai_assurance_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_claim_assurance_report ON report_claims_assurance(organization_id, report_id, verification_status);

CREATE TABLE IF NOT EXISTS report_claim_evidence (
  claim_id TEXT NOT NULL, evidence_id TEXT NOT NULL, relationship TEXT NOT NULL DEFAULT 'supports',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(claim_id, evidence_id),
  FOREIGN KEY (claim_id) REFERENCES report_claims_assurance(id), FOREIGN KEY (evidence_id) REFERENCES evidence_registry(id)
);

CREATE TABLE IF NOT EXISTS ai_human_approvals (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_id TEXT NOT NULL, assurance_run_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED','CHANGES_REQUIRED')),
  reason TEXT, approved_at TEXT NOT NULL DEFAULT (datetime('now')), supersedes_id TEXT,
  FOREIGN KEY (assurance_run_id) REFERENCES ai_assurance_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_ai_approvals_report ON ai_human_approvals(organization_id, report_id, approved_at);

CREATE TABLE IF NOT EXISTS publication_gate_events (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_id TEXT NOT NULL, assurance_run_id TEXT,
  gate_status TEXT NOT NULL, publication_allowed INTEGER NOT NULL DEFAULT 0, blocking_reasons_json TEXT NOT NULL DEFAULT '[]',
  actor_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_publication_gate_report ON publication_gate_events(organization_id, report_id, created_at);
