// Program Beta Sprint 1.6 — read-side query functions for the projection
// APIs (Part 11/12) and Executive Decision Intelligence (Part 1F/13). All
// user-controlled filter/sort VALUES are bound as SQL parameters; the only
// user-influenced strings that reach the SQL text directly (sort column,
// sort direction) are first mapped through a small closed allowlist below —
// never concatenated from raw request input — so this module cannot be
// used to inject arbitrary SQL regardless of what a caller passes in.
import { computeActionMetrics } from './decision-metrics.js';

const LAG_THRESHOLD_SECONDS = 900; // 15 minutes — a measured operational threshold for this sweep's own cron cadence, not a marketing SLA.
const CURRENT_PROJECTION_VERSION = 1;

const SORTABLE_FIELDS = Object.freeze({
  due_date: 'due_date', priority: 'priority', risk: 'risk_level', last_activity: 'last_activity_at',
  created: 'created_at', progress: 'progress_pct', age: 'created_at',
});

// Part 12 — Decision Workspace query support. Every filter value is bound;
// dueSoonDays is converted to a concrete date in JS (never interpolated as
// a raw number into the SQL string) before binding.
export async function listActionSummaries(env, { organizationId, projectId, filters = {}, sort = 'last_activity', direction = 'desc', limit = 25, offset = 0 }) {
  const clauses = ['organization_id=?'];
  const binds = [organizationId];
  if (projectId) { clauses.push('project_id=?'); binds.push(projectId); }
  if (filters.status) { clauses.push('status=?'); binds.push(filters.status); }
  if (filters.owner) { clauses.push('owner=?'); binds.push(filters.owner); }
  if (filters.department) { clauses.push('department=?'); binds.push(filters.department); }
  if (filters.priority) { clauses.push('priority=?'); binds.push(filters.priority); }
  if (filters.riskLevel) { clauses.push('risk_level=?'); binds.push(filters.riskLevel); }
  if (filters.overdueOnly) clauses.push('overdue_since IS NOT NULL');
  if (filters.escalatedOnly) clauses.push('escalated_since IS NOT NULL');
  if (filters.dueSoonDays != null) {
    const days = Math.max(0, Math.min(365, Math.floor(Number(filters.dueSoonDays)) || 0));
    const dueSoonDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    clauses.push("due_date IS NOT NULL AND due_date >= date('now') AND due_date <= ? AND status NOT IN ('verified','cancelled')");
    binds.push(dueSoonDate);
  }
  if (filters.dueAfter) { clauses.push('due_date >= ?'); binds.push(filters.dueAfter); }
  if (filters.dueBefore) { clauses.push('due_date <= ?'); binds.push(filters.dueBefore); }
  if (filters.keyword) { clauses.push('recommendation LIKE ?'); binds.push(`%${filters.keyword}%`); }

  const sortCol = SORTABLE_FIELDS[sort] || 'last_activity_at';
  const dir = direction === 'asc' ? 'ASC' : 'DESC';
  const whereSql = clauses.join(' AND ');
  const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const boundedOffset = Math.max(0, Number(offset) || 0);

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM action_summary_projection WHERE ${whereSql}`).bind(...binds).first();
  const rows = (await env.DB.prepare(`SELECT * FROM action_summary_projection WHERE ${whereSql} ORDER BY ${sortCol} ${dir}, action_id ${dir} LIMIT ? OFFSET ?`).bind(...binds, boundedLimit, boundedOffset).all()).results || [];
  return { ok: true, actions: rows, pagination: { total: countRow?.n || 0, limit: boundedLimit, offset: boundedOffset, has_more: boundedOffset + rows.length < (countRow?.n || 0) } };
}

export async function getActionSummary(env, organizationId, actionId) {
  const row = await env.DB.prepare('SELECT * FROM action_summary_projection WHERE action_id=? AND organization_id=?').bind(actionId, organizationId).first();
  return row ? { ok: true, action: row } : { ok: false, error: 'not_found' };
}

function computePortfolioRates(portfolio) {
  const compDenom = portfolio.total_actions - portfolio.cancelled_count;
  const verifDenom = portfolio.completed_count + portfolio.verified_count;
  return {
    completion_rate: compDenom > 0 ? Math.round(((portfolio.completed_count + portfolio.verified_count) / compDenom) * 1000) / 1000 : null,
    verification_rate: verifDenom > 0 ? Math.round((portfolio.verified_count / verifDenom) * 1000) / 1000 : null,
  };
}

export async function getOrganizationPortfolio(env, organizationId) {
  const portfolio = await env.DB.prepare('SELECT * FROM organization_decision_portfolio WHERE organization_id=?').bind(organizationId).first();
  if (!portfolio) return { ok: true, available: false, reason: 'no Actions projected yet for this organization' };
  return {
    ok: true, available: true, organization_id: organizationId,
    total_actions: portfolio.total_actions, backlog_by_status: JSON.parse(portfolio.backlog_by_status_json || '{}'),
    high_risk_count: portfolio.high_risk_count, critical_priority_count: portfolio.critical_priority_count,
    overdue_count: portfolio.overdue_count, escalated_count: portfolio.escalated_count,
    awaiting_review_count: portfolio.awaiting_review_count, awaiting_verification_count: portfolio.awaiting_verification_count,
    completed_count: portfolio.completed_count, verified_count: portfolio.verified_count, cancelled_count: portfolio.cancelled_count,
    aging_bands: JSON.parse(portfolio.aging_band_json || '{}'),
    ...computePortfolioRates(portfolio),
    freshness: { last_event_at: portfolio.last_event_at, projected_at: portfolio.projected_at, projection_version: portfolio.projection_version },
  };
}

export async function getProjectPortfolio(env, organizationId, projectId) {
  const portfolio = await env.DB.prepare('SELECT * FROM project_decision_portfolio WHERE organization_id=? AND project_id=?').bind(organizationId, projectId).first();
  if (!portfolio) return { ok: true, available: false, reason: 'no Actions projected yet for this project' };
  return {
    ok: true, available: true, project_id: projectId, organization_id: organizationId,
    total_actions: portfolio.total_actions, backlog_by_status: JSON.parse(portfolio.backlog_by_status_json || '{}'),
    high_risk_count: portfolio.high_risk_count, critical_priority_count: portfolio.critical_priority_count,
    overdue_count: portfolio.overdue_count, escalated_count: portfolio.escalated_count,
    awaiting_review_count: portfolio.awaiting_review_count, awaiting_verification_count: portfolio.awaiting_verification_count,
    completed_count: portfolio.completed_count, verified_count: portfolio.verified_count, cancelled_count: portfolio.cancelled_count,
    aging_bands: JSON.parse(portfolio.aging_band_json || '{}'),
    ...computePortfolioRates(portfolio),
    freshness: { last_event_at: portfolio.last_event_at, projected_at: portfolio.projected_at, projection_version: portfolio.projection_version },
  };
}

export async function listOwnerWorkloads(env, organizationId, { limit = 25, offset = 0 } = {}) {
  const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const boundedOffset = Math.max(0, Number(offset) || 0);
  const countRow = await env.DB.prepare('SELECT COUNT(*) as n FROM owner_workload_projection WHERE organization_id=?').bind(organizationId).first();
  const rows = (await env.DB.prepare('SELECT * FROM owner_workload_projection WHERE organization_id=? ORDER BY overdue_count DESC, owner ASC LIMIT ? OFFSET ?').bind(organizationId, boundedLimit, boundedOffset).all()).results || [];
  return { ok: true, owners: rows.map(r => ({ ...r, priority_breakdown: JSON.parse(r.priority_breakdown_json || '{}'), risk_breakdown: JSON.parse(r.risk_breakdown_json || '{}') })), pagination: { total: countRow?.n || 0, limit: boundedLimit, offset: boundedOffset } };
}

export async function getReviewQueue(env, organizationId, projectId) {
  const key = projectId || '__all__';
  const row = await env.DB.prepare('SELECT * FROM review_queue_projection WHERE organization_id=? AND project_id=?').bind(organizationId, key).first();
  if (!row) return { ok: true, available: false, reason: 'no review-queue data yet for this scope' };
  return {
    ok: true, available: true, scope: projectId ? 'project' : 'organization',
    under_review_count: row.under_review_count, needs_clarification_count: row.needs_clarification_count, awaiting_verification_count: row.awaiting_verification_count,
    oldest_pending_review_at: row.oldest_pending_review_at, oldest_pending_verification_at: row.oldest_pending_verification_at,
    note: 'Scoped to a queue depth/aging view, not per-reviewer-person workload: neither management_response_actions nor action_history stores a durable assigned-reviewer relationship — only who last acted (Part 2 anti-fabrication rule).',
    freshness: { last_event_at: row.last_event_at, projected_at: row.projected_at, projection_version: row.projection_version },
  };
}

// Part 1F/13 — Executive Decision Intelligence. Reuses computeActionMetrics
// (decision-metrics.js) for duration/reopen semantics rather than
// recomputing them a second way, and organization_decision_portfolio for
// current-state aggregates. No generated narrative, no AI interpretation.
export async function getExecutiveIntelligence(env, organizationId) {
  const portfolio = await env.DB.prepare('SELECT * FROM organization_decision_portfolio WHERE organization_id=?').bind(organizationId).first();
  if (!portfolio) return { ok: true, available: false, reason: 'no projection data yet for this organization' };

  const metrics = await computeActionMetrics(env, { orgId: organizationId });
  const rates = computePortfolioRates(portfolio);

  const priorSnapshot = await env.DB.prepare(`SELECT * FROM organization_decision_portfolio_snapshot WHERE organization_id=? AND snapshot_date < date('now') ORDER BY snapshot_date DESC LIMIT 1`).bind(organizationId).first();
  const trend = priorSnapshot ? {
    available: true,
    compared_to_date: priorSnapshot.snapshot_date,
    overdue_count_delta: portfolio.overdue_count - priorSnapshot.overdue_count,
    verification_rate_delta: (rates.verification_rate != null && priorSnapshot.verification_rate != null) ? Math.round((rates.verification_rate - priorSnapshot.verification_rate) * 1000) / 1000 : null,
  } : { available: false, reason: 'no prior measured snapshot yet — trend requires at least one earlier daily snapshot' };

  const priorityRows = (await env.DB.prepare('SELECT priority, COUNT(*) as n FROM action_summary_projection WHERE organization_id=? GROUP BY priority').bind(organizationId).all()).results || [];
  const riskRows = (await env.DB.prepare("SELECT risk_level, COUNT(*) as n FROM action_summary_projection WHERE organization_id=? AND risk_level IS NOT NULL GROUP BY risk_level").bind(organizationId).all()).results || [];

  return {
    ok: true, available: true, organization_id: organizationId,
    decision_backlog: JSON.parse(portfolio.backlog_by_status_json || '{}'),
    review_backlog: portfolio.awaiting_review_count,
    verification_backlog: portfolio.awaiting_verification_count,
    overdue: { count: portfolio.overdue_count, percentage: portfolio.total_actions > 0 ? Math.round((portfolio.overdue_count / portfolio.total_actions) * 1000) / 10 : null },
    escalated_count: portfolio.escalated_count,
    ...rates,
    aging_bands: JSON.parse(portfolio.aging_band_json || '{}'),
    priority_concentration: Object.fromEntries(priorityRows.map(r => [r.priority, r.n])),
    risk_concentration: Object.fromEntries(riskRows.map(r => [r.risk_level, r.n])),
    durations: metrics.durations,
    reopen_count: metrics.reopen_count,
    trend,
    narrative: null, // Part 1F: explicitly no generated narrative / AI interpretation this sprint.
    semantics: metrics.semantics,
    freshness: { last_event_at: portfolio.last_event_at, projected_at: portfolio.projected_at, projection_version: portfolio.projection_version },
  };
}

// Part 8/16 — projection freshness/health.
export async function getProjectionHealth(env, organizationId) {
  const nowMs = Date.now();
  async function freshnessFor(table, whereSql, binds) {
    const row = await env.DB.prepare(`SELECT MAX(projected_at) as latest, COUNT(*) as n FROM ${table} WHERE ${whereSql}`).bind(...binds).first();
    if (!row || !row.n) return { status: 'unknown', projected_at: null, lag_seconds: null, row_count: 0 };
    const lagSeconds = row.latest ? Math.max(0, Math.round((nowMs - new Date(row.latest).getTime()) / 1000)) : null;
    const status = lagSeconds == null ? 'unknown' : lagSeconds > LAG_THRESHOLD_SECONDS ? 'lagging' : 'current';
    return { status, projected_at: row.latest, lag_seconds: lagSeconds, row_count: row.n };
  }
  const [actionSummary, orgPortfolio, ownerWorkload, reviewQueue] = await Promise.all([
    freshnessFor('action_summary_projection', 'organization_id=?', [organizationId]),
    freshnessFor('organization_decision_portfolio', 'organization_id=?', [organizationId]),
    freshnessFor('owner_workload_projection', 'organization_id=?', [organizationId]),
    freshnessFor('review_queue_projection', 'organization_id=?', [organizationId]),
  ]);
  const unresolvedFindings = await env.DB.prepare('SELECT COUNT(*) as n FROM projection_reconciliation_findings WHERE organization_id=? AND resolved_at IS NULL').bind(organizationId).first();
  const missingCount = await env.DB.prepare(`
    SELECT COUNT(*) as n FROM management_response_actions m LEFT JOIN action_summary_projection p ON p.action_id = m.id WHERE m.organization_id=? AND p.action_id IS NULL
  `).bind(organizationId).first();
  return {
    ok: true, organization_id: organizationId, lag_threshold_seconds: LAG_THRESHOLD_SECONDS, current_projection_version: CURRENT_PROJECTION_VERSION,
    projections: { 'action-summary': actionSummary, 'organization-portfolio': orgPortfolio, 'owner-workload': ownerWorkload, 'review-queue': reviewQueue },
    unresolved_reconciliation_findings: unresolvedFindings?.n || 0,
    actions_missing_projection: missingCount?.n || 0,
  };
}

// ============================================================
// Program Beta Sprint 3 — Executive Intelligence read functions.
// Every function below reads EXISTING projection tables (or, where a field
// genuinely isn't projected — evidence — the governed source table
// directly, server-side). None recomputes an authoritative aggregate a
// second, divergent way; all reuse computePortfolioRates and the same
// organization_id=? inline tenant-scoping convention as the functions above.
// ============================================================

// Part 3E — Portfolio Performance: list every project's portfolio in one
// call (project_decision_portfolio already holds exactly this data; the
// only gap was a LIST query beside the existing single-project lookup).
export async function listProjectPortfolios(env, organizationId) {
  const rows = (await env.DB.prepare('SELECT * FROM project_decision_portfolio WHERE organization_id=? ORDER BY overdue_count DESC, total_actions DESC').bind(organizationId).all()).results || [];
  const projects = rows.map(portfolio => ({
    project_id: portfolio.project_id, total_actions: portfolio.total_actions,
    backlog_by_status: JSON.parse(portfolio.backlog_by_status_json || '{}'),
    high_risk_count: portfolio.high_risk_count, critical_priority_count: portfolio.critical_priority_count,
    overdue_count: portfolio.overdue_count, escalated_count: portfolio.escalated_count,
    awaiting_review_count: portfolio.awaiting_review_count, awaiting_verification_count: portfolio.awaiting_verification_count,
    ...computePortfolioRates(portfolio),
    freshness: { last_event_at: portfolio.last_event_at, projected_at: portfolio.projected_at },
  }));
  return { ok: true, organization_id: organizationId, projects };
}

// Part 3D — Strategic Priority Performance. New GROUP BY over the existing
// action_summary_projection table — no new authoritative computation, just
// a different aggregation view of data already projected.
export async function getStrategicPriorityBreakdown(env, organizationId) {
  const rows = (await env.DB.prepare(`
    SELECT strategic_priority,
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('completed','verified') THEN 1 ELSE 0 END) as completed_n,
      SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) as verified_n,
      SUM(CASE WHEN overdue_since IS NOT NULL THEN 1 ELSE 0 END) as overdue_n,
      SUM(CASE WHEN escalated_since IS NOT NULL THEN 1 ELSE 0 END) as escalated_n,
      AVG(progress_pct) as avg_progress
    FROM action_summary_projection WHERE organization_id=? AND strategic_priority IS NOT NULL AND strategic_priority != ''
    GROUP BY strategic_priority ORDER BY total DESC
  `).bind(organizationId).all()).results || [];
  const priorities = rows.map(r => ({
    strategic_priority: r.strategic_priority, total_commitments: r.total,
    completed_count: r.completed_n, verified_count: r.verified_n,
    overdue_count: r.overdue_n, escalated_count: r.escalated_n,
    overdue_rate: r.total > 0 ? Math.round((r.overdue_n / r.total) * 1000) / 1000 : null,
    average_progress_pct: r.avg_progress != null ? Math.round(r.avg_progress) : null,
  }));
  return { ok: true, organization_id: organizationId, available: priorities.length > 0, strategic_priorities: priorities };
}

// Part 7 — Trend and Movement. Reads the real daily snapshot table (no
// synthetic interpolation). Honestly reports insufficient history rather
// than rendering a chart from too few points — 3 is the minimum for a
// trend LINE to mean anything (2 points is just a single delta, already
// surfaced separately by getExecutiveIntelligence's `trend` field).
const MIN_TREND_POINTS = 3;
export async function getPortfolioTrend(env, organizationId, days = 30) {
  const boundedDays = Math.min(90, Math.max(1, Number(days) || 30));
  const rows = (await env.DB.prepare(
    `SELECT * FROM organization_decision_portfolio_snapshot WHERE organization_id=? AND snapshot_date >= date('now', ?) ORDER BY snapshot_date ASC`
  ).bind(organizationId, `-${boundedDays} days`).all()).results || [];
  if (rows.length < MIN_TREND_POINTS) {
    return { ok: true, available: false, reason: `Insufficient historical data: ${rows.length} snapshot day(s) recorded, ${MIN_TREND_POINTS} required for a trend chart.`, points_available: rows.length };
  }
  return {
    ok: true, available: true, days: boundedDays,
    points: rows.map(r => ({
      date: r.snapshot_date, total_actions: r.total_actions, overdue_count: r.overdue_count,
      escalated_count: r.escalated_count, completed_count: r.completed_count, verified_count: r.verified_count,
      verification_rate: r.verification_rate, completion_rate: r.completion_rate,
    })),
  };
}

// Part 3I — Evidence and Assurance. Evidence fields (evidence_after_json,
// attachments_count, verification_status) are NOT part of the projection
// schema (migration 045) — they live only on the governed source table
// (management_response_actions). Querying that table directly here is
// still a server-side, governed read (never done in the browser), so it
// does not violate "no raw-record computation" — that rule targets
// browser-side recomputation, not this server module.
// Only 3 evidence states are real in the current data model: Attached
// (attachments_count>0 or evidence_after_json non-empty), Verified
// (verification_status='verified'), and Not available (neither). A
// distinct pre-verification "Reviewed" state does not exist in the schema
// today and is deliberately not fabricated here.
export async function getEvidenceAssurance(env, organizationId) {
  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN attachments_count > 0 OR (evidence_after_json IS NOT NULL AND evidence_after_json != '[]') THEN 1 ELSE 0 END) as with_evidence,
      SUM(CASE WHEN verification_status='verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN status IN ('completed','verified') AND (attachments_count = 0 AND (evidence_after_json IS NULL OR evidence_after_json = '[]')) THEN 1 ELSE 0 END) as completed_without_evidence,
      SUM(CASE WHEN risk_level='high' AND status IN ('completed','verified') AND (attachments_count = 0 AND (evidence_after_json IS NULL OR evidence_after_json = '[]')) THEN 1 ELSE 0 END) as high_risk_without_evidence,
      SUM(CASE WHEN strategic_priority IS NOT NULL AND strategic_priority != '' AND (attachments_count > 0 OR (evidence_after_json IS NOT NULL AND evidence_after_json != '[]')) THEN 1 ELSE 0 END) as strategic_with_evidence,
      SUM(CASE WHEN updated_at >= datetime('now','-7 days') AND (attachments_count > 0 OR (evidence_after_json IS NOT NULL AND evidence_after_json != '[]')) THEN 1 ELSE 0 END) as evidence_added_recent
    FROM management_response_actions WHERE organization_id=?
  `).bind(organizationId).first();
  const total = totals?.total || 0;
  return {
    ok: true, organization_id: organizationId, total_actions: total,
    with_evidence_count: totals?.with_evidence || 0,
    verified_count: totals?.verified || 0,
    not_available_count: total - (totals?.with_evidence || 0),
    completed_without_evidence_count: totals?.completed_without_evidence || 0,
    high_risk_without_evidence_count: totals?.high_risk_without_evidence || 0,
    strategic_priority_with_evidence_count: totals?.strategic_with_evidence || 0,
    evidence_added_last_7_days: totals?.evidence_added_recent || 0,
    evidence_coverage_rate: total > 0 ? Math.round(((totals?.with_evidence || 0) / total) * 1000) / 1000 : null,
    note: 'Only three evidence states are real in the current data model: Attached, Verified, and Not available. A distinct pre-verification "Reviewed" state is not tracked and is not fabricated here.',
  };
}

// Part 3J — Executive Timeline. Joins action_history (the real event log)
// with action_summary_projection for the project/priority/risk context
// needed by the filters, restricted to institutionally significant event
// types (never every micro-edit).
const SIGNIFICANT_EVENT_TYPES = Object.freeze(['status', 'assignment', 'evidence', 'verification']);
export async function getExecutiveTimeline(env, organizationId, { projectId, eventType, actorId, since, limit = 30 } = {}) {
  const clauses = ['h.organization_id=?'];
  const binds = [organizationId];
  if (projectId) { clauses.push('p.project_id=?'); binds.push(projectId); }
  if (eventType && SIGNIFICANT_EVENT_TYPES.includes(eventType)) { clauses.push('h.history_type=?'); binds.push(eventType); }
  else { clauses.push(`h.history_type IN (${SIGNIFICANT_EVENT_TYPES.map(() => '?').join(',')})`); binds.push(...SIGNIFICANT_EVENT_TYPES); }
  if (actorId) { clauses.push('h.actor_id=?'); binds.push(actorId); }
  if (since) { clauses.push('h.created_at >= ?'); binds.push(since); }
  const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const whereSql = clauses.join(' AND ');
  const rows = (await env.DB.prepare(`
    SELECT h.id, h.action_id, h.history_type, h.from_value, h.to_value, h.reason, h.actor_id, h.actor_role, h.created_at,
      p.recommendation, p.project_id, p.priority, p.risk_level, p.strategic_priority
    FROM action_history h LEFT JOIN action_summary_projection p ON p.action_id = h.action_id
    WHERE ${whereSql} ORDER BY h.created_at DESC LIMIT ?
  `).bind(...binds, boundedLimit).all()).results || [];
  return { ok: true, organization_id: organizationId, events: rows };
}

// Part 6 (EXEC-009 evidence) / Decisions Required detail — per-action reopen
// counts, reusing the exact transition-pair convention already established
// in decision-metrics.js's org-wide reopen_count (completed -> in_progress).
export async function getActionReopenCounts(env, organizationId, { minCount = 1 } = {}) {
  const rows = (await env.DB.prepare(`
    SELECT action_id, COUNT(*) as reopen_count FROM action_history
    WHERE organization_id=? AND history_type='status' AND from_value='completed' AND to_value='in_progress'
    GROUP BY action_id HAVING COUNT(*) >= ? ORDER BY reopen_count DESC
  `).bind(organizationId, minCount).all()).results || [];
  return { ok: true, organization_id: organizationId, actions: rows };
}
