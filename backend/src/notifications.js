// src/notifications.js — Web-push and transactional e-mail delivery.
// Extracted from index.js (V212 maintainability refactor). Behavior unchanged.
import { logAudit } from './request-scope.js';

export async function pushToAllSuperAdmins(env, payload) {
  try {
    const { results } = await env.DB.prepare(`SELECT id FROM users WHERE role = 'super_admin' AND is_active = 1`).all();
    for (const u of results) {
      sendPushNotification(env, u.id, payload).catch(e => console.error('push (super_admin broadcast) failed for', u.id, ':', e.message));
    }
  } catch (e) { console.error('pushToAllSuperAdmins failed:', e.message); }
}

// Pushes to every org_admin of a SPECIFIC organization — used for events
// scoped to one client (fraud alert, project behind schedule).

export async function pushToOrgAdmins(env, organizationId, payload) {
  try {
    const { results } = await env.DB.prepare(`SELECT id FROM users WHERE organization_id = ? AND role = 'org_admin' AND is_active = 1`).bind(organizationId).all();
    for (const u of results) {
      sendPushNotification(env, u.id, payload).catch(e => console.error('push (org_admin broadcast) failed for', u.id, ':', e.message));
    }
  } catch (e) { console.error('pushToOrgAdmins failed:', e.message); }
}


export async function sendPushNotification(env, userId, { title, body, link }) {
  if (!env.FCM_SERVER_KEY) return { sent: 0, reason: 'FCM_SERVER_KEY not configured' };
  const { results: subs } = await env.DB.prepare('SELECT token FROM push_subscriptions WHERE user_id = ?').bind(userId).all();
  if (!subs.length) return { sent: 0, reason: 'no registered devices' };

  let sent = 0;
  for (const sub of subs) {
    try {
      const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: { 'Authorization': `key=${env.FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sub.token,
          notification: { title, body, click_action: link || '/' },
          data: { link: link || '/' },
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (resp.ok && result.success === 1) {
        sent++;
      } else if (result.results?.[0]?.error === 'NotRegistered' || result.results?.[0]?.error === 'InvalidRegistration') {
        // Self-healing: FCM is telling us this token is dead — remove it so
        // we stop wasting a send attempt on it every time.
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE token = ?').bind(sub.token).run().catch(() => {});
      }
    } catch (e) {
      console.error('Push send failed for a token:', e.message);
    }
  }
  return { sent, total: subs.length };
}


export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) return; // not configured — skip silently
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.NOTIFY_FROM_EMAIL || 'VoiceInsights Africa <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('Resend send failed:', errText);
      logAudit(env, { org: null, userId: null, action: 'email_send_failed', resourceType: 'email', resourceId: to, request: null }).catch(() => {});
    }
  } catch (e) {
    // Never let a notification failure break the main request.
    console.error('Email notification failed:', e.message);
    logAudit(env, { org: null, userId: null, action: 'email_send_failed', resourceType: 'email', resourceId: to, request: null }).catch(() => {});
  }
}

// ============================================================
// Outbound SMS / WhatsApp via Twilio (for invites and future alerts).
// Silently no-ops if Twilio isn't configured — caller should fall back to email.
// ============================================================
// Returns the campaign_id a user is restricted to, or null if they have full
// organization access (only 'enumerator' role users can be scoped this way).
// Determines which organization's data a request should read. A regular user
// is ALWAYS locked to their own organization_id from the JWT — this cannot be
// overridden from the client under any circumstance. Only a Super Admin may
// pass ?org_id=... to drill into a SPECIFIC client organization's data (e.g.
// Organizations → click an org → see its own Projects, Respondents,
// Interviews, and Reports) — this is what makes the Super Admin console a
// real oversight tool rather than just a list of organization names.
