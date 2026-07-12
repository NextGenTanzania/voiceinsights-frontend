// src/twilio-security.js — V213 Critical Security.
//
// PROBLEM (audit finding CRIT-1): the inbound collection webhooks
// (/api/whatsapp/webhook, /api/sms/webhook, /api/voice/*) processed and
// persisted respondent data with NO verification that the request actually
// came from Twilio. Anyone who knew the URLs could inject fabricated
// interviews straight into a campaign.
//
// This module is the single choke point that guards every Twilio-owned
// inbound and callback endpoint. It:
//   1. Reads X-Twilio-Signature.
//   2. Reconstructs the exact public URL Twilio signed (honouring the
//      proxy headers Cloudflare sets, and an optional TWILIO_PUBLIC_BASE_URL
//      override for setups behind additional proxies / custom domains).
//   3. Recomputes the HMAC-SHA1 signature over url + sorted POST params and
//      compares it in constant time (verifyTwilioSignature, reused).
//   4. Rejects missing/invalid signatures with 403 and a redacted audit log.
//   5. Enforces SID-based replay protection via a duplicate-event registry.
//   6. Never lets a handler run — and therefore never writes to D1 — until
//      verification succeeds.
//
// It buffers the request body ONCE and hands the parsed params back to the
// caller so the downstream handler does not have to re-read the (now
// consumed) stream.

import { verifyTwilioSignature } from './collection-operations-workstream2.js';
import { newId } from './auth.js';

// Every Twilio-owned inbound / callback path. Any POST to one of these MUST
// pass verification. Kept here (not scattered across routes) so there is one
// authoritative list.
export const TWILIO_WEBHOOK_PATHS = [
  '/api/whatsapp/webhook',
  '/api/sms/webhook',
  '/api/voice/incoming',
  '/api/voice/language',
  '/api/voice/code',
  '/api/voice/outbound-connected',
  '/api/voice/recording',
  '/api/twilio/status/sms',
  '/api/twilio/status/whatsapp',
  '/api/twilio/status/voice',
];

export function isTwilioWebhookPath(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/';
  return TWILIO_WEBHOOK_PATHS.includes(normalized)
    || /^\/api\/voice\/(?:incoming|language|code|outbound-connected|recording|status(?:\/.*)?)$/.test(normalized)
    || /^\/api\/twilio\/(?:status|callback|delivery)(?:\/.*)?$/.test(normalized);
}


// Reconstruct the exact absolute URL Twilio used to compute the signature.
// Twilio signs the URL the request was sent TO — which, behind Cloudflare,
// is the original public URL, not the internal one. Precedence:
//   1. TWILIO_PUBLIC_BASE_URL (explicit override, e.g. https://api.example.com)
//   2. Cloudflare forwarded headers (X-Forwarded-Proto / Host)
//   3. The request URL as received.
export function reconstructTwilioUrl(request, env) {
  const received = new URL(request.url);
  const search = received.search || '';

  const override = (env && env.TWILIO_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (override) return `${override}${received.pathname}${search}`;

  const fwdHost = request.headers.get('X-Forwarded-Host') || request.headers.get('Host');
  const fwdProto = request.headers.get('X-Forwarded-Proto') || received.protocol.replace(':', '');
  if (fwdHost) return `${fwdProto}://${fwdHost}${received.pathname}${search}`;

  return `${received.origin}${received.pathname}${search}`;
}

async function redactedAudit(env, { path, reason, sid, from }) {
  // Best-effort — a failure to log must never turn a rejected request into a
  // processed one. Recipient identifiers are masked.
  try {
    await env.DB.prepare(
      `INSERT INTO security_audit_log (id, event_type, severity, path, reason, subject_masked, provider_sid, created_at)
       VALUES (?, 'twilio_webhook_rejected', 'high', ?, ?, ?, ?, datetime('now'))`
    ).bind(newId('secaudit'), path, reason, maskSubject(from), sid || null).run();
  } catch (_) { /* table may not exist in older envs — never throw here */ }
}

function maskSubject(v) {
  if (!v) return null;
  const s = String(v);
  if (s.length <= 4) return '***';
  return s.slice(0, Math.min(6, s.length - 2)).replace(/./g, (c, i) => (i < 2 ? c : '*')) + s.slice(-2);
}

// Extract the provider SID used both for replay protection and idempotency.
function extractSid(params) {
  return params.MessageSid || params.SmsSid || params.CallSid || params.SmsMessageSid || null;
}

// Duplicate-event registry: Twilio retries deliver the same SID+event. We
// record (sid, event, path) and reject a second identical delivery so a
// replayed capture cannot create a second response row. Uses a dedicated
// table with a UNIQUE constraint; INSERT OR IGNORE + changes()==0 means "seen
// before".
async function isReplay(env, { sid, path, params }) {
  if (!sid) return false; // some voice sub-steps have no SID yet — allowed through, handler is idempotent by session
  const eventKey = params.MessageStatus || params.CallStatus || params.SmsStatus || 'inbound';
  try {
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO twilio_event_registry (sid, event_key, path, seen_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).bind(sid, eventKey, path).run();
    return (res?.meta?.changes ?? 1) === 0; // 0 changes => row already existed => replay
  } catch (cause) {
    const error = new Error('TWILIO_REPLAY_REGISTRY_UNAVAILABLE');
    error.cause = cause;
    throw error; // fail closed: never process a signed event without idempotency evidence
  }
}

// The guard. Returns one of:
//   { ok:true, params, sid, request }  — verified; `request` is a fresh Request
//        carrying the buffered body so the handler's formData() still works.
//   { ok:false, response }             — a ready 403 Response to return.
//
// SECURITY POSTURE: if TWILIO_AUTH_TOKEN is not configured we FAIL CLOSED
// (reject) for these paths, because an unconfigured token on a production
// collection endpoint is itself the vulnerability. (Local development uses a
// dummy token — see tests and DEPLOYMENT guide.)
export async function guardTwilioWebhook(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Buffer the body once so both verification and the downstream handler can
  // read it. Twilio inbound posts are always application/x-www-form-urlencoded.
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const params = {};
  for (const [k, v] of form.entries()) params[k] = v;

  const signature = request.headers.get('X-Twilio-Signature') || '';
  const sid = extractSid(params);

  const rebuild = () => new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBody,
  });

  if (!env.TWILIO_AUTH_TOKEN) {
    await redactedAudit(env, { path, reason: 'auth_token_not_configured', sid, from: params.From });
    return { ok: false, response: twilioReject('Webhook verification not configured') };
  }
  if (!signature) {
    await redactedAudit(env, { path, reason: 'missing_signature', sid, from: params.From });
    return { ok: false, response: twilioReject('Missing X-Twilio-Signature') };
  }

  const publicUrl = reconstructTwilioUrl(request, env);
  const valid = await verifyTwilioSignature({ authToken: env.TWILIO_AUTH_TOKEN, signature, url: publicUrl, params });
  if (!valid) {
    await redactedAudit(env, { path, reason: 'invalid_signature', sid, from: params.From });
    return { ok: false, response: twilioReject('Invalid Twilio signature') };
  }

  let replay;
  try { replay = await isReplay(env, { sid, path, params }); }
  catch (_) {
    await redactedAudit(env, { path, reason: 'replay_registry_unavailable', sid, from: params.From });
    return { ok: false, response: new Response(JSON.stringify({ error: 'Webhook idempotency temporarily unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }) };
  }
  if (replay) {
    await redactedAudit(env, { path, reason: 'replayed_sid', sid, from: params.From });
    // 200 with empty TwiML: acknowledge so Twilio stops retrying, but do NOT
    // process again. Replays are expected under normal Twilio retry behaviour.
    return { ok: false, response: new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } }) };
  }

  return { ok: true, params, sid, request: rebuild() };
}

function twilioReject(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
