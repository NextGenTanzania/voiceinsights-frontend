ALTER TABLE executive_approval_requests ADD COLUMN workflow_id TEXT;
ALTER TABLE executive_approval_requests ADD COLUMN provisioned_organization_id TEXT;
ALTER TABLE executive_approval_requests ADD COLUMN provisioned_project_id TEXT;
ALTER TABLE executive_approval_requests ADD COLUMN provisioning_status TEXT;
ALTER TABLE executive_approval_requests ADD COLUMN provisioning_error TEXT;

CREATE TABLE IF NOT EXISTS enterprise_projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner_id TEXT,
  start_date TEXT,
  end_date TEXT,
  budget_value REAL,
  currency TEXT DEFAULT 'USD',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_projects_org ON enterprise_projects(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS organization_workspaces (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_workspace_project ON organization_workspaces(organization_id,project_id);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  accepted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_org_invites_status ON organization_invitations(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS provider_health_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_health_channel ON provider_health_events(channel,created_at);

CREATE TABLE IF NOT EXISTS offline_conflict_resolutions (
  id TEXT PRIMARY KEY,
  sync_item_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  resolution TEXT NOT NULL,
  merged_payload_json TEXT,
  resolved_by TEXT NOT NULL,
  resolved_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_resolution_item ON offline_conflict_resolutions(sync_item_id);
