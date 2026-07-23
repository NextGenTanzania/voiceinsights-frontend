// Program Beta Sprint 1.5 — canonical Action domain event taxonomy and
// envelope. Reuses sanitizeObject() from cloudflare-queue-platform.js (the
// same redaction used by the real queue transport) rather than a second
// secret/PII-scrubbing implementation.
import { newId } from './auth.js';
import { sanitizeObject } from './cloudflare-queue-platform.js';

export const EVENT_SCHEMA_VERSION = 1;

// Versions this build can still validate/consume. A future breaking change
// bumps EVENT_SCHEMA_VERSION and adds the new number here; old numbers are
// only removed once no outstanding outbox/queue event references them.
//
// Versioning policy:
//  - Backward-compatible: adding a new optional payload/metadata field.
//    Consumers MUST ignore fields they don't recognise, never error on them.
//  - Breaking change: removing or renaming a required envelope field, or
//    changing what an existing field means. Requires a new event_version.
//  - An event carrying an event_version not in SUPPORTED_EVENT_VERSIONS is
//    rejected (dead-lettered) by the consumer router — never silently
//    reinterpreted under the current version's meaning.
export const SUPPORTED_EVENT_VERSIONS = Object.freeze([1]);
export function isSupportedEventVersion(v) { return SUPPORTED_EVENT_VERSIONS.includes(Number(v)); }

export const ACTION_EVENT_TYPES = Object.freeze([
  'decision.action.created',
  'decision.action.updated',
  'decision.action.submitted',
  'decision.action.needs_clarification',
  'decision.action.approved',
  'decision.action.rejected',
  'decision.action.assigned',
  'decision.action.started',
  'decision.action.progress_updated',
  'decision.action.completed',
  'decision.action.reopened',
  'decision.action.verified',
  'decision.action.cancelled',
  'decision.action.evidence_added',
  'decision.action.overdue',
  'decision.action.escalated',
]);

const REQUIRED_ENVELOPE_FIELDS = [
  'event_id','event_type','event_version','aggregate_type','aggregate_id',
  'organization_id','correlation_id','source','occurred_at','recorded_at','schema_version'
];

// Builds one governed event envelope. Only ever call this AFTER the
// corresponding D1 write has been prepared/committed — this module never
// emits an event for a change that has not actually happened (Part 1).
export function buildActionDomainEvent({
  eventType, aggregateId, organizationId, projectId, reportId,
  actorId, actorRole, correlationId, causationId, source = 'application',
  payload = {}, metadata = {}, occurredAt,
} = {}) {
  if (!ACTION_EVENT_TYPES.includes(eventType)) throw new Error(`Unsupported action event type: ${eventType}`);
  if (!aggregateId) throw new Error('aggregateId is required');
  if (!organizationId) throw new Error('organizationId is required');
  const now = new Date().toISOString();
  return {
    event_id: newId('devt'),
    event_type: eventType,
    event_version: EVENT_SCHEMA_VERSION,
    aggregate_type: 'action',
    aggregate_id: aggregateId,
    organization_id: organizationId,
    project_id: projectId || null,
    report_id: reportId || null,
    actor_id: actorId || null,
    actor_role: actorRole || null,
    correlation_id: correlationId || crypto.randomUUID(),
    causation_id: causationId || null,
    source,
    occurred_at: occurredAt || now,
    recorded_at: now,
    payload: sanitizeObject(payload || {}),
    metadata: sanitizeObject(metadata || {}),
    schema_version: EVENT_SCHEMA_VERSION,
  };
}

// Validates an envelope shape — used both when building (defensive) and
// when a consumer reads an event back off the queue (Part 7: "reject
// malformed events safely" before dispatching to any handler).
export function validateActionDomainEvent(event = {}) {
  const errors = [];
  for (const field of REQUIRED_ENVELOPE_FIELDS) {
    if (event[field] === undefined || event[field] === null || event[field] === '') errors.push(`${field} is required`);
  }
  if (event.event_type && !ACTION_EVENT_TYPES.includes(event.event_type)) errors.push(`Unknown event_type: ${event.event_type}`);
  if (event.event_version !== undefined && !isSupportedEventVersion(event.event_version)) errors.push(`Unsupported event_version: ${event.event_version}`);
  if (event.aggregate_type && event.aggregate_type !== 'action') errors.push(`Unsupported aggregate_type: ${event.aggregate_type}`);
  return { ok: errors.length === 0, errors };
}
