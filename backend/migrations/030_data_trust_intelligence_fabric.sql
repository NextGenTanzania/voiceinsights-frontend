-- VoiceInsights Data Trust & Intelligence Fabric™
CREATE TABLE IF NOT EXISTS data_catalog_assets (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
  asset_type TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  owner_user_id TEXT NOT NULL, steward_user_id TEXT, classification TEXT NOT NULL DEFAULT 'internal',
  source_system TEXT, schema_json TEXT, metadata_json TEXT, retention_rule TEXT,
  freshness_sla_hours INTEGER, quality_status TEXT NOT NULL DEFAULT 'NOT_MEASURED',
  status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_data_catalog_org ON data_catalog_assets(organization_id, asset_type);

CREATE TABLE IF NOT EXISTS data_lineage_edges (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
  from_asset_id TEXT NOT NULL, to_asset_id TEXT NOT NULL, relationship_type TEXT NOT NULL,
  transformation_json TEXT, evidence_json TEXT, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lineage_from ON data_lineage_edges(organization_id, from_asset_id);
CREATE INDEX IF NOT EXISTS idx_lineage_to ON data_lineage_edges(organization_id, to_asset_id);

CREATE TABLE IF NOT EXISTS data_quality_runs (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, asset_id TEXT,
  status TEXT NOT NULL, score REAL, checks_json TEXT NOT NULL, failed_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0, observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quality_asset ON data_quality_runs(organization_id, asset_id, observed_at);

CREATE TABLE IF NOT EXISTS privacy_disclosure_reviews (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, asset_id TEXT,
  intended_release TEXT NOT NULL, risk_level TEXT NOT NULL, decision TEXT NOT NULL,
  reasons_json TEXT, controls_json TEXT, reviewed_by TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_model_registry (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, model_name TEXT NOT NULL, model_version TEXT NOT NULL,
  task_type TEXT NOT NULL, provider TEXT, prompt_version TEXT, evaluation_dataset_id TEXT,
  assurance_status TEXT NOT NULL, assurance_score REAL, assurance_json TEXT,
  rollback_version TEXT, active INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_version ON ai_model_registry(organization_id, model_name, model_version);

CREATE TABLE IF NOT EXISTS interoperability_contracts (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, standard TEXT NOT NULL,
  contract_version TEXT NOT NULL, direction TEXT NOT NULL DEFAULT 'bidirectional', fields_json TEXT NOT NULL,
  validation_json TEXT, owner_user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decision_signals (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, signal_type TEXT NOT NULL,
  severity TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'open', assigned_to TEXT, acknowledged_at TEXT, closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signals_org ON decision_signals(organization_id, status, severity);
