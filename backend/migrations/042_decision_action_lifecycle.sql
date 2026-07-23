-- 042_decision_action_lifecycle.sql
-- Program Beta Sprint 1: evolves the existing management_response_actions
-- table (migration 028) into a governed Action per the approved Enterprise
-- Product Blueprint. Every new column is nullable or carries a safe default
-- so existing rows and the existing /api/programme-lifecycle/management-response
-- route continue to work unchanged. No table is dropped or renamed.

ALTER TABLE management_response_actions ADD COLUMN department TEXT;
ALTER TABLE management_response_actions ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE management_response_actions ADD COLUMN strategic_priority TEXT;
ALTER TABLE management_response_actions ADD COLUMN risk_level TEXT;
ALTER TABLE management_response_actions ADD COLUMN start_date TEXT;
ALTER TABLE management_response_actions ADD COLUMN completion_date TEXT;
ALTER TABLE management_response_actions ADD COLUMN dependencies_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE management_response_actions ADD COLUMN budget_estimated REAL;
ALTER TABLE management_response_actions ADD COLUMN budget_actual REAL;
ALTER TABLE management_response_actions ADD COLUMN expected_outcome TEXT;
ALTER TABLE management_response_actions ADD COLUMN success_criteria TEXT;
ALTER TABLE management_response_actions ADD COLUMN progress_pct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE management_response_actions ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE management_response_actions ADD COLUMN evidence_after_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE management_response_actions ADD COLUMN monitoring_indicator TEXT;
ALTER TABLE management_response_actions ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE management_response_actions ADD COLUMN attachments_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE management_response_actions ADD COLUMN updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_mra_org_owner ON management_response_actions(organization_id, owner);
CREATE INDEX IF NOT EXISTS idx_mra_org_department ON management_response_actions(organization_id, department);
CREATE INDEX IF NOT EXISTS idx_mra_org_priority ON management_response_actions(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_mra_org_project ON management_response_actions(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_mra_org_due_date ON management_response_actions(organization_id, due_date);

-- Dedicated, structured history for one Action's full lifecycle (Blueprint
-- Program Beta Part 6: Status/Assignment/Review/Evidence/Verification
-- history). Kept separate from the generic security_audit_events_v2 table
-- (which every transition ALSO writes to, for the platform-wide security
-- audit view) because a per-Action history needs to be queried and rendered
-- as one ordered timeline, filterable by history_type, not mixed in with
-- login/invite/rotation events.
CREATE TABLE IF NOT EXISTS action_history (
  id                TEXT PRIMARY KEY,
  action_id         TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  history_type      TEXT NOT NULL, -- status | assignment | review | evidence | verification
  from_value        TEXT,
  to_value          TEXT,
  reason            TEXT,
  actor_id          TEXT,
  actor_role        TEXT,
  source            TEXT NOT NULL DEFAULT 'api',
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_action_history_action ON action_history(action_id, created_at);
CREATE INDEX IF NOT EXISTS idx_action_history_org_type ON action_history(organization_id, history_type, created_at);
