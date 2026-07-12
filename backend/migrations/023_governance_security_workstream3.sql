CREATE TABLE IF NOT EXISTS enterprise_client_workflows (
 id TEXT PRIMARY KEY, organization_id TEXT, client_name TEXT NOT NULL, project_name TEXT,
 stage TEXT NOT NULL DEFAULT 'demo_received', owner_id TEXT, proposal_reference TEXT,
 contract_reference TEXT, invoice_reference TEXT, approval_id TEXT, project_id TEXT,
 workspace_id TEXT, campaign_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_workflows_stage ON enterprise_client_workflows(stage,updated_at);

CREATE TABLE IF NOT EXISTS enterprise_workflow_events (
 id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, organization_id TEXT, actor_id TEXT,
 actor_role TEXT, from_stage TEXT, to_stage TEXT NOT NULL, result TEXT NOT NULL,
 metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_workflow_events ON enterprise_workflow_events(workflow_id,created_at);

CREATE TABLE IF NOT EXISTS iam_auth_journey_evidence (
 id TEXT PRIMARY KEY, organization_id TEXT, environment TEXT NOT NULL DEFAULT 'production',
 journey_name TEXT NOT NULL, status TEXT NOT NULL, evidence_reference TEXT,
 executed_by TEXT, executed_at TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS iam_sso_transactions (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT NOT NULL,
 state_hash TEXT NOT NULL, nonce_hash TEXT NOT NULL, pkce_verifier_envelope TEXT,
 redirect_after TEXT, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sso_transactions_expiry ON iam_sso_transactions(organization_id,expires_at,consumed_at);

CREATE TABLE IF NOT EXISTS scim_provisioning_events (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT,
 external_id TEXT, operation TEXT NOT NULL, resource_type TEXT NOT NULL,
 resource_id TEXT, status TEXT NOT NULL, error_message TEXT,
 correlation_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scim_events_org ON scim_provisioning_events(organization_id,created_at);

CREATE TABLE IF NOT EXISTS procurement_evidence_runs (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, completion_pct INTEGER NOT NULL,
 evidence_json TEXT NOT NULL, generated_by TEXT, generated_at TEXT NOT NULL
);
