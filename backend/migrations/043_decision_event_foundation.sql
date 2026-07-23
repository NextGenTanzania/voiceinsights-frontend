-- 043_decision_event_foundation.sql
-- Program Beta Sprint 1.5: event-driven foundation for the governed Action
-- lifecycle (migration 042). Every addition below is additive — no existing
-- table is dropped, renamed, or has a column removed.
--
-- Reuse note (Part 0/4 of the brief): this deliberately does NOT duplicate
-- the existing queue_jobs/enqueueJob() mechanism (cloudflare-queue-platform.js).
-- That mechanism is a real, working queue-transport registry (idempotency by
-- idempotency_key, status tracking, retry via Cloudflare Queues) but it does
-- NOT close one specific real gap: the D1 write that records "this business
-- fact happened" and the call that hands the message to the queue transport
-- are two separate operations in enqueueJob() today (INSERT INTO queue_jobs,
-- then a separate await queue.send()) — if a Worker is interrupted between
-- them, the fact is durably recorded but nothing will ever pick it up again.
-- domain_event_outbox closes that gap for Action lifecycle events
-- specifically: the outbox row is written in the SAME atomic env.DB.batch()
-- as the Action mutation itself (see application.js), and a separate,
-- idempotent publisher (cron-driven) is the only thing that ever hands an
-- outbox row to the existing, real queue_jobs/enqueueJob() transport. Two
-- tables, two different jobs, not two copies of the same job.

CREATE TABLE IF NOT EXISTS domain_event_outbox (
  event_id          TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL,
  event_version     INTEGER NOT NULL DEFAULT 1,
  aggregate_type    TEXT NOT NULL,
  aggregate_id      TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  project_id        TEXT,
  report_id         TEXT,
  actor_id          TEXT,
  actor_role        TEXT,
  correlation_id    TEXT NOT NULL,
  causation_id      TEXT,
  source            TEXT NOT NULL DEFAULT 'application',
  payload_json      TEXT NOT NULL DEFAULT '{}',
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | processing | published | failed | dead_letter
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  available_at      TEXT NOT NULL,
  published_at      TEXT,
  last_attempt_at   TEXT,
  last_error        TEXT,
  occurred_at       TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
-- The publisher's own poll query: unpublished events ready to (re)try, oldest first.
CREATE INDEX IF NOT EXISTS idx_outbox_status_available ON domain_event_outbox(status, available_at);
-- Per-tenant and per-Action lookup (Decision Workspace timeline, observability).
CREATE INDEX IF NOT EXISTS idx_outbox_org_aggregate ON domain_event_outbox(organization_id, aggregate_id, occurred_at);

-- Part 8: consumer idempotency. A queue redelivery of the same event must
-- never cause a consumer to create a second notification, metric increment,
-- or timeline entry. Composite key (event_id, consumer_name) — the same
-- event is processed independently, and idempotently, by each consumer.
CREATE TABLE IF NOT EXISTS decision_event_processed (
  event_id          TEXT NOT NULL,
  consumer_name     TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  processed_at      TEXT NOT NULL,
  result            TEXT NOT NULL DEFAULT 'success', -- success | failed
  attempt_count     INTEGER NOT NULL DEFAULT 1,
  last_error        TEXT,
  PRIMARY KEY (event_id, consumer_name)
);
CREATE INDEX IF NOT EXISTS idx_decision_event_processed_org ON decision_event_processed(organization_id, processed_at);

-- Part 11: overdue detection needs to know whether an Action is ALREADY in
-- a known overdue episode (to emit decision.action.overdue exactly once per
-- episode) and to be able to clear that state honestly if the Action is
-- reopened or its due_date is extended. A single nullable timestamp on the
-- existing row is sufficient — no separate episode-tracking table needed.
ALTER TABLE management_response_actions ADD COLUMN overdue_since TEXT;
-- The scheduled overdue sweep scans by due_date ACROSS all organizations
-- (system-wide, cron-driven — each individual write it produces is still
-- correctly tenant-scoped, since it always carries that row's own real
-- organization_id). idx_mra_org_due_date (migration 042) is led by
-- organization_id and cannot serve that cross-tenant range scan; this index
-- is what keeps it a bounded index range-scan instead of a full table scan.
CREATE INDEX IF NOT EXISTS idx_mra_due_date ON management_response_actions(due_date);

-- Part 9, Consumer 2 (Metrics): a small, genuinely incremental rollup for
-- simple COUNT-style metrics only (Actions created/submitted/approved/...).
-- Duration-based metrics (average time to review, to approve, etc. — Part
-- 10) are deliberately NOT pre-aggregated here: they require pairing
-- specific from/to transition timestamps, which is a real query-time JOIN
-- over the already-real action_history table, not a running counter that
-- could silently drift from the source of truth. Keeping this table to
-- simple counts only avoids a second, harder-to-verify source of truth for
-- the metrics that matter most for decision-making.
CREATE TABLE IF NOT EXISTS decision_action_metrics_daily (
  organization_id   TEXT NOT NULL,
  metric_date       TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  count             INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (organization_id, metric_date, event_type)
);
CREATE INDEX IF NOT EXISTS idx_decision_metrics_org_date ON decision_action_metrics_daily(organization_id, metric_date);
