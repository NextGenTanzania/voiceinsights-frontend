-- VoiceInsights Flagship Report Engine v2 — Phase 3
CREATE TABLE IF NOT EXISTS flagship_evidence_index (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  report_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  evidence_type TEXT,
  source_label TEXT,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  confidence_score REAL,
  searchable_text TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_flagship_evidence_report ON flagship_evidence_index(report_id);
CREATE INDEX IF NOT EXISTS idx_flagship_evidence_org ON flagship_evidence_index(organization_id);

CREATE TABLE IF NOT EXISTS flagship_knowledge_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  report_id TEXT,
  kind TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  evidence_ids_json TEXT,
  tags_json TEXT,
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_flagship_knowledge_org ON flagship_knowledge_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_flagship_knowledge_report ON flagship_knowledge_records(report_id);

CREATE TABLE IF NOT EXISTS flagship_assistant_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_status TEXT NOT NULL,
  citation_ids_json TEXT,
  confidence_score REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flagship_benchmark_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  peer_scope TEXT NOT NULL,
  peer_count INTEGER NOT NULL,
  minimum_peer_group INTEGER NOT NULL,
  status TEXT NOT NULL,
  statistics_json TEXT,
  privacy_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
