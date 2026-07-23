// Program Beta Sprint 1.6, Part 9 — bounded, paginated reconciliation
// between the projection layer and the authoritative write model. Findings
// are recorded, never silently auto-corrected — a human (or a deliberate,
// separate rebuild call) decides what to do with a high-risk drift, this
// sweep only ever detects and reports it.
import { newId } from './auth.js';

const RECONCILIATION_BATCH_SIZE = 50; // organizations per invocation, not Actions — each check below is itself bounded per organization.
const CURRENT_PROJECTION_VERSION = 1;

async function recordFinding(env, { organizationId, projectionType, findingType, subjectId = null, detail = {} }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO projection_reconciliation_findings (id, organization_id, projection_type, finding_type, subject_id, detail_json, detected_at) VALUES (?,?,?,?,?,?,?)`
  ).bind(newId('recon'), organizationId, projectionType, findingType, subjectId, JSON.stringify(detail), now).run();
}

// Part 9's "impossible percentages" check, reused both here and available
// to any read-path that computes a rate from stored counts — a rate
// outside [0,1] indicates a real bug (bad denominator, drifted counters),
// never a value to silently clamp and serve as if valid.
export function isImpossibleRate(rate) {
  return rate !== null && rate !== undefined && Number.isFinite(rate) && (rate < 0 || rate > 1);
}

async function reconcileOrganization(env, organizationId) {
  const findings = [];

  // 1. Action exists but action_summary_projection is missing.
  const missing = (await env.DB.prepare(`
    SELECT m.id FROM management_response_actions m LEFT JOIN action_summary_projection p ON p.action_id = m.id
    WHERE m.organization_id=? AND p.action_id IS NULL LIMIT 20
  `).bind(organizationId).all()).results || [];
  for (const row of missing) { await recordFinding(env, { organizationId, projectionType: 'action-summary', findingType: 'missing_projection', subjectId: row.id }); findings.push('missing_projection'); }

  // 2. Projection exists but the Action no longer exists (defensive — no
  // delete route exists for Actions today, so this should never fire; kept
  // as a real, honest check rather than assumed impossible).
  const orphaned = (await env.DB.prepare(`
    SELECT p.action_id FROM action_summary_projection p LEFT JOIN management_response_actions m ON m.id = p.action_id
    WHERE p.organization_id=? AND m.id IS NULL LIMIT 20
  `).bind(organizationId).all()).results || [];
  for (const row of orphaned) { await recordFinding(env, { organizationId, projectionType: 'action-summary', findingType: 'orphaned_projection', subjectId: row.action_id }); findings.push('orphaned_projection'); }

  // 3/4/5. Projection status/organization/project drift vs the authoritative row.
  const drifted = (await env.DB.prepare(`
    SELECT p.action_id, p.status as p_status, m.status as m_status, p.organization_id as p_org, m.organization_id as m_org, p.project_id as p_project, m.project_id as m_project
    FROM action_summary_projection p JOIN management_response_actions m ON m.id = p.action_id
    WHERE p.organization_id=? AND (p.status != m.status OR p.organization_id != m.organization_id OR IFNULL(p.project_id,'') != IFNULL(m.project_id,''))
    LIMIT 20
  `).bind(organizationId).all()).results || [];
  for (const row of drifted) {
    await recordFinding(env, { organizationId, projectionType: 'action-summary', findingType: 'state_drift', subjectId: row.action_id, detail: { projected_status: row.p_status, actual_status: row.m_status, projected_project: row.p_project, actual_project: row.m_project } });
    findings.push('state_drift');
  }

  // 6. Projection is behind the latest relevant outbox event for that Action.
  const laggingEvents = (await env.DB.prepare(`
    SELECT p.action_id, p.last_event_at, latest.max_occurred_at
    FROM action_summary_projection p
    JOIN (SELECT aggregate_id, MAX(occurred_at) as max_occurred_at FROM domain_event_outbox WHERE aggregate_type='action' GROUP BY aggregate_id) latest ON latest.aggregate_id = p.action_id
    WHERE p.organization_id=? AND (p.last_event_at IS NULL OR p.last_event_at < latest.max_occurred_at)
    LIMIT 20
  `).bind(organizationId).all()).results || [];
  for (const row of laggingEvents) { await recordFinding(env, { organizationId, projectionType: 'action-summary', findingType: 'projection_lag', subjectId: row.action_id, detail: { last_event_at: row.last_event_at, latest_outbox_event_at: row.max_occurred_at } }); findings.push('projection_lag'); }

  // 7. Organization aggregate does not equal its underlying current Action states.
  const actual = await env.DB.prepare('SELECT COUNT(*) as n FROM management_response_actions WHERE organization_id=?').bind(organizationId).first();
  const portfolio = await env.DB.prepare('SELECT total_actions FROM organization_decision_portfolio WHERE organization_id=?').bind(organizationId).first();
  if (portfolio && (actual?.n || 0) !== portfolio.total_actions) {
    await recordFinding(env, { organizationId, projectionType: 'organization-portfolio', findingType: 'aggregate_mismatch', detail: { projected_total: portfolio.total_actions, actual_total: actual?.n || 0 } });
    findings.push('aggregate_mismatch');
  }

  // 9. Negative aggregate counters — a real bug indicator, never expected.
  if (portfolio) {
    const negRow = await env.DB.prepare(`SELECT * FROM organization_decision_portfolio WHERE organization_id=? AND (total_actions<0 OR high_risk_count<0 OR critical_priority_count<0 OR overdue_count<0 OR escalated_count<0 OR awaiting_review_count<0 OR awaiting_verification_count<0 OR completed_count<0 OR verified_count<0 OR cancelled_count<0)`).bind(organizationId).first();
    if (negRow) { await recordFinding(env, { organizationId, projectionType: 'organization-portfolio', findingType: 'negative_counter', detail: { row: negRow } }); findings.push('negative_counter'); }
  }

  // 10. Impossible percentages, computed the same way the read API does.
  if (portfolio) {
    const full = await env.DB.prepare('SELECT completed_count, verified_count, cancelled_count, total_actions FROM organization_decision_portfolio WHERE organization_id=?').bind(organizationId).first();
    const verifDenom = full.completed_count + full.verified_count;
    const compDenom = full.total_actions - full.cancelled_count;
    const verificationRate = verifDenom > 0 ? full.verified_count / verifDenom : null;
    const completionRate = compDenom > 0 ? (full.completed_count + full.verified_count) / compDenom : null;
    if (isImpossibleRate(verificationRate) || isImpossibleRate(completionRate)) {
      await recordFinding(env, { organizationId, projectionType: 'organization-portfolio', findingType: 'impossible_percentage', detail: { verificationRate, completionRate } });
      findings.push('impossible_percentage');
    }
  }

  // 11. Stale projection version.
  const staleVersionRow = await env.DB.prepare('SELECT COUNT(*) as n FROM action_summary_projection WHERE organization_id=? AND projection_version < ?').bind(organizationId, CURRENT_PROJECTION_VERSION).first();
  if ((staleVersionRow?.n || 0) > 0) { await recordFinding(env, { organizationId, projectionType: 'action-summary', findingType: 'stale_projection_version', detail: { stale_count: staleVersionRow.n, current_version: CURRENT_PROJECTION_VERSION } }); findings.push('stale_projection_version'); }

  return findings;
}

// Bounded, paginated across organizations (cursor = last organization_id
// processed) — never a full-database scan in one invocation. Intended to
// be driven by the same 5-minute Cron Trigger as every other sweep in this
// codebase, one page of organizations per tick.
export async function runReconciliationSweep(env, { limit = RECONCILIATION_BATCH_SIZE, cursor = '' } = {}) {
  const orgRows = (await env.DB.prepare('SELECT DISTINCT organization_id FROM management_response_actions WHERE organization_id > ? ORDER BY organization_id LIMIT ?').bind(cursor, limit).all()).results || [];
  let totalFindings = 0;
  for (const row of orgRows) totalFindings += (await reconcileOrganization(env, row.organization_id)).length;
  return { ok: true, organizationsChecked: orgRows.length, findingsRecorded: totalFindings, nextCursor: orgRows.length ? orgRows[orgRows.length - 1].organization_id : null };
}

// Cron-facing entry point: reads this sweep's persisted cursor, processes
// one bounded page, and advances (or wraps back to the start once the
// full organization list has been covered) — this is what makes the
// 5-minute-tick sweep both bounded per invocation AND, over time, complete
// across every organization, without ever scanning the whole table in one go.
export async function runReconciliationSweepTick(env, { limit = RECONCILIATION_BATCH_SIZE } = {}) {
  const state = await env.DB.prepare("SELECT cursor_value FROM projection_sweep_state WHERE sweep_name='reconciliation'").first();
  const cursor = state?.cursor_value || '';
  const result = await runReconciliationSweep(env, { limit, cursor });
  const nextCursor = result.nextCursor || ''; // wrap to the start once a full pass completes
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO projection_sweep_state (sweep_name, cursor_value, updated_at) VALUES ('reconciliation', ?, ?)
    ON CONFLICT(sweep_name) DO UPDATE SET cursor_value=excluded.cursor_value, updated_at=excluded.updated_at
  `).bind(nextCursor, now).run();
  return result;
}

export async function listReconciliationFindings(env, { organizationId, includeResolved = false, limit = 50, offset = 0 }) {
  const clauses = ['organization_id=?'];
  const binds = [organizationId];
  if (!includeResolved) clauses.push('resolved_at IS NULL');
  const sql = `SELECT * FROM projection_reconciliation_findings WHERE ${clauses.join(' AND ')} ORDER BY detected_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
  return { ok: true, findings: rows };
}
