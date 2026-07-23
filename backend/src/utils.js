// src/utils.js

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

// ============================================================
// PERMANENT SHOWCASE PROTECTION (Phase 15)
// ------------------------------------------------------------
// Any report with is_demo = 1 is a locked Flagship Showcase Report — its
// narrative, recommendations, evidence, and roadmap must never be
// silently overwritten by a routine AI-regeneration call. This guard is
// called by every endpoint that WRITES AI-generated content back onto a
// report (narrative, tiered-recommendations, citations, roadmap, and
// style regeneration). It throws unless the caller is a Super Admin AND
// has passed the explicit confirmation query param — an accidental or
// routine call is blocked; a deliberate maintenance operation is allowed.
// ============================================================
export function checkFlagshipProtection(report, claims, request) {
  if (!report.is_demo) return; // not a showcase report — no restriction
  const url = new URL(request.url);
  const hasExplicitOverride = url.searchParams.get('flagship_override') === 'CONFIRM';
  if (claims.role !== 'super_admin' || !hasExplicitOverride) {
    throw { status: 403, message: 'This is a protected Flagship Showcase Report. It cannot be regenerated except by a deliberate Super Admin maintenance operation (requires ?flagship_override=CONFIRM).' };
  }
}

export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  // Fallback: allow ?token=... ONLY for the routes that genuinely cannot set
  // an Authorization header — <audio src>, <img src>, and direct document
  // links. SECURITY (V212): query-string tokens end up in server logs,
  // browser history, and Referer headers, so accepting them on every route
  // (as before) silently widened the attack surface. Every other route must
  // use the Authorization header.
  if (!token) {
    const url = new URL(request.url);
    const qsToken = url.searchParams.get('token');
    if (qsToken && /^\/api\/(audio|photos|documents)\//.test(url.pathname)) {
      token = qsToken;
    }
  }
  if (!token) throw { status: 401, message: 'Missing Authorization header' };
  const { verifyJWT } = await import('./auth.js');
  let claims;
  try {
    claims = await verifyJWT(token, env.JWT_SECRET);
  } catch (e) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // CRITICAL SECURITY FIX: JWT signature/expiry validity alone does not mean
  // the account is still allowed to act — a deactivated user or a suspended
  // organization must lose access immediately, not merely once their token
  // happens to expire (which could be days later). One lightweight JOIN
  // query confirms both the user and their organization are still active.
  // Never skip this check — this is what makes "deactivate this account"
  // and "suspend this organization" actually take effect immediately.
  const account = await env.DB.prepare(
    `SELECT u.is_active as user_active, o.status as org_status
     FROM users u JOIN organizations o ON u.organization_id = o.id
     WHERE u.id = ?`
  ).bind(claims.sub).first();
  if (!account || !account.user_active || account.org_status === 'suspended') {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // Server-side session revocation. A token whose session has been
  // logged out / revoked (via /api/auth/logout, logout-all, password reset,
  // MFA reset, or suspension) is rejected here even though its signature and
  // expiry are still valid. Legacy tokens (no sid) are unaffected.
  const { isSessionRevoked } = await import('./session-registry.js');
  try {
    if (await isSessionRevoked(env, claims)) {
      throw { status: 401, message: 'Session has been revoked. Please log in again.' };
    }
  } catch (sessionError) {
    if (sessionError?.status === 401) throw sessionError;
    throw { status: 503, message: 'Authentication service is temporarily unavailable.' };
  }

  // A token issued while must_change_password was set (e.g. a rotated
  // temporary password — see scripts/rotate-user-password.js) may only be
  // used to change the password, check who's logged in, or log out. This is
  // enforced from the JWT claim (set at login) rather than a fresh DB read,
  // consistent with role/org already being claim-based; change-password
  // clears the underlying column so the *next* login issues a normal token.
  if (claims.mustChangePassword) {
    const path = new URL(request.url).pathname;
    const allowed = path === '/api/auth/change-password' || path === '/api/auth/me' || path === '/api/auth/logout';
    if (!allowed) {
      throw { status: 403, message: 'Password change required before continuing. Call POST /api/auth/change-password.' };
    }
  }

  return claims;
}
