// Program Beta Sprint 1.6 — Enterprise Projection Layer: the shared writer
// functions every projection consumer AND the administrative rebuild
// service (decision-projection-rebuild.js) both call. Keeping the actual
// write logic in one place, invoked from two different entry points (a
// live event consumer vs. a manually-triggered rebuild), is what satisfies
// "separate live event consumption from administrative rebuild behavior"
// without duplicating the underlying aggregation logic itself.
//
// Design decision (Part 3/4/5, documented once here): every writer below
// re-derives its result from a BOUNDED, single-tenant (and, where
// applicable, single-project/single-owner) query over the authoritative
// management_response_actions table, rather than incrementing/decrementing
// a running counter per event. Recomputing the same bounded aggregate
// twice always yields the same, correct answer regardless of event order
// or duplicate delivery — which is what makes every writer here naturally
// idempotent and immune to the double-decrement/negative-counter failure
// class Part 5/9 warn about, without needing hand-written compensation
// logic. The cost is a small amount of redundant-but-cheap recomputation
// per event; the benefit is a much simpler, more robust correctness proof.
import { ACTION_STATUSES } from './international-programme-lifecycle.js';

export const PROJECTION_SCHEMA_VERSION = 1;

// Part 10 — legacy status classification. The ONLY legacy status value
// possible today is 'open' (the hardcoded default of the pre-Sprint-1
// legacy route; confirmed by audit — no other route ever writes `status`
// outside the governed Sprint 1 routes). Written generically rather than
// hardcoding 'open' specifically, so a future, genuinely unexpected status
// value is still classified honestly instead of silently mis-displayed.
export function classifyLegacyActionStatus(rawStatus) {
  if (ACTION_STATUSES.includes(rawStatus)) return { normalized: rawStatus, isLegacy: false, original: rawStatus };
  return { normalized: 'legacy_unknown', isLegacy: true, original: rawStatus };
}

// Aging bands are computed only over non-terminal Actions (verified/
// cancelled Actions are done; their "age" is not an operational backlog
// signal). Bucketed in days since creation.
const AGING_BANDS = Object.freeze([
  { key: '0_7', min: 0, max: 7 },
  { key: '8_30', min: 8, max: 30 },
  { key: '31_90', min: 31, max: 90 },
  { key: '90_plus', min: 91, max: Infinity },
]);
function bucketAgingDays(days) {
  for (const band of AGING_BANDS) if (days >= band.min && days <= band.max) return band.key;
  return '90_plus';
}

// ============================================================
// A. Action Summary Projection
// ============================================================
export async function writeActionSummaryProjection(env, { actionId, organizationId, lastEventId = null, lastEventType = null, lastEventAt = null }) {
  const record = await env.DB.prepare('SELECT * FROM management_response_actions WHERE id=? AND organization_id=?').bind(actionId, organizationId).first();
  if (!record) return { ok: true, skipped: true, reason: 'action not found (never created, or a stale/cross-tenant reference)' };

  const legacy = classifyLegacyActionStatus(record.status);
  let ownerDisplayName = null;
  if (record.owner) {
    const user = await env.DB.prepare('SELECT full_name FROM users WHERE id=? AND organization_id=? AND is_active=1').bind(record.owner, organizationId).first().catch(() => null);
    ownerDisplayName = user?.full_name || null;
  }
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO action_summary_projection (
      action_id, organization_id, project_id, report_id, recommendation, owner, owner_display_name,
      department, status, priority, strategic_priority, risk_level, progress_pct, due_date, start_date,
      completion_date, verification_status, overdue_since, escalated_since, expected_outcome, success_criteria,
      monitoring_indicator, is_legacy, legacy_original_status, created_at, last_event_id, last_event_type, last_event_at,
      last_activity_at, projection_version, projected_at, source_updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(action_id) DO UPDATE SET
      organization_id=excluded.organization_id, project_id=excluded.project_id, report_id=excluded.report_id,
      recommendation=excluded.recommendation, owner=excluded.owner, owner_display_name=excluded.owner_display_name,
      department=excluded.department, status=excluded.status, priority=excluded.priority,
      strategic_priority=excluded.strategic_priority, risk_level=excluded.risk_level, progress_pct=excluded.progress_pct,
      due_date=excluded.due_date, start_date=excluded.start_date, completion_date=excluded.completion_date,
      verification_status=excluded.verification_status, overdue_since=excluded.overdue_since,
      escalated_since=excluded.escalated_since, expected_outcome=excluded.expected_outcome,
      success_criteria=excluded.success_criteria, monitoring_indicator=excluded.monitoring_indicator,
      is_legacy=excluded.is_legacy, legacy_original_status=excluded.legacy_original_status, created_at=excluded.created_at,
      -- Part 5 out-of-order safety: current-state fields above are always
      -- freshly re-read from the authoritative row (correct regardless of
      -- event delivery order). Only these two "what was the last event we
      -- saw" fields need an explicit regression guard, since they are the
      -- only fields actually derived from the event itself rather than
      -- from a fresh authoritative read.
      last_event_id = CASE WHEN excluded.last_event_at IS NOT NULL AND (action_summary_projection.last_event_at IS NULL OR excluded.last_event_at >= action_summary_projection.last_event_at) THEN excluded.last_event_id ELSE action_summary_projection.last_event_id END,
      last_event_type = CASE WHEN excluded.last_event_at IS NOT NULL AND (action_summary_projection.last_event_at IS NULL OR excluded.last_event_at >= action_summary_projection.last_event_at) THEN excluded.last_event_type ELSE action_summary_projection.last_event_type END,
      last_event_at = CASE WHEN excluded.last_event_at IS NOT NULL AND (action_summary_projection.last_event_at IS NULL OR excluded.last_event_at >= action_summary_projection.last_event_at) THEN excluded.last_event_at ELSE action_summary_projection.last_event_at END,
      last_activity_at=excluded.last_activity_at, projection_version=excluded.projection_version,
      projected_at=excluded.projected_at, source_updated_at=excluded.source_updated_at
  `).bind(
    record.id, record.organization_id, record.project_id, record.report_id, record.recommendation, record.owner, ownerDisplayName,
    record.department, legacy.normalized, record.priority, record.strategic_priority, record.risk_level, record.progress_pct, record.due_date, record.start_date,
    record.completion_date, record.verification_status, record.overdue_since, record.escalated_since, record.expected_outcome, record.success_criteria,
    record.monitoring_indicator, legacy.isLegacy ? 1 : 0, legacy.isLegacy ? legacy.original : null, record.created_at, lastEventId, lastEventType, lastEventAt,
    record.updated_at, PROJECTION_SCHEMA_VERSION, now, record.updated_at
  ).run();

  return { ok: true, actionId, isLegacy: legacy.isLegacy };
}

// ============================================================
// B/C. Organization / Project Decision Portfolio — bounded re-aggregation
// ============================================================
async function computePortfolioAggregate(env, whereClause, bindValue) {
  const statusRows = (await env.DB.prepare(`SELECT status, COUNT(*) as n FROM management_response_actions WHERE ${whereClause} GROUP BY status`).bind(bindValue).all()).results || [];
  const backlogByStatus = Object.fromEntries(statusRows.map(r => [r.status, r.n]));
  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN lower(risk_level) IN ('high','critical') THEN 1 ELSE 0 END) as high_risk,
      SUM(CASE WHEN priority='critical' THEN 1 ELSE 0 END) as critical_priority,
      SUM(CASE WHEN overdue_since IS NOT NULL THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN escalated_since IS NOT NULL THEN 1 ELSE 0 END) as escalated,
      SUM(CASE WHEN status IN ('under_review','needs_clarification') THEN 1 ELSE 0 END) as awaiting_review,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as awaiting_verification,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM management_response_actions WHERE ${whereClause}
  `).bind(bindValue).first();
  const agingRows = (await env.DB.prepare(`
    SELECT (julianday('now') - julianday(created_at)) as age_days
    FROM management_response_actions WHERE ${whereClause} AND status NOT IN ('verified','cancelled')
  `).bind(bindValue).all()).results || [];
  const agingBands = { '0_7': 0, '8_30': 0, '31_90': 0, '90_plus': 0 };
  for (const row of agingRows) agingBands[bucketAgingDays(Math.max(0, row.age_days))]++;
  return { backlogByStatus, totals, agingBands };
}

export async function writeOrganizationPortfolio(env, organizationId) {
  const { backlogByStatus, totals, agingBands } = await computePortfolioAggregate(env, 'organization_id=?', organizationId);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO organization_decision_portfolio (organization_id, total_actions, backlog_by_status_json, high_risk_count, critical_priority_count, overdue_count, escalated_count, awaiting_review_count, awaiting_verification_count, completed_count, verified_count, cancelled_count, aging_band_json, last_event_at, projection_version, projected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(organization_id) DO UPDATE SET total_actions=excluded.total_actions, backlog_by_status_json=excluded.backlog_by_status_json,
      high_risk_count=excluded.high_risk_count, critical_priority_count=excluded.critical_priority_count, overdue_count=excluded.overdue_count,
      escalated_count=excluded.escalated_count, awaiting_review_count=excluded.awaiting_review_count, awaiting_verification_count=excluded.awaiting_verification_count,
      completed_count=excluded.completed_count, verified_count=excluded.verified_count, cancelled_count=excluded.cancelled_count,
      aging_band_json=excluded.aging_band_json, last_event_at=excluded.last_event_at, projection_version=excluded.projection_version, projected_at=excluded.projected_at
  `).bind(organizationId, totals.total || 0, JSON.stringify(backlogByStatus), totals.high_risk || 0, totals.critical_priority || 0, totals.overdue || 0, totals.escalated || 0, totals.awaiting_review || 0, totals.awaiting_verification || 0, totals.completed || 0, totals.verified || 0, totals.cancelled || 0, JSON.stringify(agingBands), now, PROJECTION_SCHEMA_VERSION, now).run();
  return { ok: true, organizationId, total: totals.total || 0 };
}

// project scope needs two bind values (organization_id AND project_id), so
// it gets its own aggregate implementation rather than overloading
// computePortfolioAggregate's single-bind-value shape.
async function computeProjectPortfolioAggregate(env, organizationId, projectId) {
  const statusRows = (await env.DB.prepare(`SELECT status, COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND project_id=? GROUP BY status`).bind(organizationId, projectId).all()).results || [];
  const backlogByStatus = Object.fromEntries(statusRows.map(r => [r.status, r.n]));
  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN lower(risk_level) IN ('high','critical') THEN 1 ELSE 0 END) as high_risk,
      SUM(CASE WHEN priority='critical' THEN 1 ELSE 0 END) as critical_priority,
      SUM(CASE WHEN overdue_since IS NOT NULL THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN escalated_since IS NOT NULL THEN 1 ELSE 0 END) as escalated,
      SUM(CASE WHEN status IN ('under_review','needs_clarification') THEN 1 ELSE 0 END) as awaiting_review,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as awaiting_verification,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM management_response_actions WHERE organization_id=? AND project_id=?
  `).bind(organizationId, projectId).first();
  const agingRows = (await env.DB.prepare(`
    SELECT (julianday('now') - julianday(created_at)) as age_days
    FROM management_response_actions WHERE organization_id=? AND project_id=? AND status NOT IN ('verified','cancelled')
  `).bind(organizationId, projectId).all()).results || [];
  const agingBands = { '0_7': 0, '8_30': 0, '31_90': 0, '90_plus': 0 };
  for (const row of agingRows) agingBands[bucketAgingDays(Math.max(0, row.age_days))]++;
  return { backlogByStatus, totals, agingBands };
}

export async function writeProjectPortfolio(env, organizationId, projectId) {
  if (!projectId) return { ok: true, skipped: true, reason: 'no project_id on this Action' };
  const { backlogByStatus, totals, agingBands } = await computeProjectPortfolioAggregate(env, organizationId, projectId);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO project_decision_portfolio (project_id, organization_id, total_actions, backlog_by_status_json, high_risk_count, critical_priority_count, overdue_count, escalated_count, awaiting_review_count, awaiting_verification_count, completed_count, verified_count, cancelled_count, aging_band_json, last_event_at, projection_version, projected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(project_id) DO UPDATE SET organization_id=excluded.organization_id, total_actions=excluded.total_actions, backlog_by_status_json=excluded.backlog_by_status_json,
      high_risk_count=excluded.high_risk_count, critical_priority_count=excluded.critical_priority_count, overdue_count=excluded.overdue_count,
      escalated_count=excluded.escalated_count, awaiting_review_count=excluded.awaiting_review_count, awaiting_verification_count=excluded.awaiting_verification_count,
      completed_count=excluded.completed_count, verified_count=excluded.verified_count, cancelled_count=excluded.cancelled_count,
      aging_band_json=excluded.aging_band_json, last_event_at=excluded.last_event_at, projection_version=excluded.projection_version, projected_at=excluded.projected_at
  `).bind(projectId, organizationId, totals.total || 0, JSON.stringify(backlogByStatus), totals.high_risk || 0, totals.critical_priority || 0, totals.overdue || 0, totals.escalated || 0, totals.awaiting_review || 0, totals.awaiting_verification || 0, totals.completed || 0, totals.verified || 0, totals.cancelled || 0, JSON.stringify(agingBands), now, PROJECTION_SCHEMA_VERSION, now).run();
  return { ok: true, projectId, total: totals.total || 0 };
}

// Daily snapshot (Part 1F trend support) — one row per organization per day.
export async function writeOrganizationPortfolioSnapshot(env, organizationId) {
  const portfolio = await env.DB.prepare('SELECT * FROM organization_decision_portfolio WHERE organization_id=?').bind(organizationId).first();
  if (!portfolio) return { ok: true, skipped: true, reason: 'no portfolio aggregate yet for this organization' };
  const denominatorForCompletion = portfolio.total_actions - portfolio.cancelled_count;
  const denominatorForVerification = portfolio.completed_count + portfolio.verified_count;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO organization_decision_portfolio_snapshot (organization_id, snapshot_date, total_actions, overdue_count, escalated_count, completed_count, verified_count, verification_rate, completion_rate, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(organization_id, snapshot_date) DO UPDATE SET total_actions=excluded.total_actions, overdue_count=excluded.overdue_count, escalated_count=excluded.escalated_count,
      completed_count=excluded.completed_count, verified_count=excluded.verified_count, verification_rate=excluded.verification_rate, completion_rate=excluded.completion_rate, created_at=excluded.created_at
  `).bind(
    organizationId, today, portfolio.total_actions, portfolio.overdue_count, portfolio.escalated_count, portfolio.completed_count, portfolio.verified_count,
    denominatorForVerification > 0 ? portfolio.verified_count / denominatorForVerification : null,
    denominatorForCompletion > 0 ? (portfolio.completed_count + portfolio.verified_count) / denominatorForCompletion : null,
    now
  ).run();
  return { ok: true, organizationId, snapshotDate: today };
}

// ============================================================
// D. Owner Workload
// ============================================================
export async function writeOwnerWorkload(env, organizationId, owner) {
  if (!owner) return { ok: true, skipped: true, reason: 'Action has no owner' };
  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) as assigned,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN overdue_since IS NOT NULL THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date >= date('now') AND due_date <= date('now','+7 days') AND status NOT IN ('verified','cancelled') THEN 1 ELSE 0 END) as due_soon,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as awaiting_verification,
      AVG(CASE WHEN status NOT IN ('verified','cancelled') THEN (julianday('now') - julianday(created_at)) END) as avg_age_days
    FROM management_response_actions WHERE organization_id=? AND owner=?
  `).bind(organizationId, owner).first();
  const priorityRows = (await env.DB.prepare(`SELECT priority, COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND owner=? GROUP BY priority`).bind(organizationId, owner).all()).results || [];
  const riskRows = (await env.DB.prepare(`SELECT risk_level, COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND owner=? AND risk_level IS NOT NULL GROUP BY risk_level`).bind(organizationId, owner).all()).results || [];
  const user = await env.DB.prepare('SELECT full_name FROM users WHERE id=? AND organization_id=? AND is_active=1').bind(owner, organizationId).first().catch(() => null);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO owner_workload_projection (organization_id, owner, owner_display_name, assigned_count, in_progress_count, overdue_count, due_soon_count, awaiting_verification_count, avg_age_days, priority_breakdown_json, risk_breakdown_json, last_event_at, projection_version, projected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(organization_id, owner) DO UPDATE SET owner_display_name=excluded.owner_display_name, assigned_count=excluded.assigned_count, in_progress_count=excluded.in_progress_count,
      overdue_count=excluded.overdue_count, due_soon_count=excluded.due_soon_count, awaiting_verification_count=excluded.awaiting_verification_count, avg_age_days=excluded.avg_age_days,
      priority_breakdown_json=excluded.priority_breakdown_json, risk_breakdown_json=excluded.risk_breakdown_json, last_event_at=excluded.last_event_at, projection_version=excluded.projection_version, projected_at=excluded.projected_at
  `).bind(
    organizationId, owner, user?.full_name || null, totals.assigned || 0, totals.in_progress || 0, totals.overdue || 0, totals.due_soon || 0, totals.awaiting_verification || 0,
    totals.avg_age_days != null ? Math.round(totals.avg_age_days * 10) / 10 : null,
    JSON.stringify(Object.fromEntries(priorityRows.map(r => [r.priority, r.n]))), JSON.stringify(Object.fromEntries(riskRows.map(r => [r.risk_level, r.n]))), now, PROJECTION_SCHEMA_VERSION, now
  ).run();
  return { ok: true, organizationId, owner, assigned: totals.assigned || 0 };
}

// ============================================================
// E. Review Queue (organization-wide '__all__' row + one per real project)
// ============================================================
const REVIEW_QUEUE_ALL_PROJECTS = '__all__';

async function computeReviewQueueAggregate(env, whereSql, binds) {
  return env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status='under_review' THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN status='needs_clarification' THEN 1 ELSE 0 END) as needs_clarification,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as awaiting_verification,
      MIN(CASE WHEN status='under_review' THEN updated_at END) as oldest_pending_review_at,
      MIN(CASE WHEN status='completed' THEN updated_at END) as oldest_pending_verification_at
    FROM management_response_actions WHERE ${whereSql}
  `).bind(...binds).first();
}

async function upsertReviewQueueRow(env, organizationId, projectId, totals) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO review_queue_projection (organization_id, project_id, under_review_count, needs_clarification_count, awaiting_verification_count, oldest_pending_review_at, oldest_pending_verification_at, last_event_at, projection_version, projected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(organization_id, project_id) DO UPDATE SET under_review_count=excluded.under_review_count, needs_clarification_count=excluded.needs_clarification_count,
      awaiting_verification_count=excluded.awaiting_verification_count, oldest_pending_review_at=excluded.oldest_pending_review_at, oldest_pending_verification_at=excluded.oldest_pending_verification_at,
      last_event_at=excluded.last_event_at, projection_version=excluded.projection_version, projected_at=excluded.projected_at
  `).bind(organizationId, projectId, totals.under_review || 0, totals.needs_clarification || 0, totals.awaiting_verification || 0, totals.oldest_pending_review_at || null, totals.oldest_pending_verification_at || null, now, PROJECTION_SCHEMA_VERSION, now).run();
}

export async function writeReviewQueue(env, organizationId, projectId) {
  const orgTotals = await computeReviewQueueAggregate(env, 'organization_id=?', [organizationId]);
  await upsertReviewQueueRow(env, organizationId, REVIEW_QUEUE_ALL_PROJECTS, orgTotals);
  if (projectId) {
    const projectTotals = await computeReviewQueueAggregate(env, 'organization_id=? AND project_id=?', [organizationId, projectId]);
    await upsertReviewQueueRow(env, organizationId, projectId, projectTotals);
  }
  return { ok: true, organizationId, projectId: projectId || null };
}

// Cron-facing: one daily snapshot per organization that already has a
// portfolio aggregate. Bounded by the real number of organizations with
// Actions at all (this is a per-tenant B2B platform, not mass-consumer),
// and the write itself is idempotent (ON CONFLICT on organization+date), so
// running this every 5-minute tick is harmless — it just keeps today's
// snapshot current until the date rolls over, which is the correct
// behavior for a "snapshot of today so far" row.
export async function sweepDailyPortfolioSnapshots(env, { limit = 500 } = {}) {
  const rows = (await env.DB.prepare('SELECT organization_id FROM organization_decision_portfolio LIMIT ?').bind(limit).all()).results || [];
  for (const row of rows) await writeOrganizationPortfolioSnapshot(env, row.organization_id);
  return { ok: true, snapshotted: rows.length };
}
