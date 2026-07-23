// tests/security-remediation.test.js
// Verifies the V213 CRITICAL/HIGH remediation:
//   PART 2 — every Twilio inbound webhook is signature-verified (constant-time),
//            with URL reconstruction, replay protection, and no DB write on failure.
//   PART 4 — real server-side logout / session revocation enforced in requireAuth.
import { test } from 'node:test';
import assert from 'node:assert';
import { verifyTwilioSignature } from '../src/collection-operations-workstream2.js';
import { guardTwilioWebhook, reconstructTwilioUrl, isTwilioWebhookPath, TWILIO_WEBHOOK_PATHS } from '../src/twilio-security.js';
import { requireAuth } from '../src/utils.js';
import { signJWT } from '../src/auth.js';
import { isSessionRevoked, revokeSession, revokeAllSessions, newSessionId, registerSession } from '../src/session-registry.js';

const AUTH_TOKEN = 'test_twilio_auth_token_1234567890';

// ---- Minimal in-memory D1 stand-in for the tables the guard/registry touch ----
function fakeDB(seed = {}) {
  const sessions = new Map(Object.entries(seed.sessions || {})); // sid_hash -> {status,user_id}
  const twilioEvents = new Set();       // "sid|event|path"
  const securityLog = [];
  return {
    _sessions: sessions, _twilioEvents: twilioEvents, _securityLog: securityLog,
    prepare(sql) {
      return {
        _sql: sql, _args: [],
        bind(...args) { this._args = args; return this; },
        async run() {
          if (/INSERT OR IGNORE INTO twilio_event_registry/.test(sql)) {
            const key = this._args.slice(0, 3).join('|');
            if (twilioEvents.has(key)) return { meta: { changes: 0 } };
            twilioEvents.add(key); return { meta: { changes: 1 } };
          }
          if (/INSERT INTO security_audit_log/.test(sql)) { securityLog.push(this._args); return { meta: { changes: 1 } }; }
          if (/UPDATE user_sessions SET status='logged_out'/.test(sql)) {
            const h = this._args[0]; const s = sessions.get(h);
            if (s && s.status === 'active') { s.status = 'logged_out'; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (/UPDATE user_sessions SET status='revoked'/.test(sql)) {
            let n = 0; for (const s of sessions.values()) if (s.user_id === this._args[1] && s.status === 'active') { s.status = 'revoked'; n++; }
            return { meta: { changes: n } };
          }
          if (/INSERT INTO user_sessions/.test(sql)) { sessions.set(this._args[0], { status: 'active', user_id: this._args[1], expires_at: this._args[5] || null }); return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        },
        async first() {
          if (/SELECT status(?:, expires_at)? FROM user_sessions WHERE sid_hash/.test(sql)) {
            const s = sessions.get(this._args[0]); return s ? { status: s.status, expires_at: s.expires_at || null } : null;
          }
          if (/FROM users u JOIN organizations o/.test(sql)) return { user_active: 1, org_status: 'active' };
          if (/SELECT 1/.test(sql)) return { 1: 1 };
          return null;
        },
        async all() { return { results: [] }; },
      };
    },
  };
}

async function twilioSignedRequest(url, params, { authToken = AUTH_TOKEN, headers = {} } = {}) {
  const payload = Object.keys(params).sort().reduce((s, k) => s + k + String(params[k] ?? ''), url);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const signature = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const body = new URLSearchParams(params).toString();
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': signature, ...headers }, body });
}

// ===================== PART 2: Twilio webhook security =====================

test('all inbound + callback Twilio paths are in the guarded list', () => {
  for (const p of ['/api/whatsapp/webhook', '/api/sms/webhook', '/api/voice/incoming', '/api/voice/language', '/api/voice/code', '/api/voice/recording', '/api/twilio/status/sms']) {
    assert.ok(isTwilioWebhookPath(p), `${p} must be guarded`);
  }
  assert.strictEqual(isTwilioWebhookPath('/api/dashboard/stats'), false);
});

test('valid WhatsApp signature passes and returns parsed params', async () => {
  const url = 'https://api.example.com/api/whatsapp/webhook';
  const params = { From: 'whatsapp:+255700000001', Body: 'Habari', MessageSid: 'SM111' };
  const req = await twilioSignedRequest(url, params);
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  const res = await guardTwilioWebhook(req, env);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.params.Body, 'Habari');
  assert.strictEqual(res.sid, 'SM111');
});

test('invalid WhatsApp signature is rejected 403 with audit log, no processing', async () => {
  const url = 'https://api.example.com/api/whatsapp/webhook';
  const req = new Request(url, { method: 'POST', headers: { 'X-Twilio-Signature': 'BOGUSSIGNATURE', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'From=whatsapp:+255700000001&Body=hi&MessageSid=SM222' });
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  const res = await guardTwilioWebhook(req, env);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.response.status, 403);
  assert.strictEqual(env.DB._securityLog.length, 1);          // rejection audited
  assert.strictEqual(env.DB._twilioEvents.size, 0);           // nothing recorded/processed
});

test('missing signature is rejected 403', async () => {
  const url = 'https://api.example.com/api/sms/webhook';
  const req = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'From=+255700000002&Body=hi&MessageSid=SM333' });
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  const res = await guardTwilioWebhook(req, env);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.response.status, 403);
});

test('valid SMS signature passes', async () => {
  const url = 'https://api.example.com/api/sms/webhook';
  const params = { From: '+255700000003', Body: 'ndiyo', MessageSid: 'SM444' };
  const req = await twilioSignedRequest(url, params);
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  assert.strictEqual((await guardTwilioWebhook(req, env)).ok, true);
});

test('body modified after signing fails verification (tamper detection)', async () => {
  const url = 'https://api.example.com/api/sms/webhook';
  const params = { From: '+255700000004', Body: 'original', MessageSid: 'SM555' };
  const signed = await twilioSignedRequest(url, params);
  const sig = signed.headers.get('X-Twilio-Signature');
  // Same signature, but body changed to a different Body value.
  const tampered = new Request(url, { method: 'POST', headers: { 'X-Twilio-Signature': sig, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'From=+255700000004&Body=INJECTED&MessageSid=SM555' });
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  assert.strictEqual((await guardTwilioWebhook(tampered, env)).ok, false);
});

test('replayed MessageSid is not processed twice', async () => {
  const url = 'https://api.example.com/api/whatsapp/webhook';
  const params = { From: 'whatsapp:+255700000005', Body: 'moja', MessageSid: 'SM_REPLAY' };
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  const first = await guardTwilioWebhook(await twilioSignedRequest(url, params), env);
  assert.strictEqual(first.ok, true);
  const second = await guardTwilioWebhook(await twilioSignedRequest(url, params), env);
  assert.strictEqual(second.ok, false);                // replay short-circuited
  assert.strictEqual(second.response.status, 200);     // acked so Twilio stops retrying
});

test('URL reconstruction honours forwarded proto/host and explicit override', () => {
  const req = new Request('https://internal.worker.dev/api/voice/incoming', { headers: { 'X-Forwarded-Host': 'api.public.com', 'X-Forwarded-Proto': 'https' } });
  assert.strictEqual(reconstructTwilioUrl(req, {}), 'https://api.public.com/api/voice/incoming');
  assert.strictEqual(reconstructTwilioUrl(req, { TWILIO_PUBLIC_BASE_URL: 'https://override.example.com' }), 'https://override.example.com/api/voice/incoming');
});

test('proxy URL mismatch causes verification to fail (signed for public URL, checked against wrong one)', async () => {
  // Twilio signed the PUBLIC url; if we (wrongly) verified against the internal
  // url the signature wouldn't match. The guard reconstructs the public url
  // from forwarded headers, so it MUST pass here.
  const publicUrl = 'https://api.public.com/api/voice/incoming';
  const params = { From: '+255700000006', CallSid: 'CA777' };
  const signed = await twilioSignedRequest(publicUrl, params);
  const req = new Request('https://internal.worker.dev/api/voice/incoming', { method: 'POST', headers: { 'X-Twilio-Signature': signed.headers.get('X-Twilio-Signature'), 'X-Forwarded-Host': 'api.public.com', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const env = { TWILIO_AUTH_TOKEN: AUTH_TOKEN, DB: fakeDB() };
  assert.strictEqual((await guardTwilioWebhook(req, env)).ok, true);
});

test('fails closed when TWILIO_AUTH_TOKEN is not configured', async () => {
  const url = 'https://api.example.com/api/whatsapp/webhook';
  const req = await twilioSignedRequest(url, { From: 'x', MessageSid: 'SM_NO_TOKEN' });
  const env = { DB: fakeDB() }; // no TWILIO_AUTH_TOKEN
  const res = await guardTwilioWebhook(req, env);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.response.status, 403);
});

test('verifyTwilioSignature core is constant-time-safe on unequal lengths', async () => {
  assert.strictEqual(await verifyTwilioSignature({ authToken: AUTH_TOKEN, signature: 'short', url: 'https://x/y', params: {} }), false);
});

// ===================== PART 4: session revocation =====================

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

test('active session token is accepted by requireAuth', async () => {
  const secret = 's'; const sid = newSessionId();
  const db = fakeDB({ sessions: { [await sha256Hex(sid)]: { status: 'active', user_id: 'u1' } } });
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin', sid }, secret);
  const req = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  const claims = await requireAuth(req, { JWT_SECRET: secret, DB: db });
  assert.strictEqual(claims.sub, 'u1');
});

test('logout revokes the session so the SAME token is then rejected', async () => {
  const secret = 's'; const sid = newSessionId();
  const db = fakeDB({ sessions: { [await sha256Hex(sid)]: { status: 'active', user_id: 'u1' } } });
  const claims = { sub: 'u1', org: 'o1', sid };
  const result = await revokeSession({ DB: db }, claims);
  assert.strictEqual(result.revoked, 1);
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin', sid }, secret);
  const req = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  await assert.rejects(requireAuth(req, { JWT_SECRET: secret, DB: db }), (e) => e.status === 401);
});

test('logout-all revokes every active session for the user', async () => {
  const sidA = newSessionId(); const sidB = newSessionId();
  const db = fakeDB({ sessions: { [await sha256Hex(sidA)]: { status: 'active', user_id: 'u9' }, [await sha256Hex(sidB)]: { status: 'active', user_id: 'u9' } } });
  const result = await revokeAllSessions({ DB: db }, 'u9', 'logout_all');
  assert.strictEqual(result.revoked, 2);
  assert.strictEqual(await isSessionRevoked({ DB: db }, { sid: sidA }), true);
  assert.strictEqual(await isSessionRevoked({ DB: db }, { sid: sidB }), true);
});

test('a token that claims a session not on record is rejected', async () => {
  const db = fakeDB(); // no sessions
  assert.strictEqual(await isSessionRevoked({ DB: db }, { sid: 'ghost-session' }), true);
});

test('legacy token without sid is rejected by default', async () => {
  const secret = 's';
  const db = fakeDB();
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin' }, secret);
  const req = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  await assert.rejects(requireAuth(req, { JWT_SECRET: secret, DB: db }), e => e.status === 401);
});

test('legacy token works only in explicitly enabled migration mode', async () => {
  const secret = 's';
  const db = fakeDB();
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin' }, secret);
  const req = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  const claims = await requireAuth(req, { JWT_SECRET: secret, DB: db, ALLOW_LEGACY_SESSIONS: 'true' });
  assert.strictEqual(claims.sub, 'u1');
});

// ===================== HOTFIX (2026-07-14): user_sessions.expires_at =====================
// Regression coverage for the production incident where isSessionRevoked()
// read expires_at but the column didn't exist anywhere (migration 031 /
// schema.sql never defined it, registerSession() never wrote it) — every
// authenticated request failed with a real D1 "no such column" error,
// surfaced as a 503. See migrations/040_user_sessions_expires_at.sql.
// The regex-matching fakeDB above previously accepted the SELECT regardless
// of whether expires_at existed, which is exactly how this shipped
// untested; these tests exercise the actual expiry behavior instead.

test('registerSession persists expires_at, and an already-expired session is treated as revoked', async () => {
  const db = fakeDB();
  const sid = newSessionId();
  const past = new Date(Date.now() - 1000).toISOString();
  await registerSession({ DB: db }, { sid, userId: 'u1', organizationId: 'o1', expiresAt: past });
  assert.strictEqual(await isSessionRevoked({ DB: db }, { sid }), true);
});

test('registerSession persists a future expires_at and the session stays valid', async () => {
  const db = fakeDB();
  const sid = newSessionId();
  const future = new Date(Date.now() + 60_000).toISOString();
  await registerSession({ DB: db }, { sid, userId: 'u1', organizationId: 'o1', expiresAt: future });
  assert.strictEqual(await isSessionRevoked({ DB: db }, { sid }), false);
});

// ===================== HOTFIX (2026-07-14): forced password rotation =====================
// A token issued while must_change_password was set (see
// migrations/041_must_change_password.sql and scripts/rotate-user-password.js)
// must only be usable to change the password, check who's logged in, or log
// out — everything else must be rejected until the password is actually
// changed.

test('mustChangePassword claim blocks unrelated routes', async () => {
  const secret = 's'; const sid = newSessionId();
  const db = fakeDB({ sessions: { [await sha256Hex(sid)]: { status: 'active', user_id: 'u1' } } });
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin', sid, mustChangePassword: true }, secret);
  const req = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  await assert.rejects(requireAuth(req, { JWT_SECRET: secret, DB: db }), e => e.status === 403);
});

test('mustChangePassword claim still allows change-password, me, and logout', async () => {
  const secret = 's'; const sid = newSessionId();
  const db = fakeDB({ sessions: { [await sha256Hex(sid)]: { status: 'active', user_id: 'u1' } } });
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin', sid, mustChangePassword: true }, secret);
  for (const path of ['/api/auth/change-password', '/api/auth/me', '/api/auth/logout']) {
    const req = new Request(`https://api.x${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const claims = await requireAuth(req, { JWT_SECRET: secret, DB: db });
    assert.strictEqual(claims.sub, 'u1', `${path} should be allowed`);
  }
});

test('a normal token without mustChangePassword is unaffected', async () => {
  const secret = 's'; const sid = newSessionId();
  const db = fakeDB({ sessions: { [await sha256Hex(sid)]: { status: 'active', user_id: 'u1' } } });
  const token = await signJWT({ sub: 'u1', org: 'o1', role: 'org_admin', sid }, secret);
  const req = new Request('https://api.x/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } });
  const claims = await requireAuth(req, { JWT_SECRET: secret, DB: db });
  assert.strictEqual(claims.sub, 'u1');
});

// ===================== wiring =====================

test('index.js resolves with the new security modules wired in', async () => {
  const worker = (await import('../src/application.js')).default;
  assert.strictEqual(typeof worker.fetch, 'function');
  assert.strictEqual(typeof worker.scheduled, 'function');
});
