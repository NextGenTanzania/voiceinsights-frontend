// Program Beta Sprint 1.5 — the atomic write-set builders for one Action
// lifecycle occurrence (history + audit mirror + outbox event). Extracted
// into its own module (rather than kept as a private helper inside
// application.js) so the scheduled overdue-detection sweep can build the
// exact same real, tested write set for a system-triggered event
// (decision.action.overdue) as the HTTP route handlers use for a
// user-triggered one — one real mechanism, not two.
import { newId } from './auth.js';
import { buildAuditEvent } from './data-protection-security-operations.js';
import { buildActionDomainEvent } from './decision-event-envelope.js';

// D1's real, documented atomicity guarantee: env.DB.batch([...]) executes a
// fixed array of prepared statements as a single all-or-nothing unit. It
// does NOT support a statement whose parameters depend on a previous
// statement's runtime result within the same batch (no read-then-branch) —
// which is why callers must finish any read/validation BEFORE building the
// statements below, then batch only the independent writes.
export function buildActionHistoryStatement(env, { actionId, orgId, historyType, fromValue, toValue, reason, actor }) {
  const now = new Date().toISOString();
  return env.DB.prepare(
    'INSERT INTO action_history (id,action_id,organization_id,history_type,from_value,to_value,reason,actor_id,actor_role,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(newId('ahist'), actionId, orgId, historyType, fromValue ?? null, toValue ?? null, reason ?? null, actor?.sub || null, actor?.role || null, actor ? 'api' : 'system', now);
}

export function buildActionAuditStatement(env, { actionId, orgId, historyType, fromValue, toValue, reason, actor, request }) {
  const ev = buildAuditEvent({ organization_id: orgId, actor_id: actor?.sub, actor_role: actor?.role, action: `decision_action.${historyType}`, resource_type: 'action', resource_id: actionId, ip_address: request ? request.headers.get('CF-Connecting-IP') : null, metadata: { from: fromValue, to: toValue, reason } });
  const stmt = env.DB.prepare('INSERT INTO security_audit_events_v2 (id,organization_id,actor_id,actor_role,action,resource_type,resource_id,result,risk_level,correlation_id,ip_address,device,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ev.id, ev.organization_id, ev.actor_id, ev.actor_role, ev.action, ev.resource_type, ev.resource_id, ev.result, ev.risk_level, ev.correlation_id, ev.ip_address, ev.device, JSON.stringify(ev.metadata || {}), ev.created_at);
  return { stmt, correlationId: ev.correlation_id };
}

export function buildOutboxStatement(env, event) {
  const now = new Date().toISOString();
  return env.DB.prepare(
    `INSERT INTO domain_event_outbox
      (event_id,event_type,event_version,aggregate_type,aggregate_id,organization_id,project_id,report_id,actor_id,actor_role,correlation_id,causation_id,source,payload_json,metadata_json,status,attempt_count,available_at,occurred_at,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`
  ).bind(
    event.event_id, event.event_type, event.event_version, event.aggregate_type, event.aggregate_id, event.organization_id,
    event.project_id, event.report_id, event.actor_id, event.actor_role, event.correlation_id, event.causation_id, event.source,
    JSON.stringify(event.payload || {}), JSON.stringify(event.metadata || {}), 'pending', event.occurred_at, event.occurred_at, now, now
  );
}

// Builds the full atomic write set for one Action lifecycle occurrence.
// `actor`/`request` are optional — a system-triggered event (overdue
// detection) passes neither, and the statements above record `source:
// 'system'` on the history row and null actor fields on the audit mirror,
// honestly reflecting that no human performed the action.
export function buildActionEventWriteSet(env, { actionId, orgId, projectId, reportId, historyType, eventType, fromValue, toValue, reason, actor, request, payload = {}, source = 'application' }) {
  const historyStmt = buildActionHistoryStatement(env, { actionId, orgId, historyType, fromValue, toValue, reason, actor });
  const { stmt: auditStmt, correlationId } = buildActionAuditStatement(env, { actionId, orgId, historyType, fromValue, toValue, reason, actor, request });
  const event = buildActionDomainEvent({
    eventType, aggregateId: actionId, organizationId: orgId, projectId, reportId,
    actorId: actor?.sub, actorRole: actor?.role, correlationId,
    source, payload: { from: fromValue, to: toValue, ...payload },
    metadata: { reason: reason || null, owner: payload.owner || null },
  });
  const outboxStmt = buildOutboxStatement(env, event);
  return { statements: [historyStmt, auditStmt, outboxStmt], event };
}
