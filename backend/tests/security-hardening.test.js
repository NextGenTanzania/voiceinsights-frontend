// tests/security-hardening.test.js
// Verifies the V212 hardening + maintainability refactor:
//   1. CORS allowlist replaces the wildcard (security-layer.js)
//   2. Query-string tokens only accepted on media routes (utils.requireAuth)
//   3. TD-001 retention cleanup deletes old operational log rows (ops-cron.js)
//   4. The extracted modules and index.js module graph resolve completely
import { test } from 'node:test';
import assert from 'node:assert';
import { resolveAllowedOrigin, applyCorsPolicy } from '../src/security-layer.js';
import { requireAuth } from '../src/utils.js';
import { signJWT } from '../src/auth.js';
import { cleanupOperationalLogs } from '../src/ops-cron.js';

const ENV = { SITE_URL: 'https://voiceinsightsafrica.com' };
const req = (origin, url = 'https://api.example.com/api/x') =>
  new Request(url, { headers: origin ? { Origin: origin } : {} });

// ---------- 1. CORS allowlist ----------

test('CORS: SITE_URL origin is allowed', () => {
  assert.strictEqual(resolveAllowedOrigin(req('https://voiceinsightsafrica.com'), ENV), 'https://voiceinsightsafrica.com');
});

test('CORS: www variant of SITE_URL is allowed automatically', () => {
  assert.strictEqual(resolveAllowedOrigin(req('https://www.voiceinsightsafrica.com'), ENV), 'https://www.voiceinsightsafrica.com');
});

test('CORS: an arbitrary attacker origin is rejected', () => {
  assert.strictEqual(resolveAllowedOrigin(req('https://evil-site.example'), ENV), null);
});

test('CORS: ALLOWED_ORIGINS adds extra exact origins', () => {
  const env = { ...ENV, ALLOWED_ORIGINS: 'https://portal.partner.org, https://demo.client.com' };
  assert.strictEqual(resolveAllowedOrigin(req('https://portal.partner.org'), env), 'https://portal.partner.org');
  assert.strictEqual(resolveAllowedOrigin(req('https://other.partner.org'), env), null);
});

test('CORS: localhost allowed in dev, blocked by STRICT_CORS', () => {
  assert.strictEqual(resolveAllowedOrigin(req('http://localhost:8788'), ENV), 'http://localhost:8788');
  assert.strictEqual(resolveAllowedOrigin(req('http://localhost:8788'), { ...ENV, STRICT_CORS: 'true' }), null);
});

test('CORS: *.pages.dev preview allowed in dev, blocked by STRICT_CORS', () => {
  assert.strictEqual(resolveAllowedOrigin(req('https://preview.voiceinsights.pages.dev'), ENV), 'https://preview.voiceinsights.pages.dev');
  assert.strictEqual(resolveAllowedOrigin(req('https://preview.voiceinsights.pages.dev'), { ...ENV, STRICT_CORS: 'true' }), null);
});

test('CORS: request without Origin header gets no ACAO (webhooks/curl unaffected)', () => {
  assert.strictEqual(resolveAllowedOrigin(req(null), ENV), null);
});

test('applyCorsPolicy: allowed origin replaces wildcard and adds Vary + security headers', () => {
  const upstream = new Response('{}', { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  const out = applyCorsPolicy(upstream, req('https://voiceinsightsafrica.com'), ENV);
  assert.strictEqual(out.headers.get('Access-Control-Allow-Origin'), 'https://voiceinsightsafrica.com');
  assert.match(out.headers.get('Vary') || '', /Origin/);
  assert.strictEqual(out.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.strictEqual(out.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

test('applyCorsPolicy: disallowed origin gets NO Access-Control-Allow-Origin at all', () => {
  const upstream = new Response('{}', { headers: { 'Access-Control-Allow-Origin': '*' } });
  const out = applyCorsPolicy(upstream, req('https://evil-site.example'), ENV);
  assert.strictEqual(out.headers.get('Access-Control-Allow-Origin'), null);
});

test('applyCorsPolicy: preserves status and body', async () => {
  const upstream = new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Access-Control-Allow-Origin': '*' } });
  const out = applyCorsPolicy(upstream, req('https://voiceinsightsafrica.com'), ENV);
  assert.strictEqual(out.status, 201);
  assert.deepStrictEqual(await out.json(), { ok: true });
});

// ---------- 2. Query-string token restriction ----------

function fakeActiveAccountDB() {
  return {
    prepare: () => ({ bind: () => ({ first: async () => ({ user_active: 1, org_status: 'active' }) }) }),
  };
}

test('requireAuth: ?token= accepted on /api/audio/ (audio tags cannot set headers)', async () => {
  const secret = 'test-secret';
  const token = await signJWT({ sub: 'u1', role: 'org_admin' }, secret);
  const request = new Request(`https://api.x/api/audio/some-key.mp3?token=${encodeURIComponent(token)}`);
  const claims = await requireAuth(request, { JWT_SECRET: secret, DB: fakeActiveAccountDB(), ALLOW_LEGACY_SESSIONS: 'true' });
  assert.strictEqual(claims.sub, 'u1');
});

test('requireAuth: ?token= accepted on /api/photos/ and /api/documents/', async () => {
  const secret = 'test-secret';
  const token = await signJWT({ sub: 'u1', role: 'org_admin' }, secret);
  for (const p of ['/api/photos/k.jpg', '/api/documents/k.pdf']) {
    const claims = await requireAuth(new Request(`https://api.x${p}?token=${encodeURIComponent(token)}`), { JWT_SECRET: secret, DB: fakeActiveAccountDB(), ALLOW_LEGACY_SESSIONS: 'true' });
    assert.strictEqual(claims.sub, 'u1');
  }
});

test('requireAuth: ?token= REJECTED on ordinary API routes (must use Authorization header)', async () => {
  const secret = 'test-secret';
  const token = await signJWT({ sub: 'u1', role: 'org_admin' }, secret);
  const request = new Request(`https://api.x/api/dashboard/stats?token=${encodeURIComponent(token)}`);
  await assert.rejects(
    requireAuth(request, { JWT_SECRET: secret, DB: fakeActiveAccountDB(), ALLOW_LEGACY_SESSIONS: 'true' }),
    (e) => e.status === 401
  );
});

test('requireAuth: Authorization header still works everywhere', async () => {
  const secret = 'test-secret';
  const token = await signJWT({ sub: 'u1', role: 'org_admin' }, secret);
  const request = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  const claims = await requireAuth(request, { JWT_SECRET: secret, DB: fakeActiveAccountDB(), ALLOW_LEGACY_SESSIONS: 'true' });
  assert.strictEqual(claims.sub, 'u1');
});

// ---------- 3. TD-001 retention cleanup ----------

test('cleanupOperationalLogs deletes one bounded batch per table, older than cutoff', async () => {
  const executed = [];
  const env = {
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: async () => { executed.push({ sql, args }); return { meta: { changes: 42 } }; },
        }),
      }),
    },
  };
  const result = await cleanupOperationalLogs(env, { retentionDays: 90, batchLimit: 500 });
  assert.strictEqual(executed.length, 2);
  assert.match(executed[0].sql, /DELETE FROM ai_retry_cron_log/);
  assert.match(executed[0].sql, /started_at < \?/);
  assert.match(executed[1].sql, /DELETE FROM ai_processing_attempts_log/);
  assert.match(executed[1].sql, /attempted_at < \?/);
  // batch limit bound so a single Cron tick can never run long
  assert.strictEqual(executed[0].args[1], 500);
  assert.deepStrictEqual(result, { ai_retry_cron_log: 42, ai_processing_attempts_log: 42 });
});

test('cleanupOperationalLogs never throws — a broken table is reported, not fatal', async () => {
  const env = { DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('no such table'); } }) }) } };
  const result = await cleanupOperationalLogs(env);
  assert.match(String(result.ai_retry_cron_log), /skipped/);
  assert.match(String(result.ai_processing_attempts_log), /skipped/);
});

// ---------- 4. Refactor wiring: modules + full index.js graph resolve ----------

test('extracted modules export the expected functions', async () => {
  const scope = await import('../src/request-scope.js');
  for (const f of ['getEffectiveOrgId', 'getAssignedCampaignId', 'getEffectiveCampaignFilter', 'isOverRateLimit', 'recordFailedAttempt', 'isRateLimited', 'logAudit']) assert.strictEqual(typeof scope[f], 'function', f);
  const notif = await import('../src/notifications.js');
  for (const f of ['pushToAllSuperAdmins', 'pushToOrgAdmins', 'sendPushNotification', 'sendEmail']) assert.strictEqual(typeof notif[f], 'function', f);
  const chan = await import('../src/channel-pipeline.js');
  for (const f of ['getOrCreateSession', 'submitAnswer', 'handleWhatsAppWebhook', 'handleVoiceIncoming', 'handleSmsWebhook', 'handleWebSubmit', 'runFraudChecks', 'twiml']) assert.strictEqual(typeof chan[f], 'function', f);
  const bill = await import('../src/billing-export.js');
  for (const f of ['handleCsvExport', 'handleCreateCheckoutSession', 'handleStripeWebhook', 'verifyStripeSignature']) assert.strictEqual(typeof bill[f], 'function', f);
  const ops = await import('../src/ops-cron.js');
  for (const f of ['processReportSchedules', 'checkProjectsBehindSchedule', 'recordHealthSnapshot', 'processNextRotationBatch', 'cleanupOperationalLogs']) assert.strictEqual(typeof ops[f], 'function', f);
});

test('index.js full module graph resolves and exposes fetch + scheduled', async () => {
  const worker = (await import('../src/application.js')).default;
  assert.strictEqual(typeof worker.fetch, 'function');
  assert.strictEqual(typeof worker.scheduled, 'function');
});
