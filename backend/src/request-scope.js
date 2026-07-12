// src/request-scope.js — Per-request authorization scoping, rate limiting and audit logging.
// Extracted from index.js (V212 maintainability refactor). Behavior unchanged.
import { newId } from './auth.js';

export async function getEffectiveOrgId(request, env, claims) {
  if (claims.role !== 'super_admin') return claims.org;
  const requestedOrgId = new URL(request.url).searchParams.get('org_id');
  if (!requestedOrgId) return claims.org;
  const exists = await env.DB.prepare('SELECT id FROM organizations WHERE id = ?').bind(requestedOrgId).first();
  return exists ? requestedOrgId : claims.org;
}


export async function getAssignedCampaignId(env, claims) {
  if (claims.role !== 'enumerator') return null;
  const row = await env.DB.prepare('SELECT campaign_id FROM user_campaign_assignment WHERE user_id = ?').bind(claims.sub).first();
  return row ? row.campaign_id : null;
}

// Determines which single campaign/project a dashboard, analytics, or report
// request should be scoped to. An Enumerator is ALWAYS forced to their one
// assigned project (cannot override via the URL). Any other role may
// optionally scope to one project via ?campaign_id=... — this is what lets a
// report's cover page and content genuinely reflect the specific research
// being reported on, instead of silently blending every project an
// organization runs together into one undifferentiated report.

export async function getEffectiveCampaignFilter(request, env, claims, effectiveOrgId) {
  const assigned = await getAssignedCampaignId(env, claims);
  if (assigned) return assigned;
  const requested = new URL(request.url).searchParams.get('campaign_id');
  if (!requested) return null;
  const owned = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(requested, effectiveOrgId || claims.org).first();
  return owned ? requested : null;
}

// Sliding-window rate limiter backed by D1. Returns true if the request should
// be BLOCKED (limit exceeded). windowSeconds and maxRequests are per rate_key.
// Read-only check: is this key currently AT or OVER the limit? Never
// increments anything — used to decide whether to even attempt a code
// lookup, so a VALID code never gets counted as an "attempt" against the
// respondent (only invalid codes should ever count, per design).

export async function isOverRateLimit(env, rateKey, maxRequests, windowSeconds) {
  try {
    const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE rate_key = ?').bind(rateKey).first();
    if (!row) return false;
    const windowStart = new Date(row.window_start).getTime();
    if (Date.now() - windowStart > windowSeconds * 1000) return false; // window expired — treat as fresh
    return row.count >= maxRequests;
  } catch (e) {
    return false; // never let rate-limit bookkeeping itself block a real request
  }
}

// Records exactly one FAILED attempt (invalid survey code). Call this only
// after confirming the code was wrong — never for a valid code, and never
// for an already-existing session (which skips code entry entirely).

export async function recordFailedAttempt(env, rateKey, windowSeconds) {
  try {
    const now = Date.now();
    const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE rate_key = ?').bind(rateKey).first();
    if (!row) {
      await env.DB.prepare('INSERT INTO rate_limits (rate_key, count, window_start) VALUES (?, 1, ?)').bind(rateKey, new Date(now).toISOString()).run();
      return;
    }
    const windowStart = new Date(row.window_start).getTime();
    if (now - windowStart > windowSeconds * 1000) {
      await env.DB.prepare('UPDATE rate_limits SET count = 1, window_start = ? WHERE rate_key = ?').bind(new Date(now).toISOString(), rateKey).run();
    } else {
      await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE rate_key = ?').bind(rateKey).run();
    }
  } catch (e) { /* best-effort — never let this block the actual response */ }
}


export async function isRateLimited(env, rateKey, maxRequests, windowSeconds) {
  try {
    const now = Date.now();
    const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE rate_key = ?').bind(rateKey).first();
    if (!row) {
      await env.DB.prepare('INSERT INTO rate_limits (rate_key, count, window_start) VALUES (?, 1, ?)').bind(rateKey, new Date(now).toISOString()).run();
      return false;
    }
    const windowStart = new Date(row.window_start).getTime();
    if (now - windowStart > windowSeconds * 1000) {
      // Window expired — reset it.
      await env.DB.prepare('UPDATE rate_limits SET count = 1, window_start = ? WHERE rate_key = ?').bind(new Date(now).toISOString(), rateKey).run();
      return false;
    }
    if (row.count >= maxRequests) return true;
    await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE rate_key = ?').bind(rateKey).run();
    return false;
  } catch (e) {
    return false; // Never let rate-limit bookkeeping itself break a real request.
  }
}

// Records a real, queryable audit trail entry — used for login, invites,
// deactivations, and 2FA changes, the events security/procurement reviewers ask about.

export async function logAudit(env, { org, userId, action, resourceType, resourceId, request }) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId('audit'), org || null, userId || null, action, resourceType || null, resourceId || null, request ? request.headers.get('CF-Connecting-IP') : null).run();
  } catch (e) {
    // Never let audit logging break the actual request.
  }
}

// Initiates a real outbound phone call via Twilio's REST API. Twilio will dial
// the number and, once answered, fetch TwiML from `voiceUrl` — reusing the
// exact same inbound call flow (language select, then questions) we already have.
