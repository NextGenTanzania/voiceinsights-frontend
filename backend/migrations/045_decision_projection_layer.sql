-- 045_decision_projection_layer.sql
-- Program Beta Sprint 1.6: Enterprise Projection Layer. Additive only — no
-- existing table dropped, renamed, or altered destructively.
--
-- Part 1G reconciliation decision (documented here, not silently decided):
-- decision_action_metrics_daily (migration 043) is KEPT AS-IS and is NOT
-- extended or replaced. It counts EVENTS per day (a fact that only ever
-- grows) and GET /api/decisions/metrics already reads it correctly. Every
-- table below instead holds CURRENT-STATE aggregates (e.g. "how many
-- Actions are right now overdue") — a fundamentally different fact from
-- "how many decision.action.overdue events happened on day X". Reusing
-- decision_action_metrics_daily for current-state aggregates would require
-- turning day-bucketed event counts into a running current total via
-- increment/decrement, which reintroduces exactly the double-decrement and
-- negative-counter risk this sprint's own Part 5/9 warn about. Keeping the
-- two concerns in separate tables is the reconciliation; no data is
-- duplicated because no other table in this repo currently stores a
-- current-state aggregate at all (confirmed by audit — see Part 0 of the
-- Sprint 1.6 report).
--
-- Every current-state aggregate below (organization/project portfolio,
-- owner workload, review queue) is populated by a bounded, single-tenant
-- re-aggregation query (COUNT/GROUP BY WHERE organization_id=? or
-- project_id=? or owner=?) triggered by a relevant event — never by blind
-- per-event increment/decrement. This is a deliberate structural choice:
-- recomputing the same aggregate twice always yields the same, correct
-- result regardless of event order or duplicate delivery, which is a much
-- stronger safety property than any amount of careful +1/-1 bookkeeping.

-- ============================================================
-- A. Action Summary Projection — one current row per Action.
-- ============================================================
CREATE TABLE IF NOT EXISTS action_summary_projection (
  action_id             TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  project_id            TEXT,
  report_id             TEXT,
  recommendation        TEXT,
  owner                 TEXT,
  owner_display_name    TEXT,
  department            TEXT,
  status                TEXT NOT NULL,
  priority               TEXT,
  strategic_priority    TEXT,
  risk_level            TEXT,
  progress_pct          INTEGER,
  due_date              TEXT,
  start_date            TEXT,
  completion_date       TEXT,
  verification_status   TEXT,
  overdue_since         TEXT,
  escalated_since       TEXT,
  expected_outcome      TEXT,
  success_criteria      TEXT,
  monitoring_indicator  TEXT,
  is_legacy             INTEGER NOT NULL DEFAULT 0,
  legacy_original_status TEXT,
  created_at            TEXT,
  last_event_id         TEXT,
  last_event_type       TEXT,
  last_event_at         TEXT,
  last_activity_at      TEXT,
  projection_version    INTEGER NOT NULL DEFAULT 1,
  projected_at          TEXT NOT NULL,
  source_updated_at     TEXT
);
-- Decision Workspace query shapes (Part 12): my actions, by status/owner,
-- overdue/escalated/due-soon, by project/department, sorted by activity.
CREATE INDEX IF NOT EXISTS idx_asp_org_status_due ON action_summary_projection(organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_asp_org_owner ON action_summary_projection(organization_id, owner);
CREATE INDEX IF NOT EXISTS idx_asp_org_project ON action_summary_projection(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_asp_org_department ON action_summary_projection(organization_id, department);
CREATE INDEX IF NOT EXISTS idx_asp_org_priority ON action_summary_projection(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_asp_org_risk ON action_summary_projection(organization_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_asp_org_overdue ON action_summary_projection(organization_id, overdue_since);
CREATE INDEX IF NOT EXISTS idx_asp_org_escalated ON action_summary_projection(organization_id, escalated_since);
CREATE INDEX IF NOT EXISTS idx_asp_org_activity ON action_summary_projection(organization_id, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_asp_org_created ON action_summary_projection(organization_id, created_at);

-- ============================================================
-- B/C. Organization and Project Decision Portfolio Projections —
-- one CURRENT aggregate row per organization / per project.
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_decision_portfolio (
  organization_id           TEXT PRIMARY KEY,
  total_actions             INTEGER NOT NULL DEFAULT 0,
  backlog_by_status_json    TEXT NOT NULL DEFAULT '{}',
  high_risk_count           INTEGER NOT NULL DEFAULT 0,
  critical_priority_count   INTEGER NOT NULL DEFAULT 0,
  overdue_count             INTEGER NOT NULL DEFAULT 0,
  escalated_count           INTEGER NOT NULL DEFAULT 0,
  awaiting_review_count     INTEGER NOT NULL DEFAULT 0,
  awaiting_verification_count INTEGER NOT NULL DEFAULT 0,
  completed_count           INTEGER NOT NULL DEFAULT 0,
  verified_count            INTEGER NOT NULL DEFAULT 0,
  cancelled_count           INTEGER NOT NULL DEFAULT 0,
  aging_band_json           TEXT NOT NULL DEFAULT '{}',
  last_event_id             TEXT,
  last_event_at             TEXT,
  projection_version        INTEGER NOT NULL DEFAULT 1,
  projected_at               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_decision_portfolio (
  project_id                TEXT PRIMARY KEY,
  organization_id           TEXT NOT NULL,
  total_actions             INTEGER NOT NULL DEFAULT 0,
  backlog_by_status_json    TEXT NOT NULL DEFAULT '{}',
  high_risk_count           INTEGER NOT NULL DEFAULT 0,
  critical_priority_count   INTEGER NOT NULL DEFAULT 0,
  overdue_count             INTEGER NOT NULL DEFAULT 0,
  escalated_count           INTEGER NOT NULL DEFAULT 0,
  awaiting_review_count     INTEGER NOT NULL DEFAULT 0,
  awaiting_verification_count INTEGER NOT NULL DEFAULT 0,
  completed_count           INTEGER NOT NULL DEFAULT 0,
  verified_count            INTEGER NOT NULL DEFAULT 0,
  cancelled_count           INTEGER NOT NULL DEFAULT 0,
  aging_band_json           TEXT NOT NULL DEFAULT '{}',
  last_event_id             TEXT,
  last_event_at             TEXT,
  projection_version        INTEGER NOT NULL DEFAULT 1,
  projected_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pdp_org ON project_decision_portfolio(organization_id);

-- Daily snapshot of the organization aggregate, so Executive Decision
-- Intelligence can honestly compare "now" against a real prior measured
-- point (Part 1F) without a second live-computation engine. This is NOT a
-- duplicate of decision_action_metrics_daily: that table counts events on
-- day X; this table stores what the CURRENT aggregate looked like on day X
-- — a snapshot of state, not a count of occurrences.
CREATE TABLE IF NOT EXISTS organization_decision_portfolio_snapshot (
  organization_id           TEXT NOT NULL,
  snapshot_date             TEXT NOT NULL,
  total_actions             INTEGER NOT NULL DEFAULT 0,
  overdue_count             INTEGER NOT NULL DEFAULT 0,
  escalated_count           INTEGER NOT NULL DEFAULT 0,
  completed_count           INTEGER NOT NULL DEFAULT 0,
  verified_count            INTEGER NOT NULL DEFAULT 0,
  verification_rate         REAL,
  completion_rate           REAL,
  created_at                TEXT NOT NULL,
  PRIMARY KEY (organization_id, snapshot_date)
);

-- ============================================================
-- D. Owner Workload Projection — one row per (organization, owner).
-- Grain is organization+owner, not organization+owner+project: an owner's
-- workload naturally spans projects within one organization, and a
-- project-filtered view is served by filtering action_summary_projection
-- directly rather than maintaining a third, redundant grain.
-- ============================================================
CREATE TABLE IF NOT EXISTS owner_workload_projection (
  organization_id           TEXT NOT NULL,
  owner                     TEXT NOT NULL,
  owner_display_name        TEXT,
  assigned_count            INTEGER NOT NULL DEFAULT 0,
  in_progress_count         INTEGER NOT NULL DEFAULT 0,
  overdue_count             INTEGER NOT NULL DEFAULT 0,
  due_soon_count            INTEGER NOT NULL DEFAULT 0,
  awaiting_verification_count INTEGER NOT NULL DEFAULT 0,
  avg_age_days              REAL,
  priority_breakdown_json   TEXT NOT NULL DEFAULT '{}',
  risk_breakdown_json       TEXT NOT NULL DEFAULT '{}',
  last_event_at             TEXT,
  projection_version        INTEGER NOT NULL DEFAULT 1,
  projected_at               TEXT NOT NULL,
  PRIMARY KEY (organization_id, owner)
);

-- ============================================================
-- E. Review Queue Projection — NOT a per-reviewer-person workload table.
-- Audit finding (Part 0): neither management_response_actions nor
-- action_history stores a durable "assigned reviewer" relationship — only
-- who last ACTED on a transition (actor_id/actor_role on action_history).
-- An Action sitting in under_review has no reviewer assigned to it in the
-- data model at all. Per Part 2's explicit rule ("do not invent a reviewer
-- relationship where none exists"), this projection is scoped to the real,
-- available grain: an organization/project-level review QUEUE (depth and
-- aging), not a fabricated per-person assignment.
-- ============================================================
CREATE TABLE IF NOT EXISTS review_queue_projection (
  organization_id           TEXT NOT NULL,
  project_id                TEXT NOT NULL DEFAULT '__all__',
  under_review_count        INTEGER NOT NULL DEFAULT 0,
  needs_clarification_count INTEGER NOT NULL DEFAULT 0,
  awaiting_verification_count INTEGER NOT NULL DEFAULT 0,
  oldest_pending_review_at  TEXT,
  oldest_pending_verification_at TEXT,
  last_event_at             TEXT,
  projection_version        INTEGER NOT NULL DEFAULT 1,
  projected_at               TEXT NOT NULL,
  PRIMARY KEY (organization_id, project_id)
);

-- ============================================================
-- F/G. Reconciliation findings (Part 9) — bounded, queryable, never
-- silently auto-corrected for high-risk drift.
-- ============================================================
CREATE TABLE IF NOT EXISTS projection_reconciliation_findings (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  projection_type   TEXT NOT NULL,
  finding_type      TEXT NOT NULL,
  subject_id        TEXT,
  detail_json       TEXT NOT NULL DEFAULT '{}',
  detected_at       TEXT NOT NULL,
  resolved_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_prf_org_type ON projection_reconciliation_findings(organization_id, projection_type, detected_at);
CREATE INDEX IF NOT EXISTS idx_prf_unresolved ON projection_reconciliation_findings(resolved_at, detected_at);

-- Persisted cursor for bounded, resumable cron sweeps (reconciliation and
-- any future cursor-paginated sweep). Without this, a 5-minute tick that
-- only processes one bounded page would restart from the same first page
-- every time and never reach organizations beyond it — this table is what
-- makes "bounded AND complete over time" both true at once.
CREATE TABLE IF NOT EXISTS projection_sweep_state (
  sweep_name    TEXT PRIMARY KEY,
  cursor_value  TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL
);
