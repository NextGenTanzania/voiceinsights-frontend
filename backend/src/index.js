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
        return json({ ok: true });
      }

      if (path === '/api/2fa/disable' && method === 'POST') {
        const claims = await requireAuth(request, env);
        await env.DB.prepare('DELETE FROM user_2fa WHERE user_id = ?').bind(claims.sub).run();
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

      if (path === '/api/users/invite' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin') return error('Only an Org Admin can invite users', 403);
        const { email, full_name, role, region, phone, invite_method } = await request.json();
        if (!email || !full_name) return error('email and full_name are required');
        if ((invite_method === 'sms' || invite_method === 'whatsapp') && !phone) return error('Phone number is required for SMS/WhatsApp invites', 400);
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) return error('A user with this email already exists', 409);

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

        const loginUrl = `${env.SITE_URL || 'https://voiceinsights-frontend.pages.dev'}/login.html`;
        let delivered = 'email';

        if (invite_method === 'sms' || invite_method === 'whatsapp') {
          const smsBody = `Hi ${full_name}, you've been invited to VoiceInsights Africa. Login: ${loginUrl} | Email: ${email} | Temp password: ${tempPassword}. Please change your password after first login.`;
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
            subject: `You've been invited to VoiceInsights Africa`,
            html: `<p>Hi ${full_name},</p>
                   <p>You've been added as a team member on VoiceInsights Africa${region ? ` for the ${region} region` : ''}.</p>
                   <p><b>Login:</b> <a href="${loginUrl}">${loginUrl}</a><br>
                   <b>Email:</b> ${email}<br>
                   <b>Temporary password:</b> ${tempPassword}</p>
                   <p>Please log in and change your password from Settings as soon as possible.</p>`,
          });
        }

        return json({ ok: true, delivered_via: delivered, user: { id: userId, email, full_name, role: role || 'me_officer', region: region || null } }, 201);
      }

      const deactivateMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_]+)\/deactivate$/);
      if (deactivateMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin') return error('Only an Org Admin can deactivate users', 403);
        await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ? AND organization_id = ?').bind(deactivateMatch[1], claims.org).run();
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
        const surveys = await env.DB.prepare('SELECT COUNT(*) as n FROM surveys WHERE organization_id = ? AND status = "active"').bind(claims.org).first();
        const responses = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`
        ).bind(claims.org).first();
        const completed = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? AND r.status = 'completed'`
        ).bind(claims.org).first();
        const positive = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? AND r.overall_sentiment = 'positive'`
        ).bind(claims.org).first();
        const byChannel = await env.DB.prepare(
          `SELECT r.channel, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? GROUP BY r.channel`
        ).bind(claims.org).all();
        const { results: weeklyRows } = await env.DB.prepare(
          `SELECT strftime('%Y-%W', r.started_at) as week, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? AND r.started_at >= datetime('now', '-42 days')
           GROUP BY week ORDER BY week ASC`
        ).bind(claims.org).all();
        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? GROUP BY r.overall_sentiment`
        ).bind(claims.org).all();
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
          `SELECT r.id, r.phone_number, r.region, r.gender, r.age_bracket, r.consent_given, r.created_at,
                  (SELECT COUNT(*) FROM responses resp WHERE resp.respondent_id = r.id) AS response_count
           FROM respondents r WHERE r.organization_id = ? ORDER BY r.created_at DESC LIMIT 200`
        ).bind(claims.org).all();
        return json({ respondents: results });
      }

      // ---------- INTERVIEWS (responses with transcript + audio) ----------
      if (path === '/api/interviews' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT r.id as response_id, r.channel, r.overall_sentiment, r.fraud_score, r.status, r.started_at,
                  resp.phone_number, c.name as campaign_name,
                  (SELECT a.audio_r2_key FROM answers a WHERE a.response_id = r.id AND a.audio_r2_key IS NOT NULL ORDER BY a.created_at ASC LIMIT 1) as audio_r2_key,
                  (SELECT t.raw_text FROM transcripts t JOIN answers a2 ON t.answer_id = a2.id WHERE a2.response_id = r.id ORDER BY t.created_at ASC LIMIT 1) as first_transcript,
                  (SELECT ai.content_json FROM ai_insights ai WHERE ai.response_id = r.id AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 1) as summary_json
           FROM responses r
           JOIN campaigns c ON r.campaign_id = c.id
           JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ?
           ORDER BY r.started_at DESC LIMIT 100`
        ).bind(claims.org).all();
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
        const { results: regionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? GROUP BY region ORDER BY n DESC LIMIT 8`
        ).bind(claims.org).all();
        const { results: insightRows } = await env.DB.prepare(
          `SELECT ai.content_json FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 100`
        ).bind(claims.org).all();
        const topicCounts = {};
        for (const row of insightRows) {
          try { const parsed = JSON.parse(row.content_json); for (const t of parsed.topics || []) topicCounts[t] = (topicCounts[t] || 0) + 1; } catch (_) {}
        }
        const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, count]) => ({ topic, count }));
        const totalResponses = sentimentRows.reduce((s, r) => s + r.n, 0);

        if (totalResponses === 0) {
          return json({
            key_findings: ['No responses have been collected yet — key findings will appear here once data comes in.'],
            recommendations: { immediate: [], strategic: [], policy: [] },
          });
        }

        const context = `Total responses: ${totalResponses}
Sentiment breakdown: ${JSON.stringify(sentimentRows)}
Gender breakdown: ${JSON.stringify(genderRows)}
Top regions: ${JSON.stringify(regionRows)}
Top topics mentioned: ${JSON.stringify(topics)}`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 900,
            messages: [{
              role: 'user',
              content: `You are a research analyst producing an executive report for an NGO/donor audience. Using ONLY the data below, write:
1. "key_findings": exactly 3 short, punchy bullet-point findings (each under 20 words) a CEO could read in 60 seconds. Cite real numbers/percentages from the data where possible.
2. "recommendations": an object with three arrays — "immediate" (next 30 days, 2 items), "strategic" (6-12 months, 2 items), "policy" (long-term, 1-2 items).

Do not invent statistics not supported by the data. If the data is too sparse for a strong claim, say so plainly instead of fabricating specifics.

DATA:
${context}

Respond with ONLY valid JSON in this exact shape, no markdown, no preamble:
{"key_findings": ["...", "...", "..."], "recommendations": {"immediate": ["...", "..."], "strategic": ["...", "..."], "policy": ["..."]}}`,
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
        return json({
          total_responses: responses.n,
          total_transcripts: transcripts.n,
          fraud_flags: fraudFlags.n,
          avg_fraud_score: fraudFlags.avg_score,
          avg_processing_seconds: avgLatency.avg_seconds,
        });
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

  let session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE session_key = ? AND channel = ? AND campaign_id = ? AND status = 'in_progress'`
  ).bind(sessionKey, channel, campaignId).first();
  if (session) return session;

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

  let transcript, r2Key = null, sttEngine;
  if (audioBuf) {
    r2Key = `${session.channel}/${Date.now()}-${crypto.randomUUID()}.audio`;
    await env.AUDIO_BUCKET.put(r2Key, audioBuf, { httpMetadata: { contentType: mediaType || 'audio/ogg' } });
    transcript = await transcribeAudio(env, audioBuf, mediaType);
    sttEngine = 'whisper-1';
  } else {
    transcript = (textAnswer || '').trim();
    sttEngine = 'text-input';
  }
  if (!transcript) throw new Error('Empty answer');

  const analysis = await analyzeText(env, transcript);
  const fraudResult = await runFraudChecks(env, session.campaign_id, transcript);

  const answerId = newId('answer');
  await env.DB.prepare(
    `INSERT INTO answers (id, response_id, question_id, answer_text, audio_r2_key) VALUES (?, ?, ?, ?, ?)`
  ).bind(answerId, session.response_id, question.id, audioBuf ? null : transcript, r2Key).run();

  await env.DB.prepare(
    `INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, ?, ?)`
  ).bind(newId('tr'), answerId, transcript, session.language, sttEngine).run();

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
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: whisperForm,
  });
  if (!resp.ok) throw new Error('Transcription failed: ' + (await resp.text()).slice(0, 200));
  const { text } = await resp.json();
  return text;
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

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: from, channel: 'whatsapp', campaignId, language: /^2$/.test(bodyText) ? 'en' : 'sw' });
  } catch (e) {
    return twiml('Sorry, this survey is not currently active.');
  }
  const questions = await getQuestions(env, session.survey_id);

  // Fresh session and no audio yet: greet and ask the first question.
  if (session.current_index === 0 && !numMedia) {
    const q = questions[0];
    return twiml(`Welcome to VoiceInsights! Please send a voice note to answer.\n\n${q ? q.question_text : 'Thank you.'}`);
  }
  if (!numMedia || !mediaUrl) {
    const q = questions[session.current_index];
    return twiml(q ? `Please reply with a voice note: ${q.question_text}` : 'Please send a voice note to answer.');
  }

  const twilioAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const audioResp = await fetch(mediaUrl, { headers: { Authorization: `Basic ${twilioAuth}` } });
  if (!audioResp.ok) return twiml('Sorry, we could not receive your audio. Please try again.');
  const audioBuf = await audioResp.arrayBuffer();

  try {
    const result = await submitAnswer(env, session, { audioBuf, mediaType });
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
