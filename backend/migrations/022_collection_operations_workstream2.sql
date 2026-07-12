-- Collection, Enumerator, Offline & Omni-Channel Operations
CREATE TABLE IF NOT EXISTS channel_delivery_events (
 id TEXT PRIMARY KEY, organization_id TEXT, campaign_id TEXT, survey_id TEXT,
 channel TEXT NOT NULL, provider_sid TEXT, recipient_masked TEXT, provider_status TEXT,
 normalized_status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 max_attempts INTEGER NOT NULL DEFAULT 5, next_attempt_at TEXT, error_code TEXT,
 error_message TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_delivery_lookup ON channel_delivery_events(organization_id,campaign_id,channel,normalized_status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_delivery_provider_sid ON channel_delivery_events(channel,provider_sid) WHERE provider_sid IS NOT NULL;

CREATE TABLE IF NOT EXISTS channel_dead_letters (
 id TEXT PRIMARY KEY, delivery_event_id TEXT NOT NULL, organization_id TEXT, channel TEXT NOT NULL,
 reason TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', resolution_status TEXT NOT NULL DEFAULT 'open',
 resolved_by TEXT, resolved_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_dead_letters_status ON channel_dead_letters(organization_id,resolution_status,created_at);

CREATE TABLE IF NOT EXISTS enumerator_assignments_v2 (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, survey_id TEXT NOT NULL,
 campaign_id TEXT, enumerator_id TEXT NOT NULL, supervisor_id TEXT, assignment_type TEXT NOT NULL DEFAULT 'standard',
 region TEXT, language TEXT, status TEXT NOT NULL DEFAULT 'assigned', offline_package_version INTEGER NOT NULL DEFAULT 1,
 due_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enum_assignments_user ON enumerator_assignments_v2(organization_id,enumerator_id,status,due_at);

CREATE TABLE IF NOT EXISTS offline_sync_items_v2 (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assignment_id TEXT, device_id TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, client_version INTEGER NOT NULL DEFAULT 1,
 server_version INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL, checksum TEXT,
 sync_status TEXT NOT NULL DEFAULT 'pending', conflict_reason TEXT, server_payload_json TEXT,
 synced_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_sync_idempotency ON offline_sync_items_v2(organization_id,device_id,entity_type,entity_id,client_version);
CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_items_v2(organization_id,sync_status,updated_at);

CREATE TABLE IF NOT EXISTS double_entry_assignments (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, survey_id TEXT NOT NULL,
 source_response_id TEXT NOT NULL, first_enumerator_id TEXT, second_enumerator_id TEXT,
 verification_mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'assigned', due_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_double_entry_source ON double_entry_assignments(organization_id,source_response_id);

CREATE TABLE IF NOT EXISTS double_entry_submissions (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, entry_number INTEGER NOT NULL,
 enumerator_id TEXT NOT NULL, answers_json TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
 submitted_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_double_entry_number ON double_entry_submissions(assignment_id,entry_number);

CREATE TABLE IF NOT EXISTS double_entry_comparisons (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, match_score INTEGER NOT NULL,
 conflict_score INTEGER NOT NULL, status TEXT NOT NULL, conflicts_json TEXT NOT NULL DEFAULT '[]',
 compared_at TEXT NOT NULL, reviewed_by TEXT, review_decision TEXT, review_notes TEXT, reviewed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_double_entry_comparison_assignment ON double_entry_comparisons(assignment_id);

CREATE TABLE IF NOT EXISTS field_quality_assessments (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, survey_id TEXT,
 response_id TEXT NOT NULL, enumerator_id TEXT, fraud_risk_score INTEGER NOT NULL,
 quality_score INTEGER NOT NULL, verification_mode TEXT NOT NULL, flags_json TEXT NOT NULL DEFAULT '[]',
 review_status TEXT NOT NULL DEFAULT 'pending', supervisor_id TEXT, me_reviewer_id TEXT,
 resolution TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_field_quality_review ON field_quality_assessments(organization_id,review_status,fraud_risk_score,created_at);
