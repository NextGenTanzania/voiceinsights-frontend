// tests/change-password-flow.test.js
// Covers the corrected POST /api/auth/change-password flow: a password
// change (forced or voluntary) must revoke every existing session for the
// user and issue exactly one fresh session for the caller, so the caller's
// own token stops carrying a stale mustChangePassword=true claim. Before
// this fix the database was updated correctly but the session never
// transitioned — see HOTFIX_2026-07-14_DEPLOYMENT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import application from '../src/application.js';
import { signJWT, verifyJWT, hashPassword } from '../src/auth.js';

// ------------------------------------------------------------
// Fake D1: tracks real per-user and per-session state across multiple
// requests in the same test (unlike the regex-only fakes elsewhere, this
// one needs actual mutable rows so a login->change-password->reuse-old-token
// sequence is meaningful). Matches on distinctive SQL substrings, same
// hand-rolled style as tests/publication-gate-route-pilot.test.js.
// ------------------------------------------------------------
function fakeAuthDB(seedUser) {
  const usersById = new Map([[seedUser.id, { ...seedUser }]]);
  const sessions = new Map(); // sid_hash -> { status, user_id, expires_at }
  const auditLogs = [];      // { action, userId }
  return {
    _usersById: usersById, _sessions: sessions, _auditLogs: auditLogs,
    prepare(sql) {
      return {
        _sql: sql, _args: [],
        bind(...args) { this._args = args; return this; },
        async first() {
          if (/FROM users u JOIN organizations o/.test(sql)) {
            const u = usersById.get(this._args[0]);
            return u ? { user_active: u.is_active ?? 1, org_status: 'active' } : null;
          }
          if (/SELECT status(?:, expires_at)? FROM user_sessions WHERE sid_hash/.test(sql)) {
            const s = sessions.get(this._args[0]);
            return s ? { status: s.status, expires_at: s.expires_at || null } : null;
          }
          if (/SELECT \* FROM users WHERE id = \?/.test(sql)) {
            return usersById.get(this._args[0]) || null;
          }
          return null;
        },
        async run() {
          if (/INSERT INTO audit_logs/.test(sql)) {
            auditLogs.push({ action: this._args[3], userId: this._args[2] });
            return { meta: { changes: 1 } };
          }
          if (/UPDATE users SET password_hash = \?, password_salt = \?, must_change_password = 0/.test(sql)) {
            const [hash, salt, id] = this._args;
            const u = usersById.get(id);
            if (u) { u.password_hash = hash; u.password_salt = salt; u.must_change_password = 0; }
            return { meta: { changes: u ? 1 : 0 } };
          }
          if (/UPDATE user_sessions SET status='revoked'/.test(sql)) {
            let n = 0;
            for (const s of sessions.values()) if (s.user_id === this._args[1] && s.status === 'active') { s.status = 'revoked'; n++; }
            return { meta: { changes: n } };
          }
          if (/INSERT INTO user_sessions/.test(sql)) {
            const [sidHash, userId, , , , expiresAt] = this._args;
            sessions.set(sidHash, { status: 'active', user_id: userId, expires_at: expiresAt || null });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        async all() {
          if (/FROM user_sessions WHERE user_id = \? ORDER BY last_seen_at/.test(sql)) {
            const rows = [...sessions.entries()]
              .filter(([, s]) => s.user_id === this._args[0])
              .map(([id, s]) => ({ id, status: s.status }));
            return { results: rows };
          }
          return { results: [] };
        },
      };
    },
  };
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const SECRET = 'test-secret';
const USER_ID = 'user_1';

// Registers an active session directly in the fake DB (bypassing a real
// login call) and returns a bearer token matching it -- lets tests start
// from "already logged in with a temp password" without re-testing login.
async function seedSession(db, { sid, mustChangePassword, expiresAt = new Date(Date.now() + 60_000).toISOString() }) {
  const sidHash = await sha256Hex(sid);
  db._sessions.set(sidHash, { status: 'active', user_id: USER_ID, expires_at: expiresAt });
  return signJWT({ sub: USER_ID, org: 'org_1', role: 'super_admin', email: 'admin@test.local', sid, mustChangePassword }, SECRET);
}

function request(path, { method = 'GET', token, body } = {}) {
  return new Request(`https://api.example${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function makeSeededUser(currentPassword) {
  const { hash, salt } = await hashPassword(currentPassword);
  return { id: USER_ID, organization_id: 'org_1', email: 'admin@test.local', password_hash: hash, password_salt: salt, full_name: 'Test Admin', role: 'super_admin', is_active: 1, must_change_password: 1 };
}

test('successful forced password change: 200, new token, must_change_password:false in response', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  const res = await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.must_change_password, false);
  assert.equal(typeof body.token, 'string');
  assert.notEqual(body.token, token);
  assert.equal(body.user.id, USER_ID);
});

test('must_change_password is cleared in the database', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  assert.equal(db._usersById.get(USER_ID).must_change_password, 0);
});

test('all old sessions (including other devices) are revoked, not just the caller\'s', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  await seedSession(db, { sid: 'sid-other-device', mustChangePassword: true }); // a second "device"
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const statuses = [...db._sessions.values()].filter(s => s.user_id === USER_ID).map(s => s.status);
  // 2 seeded + 1 freshly issued for the caller = 3 rows; the 2 seeded ones must be revoked.
  assert.equal(statuses.filter(s => s === 'revoked').length, 2);
});

test('exactly one new active session is created for the caller', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const active = [...db._sessions.entries()].filter(([, s]) => s.user_id === USER_ID && s.status === 'active');
  assert.equal(active.length, 1);
  assert.notEqual(active[0][0], await sha256Hex('sid-old')); // different sid_hash than the old session
});

test('the new session has a non-null, future expires_at', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const active = [...db._sessions.values()].find(s => s.user_id === USER_ID && s.status === 'active');
  assert.ok(active.expires_at, 'expires_at must be set');
  assert.ok(Date.parse(active.expires_at) > Date.now(), 'expires_at must be in the future');
});

test('the new JWT carries mustChangePassword:false', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  const res = await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const { token: newToken } = await res.json();
  const claims = await verifyJWT(newToken, SECRET);
  assert.equal(claims.mustChangePassword, false);
});

test('the old token is rejected after a password change (session revoked)', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const res = await application.fetch(request('/api/auth/me', { token }), env);
  assert.equal(res.status, 401);
});

test('the new token is accepted on a route that mustChangePassword previously blocked', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  // Sanity: this route WAS blocked under the old token (proves the "before" state).
  const blocked = await application.fetch(request('/api/auth/sessions', { token }), env);
  assert.equal(blocked.status, 403);
  const res = await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const { token: newToken } = await res.json();
  const allowed = await application.fetch(request('/api/auth/sessions', { token: newToken }), env);
  assert.equal(allowed.status, 200);
});

test('wrong current password: 401, and no session or password mutation happens', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  const res = await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'WRONG', new_password: 'BrandNewPass456!' } }), env);
  assert.equal(res.status, 401);
  assert.equal(db._usersById.get(USER_ID).must_change_password, 1, 'must_change_password must be unchanged');
  const sessions = [...db._sessions.values()].filter(s => s.user_id === USER_ID);
  assert.equal(sessions.length, 1, 'no new session should have been created');
  assert.equal(sessions[0].status, 'active', 'the existing session must not have been revoked');
});

test('password policy rejection (too short): 400, no audit log, no mutation', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  const res = await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'short' } }), env);
  assert.equal(res.status, 400);
  assert.equal(db._auditLogs.length, 0);
  assert.equal(db._usersById.get(USER_ID).must_change_password, 1);
});

test('audit events: requested + changed + sessions_revoked + new_session on success', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'TempPass123!', new_password: 'BrandNewPass456!' } }), env);
  const actions = db._auditLogs.map(a => a.action);
  assert.deepEqual(actions, ['password_change_requested', 'password_changed', 'sessions_revoked_after_password_change', 'new_session_created_after_password_change']);
});

test('audit events: requested + failed on wrong current password, nothing else', async () => {
  const db = fakeAuthDB(await makeSeededUser('TempPass123!'));
  const token = await seedSession(db, { sid: 'sid-old', mustChangePassword: true });
  const env = { JWT_SECRET: SECRET, DB: db };
  await application.fetch(request('/api/auth/change-password', { method: 'POST', token, body: { current_password: 'WRONG', new_password: 'BrandNewPass456!' } }), env);
  const actions = db._auditLogs.map(a => a.action);
  assert.deepEqual(actions, ['password_change_requested', 'password_change_failed']);
});

// ===================== 2FA route still works (untouched by this change) =====================

// Same RFC 6238 computation auth.js uses internally (base32 decode + HMAC-SHA1
// + dynamic truncation), reimplemented here just to derive the current valid
// code for a known secret -- avoids brute-forcing 10^6 candidates through the
// real (async, per-candidate) verifyTotpCode().
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}
async function currentTotpCode(secretBase32) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBytes = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { counterBytes[i] = c & 0xff; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey('raw', base32Decode(secretBase32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (binCode % 1000000).toString().padStart(6, '0');
}

test('verify-2fa still issues a working token end to end', async () => {
  const user = await makeSeededUser('TempPass123!');
  user.must_change_password = 0;
  const db = fakeAuthDB(user);
  const TOTP_SECRET = 'JBSWY3DPEHPK3PXP'; // arbitrary valid base32 secret, test-only
  const pendingToken = await signJWT({ sub: USER_ID, pending2fa: true }, SECRET, 5 * 60);
  const origPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = origPrepare(sql);
    if (/SELECT secret FROM user_2fa WHERE user_id = \? AND enabled = 1/.test(sql)) {
      stmt.first = async () => ({ secret: TOTP_SECRET });
    }
    return stmt;
  };
  const code = await currentTotpCode(TOTP_SECRET);
  const env = { JWT_SECRET: SECRET, DB: db };
  const res = await application.fetch(request('/api/auth/verify-2fa', { method: 'POST', body: { pending_token: pendingToken, code } }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.token, 'string');
  assert.equal(body.must_change_password, false);
});
