// Program Beta Sprint 1.5 — the publisher half of the transactional outbox
// (Part 6), the overdue-detection background sweep (Part 11), and the
// escalation sweep (Part 12). All three are driven by the existing 5-minute
// Cron Trigger already declared in wrangler.toml (see application.js's
// scheduled() handler) — no new scheduled-job infrastructure was introduced.
import { enqueueJob } from './cloudflare-queue-platform.js';
import { buildActionEventWriteSet } from './decision-action-write-set.js';
import { findEscalationCandidates, DEFAULT_ESCALATION_RULES } from './decision-escalation-rules.js';

const PUBLISH_BATCH_SIZE = 20;
const MAX_PUBLISH_ATTEMPTS = 8;
const OVERDUE_SWEEP_LIMIT = 200;
// Statuses an Action can never be "overdue" in — matching ACTION_TRANSITIONS'
// real terminal states in international-programme-lifecycle.js (verified
// and cancelled are the only edges with no outgoing transitions).
const TERMINAL_ACTION_STATUSES = new Set(['verified', 'cancelled']);

// Reads pending/previously-failed outbox rows and hands each to the real,
// existing queue transport (enqueueJob → the same idempotent, retryable,
// dead-letter-backed mechanism every other job type in this codebase uses).
// Never marks a row 'published' itself — that only happens once the queue
// consumer (queue-adapters.js's processDecisionEvent) actually dispatches it
// to its consumers successfully.
export async function publishPendingDecisionEvents(env, { limit = PUBLISH_BATCH_SIZE } = {}) {
  const now = new Date().toISOString();
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      `SELECT * FROM domain_event_outbox WHERE status IN ('pending','failed') AND available_at <= ? ORDER BY created_at ASC LIMIT ?`
    ).bind(now, limit).all()).results || [];
  } catch (e) {
    return { ok: false, processed: 0, error: e.message };
  }

  let published = 0, deadLettered = 0, errors = 0;
  for (const row of rows) {
    if (row.attempt_count >= MAX_PUBLISH_ATTEMPTS) {
      await env.DB.prepare(`UPDATE domain_event_outbox SET status='dead_letter', updated_at=? WHERE event_id=?`).bind(now, row.event_id).run().catch(() => {});
      deadLettered++;
      continue;
    }
    try {
      await env.DB.prepare(
        `UPDATE domain_event_outbox SET status='processing', attempt_count=attempt_count+1, last_attempt_at=?, updated_at=? WHERE event_id=?`
      ).bind(now, now, row.event_id).run();
      await enqueueJob(env, {
        jobType: 'decision.event',
        tenantId: row.organization_id,
        projectId: row.project_id,
        actorId: row.actor_id,
        correlationId: row.correlation_id,
        causationId: row.causation_id,
        // Idempotent: re-running the sweep before the queue consumer has
        // flipped this row to 'published' will hit the SAME idempotency_key
        // and enqueueJob() will report a safe duplicate rather than sending
        // the event twice.
        idempotencyKey: `decision_event:${row.event_id}`,
        payload: { outbox_event_id: row.event_id },
      });
      published++;
    } catch (err) {
      await env.DB.prepare(
        `UPDATE domain_event_outbox SET status='failed', last_error=?, updated_at=? WHERE event_id=?`
      ).bind(String(err?.message || 'publish failure').slice(0, 500), now, row.event_id).run().catch(() => {});
      errors++;
    }
  }
  return { ok: true, processed: rows.length, published, dead_lettered: deadLettered, errors };
}

// Part 11 — Overdue detection. Only ever emits decision.action.overdue for
// an Action that is NOT already in a known overdue episode (overdue_since
// IS NULL), so a redelivered/rerun sweep can never produce duplicate
// overdue alerts for the same episode. The episode clears (overdue_since
// reset to NULL) automatically whenever the Action transitions (see the
// /transition route) or has its due_date extended (see the PATCH route) —
// both handled at the point of that real state change, not here.
export async function detectOverdueActions(env, { limit = OVERDUE_SWEEP_LIMIT } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      `SELECT * FROM management_response_actions
       WHERE due_date < ? AND overdue_since IS NULL AND status NOT IN ('verified','cancelled')
       ORDER BY due_date ASC LIMIT ?`
    ).bind(today, limit).all()).results || [];
  } catch (e) {
    return { ok: false, detected: 0, error: e.message };
  }

  let detected = 0;
  for (const row of rows) {
    if (TERMINAL_ACTION_STATUSES.has(row.status)) continue; // defensive — the query already excludes these
    const now = new Date().toISOString();
    const markStmt = env.DB.prepare('UPDATE management_response_actions SET overdue_since=? WHERE id=? AND organization_id=?').bind(now, row.id, row.organization_id);
    const { statements } = buildActionEventWriteSet(env, {
      actionId: row.id, orgId: row.organization_id, projectId: row.project_id, reportId: row.report_id,
      historyType: 'status', eventType: 'decision.action.overdue', fromValue: row.status, toValue: row.status,
      reason: `Past due date ${row.due_date}`, actor: null, request: null, source: 'system',
      payload: { owner: row.owner, due_date: row.due_date },
    });
    try {
      await env.DB.batch([markStmt, ...statements]);
      detected++;
    } catch (_) { /* one Action's failure must never block the sweep for the rest */ }
  }
  return { ok: true, detected, scanned: rows.length };
}

// Part 12 — Escalation sweep. Scans Actions whose status matches one of
// DEFAULT_ESCALATION_RULES' appliesToStatus values, hands the real rows to
// the pure findEscalationCandidates() evaluator, and emits
// decision.action.escalated exactly once per episode (escalated_since IS
// NULL) for whichever candidates it returns. The episode clears the same
// way overdue episodes do: on the Action's next real transition (see the
// /transition route's updates.escalated_since reset).
const ESCALATION_SWEEP_LIMIT = 200;

export async function detectEscalationCandidates(env, { limit = ESCALATION_SWEEP_LIMIT } = {}) {
  const statuses = [...new Set(DEFAULT_ESCALATION_RULES.map(r => r.appliesToStatus))];
  const placeholders = statuses.map(() => '?').join(',');
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      `SELECT * FROM management_response_actions WHERE status IN (${placeholders}) AND escalated_since IS NULL ORDER BY updated_at ASC LIMIT ?`
    ).bind(...statuses, limit).all()).results || [];
  } catch (e) {
    return { ok: false, escalated: 0, error: e.message };
  }

  const candidates = findEscalationCandidates(rows, { now: new Date() });
  let escalated = 0;
  for (const { row, rule, elapsedDays } of candidates) {
    const now = new Date().toISOString();
    const markStmt = env.DB.prepare('UPDATE management_response_actions SET escalated_since=? WHERE id=? AND organization_id=?').bind(now, row.id, row.organization_id);
    const { statements } = buildActionEventWriteSet(env, {
      actionId: row.id, orgId: row.organization_id, projectId: row.project_id, reportId: row.report_id,
      historyType: 'status', eventType: 'decision.action.escalated', fromValue: row.status, toValue: row.status,
      reason: `${rule.description} (held ${elapsedDays} days, threshold ${rule.thresholdDays})`, actor: null, request: null, source: 'system',
      payload: { owner: row.owner, rule_id: rule.id, elapsed_days: elapsedDays },
    });
    try {
      await env.DB.batch([markStmt, ...statements]);
      escalated++;
    } catch (_) { /* one Action's failure must never block the sweep for the rest */ }
  }
  return { ok: true, escalated, scanned: rows.length };
}
