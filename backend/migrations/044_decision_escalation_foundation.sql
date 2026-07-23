-- 044_decision_escalation_foundation.sql
-- Program Beta Sprint 1.5, Part 12: Reminders and Escalations Foundation.
-- Additive only — no existing table/column dropped or renamed.
--
-- Scope note: this migration adds the minimum real column needed for a
-- single, working escalation rule (an Action stalled in one status beyond a
-- threshold) to be detected exactly once per episode and cleared on its next
-- real transition — mirroring the existing overdue_since pattern (migration
-- 043) exactly, rather than inventing a second episode-tracking mechanism.
-- A full configurable-per-organization rule engine is explicitly NOT built
-- here (see decision-escalation-rules.js's own comment for why) — this is
-- the foundation the brief asks for, not the full feature.
ALTER TABLE management_response_actions ADD COLUMN escalated_since TEXT;

-- The escalation sweep scans by (status, updated_at) across all
-- organizations, same cross-tenant range-scan shape as idx_mra_due_date in
-- migration 043 and for the same reason: organization-first indexes can't
-- serve this query efficiently.
CREATE INDEX IF NOT EXISTS idx_mra_status_updated ON management_response_actions(status, updated_at);
