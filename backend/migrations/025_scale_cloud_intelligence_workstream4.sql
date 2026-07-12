-- Workstream 4: production queues and operational acceptance evidence
CREATE TABLE IF NOT EXISTS production_queue_jobs_ws4 (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  campaign_id TEXT,
  queue_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 5,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT,
  available_at TEXT,
  locked_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ws4_queue_status_available ON production_queue_jobs_ws4(queue_type,status,available_at,priority);
CREATE INDEX IF NOT EXISTS idx_ws4_queue_org ON production_queue_jobs_ws4(organization_id,created_at);

CREATE TABLE IF NOT EXISTS operational_acceptance_runs_ws4 (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score_pct INTEGER NOT NULL,
  evidence_reference TEXT,
  result_json TEXT NOT NULL,
  executed_by TEXT,
  executed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ws4_acceptance_type ON operational_acceptance_runs_ws4(run_type,status,executed_at);
