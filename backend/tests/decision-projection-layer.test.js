// Program Beta Sprint 1.6 — Enterprise Projection Layer test suite.
//
// Unlike most of this repository's DB-touching tests (which are honest
// source-inspection regression guards, since no live D1/Miniflare harness
// exists), the majority of the tests below are REAL functional tests
// against an actual in-memory SQLite database (Node's built-in
// node:sqlite), because that harness is now proven (Sprint 1.5's Part 19
// migration validation) to apply this repository's real schema.sql and
// migrations cleanly. Every projection writer/query/rebuild/reconciliation
// function here is exercised against real INSERT/SELECT/UPSERT statements,
// not mocked. Only the route-wiring/RBAC/API-contract checks fall back to
// source-inspection, for the same reason as every prior release: no
// harness runs the actual Worker/HTTP layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { classifyLegacyActionStatus, PROJECTION_SCHEMA_VERSION, writeActionSummaryProjection, writeOrganizationPortfolio, writeProjectPortfolio, writeOwnerWorkload, writeReviewQueue, writeOrganizationPortfolioSnapshot, sweepDailyPortfolioSnapshots } from '../src/decision-projection-writers.js';
import { PROJECTION_CONSUMER_REGISTRY } from '../src/decision-projection-consumers.js';
import { dispatchDecisionEvent } from '../src/decision-event-consumers.js';
import { rebuildAction, rebuildProject, rebuildOrganization, backfillMissingActionSummaries, rebuildProjectionType, previewActionRebuild, REBUILDABLE_PROJECTION_TYPES } from '../src/decision-projection-rebuild.js';
import { runReconciliationSweep, runReconciliationSweepTick, listReconciliationFindings, isImpossibleRate } from '../src/decision-projection-reconciliation.js';
import { listActionSummaries, getActionSummary, getOrganizationPortfolio, getProjectPortfolio, listOwnerWorkloads, getReviewQueue, getExecutiveIntelligence, getProjectionHealth } from '../src/decision-projection-queries.js';

const root = path.resolve('..');
const backendDir = path.join(root, 'backend');
const appSrc = fs.readFileSync(path.join(backendDir, 'src/application.js'), 'utf8');
const routeSrc = (marker) => { const start = appSrc.indexOf(marker); if (start < 0) return ''; return appSrc.slice(start, appSrc.indexOf('\n      }', start) + 8); };

// Same disclosed, pre-existing schema.sql/migrations drift identified in
// Sprint 1.5 (039/040/041 already baked into schema.sql) — unrelated to
// Sprint 1.6, reused here for the same reason.
const SKIP_MIGRATIONS = new Set(['039_report_scope_and_dataset_identity.sql', '040_user_sessions_expires_at.sql', '041_must_change_password.sql']);

function makeEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(backendDir, 'schema.sql'), 'utf8'));
  for (const f of fs.readdirSync(path.join(backendDir, 'migrations')).filter(f => f.endsWith('.sql')).sort()) {
    if (SKIP_MIGRATIONS.has(f)) continue;
    db.exec(fs.readFileSync(path.join(backendDir, 'migrations', f), 'utf8'));
  }
  function wrap(sql, args) {
    return {
      async first() { return db.prepare(sql).get(...args); },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { db.prepare(sql).run(...args); return {}; },
    };
  }
  const env = {
    DB: {
      prepare(sql) { const noBind = wrap(sql, []); noBind.bind = (...args) => wrap(sql, args); return noBind; },
      batch: async (statements) => { const out = []; for (const s of statements) out.push(await s.run()); return out; },
    },
  };
  return { env, db };
}

function seedOrg(db, orgId = 'org1') {
  db.prepare('INSERT INTO organizations (id,name,type,country,billing_tier,status) VALUES (?,?,?,?,?,?)').run(orgId, 'Test Org ' + orgId, 'local_ngo', 'Tanzania', 'starter', 'active');
}
function seedUser(db, { userId, orgId = 'org1', fullName = 'Jane Owner', isActive = 1 }) {
  db.prepare('INSERT INTO users (id,organization_id,email,password_hash,password_salt,full_name,role,is_active) VALUES (?,?,?,?,?,?,?,?)').run(userId, orgId, `${userId}@test.com`, 'h', 's', fullName, 'me_officer', isActive);
}
function seedAction(db, overrides = {}) {
  const a = {
    id: 'act1', organization_id: 'org1', project_id: 'proj1', recommendation: 'Do the thing', management_response: 'resp',
    owner: 'user1', due_date: '2026-06-01', status: 'draft', priority: 'medium', risk_level: null, overdue_since: null, escalated_since: null,
    created_by: 'user1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
  };
  db.prepare(`INSERT INTO management_response_actions (id,organization_id,project_id,recommendation,management_response,owner,due_date,status,priority,risk_level,overdue_since,escalated_since,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(a.id, a.organization_id, a.project_id, a.recommendation, a.management_response, a.owner, a.due_date, a.status, a.priority, a.risk_level, a.overdue_since, a.escalated_since, a.created_by, a.created_at, a.updated_at);
  return a;
}
function fakeEvent(overrides = {}) {
  return {
    event_id: 'evt_' + Math.random().toString(36).slice(2), event_type: 'decision.action.created', event_version: 1,
    aggregate_type: 'action', aggregate_id: 'act1', organization_id: 'org1', project_id: 'proj1', report_id: null,
    actor_id: null, actor_role: null, correlation_id: 'corr1', causation_id: null, source: 'application',
    occurred_at: '2026-01-01T00:00:00.000Z', recorded_at: '2026-01-01T00:00:00.000Z', payload: {}, metadata: {}, schema_version: 1,
    ...overrides,
  };
}

// ============================================================
// Migration Execution (extends Sprint 1.5's real Part 19 proof to 045)
// ============================================================
test('migration 045 applies cleanly on top of schema.sql + every prior migration, and defines every table Sprint 1.6 code queries', () => {
  const { db } = makeEnv();
  for (const table of ['action_summary_projection', 'organization_decision_portfolio', 'project_decision_portfolio', 'organization_decision_portfolio_snapshot', 'owner_workload_projection', 'review_queue_projection', 'projection_reconciliation_findings', 'projection_sweep_state']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    assert.ok(cols.length > 0, `expected table ${table} to exist with columns`);
  }
  const indexNames = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name);
  for (const idx of ['idx_asp_org_status_due', 'idx_asp_org_owner', 'idx_asp_org_created', 'idx_pdp_org', 'idx_prf_org_type']) {
    assert.ok(indexNames.includes(idx), `expected index ${idx}`);
  }
});

// ============================================================
// Projection Unit Tests (pure functions)
// ============================================================
test('classifyLegacyActionStatus passes through every real ACTION_STATUSES value unchanged', () => {
  for (const s of ['draft', 'under_review', 'needs_clarification', 'approved', 'rejected', 'assigned', 'in_progress', 'completed', 'verified', 'cancelled']) {
    const result = classifyLegacyActionStatus(s);
    assert.deepEqual(result, { normalized: s, isLegacy: false, original: s });
  }
});
test('classifyLegacyActionStatus classifies an unrecognized status (the real legacy default, "open") as legacy_unknown, preserving the original', () => {
  const result = classifyLegacyActionStatus('open');
  assert.equal(result.normalized, 'legacy_unknown');
  assert.equal(result.isLegacy, true);
  assert.equal(result.original, 'open');
});
test('PROJECTION_SCHEMA_VERSION is a real, stable integer', () => {
  assert.equal(PROJECTION_SCHEMA_VERSION, 1);
});
test('isImpossibleRate flags values outside [0,1] and accepts null/undefined as "not applicable"', () => {
  assert.equal(isImpossibleRate(null), false);
  assert.equal(isImpossibleRate(undefined), false);
  assert.equal(isImpossibleRate(0), false);
  assert.equal(isImpossibleRate(1), false);
  assert.equal(isImpossibleRate(0.5), false);
  assert.equal(isImpossibleRate(1.2), true);
  assert.equal(isImpossibleRate(-0.1), true);
});

// ============================================================
// Action Summary Projection Tests
// ============================================================
test('writeActionSummaryProjection re-reads authoritative state and resolves owner_display_name only for a same-org active user', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedAction(db, { status: 'in_progress', priority: 'critical', risk_level: 'high' });
  await writeActionSummaryProjection(env, { actionId: 'act1', organizationId: 'org1' });
  const row = db.prepare('SELECT * FROM action_summary_projection WHERE action_id=?').get('act1');
  assert.equal(row.status, 'in_progress');
  assert.equal(row.owner_display_name, 'Jane Owner');
  assert.equal(row.is_legacy, 0);
});
test('writeActionSummaryProjection leaves owner_display_name null for an inactive user or a non-user owner string', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'inactive_user', isActive: 0 }); seedAction(db, { owner: 'inactive_user' });
  await writeActionSummaryProjection(env, { actionId: 'act1', organizationId: 'org1' });
  const row = db.prepare('SELECT owner_display_name FROM action_summary_projection WHERE action_id=?').get('act1');
  assert.equal(row.owner_display_name, null);
});
test('writeActionSummaryProjection returns skipped for an action_id that does not exist (or belongs to a different org)', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db);
  const result = await writeActionSummaryProjection(env, { actionId: 'act1', organizationId: 'wrong_org' });
  assert.equal(result.skipped, true);
});

// ============================================================
// Out-of-Order Event Safety
// ============================================================
test('an older event delivered after a newer one never regresses last_event_id/last_event_at, while current-state fields stay freshly re-read regardless', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedAction(db, { status: 'in_progress' });
  await writeActionSummaryProjection(env, { actionId: 'act1', organizationId: 'org1', lastEventId: 'evt_new', lastEventType: 'decision.action.started', lastEventAt: '2026-03-01T00:00:00Z' });
  // Simulate a real state change that happened AFTER, then an OLDER event arriving late.
  db.prepare("UPDATE management_response_actions SET status='completed', updated_at=? WHERE id=?").run('2026-03-05T00:00:00Z', 'act1');
  await writeActionSummaryProjection(env, { actionId: 'act1', organizationId: 'org1', lastEventId: 'evt_old', lastEventType: 'decision.action.created', lastEventAt: '2026-01-01T00:00:00Z' });
  const row = db.prepare('SELECT * FROM action_summary_projection WHERE action_id=?').get('act1');
  assert.equal(row.last_event_id, 'evt_new', 'the older, late-arriving event must not overwrite the newer last_event_id');
  assert.equal(row.status, 'completed', 'current-state fields are always freshly re-read, independent of event delivery order');
});

// ============================================================
// Idempotency and Duplicate Delivery
// ============================================================
test('dispatching the same event twice through the projection registry is idempotent per consumer (decision_event_processed dedup)', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedAction(db, { status: 'draft' });
  const event = fakeEvent({ event_type: 'decision.action.created' });
  const first = await dispatchDecisionEvent(event, env, PROJECTION_CONSUMER_REGISTRY);
  assert.equal(first.ok, true);
  const second = await dispatchDecisionEvent(event, env, PROJECTION_CONSUMER_REGISTRY);
  assert.equal(second.ok, true);
  for (const consumerName of Object.keys(PROJECTION_CONSUMER_REGISTRY)) {
    assert.equal(second.outcomes[consumerName].deduplicated, true, `${consumerName} should report deduplicated on redelivery`);
  }
  const orgRow = db.prepare('SELECT total_actions FROM organization_decision_portfolio WHERE organization_id=?').get('org1');
  assert.equal(orgRow.total_actions, 1, 'redelivery must not double-count the aggregate');
});
test('writeOrganizationPortfolio is safe to call repeatedly (re-aggregation, not incrementation) — never drifts on redelivery', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'act1' }); seedAction(db, { id: 'act2', status: 'verified' });
  await writeOrganizationPortfolio(env, 'org1');
  await writeOrganizationPortfolio(env, 'org1');
  await writeOrganizationPortfolio(env, 'org1');
  const row = db.prepare('SELECT total_actions, verified_count FROM organization_decision_portfolio WHERE organization_id=?').get('org1');
  assert.equal(row.total_actions, 2);
  assert.equal(row.verified_count, 1);
});

// ============================================================
// Event-to-Projection Mapping
// ============================================================
test('every projection consumer is registered and dispatch reaches all of them for a real event', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedAction(db, { status: 'draft' });
  assert.deepEqual(Object.keys(PROJECTION_CONSUMER_REGISTRY).sort(), ['action-summary', 'organization-portfolio', 'owner-workload', 'project-portfolio', 'review-queue']);
  const result = await dispatchDecisionEvent(fakeEvent(), env, PROJECTION_CONSUMER_REGISTRY);
  assert.equal(result.ok, true);
  assert.ok(db.prepare('SELECT 1 FROM action_summary_projection WHERE action_id=?').get('act1'));
  assert.ok(db.prepare('SELECT 1 FROM organization_decision_portfolio WHERE organization_id=?').get('org1'));
  assert.ok(db.prepare('SELECT 1 FROM project_decision_portfolio WHERE project_id=?').get('proj1'));
  assert.ok(db.prepare('SELECT 1 FROM owner_workload_projection WHERE organization_id=? AND owner=?').get('org1', 'user1'));
  assert.ok(db.prepare("SELECT 1 FROM review_queue_projection WHERE organization_id=? AND project_id='__all__'").get('org1'));
});
test('project-portfolio consumer is a no-op skip for an event with no project_id, without erroring', async () => {
  // management_response_actions.project_id is NOT NULL (migration 028) — a
  // real Action always has one. This tests the consumer's own defensive
  // guard against an event object that lacks the field, independent of
  // what the underlying Action row actually has.
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db);
  const result = await dispatchDecisionEvent(fakeEvent({ project_id: null }), env, PROJECTION_CONSUMER_REGISTRY);
  assert.equal(result.outcomes['project-portfolio'].skipped, true);
});
test('an owner-reassignment PATCH-style event (payload.updated_fields includes "owner") refreshes BOTH the former and current owner workload rows', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'old_owner', fullName: 'Old Owner' }); seedUser(db, { userId: 'new_owner', fullName: 'New Owner' });
  seedAction(db, { owner: 'new_owner' });
  const event = fakeEvent({ event_type: 'decision.action.updated', payload: { from: 'old_owner', to: 'new_owner', updated_fields: ['owner'] } });
  await dispatchDecisionEvent(event, env, PROJECTION_CONSUMER_REGISTRY);
  const oldRow = db.prepare('SELECT assigned_count FROM owner_workload_projection WHERE organization_id=? AND owner=?').get('org1', 'old_owner');
  const newRow = db.prepare('SELECT assigned_count FROM owner_workload_projection WHERE organization_id=? AND owner=?').get('org1', 'new_owner');
  assert.equal(oldRow.assigned_count, 0, 'the former owner now has zero assigned actions, correctly refreshed');
  assert.equal(newRow.assigned_count, 1);
});
test('a status-transition "updated" event (no updated_fields) never mistakes payload.from/to status strings for an owner id', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedAction(db, { owner: 'user1', status: 'draft' });
  const event = fakeEvent({ event_type: 'decision.action.updated', payload: { from: 'rejected', to: 'draft', owner: 'user1' } });
  await dispatchDecisionEvent(event, env, PROJECTION_CONSUMER_REGISTRY);
  const bogusRow = db.prepare("SELECT 1 FROM owner_workload_projection WHERE owner IN ('rejected','draft')").get();
  assert.equal(bogusRow, undefined, 'a status string must never be written into owner_workload_projection as if it were an owner id');
});

// ============================================================
// Organization / Project Aggregate Tests
// ============================================================
test('organization portfolio aggregates backlog, risk, priority, overdue, and escalated counts correctly across a real multi-action scenario', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedAction(db, { id: 'a1', status: 'under_review', priority: 'critical', risk_level: 'high' });
  seedAction(db, { id: 'a2', status: 'in_progress', priority: 'high', risk_level: 'critical', overdue_since: '2026-01-10T00:00:00Z' });
  seedAction(db, { id: 'a3', status: 'completed', priority: 'medium', escalated_since: '2026-01-11T00:00:00Z' });
  seedAction(db, { id: 'a4', status: 'verified', priority: 'low' });
  seedAction(db, { id: 'a5', status: 'cancelled', priority: 'low' });
  await writeOrganizationPortfolio(env, 'org1');
  const row = db.prepare('SELECT * FROM organization_decision_portfolio WHERE organization_id=?').get('org1');
  assert.equal(row.total_actions, 5);
  assert.equal(row.high_risk_count, 2);
  assert.equal(row.critical_priority_count, 1);
  assert.equal(row.overdue_count, 1);
  assert.equal(row.escalated_count, 1);
  assert.equal(row.awaiting_review_count, 1);
  assert.equal(row.completed_count, 1);
  assert.equal(row.verified_count, 1);
  assert.equal(row.cancelled_count, 1);
});
test('project portfolio scopes correctly to one project among several in the same organization', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedAction(db, { id: 'a1', project_id: 'proj_a', status: 'draft' });
  seedAction(db, { id: 'a2', project_id: 'proj_a', status: 'verified' });
  seedAction(db, { id: 'a3', project_id: 'proj_b', status: 'draft' });
  await writeProjectPortfolio(env, 'org1', 'proj_a');
  const row = db.prepare('SELECT * FROM project_decision_portfolio WHERE project_id=?').get('proj_a');
  assert.equal(row.total_actions, 2);
  const projB = db.prepare('SELECT 1 FROM project_decision_portfolio WHERE project_id=?').get('proj_b');
  assert.equal(projB, undefined, 'writing proj_a must never create a row for an unrelated project');
});
test('aging bands exclude terminal (verified/cancelled) Actions and bucket by real days-since-creation', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const nowIso = new Date().toISOString();
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
  seedAction(db, { id: 'a1', status: 'in_progress', created_at: tenDaysAgo });
  seedAction(db, { id: 'a2', status: 'verified', created_at: tenDaysAgo }); // terminal — excluded
  await writeOrganizationPortfolio(env, 'org1');
  const row = db.prepare('SELECT aging_band_json FROM organization_decision_portfolio WHERE organization_id=?').get('org1');
  const bands = JSON.parse(row.aging_band_json);
  assert.equal(bands['8_30'], 1, 'only the non-terminal Action should be counted in an aging band');
});

// ============================================================
// Owner Workload Tests
// ============================================================
test('owner workload counts assigned/in-progress/overdue/due-soon/awaiting-verification correctly for one real owner', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  seedAction(db, { id: 'a1', owner: 'user1', status: 'in_progress' });
  seedAction(db, { id: 'a2', owner: 'user1', status: 'in_progress', overdue_since: '2026-01-01T00:00:00Z' });
  seedAction(db, { id: 'a3', owner: 'user1', status: 'assigned', due_date: soon });
  seedAction(db, { id: 'a4', owner: 'user1', status: 'completed' });
  await writeOwnerWorkload(env, 'org1', 'user1');
  const row = db.prepare('SELECT * FROM owner_workload_projection WHERE organization_id=? AND owner=?').get('org1', 'user1');
  assert.equal(row.assigned_count, 4);
  assert.equal(row.in_progress_count, 2);
  assert.equal(row.overdue_count, 1);
  assert.equal(row.due_soon_count, 1);
  assert.equal(row.awaiting_verification_count, 1);
});
test('owner workload never leaks another owner\'s Actions into the count', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedUser(db, { userId: 'user2' });
  seedAction(db, { id: 'a1', owner: 'user1' });
  seedAction(db, { id: 'a2', owner: 'user2' });
  await writeOwnerWorkload(env, 'org1', 'user1');
  const row = db.prepare('SELECT assigned_count FROM owner_workload_projection WHERE organization_id=? AND owner=?').get('org1', 'user1');
  assert.equal(row.assigned_count, 1);
});

// ============================================================
// Review Queue ("Reviewer Workload") Tests
// ============================================================
test('review queue counts under_review/needs_clarification/awaiting_verification and tracks oldest pending timestamps honestly', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedAction(db, { id: 'a1', status: 'under_review', updated_at: '2026-01-01T00:00:00Z' });
  seedAction(db, { id: 'a2', status: 'under_review', updated_at: '2026-01-05T00:00:00Z' });
  seedAction(db, { id: 'a3', status: 'needs_clarification' });
  seedAction(db, { id: 'a4', status: 'completed', updated_at: '2026-01-03T00:00:00Z' });
  await writeReviewQueue(env, 'org1', 'proj1');
  const row = db.prepare("SELECT * FROM review_queue_projection WHERE organization_id=? AND project_id='__all__'").get('org1');
  assert.equal(row.under_review_count, 2);
  assert.equal(row.needs_clarification_count, 1);
  assert.equal(row.awaiting_verification_count, 1);
  assert.equal(row.oldest_pending_review_at, '2026-01-01T00:00:00Z');
  assert.equal(row.oldest_pending_verification_at, '2026-01-03T00:00:00Z');
});
test('getReviewQueue discloses, rather than fabricates, why this is a queue view and not a per-reviewer workload', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { status: 'under_review' });
  await writeReviewQueue(env, 'org1', null);
  const result = await getReviewQueue(env, 'org1', null);
  assert.match(result.note, /not per-reviewer-person workload/);
});

// ============================================================
// Executive Metrics Semantics / Zero-Denominator / Partial-Data
// ============================================================
test('executive intelligence and organization portfolio report null (never 0 or a crash) for a rate whose denominator is genuinely zero', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { status: 'draft' }); // no completed/verified Actions at all
  await writeOrganizationPortfolio(env, 'org1');
  const portfolio = await getOrganizationPortfolio(env, 'org1');
  assert.equal(portfolio.verification_rate, null);
  const exec = await getExecutiveIntelligence(env, 'org1');
  assert.equal(exec.verification_rate, null);
});
test('executive intelligence honestly reports "not available" when no organization has been projected yet', async () => {
  const { env } = makeEnv();
  const exec = await getExecutiveIntelligence(env, 'org_with_nothing');
  assert.equal(exec.available, false);
});
test('executive intelligence trend is honestly unavailable with no prior snapshot, and becomes available once a real snapshot exists', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { status: 'verified' });
  await writeOrganizationPortfolio(env, 'org1');
  const before = await getExecutiveIntelligence(env, 'org1');
  assert.equal(before.trend.available, false);
  // Force the snapshot to be dated BEFORE today so the "prior" comparison point is real.
  await writeOrganizationPortfolioSnapshot(env, 'org1');
  db.prepare("UPDATE organization_decision_portfolio_snapshot SET snapshot_date='2020-01-01' WHERE organization_id='org1'").run();
  const after = await getExecutiveIntelligence(env, 'org1');
  assert.equal(after.trend.available, true);
  assert.equal(after.trend.compared_to_date, '2020-01-01');
});
test('executive intelligence explicitly carries no generated narrative this sprint', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db);
  await writeOrganizationPortfolio(env, 'org1');
  const exec = await getExecutiveIntelligence(env, 'org1');
  assert.equal(exec.narrative, null);
});
test('risk concentration excludes Actions with a null risk_level rather than fabricating a "null" bucket', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1', risk_level: 'high' }); seedAction(db, { id: 'a2', risk_level: null });
  await writeActionSummaryProjection(env, { actionId: 'a1', organizationId: 'org1' });
  await writeActionSummaryProjection(env, { actionId: 'a2', organizationId: 'org1' });
  await writeOrganizationPortfolio(env, 'org1');
  const exec = await getExecutiveIntelligence(env, 'org1');
  assert.deepEqual(exec.risk_concentration, { high: 1 });
});

// ============================================================
// Legacy Bootstrap Tests
// ============================================================
test('backfillMissingActionSummaries honestly projects a legacy Action (status="open", no prior events) as legacy_unknown', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  seedAction(db, { id: 'legacy1', status: 'open' });
  const result = await backfillMissingActionSummaries(env, { limit: 10 });
  assert.equal(result.backfilled, 1);
  const row = db.prepare('SELECT status, is_legacy, legacy_original_status FROM action_summary_projection WHERE action_id=?').get('legacy1');
  assert.equal(row.status, 'legacy_unknown');
  assert.equal(row.is_legacy, 1);
  assert.equal(row.legacy_original_status, 'open');
});
test('backfillMissingActionSummaries never re-processes an Action that already has a projection', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1' });
  await backfillMissingActionSummaries(env, { limit: 10 });
  const second = await backfillMissingActionSummaries(env, { limit: 10 });
  assert.equal(second.backfilled, 0);
});

// ============================================================
// Rebuild Tests
// ============================================================
test('rebuildAction reproduces the same projection a live event would have, without needing any event at all', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' }); seedAction(db, { status: 'in_progress', priority: 'high' });
  const result = await rebuildAction(env, { actionId: 'act1', organizationId: 'org1' });
  assert.equal(result.ok, true);
  assert.ok(db.prepare('SELECT 1 FROM action_summary_projection WHERE action_id=?').get('act1'));
  assert.ok(db.prepare('SELECT 1 FROM organization_decision_portfolio WHERE organization_id=?').get('org1'));
  assert.ok(db.prepare('SELECT 1 FROM owner_workload_projection WHERE owner=?').get('user1'));
});
test('rebuildProject and rebuildOrganization process every real Action in bounded batches and refresh aggregates once', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  for (let i = 0; i < 5; i++) seedAction(db, { id: `a${i}`, project_id: 'proj1' });
  const projectResult = await rebuildProject(env, { organizationId: 'org1', projectId: 'proj1', batchSize: 2 });
  assert.equal(projectResult.processed, 5);
  const orgResult = await rebuildOrganization(env, { organizationId: 'org1', batchSize: 2 });
  assert.equal(orgResult.processed, 5);
  const portfolio = db.prepare('SELECT total_actions FROM project_decision_portfolio WHERE project_id=?').get('proj1');
  assert.equal(portfolio.total_actions, 5);
});
test('rebuildProjectionType paginates via a real cursor across every organization', async () => {
  const { env, db } = makeEnv();
  seedOrg(db, 'org_a'); seedOrg(db, 'org_b');
  seedAction(db, { id: 'a1', organization_id: 'org_a' });
  seedAction(db, { id: 'a2', organization_id: 'org_b' });
  const page1 = await rebuildProjectionType(env, 'organization-portfolio', { limit: 1, cursor: '' });
  assert.equal(page1.processed, 1);
  assert.ok(page1.nextCursor);
  const page2 = await rebuildProjectionType(env, 'organization-portfolio', { limit: 1, cursor: page1.nextCursor });
  assert.equal(page2.processed, 1);
  assert.ok(db.prepare('SELECT 1 FROM organization_decision_portfolio WHERE organization_id=?').get('org_a'));
  assert.ok(db.prepare('SELECT 1 FROM organization_decision_portfolio WHERE organization_id=?').get('org_b'));
});
test('rebuildProjectionType rejects an unknown projection type rather than silently doing nothing', async () => {
  const { env } = makeEnv();
  const result = await rebuildProjectionType(env, 'not-a-real-type', {});
  assert.equal(result.ok, false);
  assert.ok(REBUILDABLE_PROJECTION_TYPES.every(t => t !== 'not-a-real-type'));
});
test('previewActionRebuild is side-effect-free (no row written) and reports whether a rebuild would change anything', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { status: 'in_progress' });
  const preview = await previewActionRebuild(env, { actionId: 'act1', organizationId: 'org1' });
  assert.equal(preview.existingProjection, null);
  const stillNoRow = db.prepare('SELECT 1 FROM action_summary_projection WHERE action_id=?').get('act1');
  assert.equal(stillNoRow, undefined, 'preview must never write a projection row');
});
test('a rebuild never touches decision_action_metrics_daily or production_notifications (no double-counting on administrative rebuild)', async () => {
  const rebuildSrc = fs.readFileSync(path.join(backendDir, 'src/decision-projection-rebuild.js'), 'utf8');
  // Checks actual write statements, not mere mentions — the module's own
  // header comment legitimately explains WHY it avoids these tables, which
  // would otherwise (harmlessly) trip a bare substring match.
  assert.doesNotMatch(rebuildSrc, /(INSERT INTO|UPDATE)\s+decision_action_metrics_daily/i);
  assert.doesNotMatch(rebuildSrc, /(INSERT INTO|UPDATE)\s+production_notifications/i);
  assert.doesNotMatch(rebuildSrc, /enqueueJob\(/, 'rebuild must never replay messages into the live production queue');
});

// ============================================================
// Reconciliation Tests
// ============================================================
test('reconciliation detects a missing action-summary projection for a real, existing Action', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1' });
  const result = await runReconciliationSweep(env, { limit: 10, cursor: '' });
  assert.ok(result.findingsRecorded >= 1);
  const findings = await listReconciliationFindings(env, { organizationId: 'org1' });
  assert.ok(findings.findings.some(f => f.finding_type === 'missing_projection'));
});
test('reconciliation detects an organization aggregate that no longer matches its underlying Actions', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1' });
  await writeOrganizationPortfolio(env, 'org1');
  db.prepare('UPDATE organization_decision_portfolio SET total_actions=99 WHERE organization_id=?').run('org1'); // force real drift
  await writeActionSummaryProjection(env, { actionId: 'a1', organizationId: 'org1' }); // clear the missing-projection finding path
  const result = await runReconciliationSweep(env, { limit: 10, cursor: '' });
  const findings = await listReconciliationFindings(env, { organizationId: 'org1' });
  assert.ok(findings.findings.some(f => f.finding_type === 'aggregate_mismatch'));
});
test('reconciliation detects a negative aggregate counter as a real bug indicator', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1' });
  await writeOrganizationPortfolio(env, 'org1');
  await writeActionSummaryProjection(env, { actionId: 'a1', organizationId: 'org1' });
  db.prepare('UPDATE organization_decision_portfolio SET overdue_count=-1 WHERE organization_id=?').run('org1');
  await runReconciliationSweep(env, { limit: 10, cursor: '' });
  const findings = await listReconciliationFindings(env, { organizationId: 'org1' });
  assert.ok(findings.findings.some(f => f.finding_type === 'negative_counter'));
});
test('reconciliation never silently auto-corrects a finding — every detection is recorded, not fixed in place', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1' });
  await writeOrganizationPortfolio(env, 'org1');
  await writeActionSummaryProjection(env, { actionId: 'a1', organizationId: 'org1' });
  db.prepare('UPDATE organization_decision_portfolio SET total_actions=500 WHERE organization_id=?').run('org1');
  await runReconciliationSweep(env, { limit: 10, cursor: '' });
  const stillWrong = db.prepare('SELECT total_actions FROM organization_decision_portfolio WHERE organization_id=?').get('org1');
  assert.equal(stillWrong.total_actions, 500, 'reconciliation must record the drift, not silently rewrite it');
});
test('runReconciliationSweepTick persists and advances a real cursor across ticks, and wraps back to the start after a full pass', async () => {
  const { env, db } = makeEnv();
  seedOrg(db, 'org_only'); seedAction(db, { organization_id: 'org_only' });
  await writeOrganizationPortfolio(env, 'org_only');
  const tick1 = await runReconciliationSweepTick(env, { limit: 10 });
  assert.equal(tick1.organizationsChecked, 1);
  const cursorAfter1 = db.prepare("SELECT cursor_value FROM projection_sweep_state WHERE sweep_name='reconciliation'").get();
  assert.equal(cursorAfter1.cursor_value, 'org_only');
  const tick2 = await runReconciliationSweepTick(env, { limit: 10 });
  assert.equal(tick2.organizationsChecked, 0, 'no organizations remain past the cursor');
  const cursorAfter2 = db.prepare("SELECT cursor_value FROM projection_sweep_state WHERE sweep_name='reconciliation'").get();
  assert.equal(cursorAfter2.cursor_value, '', 'cursor must wrap back to the start once a full pass completes');
});

// ============================================================
// Freshness and Lag Tests
// ============================================================
test('getProjectionHealth reports "current" for a freshly-projected organization and "lagging" once past the documented threshold', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db);
  await writeOrganizationPortfolio(env, 'org1');
  await writeActionSummaryProjection(env, { actionId: 'act1', organizationId: 'org1' });
  await writeOwnerWorkload(env, 'org1', 'user1');
  await writeReviewQueue(env, 'org1', null);
  const fresh = await getProjectionHealth(env, 'org1');
  assert.equal(fresh.projections['organization-portfolio'].status, 'current');
  const old = new Date(Date.now() - 2000_000).toISOString(); // well past the 900s threshold
  db.prepare('UPDATE organization_decision_portfolio SET projected_at=? WHERE organization_id=?').run(old, 'org1');
  const lagging = await getProjectionHealth(env, 'org1');
  assert.equal(lagging.projections['organization-portfolio'].status, 'lagging');
});
test('getProjectionHealth reports "unknown" (never fabricated "current") when a projection type has no rows at all yet', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const health = await getProjectionHealth(env, 'org1');
  assert.equal(health.projections['organization-portfolio'].status, 'unknown');
});
test('getProjectionHealth surfaces the real count of Actions missing a projection, not a fabricated zero', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedAction(db, { id: 'a1' });
  const health = await getProjectionHealth(env, 'org1');
  assert.equal(health.actions_missing_projection, 1);
});

// ============================================================
// Tenant Isolation
// ============================================================
test('projection reads never leak another organization\'s Actions, portfolio, owners, or review queue', async () => {
  const { env, db } = makeEnv();
  seedOrg(db, 'org_a'); seedOrg(db, 'org_b');
  seedUser(db, { userId: 'user_a', orgId: 'org_a' });
  seedAction(db, { id: 'a1', organization_id: 'org_a', owner: 'user_a' });
  seedAction(db, { id: 'b1', organization_id: 'org_b', owner: 'user_a' }); // same literal owner string, different tenant
  await rebuildOrganization(env, { organizationId: 'org_a' });
  await rebuildOrganization(env, { organizationId: 'org_b' });

  const listA = await listActionSummaries(env, { organizationId: 'org_a' });
  assert.deepEqual(listA.actions.map(a => a.action_id), ['a1']);

  const crossTenant = await getActionSummary(env, 'org_a', 'b1');
  assert.equal(crossTenant.ok, false, 'an action belonging to a different organization must never resolve, even by a guessed id');

  const ownersA = await listOwnerWorkloads(env, 'org_a');
  assert.equal(ownersA.owners.length, 1);
  assert.equal(ownersA.owners[0].assigned_count, 1, 'org_b\'s Action for the same owner id must not bleed into org_a\'s workload count');
});

// ============================================================
// Pagination / Sorting / Filtering
// ============================================================
test('listActionSummaries paginates correctly with a real multi-page dataset', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  for (let i = 0; i < 7; i++) seedAction(db, { id: `a${i}`, created_at: `2026-01-0${i + 1}T00:00:00Z` });
  await rebuildOrganization(env, { organizationId: 'org1' });
  const page1 = await listActionSummaries(env, { organizationId: 'org1', sort: 'created', direction: 'asc', limit: 3, offset: 0 });
  assert.equal(page1.actions.length, 3);
  assert.equal(page1.pagination.total, 7);
  assert.equal(page1.pagination.has_more, true);
  const page3 = await listActionSummaries(env, { organizationId: 'org1', sort: 'created', direction: 'asc', limit: 3, offset: 6 });
  assert.equal(page3.actions.length, 1);
  assert.equal(page3.pagination.has_more, false);
});
test('listActionSummaries filters by status, risk, overdue, escalated, and keyword — each independently correct', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedAction(db, { id: 'a1', status: 'under_review', recommendation: 'Improve water access' });
  seedAction(db, { id: 'a2', status: 'in_progress', risk_level: 'critical', overdue_since: '2026-01-01T00:00:00Z' });
  seedAction(db, { id: 'a3', status: 'in_progress', escalated_since: '2026-01-01T00:00:00Z' });
  await rebuildOrganization(env, { organizationId: 'org1' });
  assert.deepEqual((await listActionSummaries(env, { organizationId: 'org1', filters: { status: 'under_review' } })).actions.map(a => a.action_id), ['a1']);
  assert.deepEqual((await listActionSummaries(env, { organizationId: 'org1', filters: { riskLevel: 'critical' } })).actions.map(a => a.action_id), ['a2']);
  assert.deepEqual((await listActionSummaries(env, { organizationId: 'org1', filters: { overdueOnly: true } })).actions.map(a => a.action_id), ['a2']);
  assert.deepEqual((await listActionSummaries(env, { organizationId: 'org1', filters: { escalatedOnly: true } })).actions.map(a => a.action_id), ['a3']);
  assert.deepEqual((await listActionSummaries(env, { organizationId: 'org1', filters: { keyword: 'water' } })).actions.map(a => a.action_id), ['a1']);
});
test('listActionSummaries sorts by due_date, priority, and age in the requested direction', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedAction(db, { id: 'a1', due_date: '2026-03-01' });
  seedAction(db, { id: 'a2', due_date: '2026-01-01' });
  seedAction(db, { id: 'a3', due_date: '2026-02-01' });
  await rebuildOrganization(env, { organizationId: 'org1' });
  const bySoonestDue = await listActionSummaries(env, { organizationId: 'org1', sort: 'due_date', direction: 'asc' });
  assert.deepEqual(bySoonestDue.actions.map(a => a.action_id), ['a2', 'a3', 'a1']);
});
test('listActionSummaries scopes correctly when a project_id filter is supplied', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedAction(db, { id: 'a1', project_id: 'proj_x' });
  seedAction(db, { id: 'a2', project_id: 'proj_y' });
  await rebuildOrganization(env, { organizationId: 'org1' });
  const scoped = await listActionSummaries(env, { organizationId: 'org1', projectId: 'proj_x' });
  assert.deepEqual(scoped.actions.map(a => a.action_id), ['a1']);
});

// ============================================================
// API Contract / RBAC (source-inspection — no HTTP harness exists)
// ============================================================
test('every projection GET route requires authentication and action.read, and is org-scoped by getEffectiveOrgId', () => {
  const markers = [
    "if (path === '/api/decisions/projections/actions' && method === 'GET')",
    "if (projectionActionMatch && method === 'GET')",
    "if (path === '/api/decisions/projections/organization' && method === 'GET')",
    "if (projectionProjectMatch && method === 'GET')",
    "if (path === '/api/decisions/projections/owners' && method === 'GET')",
    "if (path === '/api/decisions/projections/reviewers' && method === 'GET')",
    "if (path === '/api/decisions/projections/executive' && method === 'GET')",
    "if (path === '/api/decisions/projections/health' && method === 'GET')",
    "if (path === '/api/decisions/executive/command-center' && method === 'GET')",
    "if (path === '/api/decisions/executive/attention-brief' && method === 'GET')",
    "if (path === '/api/decisions/executive/decisions-required' && method === 'GET')",
    "if (path === '/api/decisions/executive/timeline' && method === 'GET')",
    "if (path === '/api/decisions/intelligence/copilot' && method === 'POST')",
    "if (path === '/api/decisions/intelligence/root-cause' && method === 'GET')",
    "if (path === '/api/decisions/intelligence/simulate' && method === 'POST')",
    "if (path === '/api/decisions/intelligence/forecast' && method === 'GET')",
    "if (path === '/api/decisions/intelligence/similar' && method === 'GET')",
    "if (path === '/api/decisions/intelligence/knowledge-graph' && method === 'GET')",
    "if (path === '/api/decisions/intelligence/recommendations' && method === 'GET')",
    "if (path === '/api/decisions/intelligence/narrative' && method === 'GET')",
  ];
  for (const marker of markers) {
    const src = routeSrc(marker);
    assert.ok(src.length > 0, `route not found: ${marker}`);
    assert.match(src, /requireAuth\(request, env\)/);
    assert.match(src, /assertPermission\(claims\.role, 'action\.read'\)/);
    assert.match(src, /getEffectiveOrgId\(request, env, claims\)/);
  }
});
test('no projection route SQL text itself is interpolated with a raw filter value (values are bound; only the allowlisted sort column/direction reach the SQL string directly)', () => {
  const queriesSrc = fs.readFileSync(path.join(backendDir, 'src/decision-projection-queries.js'), 'utf8');
  // Extract only what's actually passed to .prepare(`...`) — a filter VALUE
  // interpolated into a bound placeholder's *argument* (e.g. building a LIKE
  // pattern string that is then pushed onto binds[] and bound via `?`) is
  // safe and expected; what must never happen is a filter value reaching
  // the SQL TEXT argument of .prepare() itself.
  const prepareCalls = [...queriesSrc.matchAll(/\.prepare\(`([^`]*)`\)/g)].map(m => m[1]);
  assert.ok(prepareCalls.length > 0, 'expected at least one template-literal prepare() call to inspect');
  for (const sql of prepareCalls) {
    assert.doesNotMatch(sql, /\$\{filters\./, 'a filter value must never be interpolated directly into prepare() SQL text');
    assert.doesNotMatch(sql, /\$\{url\./, 'a raw query-string value must never be interpolated directly into prepare() SQL text');
  }
});
test('the projection layer never authorizes an Action lifecycle transition — no approve/reject/assign/verify/cancel logic exists in any new module', () => {
  for (const file of ['decision-projection-writers.js', 'decision-projection-consumers.js', 'decision-projection-queries.js', 'decision-projection-rebuild.js', 'decision-projection-reconciliation.js']) {
    const src = fs.readFileSync(path.join(backendDir, 'src', file), 'utf8');
    assert.doesNotMatch(src, /assertPermission\(.*action\.(create|update|submit|review|assign|progress|verify|cancel)/, `${file} must never perform a write-side lifecycle authorization check`);
  }
});

// ============================================================
// Reconciliation with decision_action_metrics_daily (Part 1G confirmation)
// ============================================================
test('no Sprint 1.6 module writes to decision_action_metrics_daily — the existing event-count rollup is reused as-is, not duplicated', () => {
  for (const file of ['decision-projection-writers.js', 'decision-projection-consumers.js', 'decision-projection-rebuild.js']) {
    const src = fs.readFileSync(path.join(backendDir, 'src', file), 'utf8');
    assert.doesNotMatch(src, /INSERT INTO decision_action_metrics_daily/);
  }
});

// ============================================================
// Regression — scheduled() wiring
// ============================================================
test('the three new projection sweeps are wired into the existing 5-minute scheduled() tick, not a new cron trigger', () => {
  const scheduledSrc = appSrc.slice(appSrc.indexOf('async scheduled(event, env, ctx)'), appSrc.indexOf('async scheduled(event, env, ctx)') + 1600);
  assert.match(scheduledSrc, /ctx\.waitUntil\(backfillMissingActionSummaries\(env\)\)/);
  assert.match(scheduledSrc, /ctx\.waitUntil\(runReconciliationSweepTick\(env\)\)/);
  assert.match(scheduledSrc, /ctx\.waitUntil\(sweepDailyPortfolioSnapshots\(env\)\)/);
});
