// Enterprise Market Validation Release, Part B — Expert Feedback Programme,
// built for real this time (RC1 shipped only the written specification).
// Fake D1 pattern matches tests/publication-gate-route-pilot.test.js — this
// project has no mocking library, so routing on distinctive SQL substrings
// is the established convention.
import test from 'node:test';
import assert from 'node:assert/strict';
import application from '../src/application.js';
import { signJWT } from '../src/auth.js';

const VALID_SCORES = { product: 3, deployment: 3, procurement: 3, implementation: 3, offline_capability: 3, ai_capability: 3, publications: 3, value_proposition: 3 };

function fakeExpertFeedbackDB({ existingRecord = null } = {}) {
  const calls = [];
  const rateLimitRows = new Map();
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              calls.push({ sql, args, kind: 'first' });
              if (/FROM users u JOIN organizations o/.test(sql)) return { user_active: 1, org_status: 'active' };
              if (/FROM rate_limits WHERE rate_key = \?/.test(sql)) return rateLimitRows.get(args[0]) || null;
              if (/FROM expert_feedback WHERE id = \?/.test(sql)) {
                return existingRecord && existingRecord.id === args[0] ? existingRecord : null;
              }
              return null;
            },
            async all() {
              calls.push({ sql, args, kind: 'all' });
              if (/FROM expert_feedback/.test(sql)) return { results: existingRecord ? [existingRecord] : [] };
              return { results: [] };
            },
            async run() {
              calls.push({ sql, args, kind: 'run' });
              if (/INSERT INTO rate_limits/.test(sql)) rateLimitRows.set(args[0], { count: 1, window_start: args[1] });
              if (/UPDATE rate_limits SET count = count \+ 1/.test(sql)) {
                const row = rateLimitRows.get(args[0]);
                if (row) row.count += 1;
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function baseEnv(opts) {
  return { JWT_SECRET: 'test-secret', ALLOW_LEGACY_SESSIONS: 'true', DB: fakeExpertFeedbackDB(opts) };
}

async function submit(env, body, ip = '203.0.113.1') {
  return application.fetch(new Request('https://api.example/api/expert-feedback/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  }), env);
}

async function authedGet(env, path, role = 'super_admin') {
  const token = await signJWT({ sub: 'user_1', org: 'org_1', role, email: 'a@b.com' }, env.JWT_SECRET);
  return application.fetch(new Request(`https://api.example${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }), env);
}

test('a well-formed submission is accepted and inserted', async () => {
  const env = baseEnv({});
  const res = await submit(env, { reviewer_category: 'hospital_executive', reviewer_name: 'Dr. Test', scores: VALID_SCORES, free_text: 'Clear overall.' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.id);
  const insert = env.DB.calls.find(c => c.kind === 'run' && /INSERT INTO expert_feedback/.test(c.sql));
  assert.ok(insert, 'expected an INSERT INTO expert_feedback');
  assert.equal(insert.args[1], 'hospital_executive');
});

test('an invalid reviewer_category is rejected before any insert', async () => {
  const env = baseEnv({});
  const res = await submit(env, { reviewer_category: 'not_a_real_category', scores: VALID_SCORES });
  assert.equal(res.status, 400);
  assert.equal(env.DB.calls.some(c => c.kind === 'run' && /INSERT INTO expert_feedback/.test(c.sql)), false);
});

test('every one of the 8 scored questions is required and must be an integer 1-4', async () => {
  const env = baseEnv({});
  for (const [key, badValue] of [['product', 0], ['product', 5], ['product', 'clear'], ['value_proposition', undefined]]) {
    const scores = { ...VALID_SCORES, [key]: badValue };
    if (badValue === undefined) delete scores[key];
    const res = await submit(env, { reviewer_category: 'government', scores });
    assert.equal(res.status, 400, `expected rejection for ${key}=${badValue}`);
  }
  const missingQuestion = { ...VALID_SCORES };
  delete missingQuestion.ai_capability;
  const res = await submit(env, { reviewer_category: 'government', scores: missingQuestion });
  assert.equal(res.status, 400, 'missing a question entirely must be rejected');
});

test('a 6th submission from the same IP within the window is rate-limited', async () => {
  const env = baseEnv({});
  for (let i = 0; i < 5; i++) {
    const res = await submit(env, { reviewer_category: 'government', scores: VALID_SCORES }, '198.51.100.9');
    assert.equal(res.status, 201, `submission ${i + 1} should succeed`);
  }
  const sixth = await submit(env, { reviewer_category: 'government', scores: VALID_SCORES }, '198.51.100.9');
  assert.equal(sixth.status, 429);
});

test('GET /api/expert-feedback requires super_admin — every other role is denied', async () => {
  const env = baseEnv({});
  const deniedRoles = ['org_admin', 'me_officer', 'enumerator', 'project_manager'];
  for (const role of deniedRoles) {
    const res = await authedGet(env, '/api/expert-feedback', role);
    assert.equal(res.status, 403, `${role} must not read expert feedback`);
  }
  const allowed = await authedGet(env, '/api/expert-feedback', 'super_admin');
  assert.equal(allowed.status, 200);
});

test('GET /api/expert-feedback/:id returns the scores as a parsed object, and 404s for an unknown id', async () => {
  const record = { id: 'expfb_1', reviewer_category: 'me_specialist', reviewer_name: 'Test', reviewer_email: null, organization: null, scores_json: JSON.stringify(VALID_SCORES), free_text: null, status: 'new', created_at: '2026-07-21T00:00:00Z' };
  const env = baseEnv({ existingRecord: record });
  const found = await authedGet(env, '/api/expert-feedback/expfb_1');
  assert.equal(found.status, 200);
  const foundBody = await found.json();
  assert.deepEqual(foundBody.feedback.scores, VALID_SCORES);
  const missing = await authedGet(env, '/api/expert-feedback/expfb_does_not_exist');
  assert.equal(missing.status, 404);
});
