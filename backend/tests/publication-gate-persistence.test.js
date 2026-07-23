import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePublicationGate, evaluatePublicationGateAndPersist,
  persistSecurityEvent, persistPublicationGateEvaluation,
} from '../src/quality-scoring-engine.js';

// A minimal in-memory fake D1 binding — same hand-rolled pattern already
// used elsewhere in this test suite (see tests/security-hardening.test.js)
// rather than a mocking library, since the project has none.
function fakeD1() {
  const inserts = [];
  const updates = [];
  const selects = [];
  const existingCorrelationIds = new Set();
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (/^INSERT/i.test(sql)) {
                inserts.push({ sql, args });
                if (/security_audit_events_v2/.test(sql)) existingCorrelationIds.add(args[9]);
              } else if (/^UPDATE/i.test(sql)) {
                updates.push({ sql, args });
              }
              return { meta: { changes: 1 } };
            },
            async first() {
              selects.push({ sql, args });
              if (/security_audit_events_v2/.test(sql) && existingCorrelationIds.has(args[0])) {
                return { id: 'existing-event-id' };
              }
              return null;
            },
          };
        },
      };
    },
  };
  return { DB: db, inserts, updates, selects };
}

const crossTenantInput = {
  dataset_version: 'v1', organization_id: 'org_1', project_id: 'proj_1', requested_by_org_id: 'org_2',
  is_demo: false, report_type: 'standard',
  findings: [{ text: 'Some finding.', evidence_ids: ['EV-1'] }],
  evidence: [{ id: 'EV-1', source: 'survey' }],
  decisions: [], methodology: { limitations: ['x'] },
  approvals: { required: [], completed: [] }, exports: {},
};

const strongRealInput = {
  dataset_version: 'v3-locked', organization_id: 'org_1', project_id: 'proj_1',
  is_demo: false, report_type: 'standard',
  findings: [{ text: 'Facility waiting times remain the strongest driver of negative patient experience.', evidence_ids: ['EV-1'] }],
  evidence: [{ id: 'EV-1', source: 'survey', confidence: 0.9 }],
  decisions: [{ text: 'Deploy a 30-day stockout response plan.', evidence_ids: ['EV-1'], owner: 'MOH Logistics', timeline: '30 days' }],
  methodology: { sampling_frame: 'national', limitations: ['cross-sectional design'] },
  approvals: { required: ['statistician'], completed: ['statistician'] },
  exports: { pdf: { valid: true } },
};

test('persistSecurityEvent writes a row to security_audit_events_v2 with a deterministic correlation_id', async () => {
  const env = fakeD1();
  const decision = evaluatePublicationGate(crossTenantInput);
  const result = await persistSecurityEvent(env, decision.security_event, { report_id: 'report-1', route: '/api/reports/1/export' });
  assert.ok(result);
  assert.equal(result.deduplicated, false);
  assert.equal(env.inserts.length, 1);
  assert.match(env.inserts[0].sql, /security_audit_events_v2/);
  const meta = JSON.parse(env.inserts[0].args[10]);
  assert.equal(meta.requested_by_org_id, 'org_2');
  assert.equal(meta.route, '/api/reports/1/export');
});

test('persistSecurityEvent deduplicates repeated evaluations of the same report instead of creating duplicate alerts', async () => {
  const env = fakeD1();
  const decision = evaluatePublicationGate(crossTenantInput);
  const context = { report_id: 'report-1', route: '/api/reports/1/export' };
  const first = await persistSecurityEvent(env, decision.security_event, context);
  const second = await persistSecurityEvent(env, decision.security_event, context);
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(env.inserts.length, 1, 'a second identical evaluation must not create a duplicate security event row');
});

test('persistPublicationGateEvaluation writes an immutable history row and marks prior rows not-latest', async () => {
  const env = fakeD1();
  const decision = evaluatePublicationGate(strongRealInput);
  const result = await persistPublicationGateEvaluation(env, decision, { report_id: 'report-2', organization_id: 'org_1', project_id: 'proj_1', input: strongRealInput });
  assert.ok(result.id);
  assert.ok(result.input_hash);
  assert.ok(result.result_hash);
  assert.equal(env.updates.length, 1, 'expected the prior-rows is_latest flip to run before the insert');
  assert.match(env.updates[0].sql, /UPDATE publication_gate_evaluations SET is_latest = 0/);
  assert.equal(env.inserts.length, 1);
  assert.match(env.inserts[0].sql, /INSERT INTO publication_gate_evaluations/);
});

test('evaluatePublicationGateAndPersist evaluates once and persists both evaluation history and the security event', async () => {
  const env = fakeD1();
  const result = await evaluatePublicationGateAndPersist(env, crossTenantInput, { report_id: 'report-3', route: '/api/reports/3/export' });
  assert.equal(result.publication_status, 'BLOCKED');
  assert.equal(result.score_state, 'INVALIDATED');
  assert.ok(result.evaluation_id, 'expected an evaluation_id from persistence');
  assert.equal(result.security_event_persisted, true);
  const historyInsert = env.inserts.find(i => /publication_gate_evaluations/.test(i.sql));
  const securityInsert = env.inserts.find(i => /security_audit_events_v2/.test(i.sql));
  assert.ok(historyInsert, 'expected an evaluation-history row to be persisted');
  assert.ok(securityInsert, 'expected a security event row to be persisted');
});

test('evaluatePublicationGateAndPersist does not attempt security-event persistence when there is none', async () => {
  const env = fakeD1();
  const result = await evaluatePublicationGateAndPersist(env, strongRealInput, { report_id: 'report-4' });
  assert.equal(result.security_event_persisted, false);
  assert.equal(env.inserts.filter(i => /security_audit_events_v2/.test(i.sql)).length, 0);
});

test('a changed dataset_version produces a different input_hash, so a new immutable record would be created', async () => {
  const env = fakeD1();
  const decision = evaluatePublicationGate(strongRealInput);
  const before = await persistPublicationGateEvaluation(env, decision, { report_id: 'report-5', input: strongRealInput });
  const changedInput = { ...strongRealInput, dataset_version: 'v4-locked' };
  const after = await persistPublicationGateEvaluation(env, evaluatePublicationGate(changedInput), { report_id: 'report-5', input: changedInput });
  assert.notEqual(before.input_hash, after.input_hash);
});

test('persistence functions never throw even if the DB binding fails (never break the request behind them)', async () => {
  const brokenEnv = { DB: { prepare: () => { throw new Error('D1 unavailable'); } } };
  const decision = evaluatePublicationGate(crossTenantInput);
  const eventResult = await persistSecurityEvent(brokenEnv, decision.security_event, { report_id: 'report-6' });
  const historyResult = await persistPublicationGateEvaluation(brokenEnv, decision, { report_id: 'report-6', input: crossTenantInput });
  assert.equal(eventResult, null);
  assert.equal(historyResult, null);
});
