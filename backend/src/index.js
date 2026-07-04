// src/index.js — VoiceInsights API (Cloudflare Worker)
//
// Routes:
//   POST /api/auth/login
//   GET  /api/auth/me
//   POST /api/auth/change-password
//   GET  /api/users                                (auth — list team members)
//   POST /api/users/invite                          (org_admin — invite a new team member)
//   POST /api/users/:id/deactivate                  (org_admin — deactivate a team member)
//   GET  /api/surveys | POST /api/surveys | GET /api/surveys/:id | POST /api/surveys/:id/questions
//   GET/POST /api/campaigns
//   GET  /api/dashboard/stats
//   GET  /api/analytics/summary
//   GET  /api/fraud/alerts
//   GET  /api/reports/csv?campaign_id=...        (Excel-compatible export)
//   GET  /api/organizations/me                    (current org's plan/status/API key)
//   POST /api/organizations/regenerate-key        (generate a new API key)
//   POST /api/billing/create-checkout-session     (Stripe Checkout — real subscriptions)
//   POST /api/billing/webhook                     (Stripe webhook — activates plan on payment)
//   POST /api/contact/submit                      (public — website Contact form, saves a lead)
//   GET  /api/leads                                (auth — view submitted leads)
//   GET  /api/respondents                          (auth — participant list)
//   GET  /api/interviews                           (auth — response list with transcript + audio)
//   GET  /api/audio/:key                           (auth — streams audio from R2)
//   GET  /api/transcripts/:response_id             (auth — full Q&A transcript, chat-style)
//   GET  /api/compliance                           (auth — COSTECH/NBS/Ethics status per survey)
//   PUT  /api/compliance/:survey_id                (auth — update compliance status)
//   GET  /api/consent-logs                         (auth — respondent consent log)
//   POST /api/assistant/ask                        (auth — VIA Assistant, AI Q&A over your own data)
//   GET  /api/reports/intelligence                  (auth — AI key findings + recommendations for the report)
//   GET/POST /api/indicators | PUT/DELETE /api/indicators/:id (auth — baseline vs current for Donor Report)
//   GET  /api/public/campaigns/:id/questions      (public — web widget reads the question list)
//   POST /api/whatsapp/webhook                    (Twilio WhatsApp — multi-question)
//   POST /api/voice/incoming                      (Twilio Voice — language select)
//   POST /api/voice/language                      (Twilio Voice — asks Q1, starts recording)
//   POST /api/voice/recording                     (Twilio Voice — recording callback, loops questions)
//   POST /api/sms/webhook                         (Twilio SMS — feature-phone fallback, text-only)
//   POST /api/web/submit                           (public web-link / in-app recorder, multi-question)
//
// All channels share ONE pipeline via getOrCreateSession()/submitAnswer():
// a "session" walks a respondent through a survey's questions in order,
// one question at a time, regardless of which door they came in through.

import { hashPassword, verifyPassword, signJWT, verifyJWT, newId, generateTotpSecret, verifyTotpCode, totpAuthUri } from './auth.js';
import { json, error, corsHeaders, requireAuth } from './utils.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    try {
      // ---------- AUTH ----------
      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) return error('Email and password are required');
        // 10 attempts per 15 minutes, keyed by email — slows down brute-force
        // password guessing without locking out a user typo-ing their password once.
        if (await isRateLimited(env, `login:${email}`, 10, 15 * 60)) {
          return error('Too many login attempts. Please wait a few minutes and try again.', 429);
        }
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').bind(email).first();
        if (!user) return error('Invalid email or password', 401);
        const ok = await verifyPassword(password, user.password_salt, user.password_hash);
        if (!ok) return error('Invalid email or password', 401);

        const twoFa = await env.DB.prepare('SELECT enabled FROM user_2fa WHERE user_id = ?').bind(user.id).first();
        if (twoFa && twoFa.enabled) {
          const pendingToken = await signJWT({ sub: user.id, pending2fa: true }, env.JWT_SECRET, 5 * 60);
          return json({ requires_2fa: true, pending_token: pendingToken });
        }

        const token = await signJWT({ sub: user.id, org: user.organization_id, role: user.role, email: user.email }, env.JWT_SECRET);
        await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();
        await logAudit(env, { org: user.organization_id, userId: user.id, action: 'login', resourceType: 'user', resourceId: user.id, request });
        return json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, organization_id: user.organization_id } });
      }

      if (path === '/api/auth/verify-2fa' && method === 'POST') {
        const { pending_token, code } = await request.json();
        if (!pending_token || !code) return error('pending_token and code are required');
        let claims;
        try { claims = await verifyJWT(pending_token, env.JWT_SECRET); } catch (e) { return error('This login attempt has expired — please log in again', 401); }
        if (!claims.pending2fa) return error('Invalid token', 401);

        const twoFa = await env.DB.prepare('SELECT secret FROM user_2fa WHERE user_id = ? AND enabled = 1').bind(claims.sub).first();
        if (!twoFa) return error('2FA is not enabled for this account', 400);
        const valid = await verifyTotpCode(twoFa.secret, code.trim());
        if (!valid) return error('Incorrect code — check your authenticator app and try again', 401);

        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(claims.sub).first();
        const token = await signJWT({ sub: user.id, org: user.organization_id, role: user.role, email: user.email }, env.JWT_SECRET);
        await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();
        await logAudit(env, { org: user.organization_id, userId: user.id, action: 'login_2fa', resourceType: 'user', resourceId: user.id, request });
        return json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, organization_id: user.organization_id } });
      }

      // ---------- TWO-FACTOR AUTHENTICATION (TOTP) ----------
      if (path === '/api/2fa/status' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const row = await env.DB.prepare('SELECT enabled FROM user_2fa WHERE user_id = ?').bind(claims.sub).first();
        return json({ enabled: !!(row && row.enabled) });
      }

      if (path === '/api/2fa/setup' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const secret = generateTotpSecret();
        await env.DB.prepare(
          `INSERT INTO user_2fa (user_id, secret, enabled) VALUES (?, ?, 0)
           ON CONFLICT(user_id) DO UPDATE SET secret = excluded.secret, enabled = 0`
        ).bind(claims.sub, secret).run();
        const uri = totpAuthUri(secret, claims.email || claims.sub);
        return json({ secret, otpauth_uri: uri });
      }

      if (path === '/api/2fa/verify-setup' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { code } = await request.json();
        if (!code) return error('code is required');
        const row = await env.DB.prepare('SELECT secret FROM user_2fa WHERE user_id = ?').bind(claims.sub).first();
        if (!row) return error('Run 2FA setup first', 400);
        const valid = await verifyTotpCode(row.secret, code.trim());
        if (!valid) return error('Incorrect code — check your authenticator app and try again', 401);
        await env.DB.prepare('UPDATE user_2fa SET enabled = 1 WHERE user_id = ?').bind(claims.sub).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: '2fa_enabled', resourceType: 'user', resourceId: claims.sub, request });
        return json({ ok: true });
      }

      if (path === '/api/2fa/disable' && method === 'POST') {
        const claims = await requireAuth(request, env);
        await env.DB.prepare('DELETE FROM user_2fa WHERE user_id = ?').bind(claims.sub).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: '2fa_disabled', resourceType: 'user', resourceId: claims.sub, request });
        return json({ ok: true });
      }

      if (path === '/api/auth/me' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const user = await env.DB.prepare('SELECT id, email, full_name, role, organization_id FROM users WHERE id = ?').bind(claims.sub).first();
        if (!user) return error('User not found', 404);
        return json({ user });
      }

      if (path === '/api/auth/change-password' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { current_password, new_password } = await request.json();
        if (!current_password || !new_password) return error('current_password and new_password are required');
        if (new_password.length < 8) return error('New password must be at least 8 characters', 400);
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(claims.sub).first();
        const ok = await verifyPassword(current_password, user.password_salt, user.password_hash);
        if (!ok) return error('Current password is incorrect', 401);
        const { hash, salt } = await hashPassword(new_password);
        await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, claims.sub).run();
        return json({ ok: true });
      }

      // ---------- FORGOT / RESET PASSWORD ----------
      if (path === '/api/auth/forgot-password' && method === 'POST') {
        const { email } = await request.json();
        if (!email) return error('email is required');
        // 3 requests per hour per email — stops spamming one inbox with reset emails.
        if (await isRateLimited(env, `forgot:${email}`, 3, 60 * 60)) {
          return json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
        }
        const user = await env.DB.prepare('SELECT id, full_name FROM users WHERE email = ? AND is_active = 1').bind(email).first();
        // Always return success, whether or not the email exists — prevents account enumeration.
        if (user) {
          const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
          await env.DB.prepare(
            `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
          ).bind(token, user.id, expiresAt).run();
          const resetUrl = `${env.SITE_URL || 'https://voiceinsights-frontend.pages.dev'}/reset-password.html?token=${token}`;
          await sendEmail(env, {
            to: email,
            subject: 'Reset your VoiceInsights Africa password',
            html: `<p>Hi ${user.full_name},</p>
                   <p>We received a request to reset your password. Click the link below to choose a new one — this link expires in 1 hour and can only be used once.</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>If you didn't request this, you can safely ignore this email.</p>`,
          });
        }
        return json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
      }

      if (path === '/api/auth/reset-password' && method === 'POST') {
        const { token, new_password } = await request.json();
        if (!token || !new_password) return error('token and new_password are required');
        if (new_password.length < 8) return error('New password must be at least 8 characters', 400);
        const row = await env.DB.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').bind(token).first();
        if (!row || row.used || new Date(row.expires_at) < new Date()) {
          return error('This reset link is invalid or has expired. Please request a new one.', 400);
        }
        const { hash, salt } = await hashPassword(new_password);
        await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, row.user_id).run();
        await env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').bind(token).run();
        await logAudit(env, { userId: row.user_id, action: 'password_reset', resourceType: 'user', resourceId: row.user_id, request });
        return json({ ok: true });
      }

      // ---------- USER MANAGEMENT (invite team members) ----------
      if (path === '/api/users' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.last_login_at, u.created_at, up.region, up.phone
           FROM users u LEFT JOIN user_profile up ON up.user_id = u.id
           WHERE u.organization_id = ? ORDER BY u.created_at DESC`
        ).bind(claims.org).all();
        return json({ users: results });
      }

      const ROLE_WELCOME_LABEL = { org_admin: 'Org Admin', me_officer: 'M&E Officer', enumerator: 'Field Enumerator' };
      const ROLE_ONBOARDING_STEPS = {
        org_admin: `<li>Explore <b>Projects</b> and <b>Campaigns</b> to see everything already set up.</li><li>Invite the rest of your team from <b>Settings → Team</b>.</li>`,
        me_officer: `<li>Open <b>Analytics</b> and <b>Reports</b> to see the data already collected.</li><li>Check <b>Interviews</b> to listen to real voice responses and read transcripts.</li>`,
        enumerator: `<li>Open the <b>Enumerator App</b> (works offline) or the Web Link shared with you to start collecting responses.</li><li>You'll only see data for the project you were assigned to.</li>`,
      };

      if (path === '/api/users/invite' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin') return error('Only an Org Admin can invite users', 403);
        const { email, full_name, role, region, phone, invite_method, campaign_id } = await request.json();
        if (!email || !full_name) return error('email and full_name are required');
        if ((invite_method === 'sms' || invite_method === 'whatsapp') && !phone) return error('Phone number is required for SMS/WhatsApp invites', 400);
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) return error('A user with this email already exists', 409);

        let campaignName = null;
        if (campaign_id) {
          const campaign = await env.DB.prepare('SELECT id, name FROM campaigns WHERE id = ? AND organization_id = ?').bind(campaign_id, claims.org).first();
          if (!campaign) return error('That project/campaign was not found', 400);
          campaignName = campaign.name;
        }

        const tempPassword = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(36)).join('').slice(0, 12);
        const { hash, salt } = await hashPassword(tempPassword);
        const userId = newId('user');
        await env.DB.prepare(
          `INSERT INTO users (id, organization_id, email, password_hash, password_salt, full_name, role, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
        ).bind(userId, claims.org, email, hash, salt, full_name, role || 'me_officer').run();

        if (region || phone) {
          await env.DB.prepare(
            `INSERT INTO user_profile (user_id, phone, region, invite_method) VALUES (?, ?, ?, ?)`
          ).bind(userId, phone || null, region || null, invite_method || 'email').run();
        }

        if (campaign_id && role === 'enumerator') {
          await env.DB.prepare(
            `INSERT INTO user_campaign_assignment (user_id, campaign_id) VALUES (?, ?)`
          ).bind(userId, campaign_id).run();
        }

        const loginUrl = `${env.SITE_URL || 'https://voiceinsights-frontend.pages.dev'}/login.html`;
        let delivered = 'email';

        if (invite_method === 'sms' || invite_method === 'whatsapp') {
          const smsBody = `Hi ${full_name}, you've been invited to VoiceInsights Africa${campaignName ? ` for the "${campaignName}" project` : ''}. Login: ${loginUrl} | Email: ${email} | Temp password: ${tempPassword}. Please change your password after first login.`;
          const result = await sendTwilioMessage(env, { to: phone, body: smsBody, whatsapp: invite_method === 'whatsapp' });
          if (result.ok) {
            delivered = invite_method;
          } else {
            // Twilio not configured or failed — fall back to email so the invite isn't lost.
            delivered = 'email (Twilio unavailable — sent by email instead)';
          }
        }

        if (delivered.startsWith('email')) {
          await sendEmail(env, {
            to: email,
            subject: `Welcome to VoiceInsights Africa`,
            html: `<div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto; color:#1E2620;">
                     <div style="background:#0F1614; padding:1.5rem; text-align:center; border-radius:10px 10px 0 0;">
                       <span style="color:#E4A23A; font-size:1.2rem; font-weight:700;">VoiceInsights Africa</span>
                     </div>
                     <div style="padding:1.75rem; background:#fff; border:1px solid #eee; border-top:none; border-radius:0 0 10px 10px;">
                       <h2 style="margin-top:0;">Welcome, ${full_name} 👋</h2>
                       <p>You've been added to VoiceInsights Africa${region ? ` for the ${region} region` : ''}${campaignName ? `, assigned to the <b>${campaignName}</b> project` : ''} as a <b>${ROLE_WELCOME_LABEL[role] || 'team member'}</b>.</p>
                       <div style="background:#f7f5f0; border-radius:8px; padding:1rem 1.25rem; margin:1.25rem 0;">
                         <p style="margin:.3rem 0;"><b>Login page:</b> <a href="${loginUrl}">${loginUrl}</a></p>
                         <p style="margin:.3rem 0;"><b>Email:</b> ${email}</p>
                         <p style="margin:.3rem 0;"><b>Temporary password:</b> ${tempPassword}</p>
                       </div>
                       <h3 style="font-size:1rem;">Your first 3 steps</h3>
                       <ol style="padding-left:1.2rem; line-height:1.7;">
                         <li>Log in and <b>change your password</b> from Settings right away.</li>
                         ${ROLE_ONBOARDING_STEPS[role] || ROLE_ONBOARDING_STEPS.me_officer}
                       </ol>
                       <p style="margin-top:1.5rem; font-size:.85rem; color:#888;">Questions? Just reply to this email.</p>
                     </div>
                   </div>`,
          });
        }

        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'user_invited', resourceType: 'user', resourceId: userId, request });
        return json({ ok: true, delivered_via: delivered, user: { id: userId, email, full_name, role: role || 'me_officer', region: region || null, campaign_id: campaign_id || null } }, 201);
      }

      const deactivateMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_]+)\/deactivate$/);
      if (deactivateMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin') return error('Only an Org Admin can deactivate users', 403);
        await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ? AND organization_id = ?').bind(deactivateMatch[1], claims.org).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'user_deactivated', resourceType: 'user', resourceId: deactivateMatch[1], request });
        return json({ ok: true });
      }

      // ---------- SURVEYS ----------
      if (path === '/api/surveys' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare('SELECT * FROM surveys WHERE organization_id = ? ORDER BY created_at DESC').bind(claims.org).all();
        return json({ surveys: results });
      }

      if (path === '/api/surveys' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json();
        if (!body.title) return error('title is required');
        const id = newId('survey');
        await env.DB.prepare(
          `INSERT INTO surveys (id, organization_id, created_by, title, description, module_type, language, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, claims.org, claims.sub, body.title, body.description || '', body.module_type || 'survey', body.language || 'en', body.status || 'draft').run();

        if (env.NOTIFY_TO_EMAIL) {
          await sendEmail(env, {
            to: env.NOTIFY_TO_EMAIL,
            subject: `📋 New project created: ${body.title}`,
            html: `<p>A new project was created by <b>${claims.email || claims.sub}</b>.</p><p><b>Title:</b> ${body.title}<br><b>Type:</b> ${body.module_type || 'survey'}<br><b>Status:</b> ${body.status || 'draft'}</p>`,
          });
        }
        return json({ survey: { id, title: body.title, status: body.status || 'draft' } }, 201);
      }

      const surveyMatch = path.match(/^\/api\/surveys\/([a-zA-Z0-9_]+)$/);
      if (surveyMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const survey = await env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND organization_id = ?').bind(surveyMatch[1], claims.org).first();
        if (!survey) return error('Survey not found', 404);
        const { results: questions } = await env.DB.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC').bind(surveyMatch[1]).all();
        return json({ survey, questions });
      }

      if (surveyMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const existing = await env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND organization_id = ?').bind(surveyMatch[1], claims.org).first();
        if (!existing) return error('Survey not found', 404);
        const body = await request.json();
        if (!body.title) return error('title is required');
        await env.DB.prepare(
          `UPDATE surveys SET title = ?, description = ?, module_type = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(body.title, body.description || null, body.module_type || 'survey', body.status || 'draft', surveyMatch[1]).run();

        // Questions are replaced wholesale on each save — simplest way to support
        // add/edit/remove/reorder in one request without a separate diffing endpoint.
        if (Array.isArray(body.questions)) {
          await env.DB.prepare('DELETE FROM questions WHERE survey_id = ?').bind(surveyMatch[1]).run();
          for (let i = 0; i < body.questions.length; i++) {
            const q = body.questions[i];
            if (!q.question_text) continue;
            await env.DB.prepare(
              `INSERT INTO questions (id, survey_id, order_index, question_text, question_type, kpi_tag) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(newId('q'), surveyMatch[1], i, q.question_text, q.question_type || 'open_voice', q.kpi_tag || null).run();
          }
        }
        return json({ ok: true });
      }

      const questionsMatch = path.match(/^\/api\/surveys\/([a-zA-Z0-9_]+)\/questions$/);
      if (questionsMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json();
        if (!body.question_text) return error('question_text is required');
        const id = newId('q');
        await env.DB.prepare(
          `INSERT INTO questions (id, survey_id, order_index, question_text, question_type, kpi_tag) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, questionsMatch[1], body.order_index || 0, body.question_text, body.question_type || 'open_voice', body.kpi_tag || null).run();
        return json({ question: { id, question_text: body.question_text } }, 201);
      }

      // ---------- CAMPAIGNS ----------
      if (path === '/api/campaigns' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT c.*, (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id) AS reached_count
           FROM campaigns c WHERE c.organization_id = ? ORDER BY c.created_at DESC`
        ).bind(claims.org).all();
        return json({ campaigns: results });
      }

      if (path === '/api/campaigns' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json();
        if (!body.survey_id || !body.name) return error('survey_id and name are required');
        const id = newId('camp');
        await env.DB.prepare(
          `INSERT INTO campaigns (id, survey_id, organization_id, name, channel, target_respondents, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, body.survey_id, claims.org, body.name, body.channel || 'whatsapp', body.target_respondents || 0, 'scheduled').run();
        return json({ campaign: { id, name: body.name } }, 201);
      }

      // ---------- DASHBOARD ----------
      if (path === '/api/dashboard/stats' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const assignedCampaign = await getAssignedCampaignId(env, claims);
        const campFilter = assignedCampaign ? 'AND c.id = ?' : '';
        const bindArgs = assignedCampaign ? [claims.org, assignedCampaign] : [claims.org];
        const surveys = await env.DB.prepare('SELECT COUNT(*) as n FROM surveys WHERE organization_id = ? AND status = "active"').bind(claims.org).first();
        const responses = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter}`
        ).bind(...bindArgs).first();
        const completed = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter} AND r.status = 'completed'`
        ).bind(...bindArgs).first();
        const positive = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter} AND r.overall_sentiment = 'positive'`
        ).bind(...bindArgs).first();
        const byChannel = await env.DB.prepare(
          `SELECT r.channel, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter} GROUP BY r.channel`
        ).bind(...bindArgs).all();
        const { results: weeklyRows } = await env.DB.prepare(
          `SELECT strftime('%Y-%W', r.started_at) as week, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${campFilter} AND r.started_at >= datetime('now', '-42 days')
           GROUP BY week ORDER BY week ASC`
        ).bind(...bindArgs).all();
        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${campFilter} GROUP BY r.overall_sentiment`
        ).bind(...bindArgs).all();
        const responseRate = responses.n > 0 ? Math.round((completed.n / responses.n) * 100) : 0;
        const positiveSentimentPct = responses.n > 0 ? Math.round((positive.n / responses.n) * 100) : 0;
        return json({
          active_surveys: surveys.n,
          total_responses: responses.n,
          completed_responses: completed.n,
          response_rate: responseRate,
          positive_sentiment_pct: positiveSentimentPct,
          by_channel: byChannel.results,
          weekly: weeklyRows,
          sentiment_breakdown: sentimentRows,
        });
      }

      // ---------- ANALYTICS ----------
      if (path === '/api/analytics/summary' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? GROUP BY r.overall_sentiment`
        ).bind(claims.org).all();
        const { results: insightRows } = await env.DB.prepare(
          `SELECT ai.content_json FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 200`
        ).bind(claims.org).all();
        const topicCounts = {};
        for (const row of insightRows) {
          try { const parsed = JSON.parse(row.content_json); for (const t of parsed.topics || []) topicCounts[t] = (topicCounts[t] || 0) + 1; } catch (_) {}
        }
        const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
        const { results: quoteRows } = await env.DB.prepare(
          `SELECT t.raw_text, r.overall_sentiment, r.started_at, r.channel FROM transcripts t
           JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ORDER BY t.created_at DESC LIMIT 6`
        ).bind(claims.org).all();
        const { results: regionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY region ORDER BY n DESC LIMIT 10`
        ).bind(claims.org).all();
        const { results: genderRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.gender), ''), 'Unspecified') as gender, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY gender ORDER BY n DESC`
        ).bind(claims.org).all();
        const { results: ageRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.age_bracket), ''), 'Unspecified') as age_bracket, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY age_bracket ORDER BY age_bracket ASC`
        ).bind(claims.org).all();
        return json({ sentiment: sentimentRows, topics, quotes: quoteRows, regions: regionRows, gender: genderRows, age: ageRows });
      }

      // ---------- FRAUD ALERTS ----------
      if (path === '/api/fraud/alerts' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT r.id as response_id, r.fraud_score, r.overall_sentiment, r.started_at, r.channel, resp.phone_number, c.name as campaign_name,
                  (SELECT ai.content_json FROM ai_insights ai WHERE ai.response_id = r.id AND ai.insight_type = 'fraud_flag' ORDER BY ai.created_at DESC LIMIT 1) as fraud_json
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? AND r.fraud_score IS NOT NULL AND r.fraud_score >= 0.5 ORDER BY r.fraud_score DESC LIMIT 50`
        ).bind(claims.org).all();
        const alerts = results.map(a => {
          let reasons = [];
          try { reasons = JSON.parse(a.fraud_json || '{}').reasons || []; } catch (_) {}
          const { fraud_json, ...rest } = a;
          return { ...rest, reasons };
        });
        return json({ alerts });
      }

      // ---------- REPORTS (CSV / Excel export) ----------
      if (path === '/api/reports/csv' && method === 'GET') {
        return await handleCsvExport(request, env, url);
      }

      // ---------- ORGANIZATION / BILLING ----------
      if (path === '/api/organizations/me' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const org = await env.DB.prepare('SELECT id, name, type, billing_tier, status FROM organizations WHERE id = ?').bind(claims.org).first();
        if (!org) return error('Organization not found', 404);
        const keyRow = await env.DB.prepare('SELECT api_key FROM organization_api_keys WHERE organization_id = ?').bind(claims.org).first();
        return json({ organization: { ...org, api_key: keyRow ? keyRow.api_key : null } });
      }

      if (path === '/api/organizations/regenerate-key' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const newKey = 'via_' + [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
        await env.DB.prepare(
          `INSERT INTO organization_api_keys (organization_id, api_key, created_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(organization_id) DO UPDATE SET api_key = excluded.api_key, created_at = datetime('now')`
        ).bind(claims.org, newKey).run();
        return json({ api_key: newKey });
      }

      if (path === '/api/billing/create-checkout-session' && method === 'POST') {
        return await handleCreateCheckoutSession(request, env);
      }

      if (path === '/api/billing/webhook' && method === 'POST') {
        return await handleStripeWebhook(request, env);
      }

      // ---------- CONTACT / LEADS (sales pipeline) ----------
      if (path === '/api/contact/submit' && method === 'POST') {
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (await isRateLimited(env, `contact:${clientIp}`, 5, 60 * 60)) {
          return error('Too many submissions. Please try again later.', 429);
        }
        const body = await request.json();
        if (!body.full_name || !body.work_email) return error('full_name and work_email are required');
        const id = newId('lead');
        await env.DB.prepare(
          `INSERT INTO leads (id, full_name, work_email, organization, country, organization_type, project_size, expected_respondents, preferred_channels, message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, body.full_name, body.work_email, body.organization || null, body.country || null,
          body.organization_type || null, body.project_size || null, body.expected_respondents || null,
          Array.isArray(body.preferred_channels) ? body.preferred_channels.join(', ') : (body.preferred_channels || null),
          body.message || null
        ).run();

        if (env.NOTIFY_TO_EMAIL) {
          await sendEmail(env, {
            to: env.NOTIFY_TO_EMAIL,
            subject: `🎯 New lead: ${body.full_name}${body.organization ? ' (' + body.organization + ')' : ''}`,
            html: `<p><b>${body.full_name}</b> (${body.work_email}) submitted the Contact form.</p>
                   <p><b>Organization:</b> ${body.organization || '—'} (${body.organization_type || '—'})<br>
                   <b>Country:</b> ${body.country || '—'}<br>
                   <b>Project size:</b> ${body.project_size || '—'}<br>
                   <b>Expected respondents:</b> ${body.expected_respondents || '—'}<br>
                   <b>Channels:</b> ${Array.isArray(body.preferred_channels) ? body.preferred_channels.join(', ') : (body.preferred_channels || '—')}</p>
                   <p><b>Message:</b> ${body.message || '—'}</p>`,
          });
        }
        return json({ ok: true, id }, 201);
      }

      if (path === '/api/leads' && method === 'GET') {
        await requireAuth(request, env);
        const { results } = await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200').all();
        return json({ leads: results });
      }

      // ---------- RESPONDENTS ----------
      if (path === '/api/respondents' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT r.id, r.phone_number, r.full_name, r.region, r.gender, r.age_bracket, r.consent_given, r.created_at,
                  (SELECT COUNT(*) FROM responses resp WHERE resp.respondent_id = r.id) AS response_count
           FROM respondents r WHERE r.organization_id = ? ORDER BY r.created_at DESC LIMIT 200`
        ).bind(claims.org).all();
        return json({ respondents: results });
      }

      // ---------- INTERVIEWS (responses with transcript + audio) ----------
      if (path === '/api/interviews' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const assignedCampaign = await getAssignedCampaignId(env, claims);
        const { results } = await env.DB.prepare(
          `SELECT r.id as response_id, r.channel, r.overall_sentiment, r.fraud_score, r.status, r.started_at,
                  resp.phone_number, c.name as campaign_name,
                  (SELECT a.audio_r2_key FROM answers a WHERE a.response_id = r.id AND a.audio_r2_key IS NOT NULL ORDER BY a.created_at ASC LIMIT 1) as audio_r2_key,
                  (SELECT t.raw_text FROM transcripts t JOIN answers a2 ON t.answer_id = a2.id WHERE a2.response_id = r.id ORDER BY t.created_at ASC LIMIT 1) as first_transcript,
                  (SELECT ai.content_json FROM ai_insights ai WHERE ai.response_id = r.id AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 1) as summary_json
           FROM responses r
           JOIN campaigns c ON r.campaign_id = c.id
           JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? ${assignedCampaign ? 'AND c.id = ?' : ''}
           ORDER BY r.started_at DESC LIMIT 100`
        ).bind(...(assignedCampaign ? [claims.org, assignedCampaign] : [claims.org])).all();
        return json({ interviews: results });
      }

      // ---------- AUDIO STREAMING (from R2) ----------
      const audioMatch = path.match(/^\/api\/audio\/(.+)$/);
      if (audioMatch && method === 'GET') {
        await requireAuth(request, env);
        const key = decodeURIComponent(audioMatch[1]);
        const obj = await env.AUDIO_BUCKET.get(key);
        if (!obj) return error('Audio not found', 404);
        return new Response(obj.body, {
          headers: { 'Content-Type': obj.httpMetadata?.contentType || 'audio/ogg', ...corsHeaders() },
        });
      }

      // ---------- TRANSCRIPTS (full Q&A, chat-style) ----------
      const transcriptMatch = path.match(/^\/api\/transcripts\/([a-zA-Z0-9_]+)$/);
      if (transcriptMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const responseId = transcriptMatch[1];
        const { results } = await env.DB.prepare(
          `SELECT q.question_text, q.order_index, t.raw_text, a.audio_r2_key, a.created_at
           FROM answers a
           JOIN questions q ON a.question_id = q.id
           LEFT JOIN transcripts t ON t.answer_id = a.id
           JOIN responses r ON a.response_id = r.id
           JOIN campaigns c ON r.campaign_id = c.id
           WHERE a.response_id = ? AND c.organization_id = ?
           ORDER BY q.order_index ASC`
        ).bind(responseId, claims.org).all();
        return json({ turns: results });
      }

      // ---------- COMPLIANCE ----------
      if (path === '/api/compliance' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT s.id as survey_id, s.title, s.module_type, s.status as survey_status,
                  COALESCE(sc.costech_status, 'not_required') as costech_status,
                  COALESCE(sc.nbs_status, 'not_required') as nbs_status,
                  COALESCE(sc.ethics_status, 'not_required') as ethics_status,
                  COALESCE(sc.minors_involved, 0) as minors_involved,
                  COALESCE(sc.safeguarding_risk, 'low') as safeguarding_risk
           FROM surveys s
           LEFT JOIN survey_compliance sc ON sc.survey_id = s.id
           WHERE s.organization_id = ? ORDER BY s.created_at DESC`
        ).bind(claims.org).all();
        return json({ surveys: results });
      }

      const complianceUpdateMatch = path.match(/^\/api\/compliance\/([a-zA-Z0-9_]+)$/);
      if (complianceUpdateMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const surveyId = complianceUpdateMatch[1];
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO survey_compliance (survey_id, costech_status, nbs_status, ethics_status, minors_involved, safeguarding_risk, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(survey_id) DO UPDATE SET
             costech_status=excluded.costech_status, nbs_status=excluded.nbs_status, ethics_status=excluded.ethics_status,
             minors_involved=excluded.minors_involved, safeguarding_risk=excluded.safeguarding_risk, notes=excluded.notes, updated_at=datetime('now')`
        ).bind(
          surveyId, body.costech_status || 'not_required', body.nbs_status || 'not_required', body.ethics_status || 'not_required',
          body.minors_involved ? 1 : 0, body.safeguarding_risk || 'low', body.notes || null
        ).run();
        return json({ ok: true });
      }

      // ---------- CONSENT LOGS ----------
      if (path === '/api/consent-logs' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT id, phone_number, consent_given, created_at FROM respondents WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200`
        ).bind(claims.org).all();
        return json({ logs: results });
      }

      // ---------- VIA ASSISTANT (AI Q&A over your own data) ----------
      if (path === '/api/assistant/ask' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { question } = await request.json();
        if (!question) return error('question is required');

        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? GROUP BY r.overall_sentiment`
        ).bind(claims.org).all();
        const { results: quoteRows } = await env.DB.prepare(
          `SELECT t.raw_text, r.overall_sentiment, r.channel FROM transcripts t
           JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ORDER BY t.created_at DESC LIMIT 15`
        ).bind(claims.org).all();

        const context = `Sentiment breakdown: ${JSON.stringify(sentimentRows)}\n\nRecent transcripts:\n${quoteRows.map(q => `- (${q.overall_sentiment}, ${q.channel}) "${q.raw_text}"`).join('\n')}`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: `You are VIA, an analytics assistant inside a research dashboard. Answer the user's question using ONLY the data context below. If the data doesn't support an answer, say so honestly — do not invent numbers.\n\nDATA CONTEXT:\n${context}\n\nUSER QUESTION: ${question}`,
            }],
          }),
        });
        if (!claudeResp.ok) return error('Assistant is temporarily unavailable', 500);
        const data = await claudeResp.json();
        const answer = (data.content || []).map(c => c.text || '').join('');
        return json({ answer });
      }

      // ---------- AI REPORT INTELLIGENCE (Key Findings + Recommendations for the PDF report) ----------
      if (path === '/api/reports/intelligence' && method === 'GET') {
        const claims = await requireAuth(request, env);

        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? GROUP BY r.overall_sentiment`
        ).bind(claims.org).all();
        const { results: genderRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.gender), ''), 'Unspecified') as gender, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY gender`
        ).bind(claims.org).all();
        const { results: ageRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.age_bracket), ''), 'Unspecified') as age_bracket, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY age_bracket`
        ).bind(claims.org).all();
        const { results: regionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY region ORDER BY n DESC LIMIT 8`
        ).bind(claims.org).all();
        // Sentiment cross-tabulated by region — lets the AI spot *where* problems concentrate, not just that they exist.
        const { results: sentByRegionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, r.overall_sentiment, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? AND r.overall_sentiment IS NOT NULL GROUP BY region, r.overall_sentiment`
        ).bind(claims.org).all();
        const { results: insightRows } = await env.DB.prepare(
          `SELECT ai.content_json FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 150`
        ).bind(claims.org).all();
        const topicCounts = {};
        for (const row of insightRows) {
          try { const parsed = JSON.parse(row.content_json); for (const t of parsed.topics || []) topicCounts[t] = (topicCounts[t] || 0) + 1; } catch (_) {}
        }
        const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
        const totalResponses = sentimentRows.reduce((s, r) => s + r.n, 0);

        if (totalResponses === 0) {
          return json({
            key_findings: ['No responses have been collected yet — key findings will appear here once data comes in.'],
            recommendations: { immediate: [], strategic: [], policy: [] },
          });
        }

        // Real verbatim quotes, paired with their sentiment/topic tags — this is what
        // lets the AI write specific, grounded findings instead of generic summaries.
        const { results: quoteRows } = await env.DB.prepare(
          `SELECT t.raw_text, r.overall_sentiment, resp.region
           FROM transcripts t JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id
           JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? ORDER BY t.created_at DESC LIMIT 25`
        ).bind(claims.org).all();

        const context = `SAMPLE SIZE: ${totalResponses} total responses

SENTIMENT BREAKDOWN: ${JSON.stringify(sentimentRows)}
GENDER BREAKDOWN: ${JSON.stringify(genderRows)}
AGE BREAKDOWN: ${JSON.stringify(ageRows)}
REGION BREAKDOWN: ${JSON.stringify(regionRows)}
SENTIMENT BY REGION (cross-tab — use this to identify WHERE issues concentrate): ${JSON.stringify(sentByRegionRows)}
TOP TOPICS MENTIONED, WITH FREQUENCY: ${JSON.stringify(topics)}

SAMPLE VERBATIM RESPONSES (real transcripts, tagged with sentiment and region — use these to ground findings in specific evidence, and to select real illustrative quotes):
${quoteRows.map(q => `- [${q.overall_sentiment || 'unrated'}, ${q.region || 'unspecified region'}] "${q.raw_text}"`).join('\n')}`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 2200,
            messages: [{
              role: 'user',
              content: `You are a senior research analyst producing an executive intelligence report for an NGO/donor/government audience. Your output will be read by people deciding whether to award a $25K-$500K contract based on data quality — generic, vague, or template-sounding analysis is an immediate credibility failure. Every finding must be specific, evidence-grounded, and non-obvious.

STRICT RULES:
- Every key finding MUST cite a specific number, percentage, or comparison FROM THE DATA BELOW. Never write a finding that could apply to any survey anywhere (e.g. banning phrases like "respondents shared valuable feedback" or "the data shows important insights").
- Use the SENTIMENT BY REGION cross-tab to name which specific region(s) show elevated negative sentiment, if any — don't just say "some regions."
- Use the verbatim quotes to ground at least one finding in something a specific respondent said (paraphrase briefly, don't quote verbatim here — that's for the report's own quotes section).
- Assign each key finding a severity: "critical", "high", "medium", or "low" — based on how many responses are affected AND how negative the associated sentiment is. Do not mark everything "critical."
- If a cross-tab or breakdown has too few responses to support a claim (e.g. under 5 per group), say so explicitly rather than drawing a conclusion from it.
- Recommendations must each name a concrete action tied to a specific finding above — not generic advice like "improve communication" or "conduct further research."

Using ONLY the data below, produce:
1. "key_findings": an array of 3-4 objects, each with "text" (a specific, numbers-grounded finding, under 25 words) and "severity" ("critical"|"high"|"medium"|"low").
2. "recommendations": an object with three arrays — "immediate" (next 30 days, 1-2 items, each tied to a specific finding), "strategic" (6-12 months, 1-2 items), "policy" (long-term structural change, 0-1 items — omit if the data doesn't support a policy-level claim).
3. "risk_if_ignored": one specific sentence describing the concrete consequence of not acting on the top finding — grounded in the data, not generic ("things may get worse").
4. "top_recommendation": an object {"action": the single highest-priority recommendation text, "impact": a 0-100 estimate of how much this could move the top finding if implemented, "urgency": "high"|"medium"|"low", "confidence": a 0-100 estimate of how confident you are given the sample size and data quality}.
5. "narrative": a 3-4 paragraph flowing prose write-up (not bullet points) that tells the story of what was found, written for someone who wants to read a full account rather than skim bullets — ground every claim in the data, and weave in the general theme of any verbatim quotes provided (without quoting them verbatim here).

Do not invent statistics not supported by the data. If the data is too sparse for a strong claim anywhere, say so plainly in that finding instead of fabricating specifics.

DATA:
${context}

Respond with ONLY valid JSON in this exact shape, no markdown, no preamble:
{"key_findings": [{"text": "...", "severity": "high"}], "recommendations": {"immediate": ["..."], "strategic": ["..."], "policy": ["..."]}, "risk_if_ignored": "...", "top_recommendation": {"action": "...", "impact": 80, "urgency": "high", "confidence": 85}, "narrative": "..."}`,
            }],
          }),
        });
        if (!claudeResp.ok) return error('Report intelligence is temporarily unavailable', 500);
        const data = await claudeResp.json();
        const raw = (data.content || []).map(c => c.text || '').join('').trim().replace(/^```json\n?|\n?```$/g, '');
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return error('Could not parse AI response', 500); }
        return json(parsed);
      }

      // ---------- IMPACT INDICATORS (baseline vs current, for Donor Impact Report) ----------
      if (path === '/api/indicators' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          'SELECT * FROM impact_indicators WHERE organization_id = ? ORDER BY order_index ASC, updated_at ASC'
        ).bind(claims.org).all();
        return json({ indicators: results });
      }

      if (path === '/api/indicators' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { name, baseline_value, current_value, unit } = await request.json();
        if (!name) return error('name is required');
        const id = newId('ind');
        const countRow = await env.DB.prepare('SELECT COUNT(*) as n FROM impact_indicators WHERE organization_id = ?').bind(claims.org).first();
        await env.DB.prepare(
          `INSERT INTO impact_indicators (id, organization_id, name, baseline_value, current_value, unit, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, claims.org, name, baseline_value || null, current_value || null, unit || null, countRow.n).run();
        return json({ ok: true, id }, 201);
      }

      const indicatorMatch = path.match(/^\/api\/indicators\/([a-zA-Z0-9_]+)$/);
      if (indicatorMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const { name, baseline_value, current_value, unit } = await request.json();
        await env.DB.prepare(
          `UPDATE impact_indicators SET name = ?, baseline_value = ?, current_value = ?, unit = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`
        ).bind(name, baseline_value || null, current_value || null, unit || null, indicatorMatch[1], claims.org).run();
        return json({ ok: true });
      }
      if (indicatorMatch && method === 'DELETE') {
        const claims = await requireAuth(request, env);
        await env.DB.prepare('DELETE FROM impact_indicators WHERE id = ? AND organization_id = ?').bind(indicatorMatch[1], claims.org).run();
        return json({ ok: true });
      }

      // ---------- ADMIN: MODEL PERFORMANCE (real operational stats, no fabricated accuracy) ----------
      if (path === '/api/admin/model-stats' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const responses = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`
        ).bind(claims.org).first();
        const transcripts = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM transcripts t JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`
        ).bind(claims.org).first();
        const fraudFlags = await env.DB.prepare(
          `SELECT COUNT(*) as n, AVG(r.fraud_score) as avg_score FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? AND r.fraud_score >= 0.5`
        ).bind(claims.org).first();
        const avgLatency = await env.DB.prepare(
          `SELECT AVG((julianday(t.created_at) - julianday(a.created_at)) * 86400) as avg_seconds
           FROM transcripts t JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ?`
        ).bind(claims.org).first();
        // Real Whisper confidence, averaged across every voice response — not an illustrative number.
        const avgConfidence = await env.DB.prepare(
          `SELECT AVG(CAST(json_extract(ai.content_json, '$.confidence') AS REAL)) as avg_confidence
           FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? AND ai.insight_type = 'transcription_quality'`
        ).bind(claims.org).first();
        return json({
          total_responses: responses.n,
          total_transcripts: transcripts.n,
          fraud_flags: fraudFlags.n,
          avg_fraud_score: fraudFlags.avg_score,
          avg_processing_seconds: avgLatency.avg_seconds,
          avg_transcription_confidence: avgConfidence.avg_confidence,
        });
      }

      // ---------- OUTBOUND CAMPAIGNS (host-initiated calls/SMS/WhatsApp — you call THEM) ----------
      const outboundMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/outbound$/);
      if (outboundMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND organization_id = ?').bind(outboundMatch[1], claims.org).first();
        if (!campaign) return error('Campaign not found', 404);
        const { phone_numbers, channel, language } = await request.json();
        if (!Array.isArray(phone_numbers) || !phone_numbers.length) return error('phone_numbers must be a non-empty array');
        if (!['phone_call', 'sms', 'whatsapp'].includes(channel)) return error('channel must be phone_call, sms, or whatsapp');
        const lang = language === 'en' ? 'en' : 'sw';
        const base = new URL(request.url).origin;

        const results = [];
        for (const rawNumber of phone_numbers) {
          const phone = rawNumber.trim();
          if (!phone) continue;
          if (channel === 'phone_call') {
            const voiceUrl = `${base}/api/voice/outbound-connected?campaign_id=${encodeURIComponent(campaign.id)}&language=${lang}`;
            const result = await initiateOutboundCall(env, phone, voiceUrl);
            results.push({ phone, ok: result.ok, reason: result.reason });
          } else {
            // For SMS/WhatsApp we start the session immediately and text the
            // first question directly — their reply is then handled by the
            // exact same inbound webhook logic already in place.
            try {
              const session = await getOrCreateSession(env, { sessionKey: phone, channel, campaignId: campaign.id, language: lang });
              const questions = await getQuestions(env, session.survey_id);
              const q = questions[session.current_index];
              const messageBody = q ? q.question_text : 'Thank you for participating.';
              const sendResult = await sendTwilioMessage(env, { to: phone, body: messageBody, whatsapp: channel === 'whatsapp' });
              results.push({ phone, ok: sendResult.ok, reason: sendResult.reason });
            } catch (e) {
              results.push({ phone, ok: false, reason: e.message });
            }
          }
        }
        const successCount = results.filter(r => r.ok).length;
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'outbound_campaign_started', resourceType: 'campaign', resourceId: campaign.id, request });
        return json({ ok: true, sent: successCount, failed: results.length - successCount, results });
      }

      // ---------- AUDIT LOG (real security trail — logins, invites, 2FA changes) ----------
      if (path === '/api/audit-logs' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin') return error('Only an Org Admin can view the audit log', 403);
        const { results } = await env.DB.prepare(
          `SELECT al.action, al.resource_type, al.resource_id, al.ip_address, al.created_at, u.full_name, u.email
           FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
           WHERE al.organization_id = ? ORDER BY al.created_at DESC LIMIT 200`
        ).bind(claims.org).all();
        return json({ logs: results });
      }

      // ---------- PUBLIC: survey questions for the web widget ----------
      const publicQMatch = path.match(/^\/api\/public\/campaigns\/([a-zA-Z0-9_]+)\/questions$/);
      if (publicQMatch && method === 'GET') {
        const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(publicQMatch[1]).first();
        if (!campaign) return error('Campaign not found', 404);
        const questions = await getQuestions(env, campaign.survey_id);
        return json({ campaign: { id: campaign.id, name: campaign.name }, questions });
      }

      // ---------- CHANNEL 1: WHATSAPP ----------
      if (path === '/api/whatsapp/webhook' && method === 'POST') return await handleWhatsAppWebhook(request, env);

      // ---------- CHANNEL 2: PHONE CALL (Twilio Voice) ----------
      if (path === '/api/voice/incoming' && method === 'POST') return handleVoiceIncoming(request, env);
      if (path === '/api/voice/language' && method === 'POST') return await handleVoiceLanguage(request, env);
      if (path === '/api/voice/outbound-connected' && method === 'POST') return await handleVoiceOutboundConnected(request, env);
      if (path === '/api/voice/recording' && method === 'POST') return await handleVoiceRecording(request, env);

      // ---------- CHANNEL 3: SMS (feature-phone fallback, text only) ----------
      if (path === '/api/sms/webhook' && method === 'POST') return await handleSmsWebhook(request, env);

      // ---------- CHANNEL 4: WEB LINK / in-app recorder ----------
      if (path === '/api/web/submit' && method === 'POST') return await handleWebSubmit(request, env);

      return error('Not found', 404);
    } catch (e) {
      if (e && e.status) return error(e.message, e.status);
      console.error(e);
      return error('Internal server error: ' + (e.message || 'unknown'), 500);
    }
  },
};

// ============================================================
// SESSIONS — one survey walk-through per respondent, shared by every channel.
// ============================================================
async function getOrCreateSession(env, { sessionKey, channel, campaignId, language }) {
  campaignId = campaignId || env.DEFAULT_CAMPAIGN_ID || 'camp_default';

  // First, look for ANY in-progress session for this session_key+channel, regardless
  // of campaign_id. This matters for outbound SMS/WhatsApp/calls: the reply webhook
  // only knows the phone number, not which campaign the outbound message belonged
  // to — without this, a reply to an outbound message for a non-default campaign
  // would silently create a brand-new session under the wrong (default) campaign.
  let session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE session_key = ? AND channel = ? AND status = 'in_progress'`
  ).bind(sessionKey, channel).first();
  if (session) return session;

  // One response per device, for the web link specifically — if this device already
  // completed this exact campaign, don't silently start a brand-new response.
  if (channel === 'web_link') {
    const completed = await env.DB.prepare(
      `SELECT id FROM sessions WHERE session_key = ? AND channel = ? AND campaign_id = ? AND status = 'completed'`
    ).bind(sessionKey, channel, campaignId).first();
    if (completed) {
      const err = new Error('This device has already submitted a response for this survey.');
      err.code = 'ALREADY_SUBMITTED';
      throw err;
    }
  }

  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(campaignId).first();
  if (!campaign) throw new Error('Campaign not found: ' + campaignId);

  const respondentId = newId('resp');
  await env.DB.prepare(
    `INSERT INTO respondents (id, organization_id, phone_number, consent_given) VALUES (?, ?, ?, 1)`
  ).bind(respondentId, campaign.organization_id, channel === 'web_link' ? null : sessionKey).run();

  const responseId = newId('response');
  await env.DB.prepare(
    `INSERT INTO responses (id, campaign_id, respondent_id, channel, status) VALUES (?, ?, ?, ?, 'in_progress')`
  ).bind(responseId, campaignId, respondentId, channel).run();

  const id = newId('sess');
  await env.DB.prepare(
    `INSERT INTO sessions (id, session_key, channel, campaign_id, survey_id, respondent_id, response_id, current_index, language, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'in_progress')`
  ).bind(id, sessionKey, channel, campaignId, campaign.survey_id, respondentId, responseId, language || 'sw').run();

  return await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first();
}

async function getQuestions(env, surveyId) {
  const { results } = await env.DB.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC').bind(surveyId).all();
  return results;
}

// Process one answer (audio OR plain text) for the session's CURRENT question,
// then advance the session. Every channel calls this one function.
async function submitAnswer(env, session, { audioBuf, mediaType, textAnswer }) {
  const questions = await getQuestions(env, session.survey_id);
  const question = questions[session.current_index];
  if (!question) throw new Error('This session has no more questions');

  let transcript, r2Key = null, sttEngine, transcriptionConfidence = null;
  if (audioBuf) {
    r2Key = `${session.channel}/${Date.now()}-${crypto.randomUUID()}.audio`;
    await env.AUDIO_BUCKET.put(r2Key, audioBuf, { httpMetadata: { contentType: mediaType || 'audio/ogg' } });
    const sttResult = await transcribeAudio(env, audioBuf, mediaType);
    transcript = sttResult.text;
    transcriptionConfidence = sttResult.confidence;
    sttEngine = 'whisper-1';
  } else {
    transcript = (textAnswer || '').trim();
    sttEngine = 'text-input';
  }
  if (!transcript) throw new Error('Empty answer');

  // A "full_name" question is metadata about the respondent, not a survey
  // opinion — skip sentiment/fraud analysis (meaningless on a name) and store
  // it directly on the respondent record so it shows up everywhere immediately.
  if (question.question_type === 'full_name') {
    await env.DB.prepare('UPDATE respondents SET full_name = ? WHERE id = ?').bind(transcript, session.respondent_id).run();
    const answerId = newId('answer');
    await env.DB.prepare(
      `INSERT INTO answers (id, response_id, question_id, answer_text, audio_r2_key) VALUES (?, ?, ?, ?, ?)`
    ).bind(answerId, session.response_id, question.id, audioBuf ? null : transcript, r2Key).run();
    await env.DB.prepare(
      `INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, ?, ?)`
    ).bind(newId('tr'), answerId, transcript, session.language, sttEngine).run();
    const nextIndex = session.current_index + 1;
    const isComplete = nextIndex >= questions.length;
    await env.DB.prepare(
      `UPDATE sessions SET current_index = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(nextIndex, isComplete ? 'completed' : 'in_progress', session.id).run();
    if (isComplete) {
      await env.DB.prepare(`UPDATE responses SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).bind(session.response_id).run();
    }
    return { transcript, analysis: null, fraudResult: null, isComplete, nextQuestion: isComplete ? null : questions[nextIndex] };
  }

  const analysis = await analyzeText(env, transcript);
  const fraudResult = await runFraudChecks(env, session.campaign_id, transcript);

  const answerId = newId('answer');
  await env.DB.prepare(
    `INSERT INTO answers (id, response_id, question_id, answer_text, audio_r2_key) VALUES (?, ?, ?, ?, ?)`
  ).bind(answerId, session.response_id, question.id, audioBuf ? null : transcript, r2Key).run();

  await env.DB.prepare(
    `INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, ?, ?)`
  ).bind(newId('tr'), answerId, transcript, session.language, sttEngine).run();

  if (transcriptionConfidence != null) {
    await env.DB.prepare(
      `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'transcription_quality', ?, 'whisper-1')`
    ).bind(newId('ai'), session.response_id, JSON.stringify({ confidence: transcriptionConfidence })).run();
  }

  await env.DB.prepare(
    `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'summary', ?, 'claude-sonnet-5')`
  ).bind(newId('ai'), session.response_id, JSON.stringify(analysis)).run();

  if (fraudResult.score >= 0.5) {
    await env.DB.prepare(
      `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'fraud_flag', ?, 'fraud-engine-v1')`
    ).bind(newId('ai'), session.response_id, JSON.stringify(fraudResult)).run();

    if (fraudResult.score >= 0.7 && env.NOTIFY_TO_EMAIL) {
      await sendEmail(env, {
        to: env.NOTIFY_TO_EMAIL,
        subject: `⚠️ High fraud score detected (${fraudResult.score.toFixed(2)})`,
        html: `<p>A response scored <b>${fraudResult.score.toFixed(2)}</b> on the fraud engine.</p>
               <p><b>Reasons:</b> ${(fraudResult.reasons || []).join(', ') || 'unspecified'}</p>
               <p>Review it in Admin → Fraud Alerts.</p>`,
      });
    }
  }

  await env.DB.prepare(
    `UPDATE responses SET fraud_score = MAX(COALESCE(fraud_score, 0), ?), overall_sentiment = ? WHERE id = ?`
  ).bind(fraudResult.score, analysis.sentiment, session.response_id).run();

  const nextIndex = session.current_index + 1;
  const isComplete = nextIndex >= questions.length;

  if (isComplete) {
    await env.DB.prepare(`UPDATE sessions SET status = 'completed', current_index = ?, updated_at = datetime('now') WHERE id = ?`).bind(nextIndex, session.id).run();
    await env.DB.prepare(`UPDATE responses SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).bind(session.response_id).run();
  } else {
    await env.DB.prepare(`UPDATE sessions SET current_index = ?, updated_at = datetime('now') WHERE id = ?`).bind(nextIndex, session.id).run();
  }

  return { transcript, analysis, fraudResult, isComplete, nextQuestion: isComplete ? null : questions[nextIndex] };
}

async function transcribeAudio(env, audioBuf, mediaType) {
  const whisperForm = new FormData();
  whisperForm.append('file', new Blob([audioBuf], { type: mediaType || 'audio/ogg' }), 'audio.ogg');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'sw');
  whisperForm.append('response_format', 'verbose_json'); // returns per-segment avg_logprob — a real confidence signal, not a guess
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: whisperForm,
  });
  if (!resp.ok) throw new Error('Transcription failed: ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  // avg_logprob is typically in [-1, 0]; a simple, defensible mapping to a 0-100%
  // confidence score is exp(avg_logprob) * 100 — standard practice for Whisper output.
  let confidence = null;
  if (data.segments && data.segments.length) {
    const avgLogprob = data.segments.reduce((s, seg) => s + (seg.avg_logprob || 0), 0) / data.segments.length;
    confidence = Math.round(Math.exp(avgLogprob) * 100);
  }
  return { text: data.text, confidence };
}

async function analyzeText(env, transcript) {
  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are analyzing one answer from a survey respondent (transcribed from Swahili, English, or a mix, or typed directly via SMS). Respond ONLY with JSON, no other text, in this exact shape:
{"sentiment": "positive|neutral|negative|distressed", "topics": ["..."], "summary": "one sentence in English"}

Answer: """${transcript}"""`,
      }],
    }),
  });
  let analysis = { sentiment: 'neutral', topics: [], summary: '' };
  if (claudeResp.ok) {
    const data = await claudeResp.json();
    const textBlock = (data.content || []).map(c => c.text || '').join('');
    try { analysis = JSON.parse(textBlock.replace(/```json|```/g, '').trim()); } catch (_) {}
  }
  return analysis;
}

// ============================================================
// CHANNEL 1 — WhatsApp (multi-question)
// ============================================================
async function handleWhatsAppWebhook(request, env) {
  const form = await request.formData();
  const from = form.get('From');
  const numMedia = parseInt(form.get('NumMedia') || '0', 10);
  const mediaUrl = form.get('MediaUrl0');
  const mediaType = form.get('MediaContentType0');
  const bodyText = (form.get('Body') || '').trim();
  const campaignId = env.DEFAULT_CAMPAIGN_ID || 'camp_default';
  const hasAudio = numMedia > 0 && mediaUrl && (mediaType || '').startsWith('audio');
  const hasText = bodyText.length > 0;

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: from, channel: 'whatsapp', campaignId, language: /^2$/.test(bodyText) ? 'en' : 'sw' });
  } catch (e) {
    return twiml('Sorry, this survey is not currently active.');
  }
  const questions = await getQuestions(env, session.survey_id);

  // Fresh session and no answer content yet: greet and ask the first question.
  // Accepts a reply either as a voice note or as typed text — respondent's choice.
  if (session.current_index === 0 && !hasAudio && !hasText) {
    const q = questions[0];
    return twiml(`Welcome to VoiceInsights! Reply with a voice note or type your answer.\n\n${q ? q.question_text : 'Thank you.'}`);
  }
  if (!hasAudio && !hasText) {
    const q = questions[session.current_index];
    return twiml(q ? `Please reply with a voice note or type your answer: ${q.question_text}` : 'Please send a voice note or type your answer.');
  }

  try {
    let result;
    if (hasAudio) {
      const twilioAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
      const audioResp = await fetch(mediaUrl, { headers: { Authorization: `Basic ${twilioAuth}` } });
      if (!audioResp.ok) return twiml('Sorry, we could not receive your audio. Please try again.');
      const audioBuf = await audioResp.arrayBuffer();
      result = await submitAnswer(env, session, { audioBuf, mediaType });
    } else {
      result = await submitAnswer(env, session, { textAnswer: bodyText });
    }
    if (result.isComplete) return twiml('Thank you! You have completed the survey. We appreciate your time.');
    return twiml(`Got it! Next question:\n${result.nextQuestion.question_text}`);
  } catch (e) {
    console.error(e);
    return twiml('Sorry, a technical error occurred. We will try again shortly.');
  }
}

// ============================================================
// CHANNEL 2 — Phone Call (Twilio Voice), with language selection + multi-question loop
// ============================================================
function handleVoiceIncoming(request, env) {
  const base = new URL(request.url).origin;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${base}/api/voice/language" method="POST" timeout="6">
    <Say voice="Polly.Joanna">Welcome to VoiceInsights. For English, press 1. Kwa Kiswahili, bonyeza 2.</Say>
  </Gather>
  <Redirect method="POST">${base}/api/voice/language</Redirect>
</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

// Called by Twilio the moment an OUTBOUND call (initiated by the org) is answered.
// Unlike inbound calls, we already know the campaign and language from the
// dial request, so we skip straight to the first question — no keypress needed.
async function handleVoiceOutboundConnected(request, env) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaign_id');
  const language = url.searchParams.get('language') === 'en' ? 'en' : 'sw';
  const form = await request.formData();
  const callSid = form.get('CallSid');
  const base = url.origin;

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: callSid, channel: 'phone_call', campaignId, language });
  } catch (e) {
    return voiceTwiml(language === 'en' ? 'Sorry, this survey is not currently active. Goodbye.' : 'Samahani, utafiti huu haupo hai kwa sasa. Kwaheri.');
  }
  const questions = await getQuestions(env, session.survey_id);
  const q = questions[0];
  const greeting = language === 'en'
    ? 'Hello, this is a call from VoiceInsights Africa. We would like to ask you a few questions.'
    : 'Habari, huu ni ujumbe kutoka VoiceInsights Africa. Tungependa kukuuliza maswali machache.';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
  <Say voice="Polly.Joanna">${escapeXml(q ? q.question_text : 'Thank you.')}</Say>
  <Record maxLength="120" playBeep="true" action="${base}/api/voice/recording" method="POST" trim="trim-silence"/>
  <Say>We did not receive a recording. Goodbye.</Say>
</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

async function handleVoiceLanguage(request, env) {
  const form = await request.formData();
  const digits = form.get('Digits');
  const callSid = form.get('CallSid');
  const language = digits === '2' ? 'sw' : 'en';
  const base = new URL(request.url).origin;

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: callSid, channel: 'phone_call', campaignId: env.DEFAULT_CAMPAIGN_ID || 'camp_default', language });
  } catch (e) {
    return voiceTwiml('Sorry, this survey is not currently active. Goodbye.');
  }
  const questions = await getQuestions(env, session.survey_id);
  const q = questions[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(q ? q.question_text : 'Thank you.')}</Say>
  <Record maxLength="120" playBeep="true" action="${base}/api/voice/recording" method="POST" trim="trim-silence"/>
  <Say>We did not receive a recording. Goodbye.</Say>
</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

async function handleVoiceRecording(request, env) {
  const form = await request.formData();
  const callSid = form.get('CallSid');
  const recordingUrl = form.get('RecordingUrl');
  const base = new URL(request.url).origin;
  if (!recordingUrl) return voiceTwiml('Sorry, no recording was received. Goodbye.');

  const session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE session_key = ? AND channel = 'phone_call' AND status = 'in_progress'`
  ).bind(callSid).first();
  if (!session) return voiceTwiml('Sorry, your session expired. Goodbye.');

  const twilioAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const audioResp = await fetch(recordingUrl + '.mp3', { headers: { Authorization: `Basic ${twilioAuth}` } });
  if (!audioResp.ok) return voiceTwiml('Sorry, we could not process your recording. Goodbye.');
  const audioBuf = await audioResp.arrayBuffer();

  try {
    const result = await submitAnswer(env, session, { audioBuf, mediaType: 'audio/mpeg' });
    if (result.isComplete) return voiceTwiml('Thank you. Your responses have been recorded. Goodbye.');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(result.nextQuestion.question_text)}</Say>
  <Record maxLength="120" playBeep="true" action="${base}/api/voice/recording" method="POST" trim="trim-silence"/>
</Response>`;
    return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (e) {
    console.error(e);
    return voiceTwiml('Sorry, a technical error occurred. Goodbye.');
  }
}

// ============================================================
// CHANNEL 3 — SMS (feature-phone fallback: no smartphone or data needed)
// ============================================================
async function handleSmsWebhook(request, env) {
  const form = await request.formData();
  const from = form.get('From');
  const bodyText = (form.get('Body') || '').trim();
  const campaignId = env.DEFAULT_CAMPAIGN_ID || 'camp_default';

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: from, channel: 'sms', campaignId, language: 'sw' });
  } catch (e) {
    return twiml('Sorry, this survey is not currently active.');
  }
  const questions = await getQuestions(env, session.survey_id);

  if (session.current_index === 0 && !bodyText) {
    return twiml(`VoiceInsights survey. Reply by text to answer.\n\n${questions[0] ? questions[0].question_text : 'Thank you.'}`);
  }
  if (!bodyText) {
    const q = questions[session.current_index];
    return twiml(q ? q.question_text : 'Please reply with your answer.');
  }

  try {
    const result = await submitAnswer(env, session, { textAnswer: bodyText });
    if (result.isComplete) return twiml('Thank you for completing the survey!');
    return twiml(result.nextQuestion.question_text);
  } catch (e) {
    console.error(e);
    return twiml('Sorry, a technical error occurred.');
  }
}

// ============================================================
// CHANNEL 4 — Web Link / in-app recorder (public, multi-question)
// Expects multipart/form-data: audio (file), campaign_id, session_key, language.
// The client generates and re-sends the same session_key for every question
// in one visit so answers link to the same response.
// ============================================================
async function handleWebSubmit(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  // 30 submissions per 10 minutes per IP — generous for a real respondent
  // answering a multi-question survey, but blocks automated spam/abuse.
  if (await isRateLimited(env, `websubmit:${clientIp}`, 30, 10 * 60)) {
    return error('Too many submissions from this connection. Please wait a few minutes and try again.', 429);
  }
  const form = await request.formData();
  const audioFile = form.get('audio');
  const campaignId = form.get('campaign_id') || env.DEFAULT_CAMPAIGN_ID || 'camp_default';
  const sessionKey = form.get('session_key') || newId('web');
  const language = form.get('language') || 'en';
  if (!audioFile || typeof audioFile === 'string') return error('audio file is required');

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey, channel: 'web_link', campaignId, language });
  } catch (e) {
    if (e.code === 'ALREADY_SUBMITTED') return error('This device has already submitted a response for this survey.', 409);
    return error('Campaign not found or inactive', 404);
  }

  const audioBuf = await audioFile.arrayBuffer();
  try {
    const result = await submitAnswer(env, session, { audioBuf, mediaType: audioFile.type || 'audio/webm' });
    return json({
      ok: true, session_key: sessionKey, transcript: result.transcript, sentiment: result.analysis.sentiment,
      is_complete: result.isComplete, next_question: result.nextQuestion,
    });
  } catch (e) {
    console.error(e);
    return error('Processing failed: ' + e.message, 500);
  }
}

// ============================================================
// REPORTS — CSV export (opens directly in Excel / Google Sheets).
// For a PDF, open the CSV in Excel/Sheets and use "Save as PDF" —
// that keeps formatting under the organization's own control.
// ============================================================
async function handleCsvExport(request, env, url) {
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

async function handleCreateCheckoutSession(request, env) {
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

async function handleStripeWebhook(request, env) {
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
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
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
async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) return; // not configured — skip silently
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.NOTIFY_FROM_EMAIL || 'VoiceInsights Africa <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    // Never let a notification failure break the main request.
    console.error('Email notification failed:', e.message);
  }
}

// ============================================================
// Outbound SMS / WhatsApp via Twilio (for invites and future alerts).
// Silently no-ops if Twilio isn't configured — caller should fall back to email.
// ============================================================
// Returns the campaign_id a user is restricted to, or null if they have full
// organization access (only 'enumerator' role users can be scoped this way).
async function getAssignedCampaignId(env, claims) {
  if (claims.role !== 'enumerator') return null;
  const row = await env.DB.prepare('SELECT campaign_id FROM user_campaign_assignment WHERE user_id = ?').bind(claims.sub).first();
  return row ? row.campaign_id : null;
}

// Sliding-window rate limiter backed by D1. Returns true if the request should
// be BLOCKED (limit exceeded). windowSeconds and maxRequests are per rate_key.
async function isRateLimited(env, rateKey, maxRequests, windowSeconds) {
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
async function logAudit(env, { org, userId, action, resourceType, resourceId, request }) {
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
async function initiateOutboundCall(env, phoneNumber, voiceUrl) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return { ok: false, reason: 'twilio_not_configured' };
  }
  try {
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const params = new URLSearchParams({ To: phoneNumber, From: env.TWILIO_PHONE_NUMBER, Url: voiceUrl });
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) { const errText = await resp.text(); console.error('Twilio outbound call failed:', errText); return { ok: false, reason: 'twilio_error' }; }
    return { ok: true };
  } catch (e) {
    console.error('Twilio outbound call exception:', e.message);
    return { ok: false, reason: 'exception' };
  }
}

async function sendTwilioMessage(env, { to, body, whatsapp = false }) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return { ok: false, reason: 'twilio_not_configured' };
  }
  try {
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const from = whatsapp ? `whatsapp:${env.TWILIO_WHATSAPP_NUMBER || env.TWILIO_PHONE_NUMBER}` : env.TWILIO_PHONE_NUMBER;
    const toFormatted = whatsapp ? `whatsapp:${to}` : to;
    const params = new URLSearchParams({ To: toFormatted, From: from, Body: body });
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) { const errText = await resp.text(); console.error('Twilio send failed:', errText); return { ok: false, reason: 'twilio_error' }; }
    return { ok: true };
  } catch (e) {
    console.error('Twilio send exception:', e.message);
    return { ok: false, reason: 'exception' };
  }
}

// ============================================================
// Fraud Engine — real, deterministic heuristics (v1).
// ============================================================
async function runFraudChecks(env, campaignId, transcript) {
  const reasons = [];
  let score = 0;

  const { results: recent } = await env.DB.prepare(
    `SELECT t.raw_text, r.started_at FROM transcripts t
     JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id
     WHERE r.campaign_id = ? ORDER BY t.created_at DESC LIMIT 20`
  ).bind(campaignId).all();

  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\s]/g, '').trim();
  const a = normalize(transcript);
  for (const row of recent) {
    const b = normalize(row.raw_text || '');
    if (!b) continue;
    const similarity = jaccardSimilarity(a, b);
    if (similarity > 0.85) {
      score = Math.max(score, 0.9);
      reasons.push('Near-identical wording to a previous response on this campaign');
      break;
    } else if (similarity > 0.6) {
      score = Math.max(score, 0.55);
      reasons.push('Substantial overlap with a previous response on this campaign');
    }
  }

  if (recent.length > 0) {
    const lastTime = new Date(recent[0].started_at + 'Z').getTime();
    const secondsSinceLast = (Date.now() - lastTime) / 1000;
    if (secondsSinceLast >= 0 && secondsSinceLast < 15) {
      score = Math.max(score, 0.65);
      reasons.push(`Arrived only ${Math.round(secondsSinceLast)}s after the previous response (unusually fast)`);
    }
  }

  return { score: Number(score.toFixed(2)), reasons };
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function twiml(message) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}
function voiceTwiml(message) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(message)}</Say></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
