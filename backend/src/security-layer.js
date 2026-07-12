// src/security-layer.js — V212 Security Hardening.
//
// WHY THIS EXISTS: the API previously answered every browser origin with
// `Access-Control-Allow-Origin: *`. That means ANY website on the internet
// could make authenticated-looking requests against the API from a visitor's
// browser. This module replaces the wildcard with an explicit origin
// allowlist, applied at ONE choke point (the fetch wrapper in index.js), so
// none of the ~400 route handlers had to change.
//
// HOW THE ALLOWLIST IS BUILT (first match wins):
//   1. env.ALLOWED_ORIGINS  — comma-separated exact origins (recommended for
//      production, e.g. "https://voiceinsightsafrica.com,https://www.voiceinsightsafrica.com")
//   2. env.SITE_URL         — already set in wrangler.toml; its www. variant
//      is allowed automatically.
//   3. Convenience defaults — localhost / 127.0.0.1 (local dev) and
//      *.pages.dev / *.workers.dev (Cloudflare previews). Set
//      env.STRICT_CORS = "true" to disable these and allow ONLY (1) and (2).
//
// Requests WITHOUT an Origin header (Twilio webhooks, Stripe webhooks, curl,
// server-to-server API-key calls) are unaffected — CORS only governs
// browsers, and those callers never needed the header.

function parseConfiguredOrigins(env) {
  const out = new Set();
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  for (const o of configured) out.add(o.replace(/\/$/, ''));
  if (env.SITE_URL) {
    const site = env.SITE_URL.replace(/\/$/, '');
    out.add(site);
    try {
      const u = new URL(site);
      if (!u.hostname.startsWith('www.')) out.add(`${u.protocol}//www.${u.hostname}`);
    } catch (_) { /* SITE_URL malformed — ignore, allowlist still works */ }
  }
  return out;
}

export function resolveAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null; // non-browser caller — no CORS header needed

  const allowlist = parseConfiguredOrigins(env);
  const normalized = origin.replace(/\/$/, '');
  if (allowlist.has(normalized)) return origin;

  if (String(env.STRICT_CORS).toLowerCase() === 'true') return null;

  // Convenience defaults (disabled by STRICT_CORS): local development and
  // Cloudflare preview deployments. Still infinitely tighter than "*".
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return origin;
    if (u.protocol === 'https:' &&
        (u.hostname.endsWith('.pages.dev') || u.hostname.endsWith('.workers.dev'))) {
      return origin;
    }
  } catch (_) { /* malformed Origin header — treat as disallowed */ }
  return null;
}

// Applied to EVERY response by the fetch wrapper in index.js. Replaces the
// wildcard set by the legacy corsHeaders() helper with either the caller's
// (allowed) origin or nothing at all, and stamps baseline security headers
// on all API responses.
export function applyCorsPolicy(response, request, env) {
  const origin = resolveAllowedOrigin(request, env);
  const headers = new Headers(response.headers);

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    // Caches must key on Origin now that the value varies per caller.
    const vary = headers.get('Vary');
    if (!vary) headers.set('Vary', 'Origin');
    else if (!/\borigin\b/i.test(vary)) headers.set('Vary', `${vary}, Origin`);
  } else {
    headers.delete('Access-Control-Allow-Origin');
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  const cspReportOnly = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.workers.dev https://api.twilio.com https://api.anthropic.com",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "upgrade-insecure-requests",
    "report-uri /api/security/csp-report"
  ].join('; ');
  headers.set('Content-Security-Policy-Report-Only', cspReportOnly);
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');


  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
