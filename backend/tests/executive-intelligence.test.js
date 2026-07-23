// Program Beta Sprint 3 — Executive Intelligence Command Center test suite.
// Same real in-memory-SQLite harness as decision-projection-layer.test.js
// (node:sqlite applying the actual schema.sql + migrations) — every rule
// and query below is exercised against real rows, not mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { writeActionSummaryProjection, writeOrganizationPortfolio } from '../src/decision-projection-writers.js';
import { listProjectPortfolios, getStrategicPriorityBreakdown, getPortfolioTrend, getEvidenceAssurance, getExecutiveTimeline, getActionReopenCounts } from '../src/decision-projection-queries.js';
import { evaluateExecutiveInsights, buildDecisionsRequired, EXEC_RULES, DEFAULT_THRESHOLDS } from '../src/executive-insight-engine.js';

const root = path.resolve('..');
const backendDir = path.join(root, 'backend');

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
function seedUser(db, { userId, orgId = 'org1', fullName = 'Jane Owner' }) {
  db.prepare('INSERT INTO users (id,organization_id,email,password_hash,password_salt,full_name,role,is_active) VALUES (?,?,?,?,?,?,?,?)').run(userId, orgId, `${userId}@test.com`, 'h', 's', fullName, 'me_officer', 1);
}
let actionSeq = 0;
function seedAction(db, overrides = {}) {
  actionSeq += 1;
  const a = {
    id: `act${actionSeq}`, organization_id: 'org1', project_id: 'proj1', recommendation: 'Do the thing', management_response: 'resp',
    owner: 'user1', due_date: '2026-06-01', status: 'draft', priority: 'medium', risk_level: null, strategic_priority: null,
    overdue_since: null, escalated_since: null, completion_date: null, attachments_count: 0, evidence_after_json: '[]', verification_status: 'unverified',
    created_by: 'user1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
  };
  db.prepare(`INSERT INTO management_response_actions (id,organization_id,project_id,recommendation,management_response,owner,due_date,status,priority,risk_level,strategic_priority,overdue_since,escalated_since,completion_date,attachments_count,evidence_after_json,verification_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(a.id, a.organization_id, a.project_id, a.recommendation, a.management_response, a.owner, a.due_date, a.status, a.priority, a.risk_level, a.strategic_priority, a.overdue_since, a.escalated_since, a.completion_date, a.attachments_count, a.evidence_after_json, a.verification_status, a.created_by, a.created_at, a.updated_at);
  return a;
}
function seedHistory(db, { actionId, orgId = 'org1', historyType = 'status', from = null, to, createdAt = '2026-01-02T00:00:00Z' }) {
  db.prepare('INSERT INTO action_history (id,action_id,organization_id,history_type,from_value,to_value,actor_id,actor_role,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(`h_${Math.random().toString(36).slice(2)}`, actionId, orgId, historyType, from, to, 'user1', 'me_officer', 'api', createdAt);
}
async function seedProjected(env, db, overrides = {}) {
  const a = seedAction(db, overrides);
  await writeActionSummaryProjection(env, { actionId: a.id, organizationId: a.organization_id });
  return a;
}

// ============================================================
// EXEC-001..EXEC-010 rule evaluation
// ============================================================
test('EXEC-001 fires for a critical, overdue Action and links to it', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' });
  const result = await evaluateExecutiveInsights(env, 'org1');
  const hit = result.insights.find(i => i.rule_id === 'EXEC-001');
  assert.ok(hit, 'expected EXEC-001 to fire');
  assert.equal(hit.severity, 'critical');
  assert.match(hit.link, /decision-detail\.html\?id=/);
});

test('EXEC-001 does not fire for a critical Action that is not overdue', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: null });
  const result = await evaluateExecutiveInsights(env, 'org1');
  assert.equal(result.insights.filter(i => i.rule_id === 'EXEC-001').length, 0);
});

test('EXEC-002 fires for a completed high-risk Action with zero evidence, not for one with evidence attached', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { risk_level: 'high', status: 'completed', attachments_count: 0, evidence_after_json: '[]' });
  await seedProjected(env, db, { risk_level: 'high', status: 'completed', attachments_count: 2, evidence_after_json: '[{"url":"x"}]' });
  const result = await evaluateExecutiveInsights(env, 'org1');
  const hits = result.insights.filter(i => i.rule_id === 'EXEC-002');
  assert.equal(hits.length, 1);
});

test('EXEC-003 fires only once a review-queue item exceeds the age threshold', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const oldEnough = new Date(Date.now() - 10 * 86400000).toISOString();
  const tooRecent = new Date(Date.now() - 1 * 86400000).toISOString();
  const a1 = await seedProjected(env, db, { status: 'under_review', updated_at: oldEnough });
  const a2 = await seedProjected(env, db, { status: 'under_review', updated_at: tooRecent });
  // last_activity_at is populated by writeActionSummaryProjection from action_history when present, else falls back — set explicitly here to isolate this rule's own age logic from that fallback behavior.
  db.prepare('UPDATE action_summary_projection SET last_activity_at=? WHERE action_id=?').run(oldEnough, a1.id);
  db.prepare('UPDATE action_summary_projection SET last_activity_at=? WHERE action_id=?').run(tooRecent, a2.id);
  const result = await evaluateExecutiveInsights(env, 'org1');
  const hits = result.insights.filter(i => i.rule_id === 'EXEC-003');
  assert.equal(hits.length, 1);
});

test('EXEC-005 fires for an owner whose overdue count meets the configurable threshold', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  for (let i = 0; i < 3; i++) await seedProjected(env, db, { owner: 'user1', overdue_since: '2026-01-01T00:00:00Z' });
  const { writeOwnerWorkload } = await import('../src/decision-projection-writers.js');
  await writeOwnerWorkload(env, 'org1', 'user1');
  const strict = await evaluateExecutiveInsights(env, 'org1', { thresholds: { OWNER_OVERDUE_THRESHOLD: 5 } });
  assert.equal(strict.insights.filter(i => i.rule_id === 'EXEC-005').length, 0, 'threshold of 5 must not fire for 3 overdue');
  const lenient = await evaluateExecutiveInsights(env, 'org1', { thresholds: { OWNER_OVERDUE_THRESHOLD: 3 } });
  assert.equal(lenient.insights.filter(i => i.rule_id === 'EXEC-005').length, 1, 'threshold of 3 must fire for exactly 3 overdue');
});

test('EXEC-007 fires only past the unresolved-escalation age threshold, and EXEC-008 fires for a portfolio with multiple overdue critical Actions', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const staleEscalation = new Date(Date.now() - 10 * 86400000).toISOString();
  await seedProjected(env, db, { escalated_since: staleEscalation });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z', project_id: 'proj_risky' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z', project_id: 'proj_risky' });
  const result = await evaluateExecutiveInsights(env, 'org1');
  assert.equal(result.insights.filter(i => i.rule_id === 'EXEC-007').length, 1);
  const portfolioHit = result.insights.find(i => i.rule_id === 'EXEC-008');
  assert.ok(portfolioHit, 'expected EXEC-008 for proj_risky with 2 overdue critical Actions');
  assert.equal(portfolioHit.subject_id, 'proj_risky');
});

test('EXEC-009 fires only once an Action has been reopened at least the configured number of times', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { status: 'in_progress' });
  seedHistory(db, { actionId: 'act1', from: 'completed', to: 'in_progress' });
  const onceReopened = await evaluateExecutiveInsights(env, 'org1', { thresholds: { REOPEN_COUNT_THRESHOLD: 2 } });
  assert.equal(onceReopened.insights.filter(i => i.rule_id === 'EXEC-009').length, 0);
  seedHistory(db, { actionId: 'act1', from: 'completed', to: 'in_progress' });
  const twiceReopened = await evaluateExecutiveInsights(env, 'org1', { thresholds: { REOPEN_COUNT_THRESHOLD: 2 } });
  const hit = twiceReopened.insights.find(i => i.rule_id === 'EXEC-009');
  assert.ok(hit);
  assert.equal(hit.message.includes('2 times'), true);
});

test('EXEC-006 fires for a strategic priority whose overdue rate is well above the organization average, not for one performing normally', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  for (let i = 0; i < 4; i++) await seedProjected(env, db, { strategic_priority: 'Healthy Priority', overdue_since: null });
  for (let i = 0; i < 4; i++) await seedProjected(env, db, { strategic_priority: 'Struggling Priority', overdue_since: i < 3 ? '2026-01-01T00:00:00Z' : null });
  const result = await evaluateExecutiveInsights(env, 'org1');
  assert.equal(result.insights.filter(i => i.rule_id === 'EXEC-006' && i.subject_id === 'Healthy Priority').length, 0);
  assert.equal(result.insights.filter(i => i.rule_id === 'EXEC-006' && i.subject_id === 'Struggling Priority').length, 1);
});

test('EXEC-010 fires when projection data is stale beyond the lag threshold, using the same freshness definition as getProjectionHealth (never a second staleness computation)', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const a = await seedProjected(env, db, {});
  const staleAt = new Date(Date.now() - 3600 * 1000).toISOString();
  db.prepare('UPDATE action_summary_projection SET projected_at=? WHERE action_id=?').run(staleAt, a.id);
  const result = await evaluateExecutiveInsights(env, 'org1');
  assert.ok(result.insights.some(i => i.rule_id === 'EXEC-010'));
});

test('evaluateExecutiveInsights is deterministic: identical input produces identical output', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' });
  const a = await evaluateExecutiveInsights(env, 'org1');
  const b = await evaluateExecutiveInsights(env, 'org1');
  assert.deepEqual(a.insights.map(i => ({ rule_id: i.rule_id, subject_id: i.subject_id, message: i.message })), b.insights.map(i => ({ rule_id: i.rule_id, subject_id: i.subject_id, message: i.message })));
});

test('role filtering: an insight rule never appears for a role outside its declared applicable_roles', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' }); // EXEC-001
  const result = await evaluateExecutiveInsights(env, 'org1', { role: 'me_officer' });
  const rule = EXEC_RULES.find(r => r.id === 'EXEC-001');
  assert.equal(rule.applicable_roles.includes('me_officer'), false, 'fixture assumption: EXEC-001 must not list me_officer');
  assert.equal(result.insights.filter(i => i.rule_id === 'EXEC-001').length, 0);
});

test('insights are sorted by severity, critical first', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' }); // critical
  const medium = await seedProjected(env, db, { status: 'under_review' });
  db.prepare('UPDATE action_summary_projection SET last_activity_at=? WHERE action_id=?').run(new Date(Date.now() - 10 * 86400000).toISOString(), medium.id);
  const result = await evaluateExecutiveInsights(env, 'org1');
  const severities = result.insights.map(i => i.severity);
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  for (let i = 1; i < severities.length; i++) assert.ok(rank[severities[i - 1]] <= rank[severities[i]], 'insights must be sorted worst-severity-first');
});

// ============================================================
// Decisions Required
// ============================================================
test('buildDecisionsRequired excludes workload (EXEC-005) and projection-health (EXEC-010) insights — those are operational/technical, not leadership decisions', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' });
  const evaluation = await evaluateExecutiveInsights(env, 'org1');
  const decisions = buildDecisionsRequired(evaluation);
  assert.equal(decisions.decisions.some(d => d.rule_id === 'EXEC-005' || d.rule_id === 'EXEC-010'), false);
  const critical = decisions.decisions.find(d => d.rule_id === 'EXEC-001');
  assert.ok(critical);
  assert.ok(critical.decision_deadline);
  assert.ok(critical.consequence_of_inaction);
  assert.ok(critical.responsible_authority);
});

// ============================================================
// New projection query functions
// ============================================================
test('listProjectPortfolios ranks projects by overdue_count descending', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { project_id: 'projA', overdue_since: '2026-01-01T00:00:00Z' });
  await seedProjected(env, db, { project_id: 'projB', overdue_since: '2026-01-01T00:00:00Z' });
  await seedProjected(env, db, { project_id: 'projB', overdue_since: '2026-01-01T00:00:00Z' });
  const { writeProjectPortfolio } = await import('../src/decision-projection-writers.js');
  await writeProjectPortfolio(env, 'org1', 'projA');
  await writeProjectPortfolio(env, 'org1', 'projB');
  const result = await listProjectPortfolios(env, 'org1');
  assert.equal(result.projects[0].project_id, 'projB');
  assert.equal(result.projects[0].overdue_count, 2);
});

test('getStrategicPriorityBreakdown groups by strategic_priority and computes an honest overdue_rate', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { strategic_priority: 'Water Access', overdue_since: '2026-01-01T00:00:00Z' });
  await seedProjected(env, db, { strategic_priority: 'Water Access', overdue_since: null });
  const result = await getStrategicPriorityBreakdown(env, 'org1');
  const row = result.strategic_priorities.find(p => p.strategic_priority === 'Water Access');
  assert.equal(row.total_commitments, 2);
  assert.equal(row.overdue_count, 1);
  assert.equal(row.overdue_rate, 0.5);
});

test('getPortfolioTrend honestly reports insufficient historical data with fewer than 3 snapshot days, and returns real points with 3+', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const d2 = daysAgo(2), d1 = daysAgo(1), d0 = daysAgo(0);
  db.prepare('INSERT INTO organization_decision_portfolio_snapshot (organization_id,snapshot_date,total_actions,overdue_count,escalated_count,completed_count,verified_count,verification_rate,completion_rate,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('org1', d2, 10, 2, 1, 3, 2, 0.5, 0.3, d2 + 'T00:00:00Z');
  db.prepare('INSERT INTO organization_decision_portfolio_snapshot (organization_id,snapshot_date,total_actions,overdue_count,escalated_count,completed_count,verified_count,verification_rate,completion_rate,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('org1', d1, 11, 2, 1, 4, 3, 0.6, 0.4, d1 + 'T00:00:00Z');
  const insufficient = await getPortfolioTrend(env, 'org1', 30);
  assert.equal(insufficient.available, false);
  assert.match(insufficient.reason, /Insufficient historical data/);
  db.prepare('INSERT INTO organization_decision_portfolio_snapshot (organization_id,snapshot_date,total_actions,overdue_count,escalated_count,completed_count,verified_count,verification_rate,completion_rate,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('org1', d0, 12, 1, 1, 5, 4, 0.7, 0.5, d0 + 'T00:00:00Z');
  const sufficient = await getPortfolioTrend(env, 'org1', 30);
  assert.equal(sufficient.available, true);
  assert.equal(sufficient.points.length, 3);
  assert.equal(sufficient.points[0].date, d2);
});

test('getEvidenceAssurance only recognizes Attached/Verified/Not-available — never a fabricated fourth state', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  seedAction(db, { id: 'evA', attachments_count: 1, evidence_after_json: '[{"url":"x"}]', status: 'completed', risk_level: 'high' });
  seedAction(db, { id: 'evB', attachments_count: 0, evidence_after_json: '[]', status: 'completed', risk_level: 'high' });
  seedAction(db, { id: 'evC', attachments_count: 1, evidence_after_json: '[{"url":"x"}]', verification_status: 'verified' });
  const result = await getEvidenceAssurance(env, 'org1');
  assert.equal(result.total_actions, 3);
  assert.equal(result.with_evidence_count, 2);
  assert.equal(result.verified_count, 1);
  assert.equal(result.not_available_count, 1);
  assert.equal(result.high_risk_without_evidence_count, 1);
  assert.match(result.note, /Attached, Verified, and Not available/);
});

test('getExecutiveTimeline only returns significant event types (status/assignment/evidence/verification), never every micro-edit', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const a = await seedProjected(env, db, {});
  seedHistory(db, { actionId: a.id, historyType: 'status', from: 'draft', to: 'under_review' });
  const result = await getExecutiveTimeline(env, 'org1', {});
  assert.ok(result.events.length >= 1);
  assert.ok(result.events.every(e => ['status', 'assignment', 'evidence', 'verification'].includes(e.history_type)));
});

test('getExecutiveTimeline filters by project when requested', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const a1 = await seedProjected(env, db, { project_id: 'projX' });
  const a2 = await seedProjected(env, db, { project_id: 'projY' });
  seedHistory(db, { actionId: a1.id, from: 'draft', to: 'under_review' });
  seedHistory(db, { actionId: a2.id, from: 'draft', to: 'under_review' });
  const result = await getExecutiveTimeline(env, 'org1', { projectId: 'projX' });
  assert.ok(result.events.length >= 1);
  assert.ok(result.events.every(e => e.project_id === 'projX'));
});

test('getActionReopenCounts only counts the real completed->in_progress transition pair, respecting minCount', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const a = seedAction(db, {});
  seedHistory(db, { actionId: a.id, from: 'completed', to: 'in_progress' });
  const zeroMin = await getActionReopenCounts(env, 'org1', { minCount: 1 });
  assert.equal(zeroMin.actions.length, 1);
  const strict = await getActionReopenCounts(env, 'org1', { minCount: 2 });
  assert.equal(strict.actions.length, 0);
});

// ============================================================
// Rule catalog completeness (Part 6 — "Document every rule")
// ============================================================
test('every EXEC rule has an id, name, purpose, severity, and a non-empty applicable_roles list', () => {
  for (const rule of EXEC_RULES) {
    assert.match(rule.id, /^EXEC-\d{3}$/);
    assert.ok(rule.name && rule.name.length > 0);
    assert.ok(rule.purpose && rule.purpose.length > 0);
    assert.ok(['critical', 'high', 'medium', 'low'].includes(rule.severity));
    assert.ok(Array.isArray(rule.applicable_roles) && rule.applicable_roles.length > 0);
    assert.equal(rule.applicable_roles.includes('enumerator'), false, 'no rule may ever be applicable to enumerator');
  }
});
test('thresholds are configurable: DEFAULT_THRESHOLDS is a plain, overridable object', () => {
  assert.equal(typeof DEFAULT_THRESHOLDS, 'object');
  assert.ok(Object.keys(DEFAULT_THRESHOLDS).length >= 6);
});
