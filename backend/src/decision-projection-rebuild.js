// Program Beta Sprint 1.6 — Part 6/17: rebuild, backfill, and legacy
// bootstrap. Every function here calls the SAME writer functions
// (decision-projection-writers.js) a live event consumer calls — this is
// the "one real write mechanism, two entry points" design (see that
// module's header comment), so rebuild logic can never silently drift from
// live-consumption logic.
//
// D1/SQLite does support a transactional ALTER TABLE RENAME, but standing
// up a full staged-table double-write/atomic-swap pipeline for this
// increment is real, heavy machinery this sprint does not need: every
// projection here is rebuilt via idempotent UPSERT directly into the live
// table, in bounded batches, so the table is never observably empty or
// half-written mid-rebuild. This is the explicitly-permitted "safe
// forward-fix" alternative (Part 6) to atomic table swapping.
//
// Rebuilds never enqueue anything onto the live production queue (Part 6:
// "must not require replaying messages into the live production queue")
// and never touch decision_action_metrics_daily, production_notifications,
// or decision_event_processed — an administrative rebuild recomputes
// CURRENT-STATE projections only, so it can never double-count a
// notification or an event-count metric (Part 17).
import { writeActionSummaryProjection, writeOrganizationPortfolio, writeProjectPortfolio, writeOwnerWorkload, writeReviewQueue } from './decision-projection-writers.js';

const REBUILD_BATCH_SIZE = 200;
export const REBUILDABLE_PROJECTION_TYPES = Object.freeze(['action-summary', 'organization-portfolio', 'project-portfolio', 'owner-workload', 'review-queue']);

// Part 6 "dry-run / validation mode where practical" — a side-effect-free
// preview comparing the authoritative row against the existing projection
// row, so an operator can inspect what a real rebuild would change before
// running it.
export async function previewActionRebuild(env, { actionId, organizationId }) {
  const current = await env.DB.prepare('SELECT id, status, owner, project_id, due_date, overdue_since, escalated_since, updated_at FROM management_response_actions WHERE id=? AND organization_id=?').bind(actionId, organizationId).first();
  const existingProjection = await env.DB.prepare('SELECT action_id, status, owner, project_id, due_date, overdue_since, escalated_since, source_updated_at, projection_version FROM action_summary_projection WHERE action_id=? AND organization_id=?').bind(actionId, organizationId).first();
  return { ok: true, actionId, current: current || null, existingProjection: existingProjection || null, wouldChange: !!current && JSON.stringify(existingProjection?.status) !== JSON.stringify(current?.status) };
}

// Rebuild one Action's summary projection plus its cascading aggregates
// (organization/project/owner/review-queue) — the same real effect a live
// event would have produced, triggered administratively instead.
export async function rebuildAction(env, { actionId, organizationId }) {
  const summary = await writeActionSummaryProjection(env, { actionId, organizationId, lastEventId: null, lastEventType: null, lastEventAt: null });
  if (summary.skipped) return summary;
  const record = await env.DB.prepare('SELECT project_id, owner FROM management_response_actions WHERE id=? AND organization_id=?').bind(actionId, organizationId).first();
  await writeOrganizationPortfolio(env, organizationId);
  await writeReviewQueue(env, organizationId, record?.project_id || null);
  if (record?.project_id) await writeProjectPortfolio(env, organizationId, record.project_id);
  if (record?.owner) await writeOwnerWorkload(env, organizationId, record.owner);
  return { ok: true, actionId };
}

async function rebuildActionsMatching(env, whereSql, binds, { batchSize = REBUILD_BATCH_SIZE } = {}) {
  let offset = 0, processed = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = (await env.DB.prepare(`SELECT id, organization_id FROM management_response_actions WHERE ${whereSql} ORDER BY id LIMIT ? OFFSET ?`).bind(...binds, batchSize, offset).all()).results || [];
    for (const row of rows) await writeActionSummaryProjection(env, { actionId: row.id, organizationId: row.organization_id, lastEventId: null, lastEventType: null, lastEventAt: null });
    processed += rows.length;
    if (rows.length < batchSize) break;
    offset += batchSize;
  }
  return processed;
}

// Rebuild every Action in one project, in bounded batches, then refresh
// that project's (and its organization's) aggregates once at the end —
// re-aggregating after every single row would be correct but wasteful,
// since the aggregate query is already a fresh, bounded re-derivation.
export async function rebuildProject(env, { organizationId, projectId, batchSize = REBUILD_BATCH_SIZE }) {
  const processed = await rebuildActionsMatching(env, 'organization_id=? AND project_id=?', [organizationId, projectId], { batchSize });
  await writeProjectPortfolio(env, organizationId, projectId);
  await writeReviewQueue(env, organizationId, projectId);
  await writeOrganizationPortfolio(env, organizationId);
  return { ok: true, organizationId, projectId, processed };
}

// Rebuild every Action in one organization, in bounded batches.
export async function rebuildOrganization(env, { organizationId, batchSize = REBUILD_BATCH_SIZE }) {
  const processed = await rebuildActionsMatching(env, 'organization_id=?', [organizationId], { batchSize });
  await writeOrganizationPortfolio(env, organizationId);
  await writeReviewQueue(env, organizationId, null);
  const projectRows = (await env.DB.prepare('SELECT DISTINCT project_id FROM management_response_actions WHERE organization_id=? AND project_id IS NOT NULL').bind(organizationId).all()).results || [];
  for (const row of projectRows) { await writeProjectPortfolio(env, organizationId, row.project_id); await writeReviewQueue(env, organizationId, row.project_id); }
  const ownerRows = (await env.DB.prepare('SELECT DISTINCT owner FROM management_response_actions WHERE organization_id=? AND owner IS NOT NULL').bind(organizationId).all()).results || [];
  for (const row of ownerRows) await writeOwnerWorkload(env, organizationId, row.owner);
  return { ok: true, organizationId, processed, projects: projectRows.length, owners: ownerRows.length };
}

// Part 17 — bounded catch-up sweep (cron-driven, like every other sweep in
// this codebase): find Actions across ALL organizations that have no
// action_summary_projection row at all — this is the real legacy-bootstrap
// path (Part 10), since a legacy Action that predates this sprint has
// never had any projection written for it — and process one bounded batch
// per invocation. Never a single unbounded full-table pass.
export async function backfillMissingActionSummaries(env, { limit = REBUILD_BATCH_SIZE } = {}) {
  const rows = (await env.DB.prepare(`
    SELECT m.id as action_id, m.organization_id FROM management_response_actions m
    LEFT JOIN action_summary_projection p ON p.action_id = m.id
    WHERE p.action_id IS NULL
    ORDER BY m.created_at ASC LIMIT ?
  `).bind(limit).all()).results || [];
  const touchedOrgs = new Set();
  for (const row of rows) { await writeActionSummaryProjection(env, { actionId: row.action_id, organizationId: row.organization_id, lastEventId: null, lastEventType: null, lastEventAt: null }); touchedOrgs.add(row.organization_id); }
  for (const organizationId of touchedOrgs) await writeOrganizationPortfolio(env, organizationId);
  return { ok: true, backfilled: rows.length, organizationsRefreshed: touchedOrgs.size };
}

// Rebuild one whole projection TYPE across the dataset, cursor-paginated
// (Part 6: "Full rebuild in bounded batches") — used after a breaking
// projection_version bump (Part 7), or to recover from a detected
// reconciliation drift affecting one projection type broadly.
export async function rebuildProjectionType(env, projectionType, { limit = REBUILD_BATCH_SIZE, cursor = '' } = {}) {
  if (!REBUILDABLE_PROJECTION_TYPES.includes(projectionType)) return { ok: false, error: `Unknown projection type: ${projectionType}` };
  if (projectionType === 'action-summary') {
    const rows = (await env.DB.prepare('SELECT id, organization_id FROM management_response_actions WHERE id > ? ORDER BY id LIMIT ?').bind(cursor, limit).all()).results || [];
    for (const row of rows) await writeActionSummaryProjection(env, { actionId: row.id, organizationId: row.organization_id, lastEventId: null, lastEventType: null, lastEventAt: null });
    return { ok: true, projectionType, processed: rows.length, nextCursor: rows.length ? rows[rows.length - 1].id : null };
  }
  if (projectionType === 'organization-portfolio') {
    const rows = (await env.DB.prepare('SELECT DISTINCT organization_id FROM management_response_actions WHERE organization_id > ? ORDER BY organization_id LIMIT ?').bind(cursor, limit).all()).results || [];
    for (const row of rows) await writeOrganizationPortfolio(env, row.organization_id);
    return { ok: true, projectionType, processed: rows.length, nextCursor: rows.length ? rows[rows.length - 1].organization_id : null };
  }
  if (projectionType === 'project-portfolio') {
    const rows = (await env.DB.prepare('SELECT DISTINCT organization_id, project_id FROM management_response_actions WHERE project_id IS NOT NULL AND project_id > ? ORDER BY project_id LIMIT ?').bind(cursor, limit).all()).results || [];
    for (const row of rows) await writeProjectPortfolio(env, row.organization_id, row.project_id);
    return { ok: true, projectionType, processed: rows.length, nextCursor: rows.length ? rows[rows.length - 1].project_id : null };
  }
  if (projectionType === 'owner-workload') {
    const rows = (await env.DB.prepare('SELECT DISTINCT organization_id, owner FROM management_response_actions WHERE owner IS NOT NULL AND owner > ? ORDER BY owner LIMIT ?').bind(cursor, limit).all()).results || [];
    for (const row of rows) await writeOwnerWorkload(env, row.organization_id, row.owner);
    return { ok: true, projectionType, processed: rows.length, nextCursor: rows.length ? rows[rows.length - 1].owner : null };
  }
  // review-queue
  const rows = (await env.DB.prepare('SELECT DISTINCT organization_id FROM management_response_actions WHERE organization_id > ? ORDER BY organization_id LIMIT ?').bind(cursor, limit).all()).results || [];
  for (const row of rows) await writeReviewQueue(env, row.organization_id, null);
  return { ok: true, projectionType, processed: rows.length, nextCursor: rows.length ? rows[rows.length - 1].organization_id : null };
}
