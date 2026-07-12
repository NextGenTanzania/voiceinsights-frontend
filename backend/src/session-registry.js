// Server-side session registry and revocation controls.
//
// PROBLEM: logout was client-side only. Deleting the token from localStorage
// left the JWT valid on the server until its 7-day expiry, so a stolen or
// leaked token stayed usable. There was no way to revoke a single session,
// all sessions, or to force logout on password/MFA change.
//
// DESIGN: every issued token carries a session id `sid` (a random UUID) in
// its claims. On login we record a row keyed by the SHA-256 hash of that sid
// (never the raw value) with status='active'. requireAuth() rejects any token
// whose session row is missing or revoked. This gives real server-side
// revocation while keeping tokens self-contained (no per-request secret
// lookup beyond the one lightweight row already read for account status).
//
// Production is fail-closed. Tokens without a session id are rejected unless
// ALLOW_LEGACY_SESSIONS=true is explicitly set for a time-bounded migration.
// SESSION_REGISTRY failures surface as 503 rather than silently authorizing.

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function newSessionId() {
  return crypto.randomUUID();
}

export function sessionIdFromClaims(claims) {
  return claims && claims.sid ? claims.sid : null;
}

// Record a new active session at login. Returns nothing meaningful; failures
// are swallowed only to the extent that they never block a legitimate login —
// but a thrown DB error here should surface, so we let it propagate.
export async function registerSession(env, { sid, userId, organizationId, request }) {
  const sidHash = await sha256Hex(sid);
  const ua = (request && request.headers.get('User-Agent') || '').slice(0, 200);
  const ipHash = await sha256Hex((request && request.headers.get('CF-Connecting-IP') || '') + '|' + sid);
  await env.DB.prepare(
    `INSERT INTO user_sessions (sid_hash, user_id, organization_id, status, user_agent, ip_hash, created_at, last_seen_at)
     VALUES (?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(sid_hash) DO UPDATE SET status='active', last_seen_at=datetime('now')`
  ).bind(sidHash, userId, organizationId, ua, ipHash).run();
}

// Called from requireAuth on every protected request. Returns true if the
// token's session has been revoked (or explicitly does not exist despite the
// token carrying a sid). Missing sid => legacy token => not revoked.
export async function isSessionRevoked(env, claims) {
  const sid = sessionIdFromClaims(claims);
  if (!sid) {
    const allowLegacy = String(env.ALLOW_LEGACY_SESSIONS || '').toLowerCase() === 'true';
    if (!allowLegacy) return true;
    const cutoff = env.LEGACY_SESSION_CUTOFF ? Date.parse(env.LEGACY_SESSION_CUTOFF) : NaN;
    const issuedAt = Number(claims?.iat || 0) * 1000;
    if (Number.isFinite(cutoff) && issuedAt >= cutoff) return true;
    return false;
  }
  try {
    const row = await env.DB.prepare(
      `SELECT status, expires_at FROM user_sessions WHERE sid_hash = ?`
    ).bind(await sha256Hex(sid)).first();
    if (!row) return true;
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return true;
    return row.status !== 'active';
  } catch (cause) {
    const error = new Error('Session registry is unavailable');
    error.code = 'SESSION_REGISTRY_UNAVAILABLE';
    error.status = 503;
    error.cause = cause;
    throw error;
  }
}

// POST /api/auth/logout — revoke just this session.
export async function revokeSession(env, claims) {
  const sid = sessionIdFromClaims(claims);
  if (!sid) return { revoked: 0, legacy: true };
  const res = await env.DB.prepare(
    `UPDATE user_sessions SET status='logged_out', revoked_at=datetime('now') WHERE sid_hash = ? AND status='active'`
  ).bind(await sha256Hex(sid)).run();
  return { revoked: res?.meta?.changes ?? 0 };
}

// POST /api/auth/logout-all — revoke every active session for the user.
// Also used by password reset, MFA reset, and user/org suspension.
export async function revokeAllSessions(env, userId, reason = 'logout_all') {
  const res = await env.DB.prepare(
    `UPDATE user_sessions SET status='revoked', revoked_at=datetime('now'), revoke_reason=? WHERE user_id = ? AND status='active'`
  ).bind(reason, userId).run();
  return { revoked: res?.meta?.changes ?? 0 };
}

// GET /api/auth/sessions — list the caller's active/recent sessions (no raw
// sid ever leaves the server; the hash is exposed as an opaque id for the
// DELETE endpoint).
export async function listSessions(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT sid_hash AS id, status, user_agent, created_at, last_seen_at, revoked_at
     FROM user_sessions WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 50`
  ).bind(userId).all();
  return results || [];
}

// DELETE /api/auth/sessions/:id — revoke one specific session by its hashed id
// (as returned by listSessions). Scoped to the caller's own user so one user
// cannot revoke another's session.
export async function revokeSessionById(env, userId, sidHash) {
  const res = await env.DB.prepare(
    `UPDATE user_sessions SET status='revoked', revoked_at=datetime('now'), revoke_reason='user_revoked'
     WHERE sid_hash = ? AND user_id = ? AND status='active'`
  ).bind(sidHash, userId).run();
  return { revoked: res?.meta?.changes ?? 0 };
}
