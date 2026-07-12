// src/billing-export.js — Stripe billing (checkout + webhook) and the
// Excel-compatible CSV export. Extracted from index.js (V212 refactor). Behavior unchanged.
import { json, error, corsHeaders, requireAuth } from './utils.js';

export async function handleCsvExport(request, env, url) {
  const claims = await requireAuth(request, env);
  const campaignId = url.searchParams.get('campaign_id');

  let query = `SELECT r.id as response_id, r.channel, r.overall_sentiment, r.fraud_score, r.started_at, r.completed_at,
                      resp.phone_number, q.order_index, q.question_text, t.raw_text as transcript
               FROM responses r
               JOIN campaigns c ON r.campaign_id = c.id
               JOIN respondents resp ON r.respondent_id = resp.id
               JOIN answers a ON a.response_id = r.id
               JOIN questions q ON a.question_id = q.id
               LEFT JOIN transcripts t ON t.answer_id = a.id
               WHERE c.organization_id = ?`;
  const params = [claims.org];
  if (campaignId) { query += ' AND r.campaign_id = ?'; params.push(campaignId); }
  query += ' ORDER BY r.started_at DESC, q.order_index ASC';

  const { results } = await env.DB.prepare(query).bind(...params).all();

  const headers = ['Response ID', 'Channel', 'Phone', 'Question', 'Answer Transcript', 'Sentiment', 'Fraud Score', 'Started', 'Completed'];
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = results.map(r => [
    r.response_id, r.channel, r.phone_number || '', r.question_text, r.transcript || '',
    r.overall_sentiment || '', r.fraud_score ?? '', r.started_at, r.completed_at || '',
  ]);
  const csv = [headers.map(escapeCsv).join(','), ...rows.map(row => row.map(escapeCsv).join(','))].join('\r\n');

  return new Response(csv, {
    status: 200,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="voiceinsights-export.csv"', ...corsHeaders() },
  });
}

// ============================================================
// BILLING — real Stripe Checkout subscriptions.
// Uses raw REST calls (no SDK) since Cloudflare Workers don't run Node's
// Stripe package cleanly. Requires env.STRIPE_SECRET_KEY,
// env.STRIPE_WEBHOOK_SECRET, and one Price ID per plan (env.STRIPE_PRICE_STARTER,
// env.STRIPE_PRICE_PROFESSIONAL, env.STRIPE_PRICE_ENTERPRISE) — created once
// in the Stripe Dashboard under Products.
// ============================================================
const PLAN_PRICE_ENV = {
  starter: 'STRIPE_PRICE_STARTER',
  professional: 'STRIPE_PRICE_PROFESSIONAL',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};


export async function handleCreateCheckoutSession(request, env) {
  const claims = await requireAuth(request, env);
  const { plan } = await request.json();
  const priceEnvKey = PLAN_PRICE_ENV[plan];
  if (!priceEnvKey || !env[priceEnvKey]) return error('Unknown or unconfigured plan: ' + plan, 400);

  const org = await env.DB.prepare('SELECT * FROM organizations WHERE id = ?').bind(claims.org).first();
  if (!org) return error('Organization not found', 404);

  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || `${url.protocol}//${url.host}`;
  // success/cancel land back on the frontend's billing page, not the API.
  const siteOrigin = env.SITE_URL || origin;

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': env[priceEnvKey],
    'line_items[0][quantity]': '1',
    success_url: `${siteOrigin}/app/billing.html?checkout=success`,
    cancel_url: `${siteOrigin}/app/billing.html?checkout=cancelled`,
    client_reference_id: claims.org,
    'metadata[plan]': plan,
    'metadata[organization_id]': claims.org,
  });
  if (claims.email) params.append('customer_email', claims.email);

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const session = await resp.json();
  if (!resp.ok) return error('Stripe error: ' + (session.error?.message || 'checkout session failed'), 500);

  return json({ url: session.url });
}


export async function handleStripeWebhook(request, env) {
  const signatureHeader = request.headers.get('Stripe-Signature') || '';
  const rawBody = await request.text();

  const valid = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return error('Invalid Stripe signature', 400);

  const event = JSON.parse(rawBody);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orgId = session.client_reference_id || session.metadata?.organization_id;
    const plan = session.metadata?.plan;
    if (orgId && plan) {
      await env.DB.prepare(
        `UPDATE organizations SET billing_tier = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`
      ).bind(plan, orgId).run();
    }
  }

  // Subscription cancelled/payment failed -> mark suspended so the org sees it in Settings/Billing.
  if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
    const sub = event.data.object;
    const orgId = sub.metadata?.organization_id;
    if (orgId) {
      await env.DB.prepare(`UPDATE organizations SET status = 'suspended', updated_at = datetime('now') WHERE id = ?`).bind(orgId).run();
    }
  }

  return json({ received: true });
}

// Stripe signs webhooks as: HMAC-SHA256(timestamp + "." + rawBody) using the
// endpoint's signing secret. Header looks like: "t=169...,v1=abc123...".

export async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computedSig = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time-ish compare
  if (computedSig.length !== expectedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < computedSig.length; i++) diff |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  return diff === 0;
}

// ============================================================
// Email notifications via Resend (optional — silently does nothing if
// RESEND_API_KEY isn't set, so the platform works fine without it).
// ============================================================
// Sends a push notification to EVERY device a user has registered.
// Uses the FCM legacy HTTP API (one POST per token, Authorization via a
// Worker Secret) — deliberately the simpler legacy key-based API rather
// than the v1 OAuth/service-account flow, since it needs only ONE secret
// value and no token-exchange step, while still being a real, functioning
// integration. The server key NEVER leaves this function — it is read
// only from env.FCM_SERVER_KEY (a Worker Secret) and is never included in
// any response sent to a browser.
// Pushes to every active Super Admin — used for platform-wide operational
// events (new lead, dead-letter, AI retry/Cron failure) that only Super
// Admin can act on. Never blocks the caller if it fails.
