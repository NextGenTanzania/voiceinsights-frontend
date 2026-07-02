// src/index.js — VoiceInsights Africa API (Cloudflare Worker)
// Routes:
//   POST /api/auth/login
//   GET  /api/auth/me
//   GET  /api/surveys              (list, org-scoped)
//   POST /api/surveys              (create)
//   GET  /api/surveys/:id          (with questions)
//   POST /api/surveys/:id/questions
//   GET  /api/campaigns
//   POST /api/campaigns
//   GET  /api/dashboard/stats
//   POST /api/whatsapp/webhook     (Twilio WhatsApp inbound voice notes)

import { hashPassword, verifyPassword, signJWT, newId } from './auth.js';
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

        const token = await signJWT(
          { sub: user.id, org: user.organization_id, role: user.role, email: user.email },
          env.JWT_SECRET
        );

        await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();

        return json({
          token,
          user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, organization_id: user.organization_id },
        });
      }

      if (path === '/api/auth/me' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const user = await env.DB.prepare('SELECT id, email, full_name, role, organization_id FROM users WHERE id = ?').bind(claims.sub).first();
        if (!user) return error('User not found', 404);
        return json({ user });
      }

      // ---------- SURVEYS ----------
      if (path === '/api/surveys' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          'SELECT * FROM surveys WHERE organization_id = ? ORDER BY created_at DESC'
        ).bind(claims.org).all();
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
        ).bind(
          id, claims.org, claims.sub, body.title, body.description || '',
          body.module_type || 'survey', body.language || 'en', body.status || 'draft'
        ).run();

        return json({ survey: { id, title: body.title, status: body.status || 'draft' } }, 201);
      }

      const surveyMatch = path.match(/^\/api\/surveys\/([a-zA-Z0-9_]+)$/);
      if (surveyMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const surveyId = surveyMatch[1];
        const survey = await env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND organization_id = ?').bind(surveyId, claims.org).first();
        if (!survey) return error('Survey not found', 404);
        const { results: questions } = await env.DB.prepare(
          'SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC'
        ).bind(surveyId).all();
        return json({ survey, questions });
      }

      const questionsMatch = path.match(/^\/api\/surveys\/([a-zA-Z0-9_]+)\/questions$/);
      if (questionsMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const surveyId = questionsMatch[1];
        const body = await request.json();
        if (!body.question_text) return error('question_text is required');

        const id = newId('q');
        await env.DB.prepare(
          `INSERT INTO questions (id, survey_id, order_index, question_text, question_type, kpi_tag)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, surveyId, body.order_index || 0, body.question_text, body.question_type || 'open_voice', body.kpi_tag || null).run();

        return json({ question: { id, question_text: body.question_text } }, 201);
      }

      // ---------- CAMPAIGNS ----------
      if (path === '/api/campaigns' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          'SELECT * FROM campaigns WHERE organization_id = ? ORDER BY created_at DESC'
        ).bind(claims.org).all();
        return json({ campaigns: results });
      }

      if (path === '/api/campaigns' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json();
        if (!body.survey_id || !body.name) return error('survey_id and name are required');

        const id = newId('camp');
        await env.DB.prepare(
          `INSERT INTO campaigns (id, survey_id, organization_id, name, channel, target_respondents, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, body.survey_id, claims.org, body.name, body.channel || 'whatsapp', body.target_respondents || 0, 'scheduled').run();

        return json({ campaign: { id, name: body.name } }, 201);
      }

      // ---------- DASHBOARD ----------
      if (path === '/api/dashboard/stats' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const surveys = await env.DB.prepare('SELECT COUNT(*) as n FROM surveys WHERE organization_id = ? AND status = "active"').bind(claims.org).first();
        const responses = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r
           JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ?`
        ).bind(claims.org).first();
        return json({ active_surveys: surveys.n, total_responses: responses.n });
      }

      // ---------- WHATSAPP WEBHOOK (Twilio) ----------
      if (path === '/api/whatsapp/webhook' && method === 'POST') {
        return await handleWhatsAppWebhook(request, env);
      }

      return error('Not found', 404);
    } catch (e) {
      if (e && e.status) return error(e.message, e.status);
      console.error(e);
      return error('Internal server error: ' + (e.message || 'unknown'), 500);
    }
  },
};

// ============================================================
// WhatsApp voice pipeline: Twilio webhook -> R2 -> Whisper (transcribe) -> Claude (analyze) -> D1
// ============================================================
async function handleWhatsAppWebhook(request, env) {
  const form = await request.formData();
  const from = form.get('From');            // e.g. "whatsapp:+255712345678"
  const numMedia = parseInt(form.get('NumMedia') || '0', 10);
  const mediaUrl = form.get('MediaUrl0');
  const mediaType = form.get('MediaContentType0');

  if (!numMedia || !mediaUrl) {
    return twiml("Karibu VoiceInsights Africa! Tuma ujumbe wa sauti (voice note) ili tuanze mahojiano. / Welcome! Please send a voice note to begin.");
  }

  // 1. Download audio from Twilio (Basic Auth with Account SID / Auth Token)
  const twilioAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const audioResp = await fetch(mediaUrl, { headers: { Authorization: `Basic ${twilioAuth}` } });
  if (!audioResp.ok) return twiml("Samahani, tumeshindwa kupokea sauti yako. Jaribu tena.");
  const audioBuf = await audioResp.arrayBuffer();

  // 2. Store raw audio in R2
  const r2Key = `whatsapp/${Date.now()}-${crypto.randomUUID()}.ogg`;
  await env.AUDIO_BUCKET.put(r2Key, audioBuf, { httpMetadata: { contentType: mediaType || 'audio/ogg' } });

  // 3. Transcribe with OpenAI Whisper
  const whisperForm = new FormData();
  whisperForm.append('file', new Blob([audioBuf], { type: mediaType || 'audio/ogg' }), 'audio.ogg');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'sw');

  const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: whisperForm,
  });
  if (!whisperResp.ok) return twiml("Samahani, kuna hitilafu ya kiufundi. Tutajaribu tena baadaye.");
  const { text: transcript } = await whisperResp.json();

  // 4. Analyze with Claude — sentiment + topic + short summary, returned strictly as JSON
  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are analyzing a survey voice response transcribed from Swahili. Respond ONLY with JSON, no other text, in this exact shape:
{"sentiment": "positive|neutral|negative|distressed", "topics": ["..."], "summary": "one sentence in English"}

Transcript: """${transcript}"""`,
      }],
    }),
  });
  let analysis = { sentiment: 'neutral', topics: [], summary: '' };
  if (claudeResp.ok) {
    const data = await claudeResp.json();
    const textBlock = (data.content || []).map(c => c.text || '').join('');
    try { analysis = JSON.parse(textBlock.replace(/```json|```/g, '').trim()); } catch (_) {}
  }

  // 5. Persist: respondent -> response -> answer -> transcript -> ai_insight
  const respondentId = newId('resp');
  await env.DB.prepare(
    `INSERT INTO respondents (id, organization_id, phone_number, consent_given) VALUES (?, ?, ?, 1)`
  ).bind(respondentId, env.DEFAULT_ORG_ID || 'org_demo', from).run();

  const responseId = newId('response');
  await env.DB.prepare(
    `INSERT INTO responses (id, campaign_id, respondent_id, channel, status, overall_sentiment)
     VALUES (?, ?, ?, 'whatsapp', 'completed', ?)`
  ).bind(responseId, env.DEFAULT_CAMPAIGN_ID || 'camp_default', respondentId, analysis.sentiment).run();

  const answerId = newId('answer');
  await env.DB.prepare(
    `INSERT INTO answers (id, response_id, question_id, audio_r2_key) VALUES (?, ?, ?, ?)`
  ).bind(answerId, responseId, env.DEFAULT_QUESTION_ID || 'q_default', r2Key).run();

  await env.DB.prepare(
    `INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, 'sw', 'whisper-1')`
  ).bind(newId('tr'), answerId, transcript).run();

  await env.DB.prepare(
    `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'summary', ?, 'claude-sonnet-4-6')`
  ).bind(newId('ai'), responseId, JSON.stringify(analysis)).run();

  return twiml(`Asante kwa jibu lako! Tumepokea: "${transcript.slice(0, 120)}${transcript.length > 120 ? '…' : ''}"`);
}

function twiml(message) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}
function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
