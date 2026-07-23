import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import application from '../src/application.js';
import { signJWT } from '../src/auth.js';

// ------------------------------------------------------------
// Fake D1 for POST /api/reports/generate. Routes on distinctive SQL
// substrings rather than a mocking library (this project has none — see
// tests/security-hardening.test.js for the same hand-rolled pattern).
// ------------------------------------------------------------
function fakeReportsDB({ hasResponses = false, orgId = 'org_1', throwOnGateInsert = false } = {}) {
  const calls = [];
  const respond = (sql, args, kind) => {
    calls.push({ sql, args, kind });

    if (/FROM users u JOIN organizations o/.test(sql)) return { user_active: 1, org_status: 'active' };
    if (/FROM report_templates WHERE id = \? AND is_active = 1/.test(sql)) {
      return { id: args[0], name: 'National Health Access Intelligence Report', sector: 'Health', sections_json: '[]', standards_json: '["SDG 3"]', target_page_band: '20-30', chart_defaults_json: '{}' };
    }
    if (/FROM organizations WHERE id = \?/.test(sql)) return { id: args[0], name: 'Test Org' };
    if (/FROM organization_branding WHERE organization_id = \?/.test(sql)) return null;
    if (/FROM campaigns c LEFT JOIN surveys s/.test(sql)) return null; // no campaign_id supplied in these tests
    if (/SELECT COUNT\(\*\) as n FROM responses r JOIN campaigns c.*AND r\.status = 'completed'/s.test(sql)) return { n: hasResponses ? 180 : 0 };
    if (/SELECT COUNT\(\*\) as n FROM responses/.test(sql)) return { n: hasResponses ? 240 : 0 };
    if (/AVG\(fraud_score\)/.test(sql)) return { avg_score: hasResponses ? 0.12 : null, flagged_count: 0 };
    if (/AVG\(CAST\(json_extract/.test(sql)) return { avg_confidence: hasResponses ? 0.91 : null };
    if (/security_audit_events_v2 WHERE correlation_id/.test(sql)) return null;
    return null;
  };
  const respondAll = (sql) => {
    calls.push({ sql, args: [], kind: 'all' });
    if (/SELECT r\.id, r\.status, r\.fraud_score, r\.completed_at, r\.started_at FROM responses/.test(sql)) {
      return { results: hasResponses ? [{ id: 'r1', status: 'completed', fraud_score: 0.1, completed_at: '2026-07-01T00:00:00Z', started_at: '2026-06-30T00:00:00Z' }, { id: 'r2', status: 'completed', fraud_score: 0.2, completed_at: '2026-07-02T00:00:00Z', started_at: '2026-06-30T00:00:00Z' }] : [] };
    }
    return { results: [] };
  };
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() { return respond(sql, args, 'first'); },
            async all() { return respondAll(sql); },
            async run() {
              calls.push({ sql, args, kind: 'run' });
              if (throwOnGateInsert && /publication_gate_evaluations/.test(sql) && /^INSERT/i.test(sql)) {
                throw new Error('D1 unavailable');
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

async function authedRequest({ env, body, role = 'org_admin' }) {
  const token = await signJWT({ sub: 'user_1', org: 'org_1', role, email: 'a@b.com' }, env.JWT_SECRET);
  return application.fetch(new Request('https://api.example/api/reports/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
}

function baseEnv(dbOptions) {
  return { JWT_SECRET: 'test-secret', ALLOW_LEGACY_SESSIONS: 'true', DB: fakeReportsDB(dbOptions) };
}

// ---------------------------------------------------------------
// 1/14 — Feature disabled: exact prior behavior (also proves rollback)
// ---------------------------------------------------------------
test('feature flag disabled: response matches the pre-pilot shape exactly (rollback behavior)', async () => {
  const env = baseEnv({});
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.report_id);
  assert.ok(body.document_model);
  assert.equal(body.publication_evaluation, undefined, 'canonical fields must not appear when the flag is off');
  assert.equal(body.rating_10, undefined, 'legacy adapter fields must not appear when the flag is off');
  const gateInserts = env.DB.calls.filter(c => c.kind === 'run' && /publication_gate_evaluations|security_audit_events_v2/.test(c.sql));
  assert.equal(gateInserts.length, 0, 'no canonical persistence should happen when the flag is off');
});

// ---------------------------------------------------------------
// Part 2 / Part 10 #4-7, #17 — RBAC role matrix (report.generate permission)
// ---------------------------------------------------------------
test('role matrix: report.generate is enforced correctly for every relevant role', async () => {
  const authorizedRoles = ['org_admin', 'super_admin', 'operations_manager', 'project_manager', 'head_of_programs', 'me_officer', 'data_analyst', 'founder_executive'];
  const deniedRoles = ['enumerator', 'respondent', 'unknown_role'];

  for (const role of authorizedRoles) {
    const env = baseEnv({});
    const res = await authedRequest({ env, body: { template_id: 'tmpl_health' }, role });
    assert.equal(res.status, 200, `${role} should be authorized to generate reports`);
  }
  for (const role of deniedRoles) {
    const env = baseEnv({});
    const res = await authedRequest({ env, body: { template_id: 'tmpl_health' }, role });
    assert.equal(res.status, 403, `${role} must be denied report generation`);
    const body = await res.json();
    assert.match(String(body.error || ''), /permission/i);
    const draftInsert = env.DB.calls.find(c => c.kind === 'run' && /INSERT INTO generated_reports/.test(c.sql));
    assert.equal(draftInsert, undefined, `${role} must not have a draft written for a denied request`);
  }
});

test('a denied generation request is recorded as a distinct audit event', async () => {
  const env = baseEnv({});
  await authedRequest({ env, body: { template_id: 'tmpl_health' }, role: 'enumerator' });
  const auditInsert = env.DB.calls.find(c => c.kind === 'run' && /INSERT INTO audit_logs/.test(c.sql) && c.args.includes('report_generation_denied'));
  assert.ok(auditInsert, 'expected a report_generation_denied audit event');
});

// ---------------------------------------------------------------
// Part 8 — audit logging coverage
// ---------------------------------------------------------------
test('audit trail covers requested, completed and canonical-evaluation-completed for a normal successful generation', async () => {
  const env = { ...baseEnv({}), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const actions = env.DB.calls.filter(c => c.kind === 'run' && /INSERT INTO audit_logs/.test(c.sql)).map(c => c.args[3]);
  assert.ok(actions.includes('report_generation_requested'), `expected report_generation_requested, got ${actions}`);
  assert.ok(actions.includes('report_generated'), `expected report_generated, got ${actions}`);
  assert.ok(actions.includes('canonical_evaluation_completed'), `expected canonical_evaluation_completed, got ${actions}`);
});

test('a tenant-integrity rejection (cross-org campaign_id) is audited distinctly from a generic failure', async () => {
  const env = baseEnv({});
  await authedRequest({ env, body: { template_id: 'tmpl_health', campaign_id: 'campaign_belonging_to_org_2' } });
  const actions = env.DB.calls.filter(c => c.kind === 'run' && /INSERT INTO audit_logs/.test(c.sql)).map(c => c.args[3]);
  assert.ok(actions.includes('report_generation_blocked_tenant_integrity'), `expected report_generation_blocked_tenant_integrity, got ${actions}`);
});

test('a canonical evaluation persistence failure is audited', async () => {
  const env = { ...baseEnv({ throwOnGateInsert: true }), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const actions = env.DB.calls.filter(c => c.kind === 'run' && /INSERT INTO audit_logs/.test(c.sql)).map(c => c.args[3]);
  assert.ok(actions.includes('canonical_evaluation_persistence_failed'), `expected canonical_evaluation_persistence_failed, got ${actions}`);
});

test('RBAC is enforced identically whether the canonical gate feature flag is on or off (a flag must not disable a security control)', async () => {
  for (const flag of [undefined, 'false', 'true']) {
    const env = { ...baseEnv({}), ...(flag !== undefined ? { CANONICAL_REPORT_GATE_ENABLED: flag } : {}) };
    const res = await authedRequest({ env, body: { template_id: 'tmpl_health' }, role: 'enumerator' });
    assert.equal(res.status, 403, `enumerator must be denied regardless of CANONICAL_REPORT_GATE_ENABLED=${flag}`);
  }
});

// ---------------------------------------------------------------
// 2/4 — Feature enabled: canonical fields present, draft still generated
// ---------------------------------------------------------------
test('feature flag enabled: draft is generated and canonical publication_evaluation is included', async () => {
  const env = { ...baseEnv({}), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.report_id);
  assert.ok(body.document_model, 'backward-compatible field must still be present');
  assert.ok(body.publication_evaluation, 'canonical result must be included when the flag is on');
  assert.equal(typeof body.publication_evaluation.publication_status, 'string');
  assert.equal(typeof body.publication_evaluation.score_state, 'string');
  const expectedRating = body.publication_evaluation.overall_score === null ? null : Math.round(body.publication_evaluation.overall_score) / 10;
  assert.equal(body.rating_10, expectedRating, 'legacy fields must be mapped from the canonical decision, not computed independently');
  if (body.publication_evaluation.score_state === 'NOT_EVALUATED' || body.publication_evaluation.score_state === 'INVALIDATED') {
    assert.equal(body.publication_evaluation.overall_score, null, `${body.publication_evaluation.score_state} must never carry a numeric score`);
    assert.equal(body.rating_10, null);
  }
});

// ---------------------------------------------------------------
// 6 — Missing evidence: draft generated, publication blocked
// ---------------------------------------------------------------
test('an honestly-empty report (zero responses, correctly labelled insufficient_evidence): draft is still generated, publication is BLOCKED/NOT_EVALUATED, not a false violation', async () => {
  const env = { ...baseEnv({ hasResponses: false }), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const body = await res.json();
  assert.equal(res.status, 200, 'draft generation must succeed even though publication will be blocked');
  assert.equal(body.report_generated, true);
  assert.equal(body.publication_ready, false);
  assert.equal(body.publication_evaluation.publication_status, 'BLOCKED');
  assert.equal(body.publication_evaluation.score_state, 'NOT_EVALUATED', 'a correctly-labelled zero-content report has nothing to score, not a violation to flag');
  assert.equal(body.publication_evaluation.overall_score, null, 'NOT_EVALUATED must never carry a numeric score (Part 1 invariant)');
  assert.equal(body.rating_10, null, 'the legacy rating field must also be null, not a fabricated 0');
  assert.equal(body.publication_evaluation.export_allowed, false);
});

test('with real response volume: still blocked on evidence traceability, because the customer pipeline has no evidence registry yet', async () => {
  const env = { ...baseEnv({ hasResponses: true }), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.report_generated, true);
  assert.equal(body.publication_evaluation.publication_status, 'BLOCKED');
  assert.equal(body.publication_evaluation.report_type ?? body.document_model.kpis.total_responses > 0, true);
});

// ---------------------------------------------------------------
// 5 — Evaluation persistence
// ---------------------------------------------------------------
test('canonical evaluation is persisted to publication_gate_evaluations', async () => {
  const env = { ...baseEnv({}), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.publication_evaluation.evaluation_id, 'expected a persisted evaluation_id');
  const historyInsert = env.DB.calls.find(c => c.kind === 'run' && /INSERT INTO publication_gate_evaluations/.test(c.sql));
  assert.ok(historyInsert, 'expected an INSERT into publication_gate_evaluations');
  assert.equal(historyInsert.args[1], body.report_id, 'the persisted row must reference this report_id');
});

// ---------------------------------------------------------------
// 10 — Persistence failure during draft generation is a warning, not a
// hard failure
// ---------------------------------------------------------------
test('persistence failure during ordinary draft generation returns an explicit warning and still returns the report', async () => {
  const env = { ...baseEnv({ throwOnGateInsert: true }), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const body = await res.json();
  assert.equal(res.status, 200, 'a persistence failure must not fail ordinary report generation');
  assert.equal(body.ok, true);
  assert.ok(body.report_id);
  assert.ok(body.publication_evaluation_warning, 'expected an explicit warning field');
  assert.match(body.publication_evaluation_warning, /could not be persisted/);
  assert.equal(body.publication_evaluation.evaluation_id, null, 'must not falsely claim the evaluation was persisted');
});

// ---------------------------------------------------------------
// Part 11 — Architectural guard for this pilot route only.
// ---------------------------------------------------------------
function routeSourceSlice() {
  const src = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  const start = src.indexOf(`if (path === '/api/reports/generate' && method === 'POST') {`);
  assert.ok(start >= 0, 'could not locate the route in application.js — has it moved?');
  const end = src.indexOf('// Phase 20 — internal procurement-grade report experience package.', start);
  assert.ok(end > start, 'could not locate the end boundary of the route');
  return src.slice(start, end);
}

test('architectural guard: the route has an authentication call AND a report-generation permission check', () => {
  const slice = routeSourceSlice();
  assert.match(slice, /requireAuth\(request, ?env\)/, 'expected requireAuth');
  assert.match(slice, /assertPermission\(claims\.role, ?'report\.generate'\)/, 'expected an explicit report.generate permission check');
});

test('architectural guard: the permission check appears before the canonical-gate feature-flag block, so the flag cannot disable it', () => {
  const slice = routeSourceSlice();
  const permissionIndex = slice.indexOf(`assertPermission(claims.role, 'report.generate')`);
  const flagBlockIndex = slice.indexOf('if (canonicalGateEnabled)');
  assert.ok(permissionIndex >= 0, 'permission check not found');
  assert.ok(flagBlockIndex >= 0, 'feature-flag block not found');
  assert.ok(permissionIndex < flagBlockIndex, 'the permission check must be unconditional, evaluated before the feature-flag-guarded section');
});

test('architectural guard: the pilot route never imports/calls the synthetic sample validator', () => {
  const slice = routeSourceSlice();
  assert.doesNotMatch(slice, /validateSyntheticSample/, 'this route must never run the synthetic sample validator — it only ever handles real customer reports');
  assert.doesNotMatch(slice, /evaluateFlagshipPublication\(/, 'this route must not call the underlying synthetic-sample engine either');
});

test('architectural guard: the pilot route does not bypass canonical persistence when the feature is enabled', () => {
  const slice = routeSourceSlice();
  assert.match(slice, /evaluatePublicationGateAndPersist\(/, 'the route must call the persisting wrapper, not the bare pure evaluatePublicationGate, so evaluation history is never silently skipped');
});

test('architectural guard: the pilot route maps legacy fields only through toLegacyPublicationFields', () => {
  const slice = routeSourceSlice();
  assert.match(slice, /toLegacyPublicationFields\(/, 'legacy fields (rating_10, status, export_allowed, ...) must come from the canonical adapter');
  // toLegacyPublicationFields must be called with the canonical decision's
  // own fields (publicationEvaluation.*), not a hand-built object sourced
  // from anywhere else.
  const call = slice.match(/toLegacyPublicationFields\(\{([\s\S]*?)\}\)/);
  assert.ok(call, 'expected an inline object literal passed to toLegacyPublicationFields');
  assert.match(call[1], /publicationEvaluation\.publication_status/);
  assert.match(call[1], /publicationEvaluation\.overall_score/);
  assert.match(call[1], /publicationEvaluation\.export_allowed/);
});

test('architectural guard: export_allowed/publication_ready/publication_status are never read off a specialized validator result', () => {
  const slice = routeSourceSlice();
  // evidenceTrustResult and internationalResult are the two specialized
  // validator variables in this route (Part 4). Per Part 3, a specialized
  // validator must never independently declare export/publication
  // authority — this asserts the route never reads those fields off them.
  for (const validatorVar of ['evidenceTrustResult', 'internationalResult']) {
    const pattern = new RegExp(`${validatorVar}\\.(export_allowed|publication_ready|publication_status)\\b`);
    assert.doesNotMatch(slice, pattern, `${validatorVar} must not be read for publication authority — only the canonical decision may declare that`);
  }
});

// ---------------------------------------------------------------
// Part 3 / Part 10 #9-11 — Project/campaign ownership validation.
// A campaign_id that does not belong to the caller's organization must be
// explicitly REJECTED, not silently downgraded to an organization-wide
// report as if no campaign_id had been supplied at all.
// ---------------------------------------------------------------
test('a campaign_id belonging to a different organization is explicitly rejected with a safe, tenant-blind 404, never silently downgraded to org-wide', async () => {
  const env = baseEnv({});
  // fakeReportsDB always returns null for the campaign lookup (simulating
  // "not found for this org") — exactly what buildDocumentModel's own
  // "WHERE c.id = ? AND c.organization_id = ?" join returns for real.
  env.CANONICAL_REPORT_GATE_ENABLED = 'true';
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health', campaign_id: 'campaign_belonging_to_org_2' } });
  const body = await res.json();
  assert.equal(res.status, 404, 'Part 2: safe not-found status, not a leaky 400');
  assert.equal(body.error, 'Report scope was not found or is not available.', 'must not confirm or deny whether the campaign_id exists at all');
  assert.doesNotMatch(JSON.stringify(body), /campaign_belonging_to_org_2|Campaign not found/, 'must never echo the requested id or the internal reason back to the client');
  const draftInsert = env.DB.calls.find(c => c.kind === 'run' && /INSERT INTO generated_reports/.test(c.sql));
  assert.equal(draftInsert, undefined, 'no draft or any report content may be returned for a rejected cross-org scope request');
});

test('a genuinely organization-wide request (no campaign_id at all) is accepted and explicitly labelled ORGANIZATION scope', async () => {
  const env = { ...baseEnv({}), CANONICAL_REPORT_GATE_ENABLED: 'true' };
  const res = await authedRequest({ env, body: { template_id: 'tmpl_health' } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.document_model.metadata.scope_type, 'ORGANIZATION');
  assert.equal(body.publication_evaluation.scope_type, 'ORGANIZATION');
});

// ---------------------------------------------------------------
// 13 — scoreReportQuality() callers outside this route are unaffected
// ---------------------------------------------------------------
test('scoreReportQuality() itself and its existing GET /api/reports/:id/quality-score caller are untouched by this route', () => {
  const src = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  assert.match(src, /const scores = scoreReportQuality\(JSON\.parse\(reportRow\.document_model_json\)\);/, 'the pre-existing quality-score endpoint must still call scoreReportQuality unchanged');
});

// ---------------------------------------------------------------
// Not exercisable at the route level today (documented, not fabricated):
// ---------------------------------------------------------------
// - "Missing approval produces provisional status" (Part 10 #7): the
//   customer documentModel has no approvals concept yet — the adapter
//   always passes approvals:{required:[],completed:[]}, which the
//   canonical gate correctly treats as not-applicable, not as a gap.
//   PROVISIONAL/approval-gap behavior is already covered at the function
//   level in tests/publication-gate-canonical.test.js (Fixture D).
// - "Cross-tenant evidence blocks..." / "Repeated identical evaluation
//   does not create duplicate security alerts" (Part 10 #8-9): this
//   route always assembles documentModel from a single effectiveOrgId,
//   so organization_id and requested_by_org_id are always equal —
//   CROSS_TENANT_REFERENCE cannot fire through this route's real data
//   flow. Already covered at the function/persistence level in
//   tests/publication-gate-canonical.test.js (Fixture G) and
//   tests/publication-gate-persistence.test.js.
