// Program Beta Sprint 1.5 — the registered consumers for canonical Action
// domain events (Part 7's "registry pattern... dispatch to registered
// handlers", matching the same shape already used by BUILTIN_ADAPTERS in
// queue-adapters.js, not a second, differently-shaped registry).
import { newId } from './auth.js';
import { validateActionDomainEvent } from './decision-event-envelope.js';

// Notification-worthy event types only — Consumer 1 must never broadcast to
// unrelated users, and must never fire for purely informational events like
// decision.action.updated or decision.action.progress_updated.
const NOTIFIABLE_EVENT_TYPES = new Set([
  'decision.action.assigned',
  'decision.action.needs_clarification',
  'decision.action.approved',
  'decision.action.rejected',
  'decision.action.overdue',
  'decision.action.escalated',
  'decision.action.completed',
  'decision.action.verified',
]);

const NOTIFICATION_COPY = {
  'decision.action.assigned': (e) => ({ icon: '📌', title: 'Action assigned to you', message: e.payload?.recommendation || 'A new Action has been assigned to you.' }),
  'decision.action.needs_clarification': (e) => ({ icon: '❓', title: 'Action needs clarification', message: 'A reviewer requested clarification on your Action.' }),
  'decision.action.approved': (e) => ({ icon: '✅', title: 'Action approved', message: 'Your Action has been approved and is ready to assign.' }),
  'decision.action.rejected': (e) => ({ icon: '⛔', title: 'Action rejected', message: e.metadata?.reason || 'Your Action was rejected. See the reason on the Action.' }),
  'decision.action.overdue': (e) => ({ icon: '⏰', title: 'Action overdue', message: 'This Action has passed its due date and is still open.' }),
  'decision.action.escalated': (e) => ({ icon: '🚨', title: 'Action escalated', message: e.metadata?.reason || 'This Action has been escalated.' }),
  'decision.action.completed': (e) => ({ icon: '🏁', title: 'Action completed, awaiting verification', message: 'Work on this Action is marked complete and needs review.' }),
  'decision.action.verified': (e) => ({ icon: '🎖️', title: 'Action verified', message: 'Your completed Action has been verified.' }),
};

// Consumer 1: Action Notification Consumer — reuses the existing, real
// production_notifications table (already used for founder/ops-manager
// notifications elsewhere in application.js) rather than a new table.
async function notificationConsumer(event, env) {
  if (!NOTIFIABLE_EVENT_TYPES.has(event.event_type)) return { ok: true, skipped: true, reason: 'not a notifiable event type' };
  const copy = NOTIFICATION_COPY[event.event_type]?.(event);
  if (!copy) return { ok: true, skipped: true, reason: 'no copy template for event type' };
  // Recipient is the Action's real owner field. Sprint 1's schema stores
  // `owner` as free text (no foreign key to `users` was introduced — see
  // migration 028) — this holds correctly whenever the owner was set to a
  // real user id (the common real path, since owners are invited users),
  // but is not database-enforced. Documented as a known limitation, not
  // silently assumed to always be a valid id.
  const recipientId = event.metadata?.owner || null;
  await env.DB.prepare(
    `INSERT INTO production_notifications (id,organization_id,user_id,audience_role,title,message,channel,status,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(newId('notification'), event.organization_id, recipientId, 'action_assignee', copy.title, copy.message, 'in_app', 'unread', event.occurred_at).run();
  return { ok: true, recipient_id: recipientId };
}

// Consumer 2: Action Metrics Consumer — a genuinely incremental rollup for
// simple counts only (see migration 043's comment on decision_action_metrics_daily
// for why duration-based metrics are deliberately computed at query time
// instead, from the real action_history timestamps).
async function metricsConsumer(event, env) {
  const metricDate = String(event.occurred_at || event.recorded_at).slice(0, 10); // UTC date bucket
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO decision_action_metrics_daily (organization_id, metric_date, event_type, count, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(organization_id, metric_date, event_type) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`
  ).bind(event.organization_id, metricDate, event.event_type, now).run();
  return { ok: true, metric_date: metricDate };
}

// Consumer 3: Action Timeline Projection — intentionally NOT a second copy
// of action_history. That table is already written, atomically, in the same
// env.DB.batch() as the Action mutation and the outbox event itself (see
// application.js). This consumer exists only so the timeline concept is a
// real, registered, observable part of the event flow (idempotency-tracked
// like every other consumer) without duplicating facts already durable.
async function timelineConsumer(event, env) {
  return { ok: true, note: 'action_history already recorded this fact transactionally at write time — no duplicate row created' };
}

export const CONSUMER_REGISTRY = Object.freeze({
  notification: notificationConsumer,
  metrics: metricsConsumer,
  timeline: timelineConsumer,
});

// Dispatches one validated event to every registered consumer, enforcing
// per-consumer idempotency (Part 8) so a redelivered queue message can never
// create a duplicate notification, metric increment, or timeline entry.
// Continues to the next consumer if one fails (Part 7) rather than letting
// one bad consumer block the others.
//
// `registry` defaults to this module's own CONSUMER_REGISTRY (notification/
// metrics/timeline) so every existing caller is unaffected. Program Beta
// Sprint 1.6 passes PROJECTION_CONSUMER_REGISTRY (decision-projection-
// consumers.js) through this same parameter instead — one real dispatch
// mechanism (validation, per-consumer idempotency, error isolation),
// exercised against two different consumer sets, rather than a second,
// duplicate dispatch loop.
export async function dispatchDecisionEvent(event, env, registry = CONSUMER_REGISTRY) {
  const envelopeCheck = validateActionDomainEvent(event);
  if (!envelopeCheck.ok) {
    return { ok: false, rejected: true, errors: envelopeCheck.errors };
  }
  const outcomes = {};
  for (const [consumerName, handler] of Object.entries(registry)) {
    const already = await env.DB.prepare(
      'SELECT result FROM decision_event_processed WHERE event_id=? AND consumer_name=?'
    ).bind(event.event_id, consumerName).first();
    if (already) { outcomes[consumerName] = { ok: true, deduplicated: true, previous_result: already.result }; continue; }
    const now = new Date().toISOString();
    try {
      const result = await handler(event, env);
      await env.DB.prepare(
        `INSERT INTO decision_event_processed (event_id, consumer_name, organization_id, processed_at, result, attempt_count, last_error)
         VALUES (?,?,?,?,?,1,NULL)
         ON CONFLICT(event_id, consumer_name) DO NOTHING`
      ).bind(event.event_id, consumerName, event.organization_id, now, 'success').run();
      outcomes[consumerName] = { ok: true, ...result };
    } catch (err) {
      await env.DB.prepare(
        `INSERT INTO decision_event_processed (event_id, consumer_name, organization_id, processed_at, result, attempt_count, last_error)
         VALUES (?,?,?,?,?,1,?)
         ON CONFLICT(event_id, consumer_name) DO UPDATE SET attempt_count = attempt_count + 1, last_error = excluded.last_error, processed_at = excluded.processed_at`
      ).bind(event.event_id, consumerName, event.organization_id, now, 'failed', String(err?.message || 'consumer failure').slice(0, 500)).run().catch(() => {});
      outcomes[consumerName] = { ok: false, error: String(err?.message || 'consumer failure') };
    }
  }
  return { ok: Object.values(outcomes).every(o => o.ok), outcomes };
}
