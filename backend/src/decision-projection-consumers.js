// Program Beta Sprint 1.6 — projection consumers, registered into the same
// consumer-registry pattern Sprint 1.5 already established (Part 3: "reuse
// the existing decision event consumer architecture"). Kept as a SEPARATE
// registry object (PROJECTION_CONSUMER_REGISTRY) from Sprint 1.5's own
// CONSUMER_REGISTRY (notification/metrics/timeline) rather than merged into
// it, because dispatchDecisionEvent() (decision-event-consumers.js) already
// iterates whatever registry it's given and tracks idempotency per
// consumer_name — merging both call sites' registries into one object would
// require importing this module's consumers back into decision-event-
// consumers.js, creating an awkward circular dependency for no real benefit.
// Instead, decision-projection-dispatch.js (see below) reuses the SAME
// dispatchDecisionEvent() function against this registry — one real
// dispatch mechanism, exercised twice with two different consumer sets.
import { writeActionSummaryProjection, writeOrganizationPortfolio, writeProjectPortfolio, writeOwnerWorkload, writeReviewQueue } from './decision-projection-writers.js';

async function actionSummaryConsumer(event, env) {
  return writeActionSummaryProjection(env, {
    actionId: event.aggregate_id, organizationId: event.organization_id,
    lastEventId: event.event_id, lastEventType: event.event_type, lastEventAt: event.occurred_at,
  });
}

async function organizationPortfolioConsumer(event, env) {
  return writeOrganizationPortfolio(env, event.organization_id);
}

async function projectPortfolioConsumer(event, env) {
  if (!event.project_id) return { ok: true, skipped: true, reason: 'event has no project_id' };
  return writeProjectPortfolio(env, event.organization_id, event.project_id);
}

// Always refreshes the CURRENT owner's workload from a fresh authoritative
// read (never from the event payload). Additionally refreshes the FORMER
// owner's workload, but only when the event unambiguously represents an
// owner reassignment: the PATCH route (application.js) is the only route
// that puts 'owner' inside payload.updated_fields, which is the one
// reliable signal that payload.from/payload.to on THIS event are owner
// values rather than status values (every other route's 'decision.action.
// updated' emission — e.g. the rejected->draft fallback edge — carries
// payload.from/to as STATUS strings, which would silently corrupt
// owner_workload_projection if treated as an owner id).
async function ownerWorkloadConsumer(event, env) {
  const record = await env.DB.prepare('SELECT owner FROM management_response_actions WHERE id=? AND organization_id=?').bind(event.aggregate_id, event.organization_id).first();
  const results = [];
  if (record?.owner) results.push(await writeOwnerWorkload(env, event.organization_id, record.owner));
  const reassignedOwner = Array.isArray(event.payload?.updated_fields) && event.payload.updated_fields.includes('owner');
  if (reassignedOwner && event.payload?.from && event.payload.from !== record?.owner) {
    results.push(await writeOwnerWorkload(env, event.organization_id, event.payload.from));
  }
  return { ok: true, results };
}

async function reviewQueueConsumer(event, env) {
  return writeReviewQueue(env, event.organization_id, event.project_id || null);
}

export const PROJECTION_CONSUMER_REGISTRY = Object.freeze({
  'action-summary': actionSummaryConsumer,
  'organization-portfolio': organizationPortfolioConsumer,
  'project-portfolio': projectPortfolioConsumer,
  'owner-workload': ownerWorkloadConsumer,
  'review-queue': reviewQueueConsumer,
});
