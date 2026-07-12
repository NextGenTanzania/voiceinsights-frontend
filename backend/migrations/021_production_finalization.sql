CREATE TABLE IF NOT EXISTS production_queue_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  campaign_id TEXT,
  queue_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  payload_json TEXT NOT NULL,
  provider_reference TEXT,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_production_queue_status ON production_queue_jobs(queue_type,status,priority,next_attempt_at);
CREATE TABLE IF NOT EXISTS executive_approval_requests (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  proposal_url TEXT,
  contract_url TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_founder_approval',
  decision_note TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS production_notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  audience_role TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  status TEXT NOT NULL DEFAULT 'queued',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS distribution_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  campaign_id TEXT,
  survey_id TEXT,
  action TEXT NOT NULL,
  channel TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
