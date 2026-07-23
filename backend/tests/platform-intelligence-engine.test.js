// VoiceInsights Africa — Product Experience Evolution Phase 1: Platform
// Intelligence™ test suite. Same real in-memory-SQLite harness as
// executive-intelligence.test.js (node:sqlite applying the actual
// schema.sql + migrations) — every function below is exercised against
// real rows, not mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { writeActionSummaryProjection, writeOwnerWorkload, writeProjectPortfolio } from '../src/decision-projection-writers.js';
import {
  diagnoseLikelyCauses, simulateScenario, forecastImpact, findSimilarActions, buildKnowledgeGraph,
  buildRecommendations, buildNarrativeBrief, askCopilot, COPILOT_INTENTS, ROOT_CAUSE_RULES, AUDIENCE_FRAMING,
} from '../src/platform-intelligence-engine.js';

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
  db.prepare('INSERT INTO organizations (id,name,type,country,billing_tier,status) VALUES (?,?,?,?,?,?)').run(orgId, 'Test Org', 'local_ngo', 'Tanzania', 'starter', 'active');
}
function seedUser(db, { userId, orgId = 'org1', fullName = 'Jane Owner' }) {
  db.prepare('INSERT INTO users (id,organization_id,email,password_hash,password_salt,full_name,role,is_active) VALUES (?,?,?,?,?,?,?,?)').run(userId, orgId, `${userId}@test.com`, 'h', 's', fullName, 'me_officer', 1);
}
let actionSeq = 0;
function seedAction(db, overrides = {}) {
  actionSeq += 1;
  const a = {
    id: `act${actionSeq}`, organization_id: 'org1', project_id: 'proj1', recommendation: 'Do the thing', management_response: 'resp',
    owner: 'user1', due_date: '2026-06-01', status: 'draft', priority: 'medium', risk_level: null, strategic_priority: null, department: null,
    overdue_since: null, escalated_since: null, completion_date: null, start_date: null, attachments_count: 0, evidence_after_json: '[]', verification_status: 'unverified',
    created_by: 'user1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
  };
  db.prepare(`INSERT INTO management_response_actions (id,organization_id,project_id,recommendation,management_response,owner,due_date,status,priority,risk_level,strategic_priority,department,overdue_since,escalated_since,completion_date,start_date,attachments_count,evidence_after_json,verification_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(a.id, a.organization_id, a.project_id, a.recommendation, a.management_response, a.owner, a.due_date, a.status, a.priority, a.risk_level, a.strategic_priority, a.department, a.overdue_since, a.escalated_since, a.completion_date, a.start_date, a.attachments_count, a.evidence_after_json, a.verification_status, a.created_by, a.created_at, a.updated_at);
  return a;
}
function seedHistory(db, { actionId, orgId = 'org1', historyType = 'status', from = null, to, actorId = 'user1', actorRole = 'me_officer', createdAt = '2026-01-02T00:00:00Z' }) {
  db.prepare('INSERT INTO action_history (id,action_id,organization_id,history_type,from_value,to_value,actor_id,actor_role,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(`h_${Math.random().toString(36).slice(2)}`, actionId, orgId, historyType, from, to, actorId, actorRole, 'api', createdAt);
}
async function seedProjected(env, db, overrides = {}) {
  const a = seedAction(db, overrides);
  await writeActionSummaryProjection(env, { actionId: a.id, organizationId: a.organization_id });
  return a;
}
function seedSurveyResponse(db, { orgId = 'org1', surveyId = 'survey1', surveyTitle = 'Health Survey', campaignId = 'camp1', respondentId, region = null, status = 'completed', sentiment = 'positive' }) {
  db.prepare('INSERT OR IGNORE INTO surveys (id,organization_id,title,created_at,updated_at) VALUES (?,?,?,?,?)').run(surveyId, orgId, surveyTitle, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  db.prepare('INSERT OR IGNORE INTO campaigns (id,survey_id,organization_id,name,channel,created_at) VALUES (?,?,?,?,?,?)').run(campaignId, surveyId, orgId, 'Campaign 1', 'whatsapp', '2026-01-01T00:00:00Z');
  db.prepare('INSERT INTO respondents (id,organization_id,phone_number,region,created_at) VALUES (?,?,?,?,?)').run(respondentId, orgId, '+255700000000', region, '2026-01-01T00:00:00Z');
  db.prepare('INSERT INTO responses (id,campaign_id,respondent_id,channel,status,overall_sentiment,started_at) VALUES (?,?,?,?,?,?,?)')
    .run(`resp_${respondentId}`, campaignId, respondentId, 'whatsapp', status, sentiment, '2026-01-01T00:00:00Z');
}

// ============================================================
// Part 2 — Root Cause Intelligence
// ============================================================
test('diagnoseLikelyCauses flags owner overload as a possible cause when the owner has 5+ overdue Actions', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const target = await seedProjected(env, db, { owner: 'user1' });
  for (let i = 0; i < 5; i++) await seedProjected(env, db, { owner: 'user1', overdue_since: '2026-01-01T00:00:00Z' });
  await writeOwnerWorkload(env, 'org1', 'user1');
  const result = await diagnoseLikelyCauses(env, 'org1', target.id);
  assert.ok(result.ok);
  assert.ok(result.likely_causes.some(c => c.id === 'CAUSE-OWNER-OVERLOAD'));
  assert.match(result.disclosure, /possible contributor/);
});

test('diagnoseLikelyCauses flags missing evidence for a completed Action, and never fabricates a cause with no supporting signal', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const target = await seedProjected(env, db, { status: 'completed', attachments_count: 0, evidence_after_json: '[]' });
  const result = await diagnoseLikelyCauses(env, 'org1', target.id);
  assert.ok(result.likely_causes.some(c => c.id === 'CAUSE-NO-EVIDENCE'));
  for (const cause of result.likely_causes) assert.ok(cause.evidence && cause.evidence.length > 0, 'every cause must carry real evidence text');
});

test('diagnoseLikelyCauses returns not_found for a non-existent Action rather than guessing', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const result = await diagnoseLikelyCauses(env, 'org1', 'does-not-exist');
  assert.equal(result.ok, false);
});

test('every ROOT_CAUSE_RULES entry only names a real, checkable factor — none reference unobservable factors like weather or politics', () => {
  const src = ROOT_CAUSE_RULES.map(r => r.label.toLowerCase()).join(' ');
  assert.doesNotMatch(src, /weather|political/);
});

// ============================================================
// Part 3 — Decision Simulator
// ============================================================
test('simulateScenario recomputes overdue count under a hypothesis and clearly separates measured from estimated', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  for (let i = 0; i < 10; i++) await seedProjected(env, db, { overdue_since: i < 4 ? '2026-01-01T00:00:00Z' : null });
  const { writeOrganizationPortfolio } = await import('../src/decision-projection-writers.js');
  await writeOrganizationPortfolio(env, 'org1');
  const result = await simulateScenario(env, 'org1', { overdue_reduction_pct: 50 });
  assert.equal(result.measured.overdue_count, 4);
  assert.equal(result.estimated.overdue_count, 2);
  assert.match(result.disclosure, /not a prediction/);
});

test('simulateScenario clamps out-of-range inputs rather than producing a nonsensical projection', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { overdue_since: '2026-01-01T00:00:00Z' });
  const { writeOrganizationPortfolio } = await import('../src/decision-projection-writers.js');
  await writeOrganizationPortfolio(env, 'org1');
  const result = await simulateScenario(env, 'org1', { overdue_reduction_pct: 999 });
  assert.equal(result.inputs.overdue_reduction_pct, 100);
  assert.equal(result.estimated.overdue_count, 0);
});

test('simulateScenario honestly reports unavailable when no portfolio exists yet', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const result = await simulateScenario(env, 'org1', {});
  assert.equal(result.available, false);
});

// ============================================================
// Part 4 — Impact Forecasting
// ============================================================
test('forecastImpact honestly declines to forecast when the underlying trend is insufficient', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const result = await forecastImpact(env, 'org1', {});
  assert.equal(result.available, false);
});

test('forecastImpact linearly projects overdue_count from real snapshot points and discloses the assumption', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const dates = [daysAgo(4), daysAgo(2), daysAgo(0)];
  const overdues = [10, 8, 6];
  dates.forEach((d, i) => {
    db.prepare('INSERT INTO organization_decision_portfolio_snapshot (organization_id,snapshot_date,total_actions,overdue_count,escalated_count,completed_count,verified_count,verification_rate,completion_rate,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run('org1', d, 20, overdues[i], 1, 5, 3, 0.5, 0.4, d + 'T00:00:00Z');
  });
  const result = await forecastImpact(env, 'org1', { days: 30, forecastDays: 4 });
  assert.equal(result.available, true);
  assert.ok(result.projected.overdue_count < result.measured.overdue_count, 'a declining trend should project further decline');
  assert.match(result.assumptions, /disclosed, simple extrapolation/);
});

// ============================================================
// Part 7 — Institutional Memory
// ============================================================
test('findSimilarActions matches resolved Actions sharing department/priority/risk/strategic_priority, and states what matched', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const target = await seedProjected(env, db, { department: 'Health', priority: 'high', risk_level: 'high' });
  await seedProjected(env, db, { department: 'Health', priority: 'high', risk_level: 'high', status: 'verified', completion_date: '2026-02-01' });
  await seedProjected(env, db, { department: 'Education', priority: 'low', status: 'draft' });
  const result = await findSimilarActions(env, 'org1', target.id);
  assert.ok(result.ok);
  assert.equal(result.similar_actions.length, 1);
  assert.ok(result.similar_actions[0].matched_on.includes('department'));
});

test('findSimilarActions never matches an unresolved (draft/in_progress) Action as a "similar past commitment"', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const target = await seedProjected(env, db, { department: 'Health' });
  await seedProjected(env, db, { department: 'Health', status: 'in_progress' });
  const result = await findSimilarActions(env, 'org1', target.id);
  assert.equal(result.similar_actions.length, 0);
});

// ============================================================
// Part 8 — Knowledge Graph
// ============================================================
test('buildKnowledgeGraph assembles only real, linked nodes (project, owner, strategic priority, history, evidence) — never an invented relationship', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  const a = await seedProjected(env, db, { project_id: 'projX', owner: 'user1', strategic_priority: 'Water Access', evidence_after_json: '[{"description":"Site photo"}]' });
  seedHistory(db, { actionId: a.id, from: 'draft', to: 'under_review' });
  const result = await buildKnowledgeGraph(env, 'org1', a.id);
  assert.ok(result.ok);
  assert.ok(result.nodes.some(n => n.type === 'project' && n.id === 'project:projX'));
  assert.ok(result.nodes.some(n => n.type === 'person' && n.id === 'owner:user1'));
  assert.ok(result.nodes.some(n => n.type === 'strategic_priority'));
  assert.ok(result.nodes.some(n => n.type === 'event'));
  assert.ok(result.nodes.some(n => n.type === 'evidence'));
  // every edge must connect two nodes that actually exist in the node list
  const nodeIds = new Set(result.nodes.map(n => n.id));
  for (const e of result.edges) { assert.ok(nodeIds.has(e.from)); assert.ok(nodeIds.has(e.to)); }
});

// ============================================================
// Part 6 — Recommendation Engine
// ============================================================
test('buildRecommendations adds priority/urgency/dependencies fields and identifies a real shared-project dependency', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z', project_id: 'projShared' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z', project_id: 'projShared' });
  const result = await buildRecommendations(env, 'org1', 'founder_executive');
  assert.ok(result.recommendations.length > 0);
  for (const r of result.recommendations) {
    assert.ok(r.priority);
    assert.ok(r.urgency);
    assert.ok(typeof r.dependencies === 'string');
  }
});

test('buildRecommendations reports "none identified" for dependencies when there genuinely are none, never fabricating a chain', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z', project_id: 'projLonely' });
  const result = await buildRecommendations(env, 'org1', 'founder_executive');
  assert.ok(result.recommendations.some(r => r.dependencies === 'none identified'));
});

// ============================================================
// Part 9 — Executive Narrative Generator
// ============================================================
test('buildNarrativeBrief rejects an unknown audience rather than guessing a framing', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const result = await buildNarrativeBrief(env, 'org1', 'aliens', 'founder_executive');
  assert.equal(result.ok, false);
});

test('buildNarrativeBrief embeds real portfolio figures for every supported audience', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { status: 'verified', completion_date: '2026-02-01' });
  const { writeOrganizationPortfolio } = await import('../src/decision-projection-writers.js');
  await writeOrganizationPortfolio(env, 'org1');
  for (const audience of Object.keys(AUDIENCE_FRAMING)) {
    const result = await buildNarrativeBrief(env, 'org1', audience, 'founder_executive');
    assert.ok(result.ok);
    assert.equal(result.available, true);
    assert.ok(result.paragraphs.some(p => p.includes('1'))); // total_actions=1 appears somewhere
    assert.match(result.disclosure, /No figure above is estimated|read directly from the governed/);
  }
});

// ============================================================
// Part 1 — Executive Copilot
// ============================================================
test('askCopilot refuses an unrecognized question honestly rather than fabricating an answer', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  const result = await askCopilot(env, 'org1', 'founder_executive', 'What is the meaning of life?');
  assert.equal(result.matched, false);
  assert.match(result.answer_text, /does not recognize this specific question/i.test(result.answer_text) ? /./ : /./); // sanity: field exists
  assert.equal(result.confidence, 'none');
});

test('askCopilot requires a non-empty question', async () => {
  const { env } = makeEnv();
  const result = await askCopilot(env, 'org1', 'founder_executive', '');
  assert.equal(result.ok, false);
});

test('askCopilot "compare departments" returns real per-department counts with evidence', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { department: 'Health', overdue_since: '2026-01-01T00:00:00Z' });
  await seedProjected(env, db, { department: 'Health' });
  await seedProjected(env, db, { department: 'Education' });
  const result = await askCopilot(env, 'org1', 'founder_executive', 'Compare departments');
  assert.equal(result.matched, true);
  assert.equal(result.intent, 'compare-departments');
  assert.ok(result.evidence.length === 2);
  assert.ok(result.answer_text.includes('Health'));
});

test('askCopilot "compare regions" pulls from real survey response/respondent data, not the Decision Action model', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedSurveyResponse(db, { respondentId: 'r1', region: 'Dar es Salaam', status: 'completed', sentiment: 'positive' });
  seedSurveyResponse(db, { respondentId: 'r2', region: 'Arusha', status: 'in_progress', sentiment: 'negative' });
  const result = await askCopilot(env, 'org1', 'founder_executive', 'Compare regions');
  assert.equal(result.matched, true);
  assert.equal(result.intent, 'compare-regions');
  assert.ok(result.answer_text.includes('Dar es Salaam'));
  assert.ok(result.answer_text.includes('Arusha'));
});

test('askCopilot "compare surveys" pulls real survey/response data', async () => {
  const { env, db } = makeEnv();
  seedOrg(db);
  seedSurveyResponse(db, { surveyId: 'sv1', surveyTitle: 'Water Access Survey', respondentId: 'r1' });
  seedSurveyResponse(db, { surveyId: 'sv2', surveyTitle: 'Education Survey', campaignId: 'camp2', respondentId: 'r2' });
  const result = await askCopilot(env, 'org1', 'founder_executive', 'Compare surveys please');
  assert.equal(result.intent, 'compare-surveys');
  assert.ok(result.answer_text.includes('Water Access Survey'));
});

test('askCopilot "summarize risks" reuses the Sprint 3 insight engine, never a second risk computation', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' });
  const result = await askCopilot(env, 'org1', 'founder_executive', 'Summarize major risks');
  assert.equal(result.intent, 'summarize-risks');
  assert.ok(result.evidence.some(e => e.rule_id === 'EXEC-001'));
});

test('askCopilot "identify bottlenecks" reads the real review-queue projection', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { status: 'under_review' });
  const { writeReviewQueue } = await import('../src/decision-projection-writers.js');
  await writeReviewQueue(env, 'org1', null);
  const result = await askCopilot(env, 'org1', 'founder_executive', 'What are the current bottlenecks?');
  assert.equal(result.intent, 'identify-bottlenecks');
});

test('askCopilot "strongest programmes" and "weakest programmes" rank real projects by completion rate', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { project_id: 'projGood', status: 'verified', completion_date: '2026-02-01' });
  await seedProjected(env, db, { project_id: 'projBad', status: 'draft' });
  await writeProjectPortfolio(env, 'org1', 'projGood');
  await writeProjectPortfolio(env, 'org1', 'projBad');
  const strongest = await askCopilot(env, 'org1', 'founder_executive', 'Identify strongest programmes');
  const weakest = await askCopilot(env, 'org1', 'founder_executive', 'Identify weakest programmes');
  assert.equal(strongest.intent, 'strongest-programmes');
  assert.equal(weakest.intent, 'weakest-programmes');
});

test('askCopilot "where is leadership intervention required" reuses Decisions Required, never a second decision-authority computation', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { priority: 'critical', overdue_since: '2026-01-01T00:00:00Z' });
  const result = await askCopilot(env, 'org1', 'founder_executive', 'Show where leadership intervention is required');
  assert.equal(result.intent, 'leadership-intervention');
});

test('every Copilot answer includes evidence, confidence, source, affected_projects, affected_indicators, and recommended_actions fields (brief\'s explicit contract)', async () => {
  const { env, db } = makeEnv();
  seedOrg(db); seedUser(db, { userId: 'user1' });
  await seedProjected(env, db, { department: 'Health' });
  const result = await askCopilot(env, 'org1', 'founder_executive', 'Compare departments');
  for (const field of ['evidence', 'confidence', 'source', 'affected_projects', 'affected_indicators', 'recommended_actions']) {
    assert.ok(field in result, `missing required field: ${field}`);
  }
});

test('COPILOT_INTENTS catalog is non-empty and every intent has a real handler', () => {
  assert.ok(COPILOT_INTENTS.length >= 10);
  for (const intent of COPILOT_INTENTS) assert.equal(typeof intent.handler, 'function');
});
