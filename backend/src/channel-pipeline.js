// src/channel-pipeline.js — The ONE shared collection pipeline for every channel
// (Voice, WhatsApp, SMS, public web link, offline enumerator app) plus Twilio
// helpers and fraud scoring. Extracted from index.js (V212 refactor). Behavior unchanged.
import { newId, verifyJWT } from './auth.js';
import { json, error } from './utils.js';
import { pushToOrgAdmins, sendEmail } from './notifications.js';
import { isOverRateLimit, recordFailedAttempt, isRateLimited, logAudit } from './request-scope.js';

export async function getOrCreateSession(env, { sessionKey, channel, campaignId, language, consentGiven }) {
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
    `INSERT INTO respondents (id, organization_id, phone_number, consent_given) VALUES (?, ?, ?, ?)`
  ).bind(respondentId, campaign.organization_id, channel === 'web_link' ? null : sessionKey, consentGiven ? 1 : 0).run();

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


export async function getQuestions(env, surveyId) {
  const { results } = await env.DB.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC').bind(surveyId).all();
  return results;
}

// Process one answer (audio OR plain text) for the session's CURRENT question,
// then advance the session. Every channel calls this one function.

export async function submitAnswer(env, session, { audioBuf, mediaType, textAnswer, questionId }) {
  const questions = await getQuestions(env, session.survey_id);
  // If the caller supplies the exact question_id this answer was recorded
  // against (used by the offline Enumerator App, which may have downloaded
  // the survey before it was later edited), honor that specific question —
  // never re-map an already-recorded answer to a different question just
  // because the live question list has since changed order or content.
  // Falls back to position-based lookup for channels with no local cache
  // (WhatsApp/SMS/Phone), which are always talking to the live question list.
  const question = questionId ? questions.find(q => q.id === questionId) : questions[session.current_index];
  if (!question) throw new Error('This session has no more questions');
  const questionIndexForProgress = questions.findIndex(q => q.id === question.id);

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
    const nextIndex = questionIndexForProgress + 1;
    const isComplete = nextIndex >= questions.length;
    // Sprint 1.2: core persistence as ONE atomic D1 batch — answer, transcript,
    // and session/response progression either all land together or none do.
    // There is no window where the answer exists but progress doesn't, or vice versa.
    const fullNameBatch = [
      env.DB.prepare(`INSERT INTO answers (id, response_id, question_id, answer_text, audio_r2_key) VALUES (?, ?, ?, ?, ?)`)
        .bind(answerId, session.response_id, question.id, audioBuf ? null : transcript, r2Key),
      env.DB.prepare(`INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, ?, ?)`)
        .bind(newId('tr'), answerId, transcript, session.language, sttEngine),
      env.DB.prepare(`UPDATE sessions SET current_index = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(nextIndex, isComplete ? 'completed' : 'in_progress', session.id),
    ];
    if (isComplete) {
      fullNameBatch.push(env.DB.prepare(`UPDATE responses SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).bind(session.response_id));
    }
    await env.DB.batch(fullNameBatch);
    return { transcript, answerId, analysis: null, fraudResult: null, isComplete, nextQuestion: isComplete ? null : questions[nextIndex] };
  }

  // ---------- Sprint 1.2 (Task 1.2.1 + correctness fix): CORE PERSISTENCE is
  // one atomic D1 batch. This guarantees a respondent can never end up with
  // "answer exists but progress doesn't" or "progress advanced but answer is
  // missing" — D1 itself enforces all-or-nothing across these statements,
  // not the order our code happens to run them in. AI ENRICHMENT (sentiment,
  // fraud, topic analysis) is DELIBERATELY excluded from this batch and
  // handled entirely separately below — if AI analysis fails, it must NEVER
  // roll back a successfully persisted answer. ----------
  const answerId = newId('answer');
  const nextIndex = questionIndexForProgress + 1;
  const isComplete = nextIndex >= questions.length;

  const coreBatch = [
    env.DB.prepare(`INSERT INTO answers (id, response_id, question_id, answer_text, audio_r2_key) VALUES (?, ?, ?, ?, ?)`)
      .bind(answerId, session.response_id, question.id, audioBuf ? null : transcript, r2Key),
    env.DB.prepare(`INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, ?, ?)`)
      .bind(newId('tr'), answerId, transcript, session.language, sttEngine),
  ];
  if (transcriptionConfidence != null) {
    coreBatch.push(
      env.DB.prepare(`INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'transcription_quality', ?, 'whisper-1')`)
        .bind(newId('ai'), session.response_id, JSON.stringify({ confidence: transcriptionConfidence }))
    );
  }
  coreBatch.push(
    env.DB.prepare(`UPDATE sessions SET current_index = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(nextIndex, isComplete ? 'completed' : 'in_progress', session.id)
  );
  if (isComplete) {
    coreBatch.push(env.DB.prepare(`UPDATE responses SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).bind(session.response_id));
  }

  // If this batch throws, NOTHING in it was committed (D1 guarantees this —
  // see verified Cloudflare docs) — the caller's existing catch block handles
  // it exactly as any other failure. There is no partial-write risk here.
  await env.DB.batch(coreBatch);

  // ---------- AI ENRICHMENT — fully decoupled from the above. From this
  // point on, submitAnswer() must NEVER throw: the respondent's answer and
  // interview progress are already durably, atomically saved regardless of
  // anything below. ----------
  let analysis = null, fraudResult = null;
  try {
    analysis = await analyzeText(env, transcript);
    fraudResult = await runFraudChecks(env, session.campaign_id, transcript, session.respondent_id, session.response_id);

    await env.DB.prepare(
      `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'summary', ?, 'claude-sonnet-5')`
    ).bind(newId('ai'), session.response_id, JSON.stringify(analysis)).run();

    if (fraudResult.score >= 0.5) {
      await env.DB.prepare(
        `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'fraud_flag', ?, 'fraud-engine')`
      ).bind(newId('ai'), session.response_id, JSON.stringify(fraudResult)).run();

      if (fraudResult.score >= 0.7 && env.NOTIFY_TO_EMAIL) {
        await sendEmail(env, {
          to: env.NOTIFY_TO_EMAIL,
          subject: `⚠️ High fraud score detected (${fraudResult.score.toFixed(2)})`,
          html: `<p>A response scored <b>${fraudResult.score.toFixed(2)}</b> on the fraud engine.</p>
                 <p><b>Reasons:</b> ${(fraudResult.reasons || []).join(', ') || 'unspecified'}</p>
                 <p>Review it in Admin → Fraud Alerts.</p>`,
        }).catch(() => { /* a failed notification email must never affect anything already persisted */ });
      }
      if (fraudResult.score >= 0.7) {
        // Task 6.4: push to this specific organization's org_admins.
        const campaignRow = await env.DB.prepare('SELECT organization_id FROM campaigns WHERE id = ?').bind(session.campaign_id).first();
        if (campaignRow) {
          pushToOrgAdmins(env, campaignRow.organization_id, {
            title: '⚠️ Fraud Alert',
            body: `A response scored ${fraudResult.score.toFixed(2)} on the fraud engine.`,
            link: '/admin/fraud-alerts.html',
          }).catch(e => console.error('push (fraud alert) failed:', e.message));
        }
      }
    }

    await env.DB.prepare(
      `UPDATE responses SET fraud_score = MAX(COALESCE(fraud_score, 0), ?), overall_sentiment = ? WHERE id = ?`
    ).bind(fraudResult.score, analysis.sentiment, session.response_id).run();
  } catch (aiError) {
    console.error('AI analysis failed, queuing for retry:', aiError.message);
    try {
      await env.DB.prepare(
        `INSERT INTO ai_processing_queue (id, answer_id, response_id, stage, attempts, last_error, status) VALUES (?, ?, ?, 'analyze', 1, ?, 'pending')`
      ).bind(newId('queue'), answerId, session.response_id, aiError.message || 'Unknown AI processing error').run();
    } catch (queueError) {
      // Worst case: even the retry-queue write failed (e.g., a D1 outage
      // coinciding with the AI failure). The answer itself is still safe —
      // this is logged loudly (visible in `wrangler tail`) so it is
      // discoverable, rather than thrown, which would incorrectly signal to
      // the caller that the respondent's answer was not saved.
      console.error('CRITICAL: AI retry-queue write also failed — answer', answerId, 'has no enrichment and no retry record:', queueError.message);
    }
  }

  return { transcript, answerId, analysis, fraudResult, isComplete, nextQuestion: isComplete ? null : questions[nextIndex] };
}


export async function transcribeAudio(env, audioBuf, mediaType) {
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


export async function analyzeText(env, transcript) {
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
  // A non-2xx Claude response (bad key, rate limit, outage) must be a real
  // failure — never silently recorded as a fake "neutral" analysis. This is
  // what allows the Sprint 1.2 retry queue to ever actually trigger for the
  // most common real-world AI failure mode (an HTTP error status), not just
  // outright network-unreachable errors. The error message is deliberately
  // short and never includes headers or the request body, so the API key
  // can never end up in a log or in ai_processing_queue.last_error.
  if (!claudeResp.ok) {
    throw new Error(`Claude API returned HTTP ${claudeResp.status} (${claudeResp.statusText || 'error'})`);
  }
  const data = await claudeResp.json();
  const textBlock = (data.content || []).map(c => c.text || '').join('');
  // A fallback ONLY for the model successfully responding (HTTP 200) but not
  // perfectly following the requested JSON shape — a model-quality edge
  // case, not an infrastructure failure, so a soft default is acceptable
  // here specifically (per explicit direction — this is the one narrow case
  // still allowed to fall back rather than throw).
  let analysis = { sentiment: 'neutral', topics: [], summary: '' };
  try { analysis = JSON.parse(textBlock.replace(/```json|```/g, '').trim()); } catch (_) { /* keep the neutral default — HTTP succeeded, just malformed content */ }
  return analysis;
}

// ============================================================
// CHANNEL 1 — WhatsApp (multi-question)
// ============================================================
// Twilio media URLs (voice notes, MMS) sometimes redirect to a separate storage
// host that doesn't want the Twilio auth header — and some fetch clients drop
// or mishandle that header across the redirect. Try the straightforward way
// first, then retry without auth (covers the redirect-to-public-URL case),
// before giving up. Logs the actual failure so real issues are diagnosable.

export async function fetchTwilioMedia(env, mediaUrl) {
  const twilioAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  try {
    const resp = await fetch(mediaUrl, { headers: { Authorization: `Basic ${twilioAuth}` } });
    if (resp.ok) return await resp.arrayBuffer();
    console.error('Twilio media fetch (with auth) failed:', resp.status, await resp.text().catch(() => ''));
  } catch (e) {
    console.error('Twilio media fetch (with auth) exception:', e.message);
  }
  try {
    const resp2 = await fetch(mediaUrl);
    if (resp2.ok) return await resp2.arrayBuffer();
    console.error('Twilio media fetch (no auth) failed:', resp2.status, await resp2.text().catch(() => ''));
  } catch (e) {
    console.error('Twilio media fetch (no auth) exception:', e.message);
  }
  return null;
}


export async function handleWhatsAppWebhook(request, env) {
  const form = await request.formData();
  const from = form.get('From');
  const numMedia = parseInt(form.get('NumMedia') || '0', 10);
  const mediaUrl = form.get('MediaUrl0');
  const mediaType = form.get('MediaContentType0');
  const bodyText = (form.get('Body') || '').trim();
  const hasAudio = numMedia > 0 && mediaUrl && (mediaType || '').startsWith('audio');
  const hasText = bodyText.length > 0;

  // Honor an opt-out immediately — we promise "reply STOP" in every outbound
  // message, so this must actually work, not just be words in a text.
  if (/^stop$/i.test(bodyText)) {
    await env.DB.prepare(
      `UPDATE responses SET status = 'withdrawn' WHERE id = (
         SELECT response_id FROM sessions WHERE session_key = ? AND channel = 'whatsapp' AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1
       )`
    ).bind(from).run();
    await env.DB.prepare(`UPDATE sessions SET status = 'withdrawn' WHERE session_key = ? AND channel = 'whatsapp' AND status = 'in_progress'`).bind(from).run();
    return twiml('You have been unsubscribed and no further questions will be sent. Thank you for your time.');
  }

  // Multiple organizations — and multiple projects within one organization —
  // can all be running WhatsApp collection on the same shared number at once.
  // An existing in-progress conversation is found regardless of campaign (see
  // getOrCreateSession); but a BRAND NEW conversation has no way to know which
  // project it's for until the respondent supplies the short code they were
  // given — this is what "commands" each reply to the correct organization
  // and activity, instead of guessing or defaulting to one global project.
  const existingSession = await env.DB.prepare(
    `SELECT campaign_id FROM sessions WHERE session_key = ? AND channel = 'whatsapp' AND status = 'in_progress'`
  ).bind(from).first();

  let campaignId, isNewConversation = false;
  if (existingSession) {
    campaignId = existingSession.campaign_id;
  } else {
    // Rate-limit code-guessing attempts BEFORE even trying the lookup, keyed
    // by phone (no organization is known yet at this point) — a valid code
    // never counts against this limit, only wrong guesses do.
    if (await isOverRateLimit(env, `survey_code:whatsapp:${from}`, 5, 60 * 60)) {
      return twiml('Too many invalid code attempts. Please wait and try again later.');
    }
    const codeRow = await env.DB.prepare('SELECT campaign_id FROM campaign_access_codes WHERE code = ?').bind(bodyText.toUpperCase()).first();
    if (!codeRow) {
      await recordFailedAttempt(env, `survey_code:whatsapp:${from}`, 60 * 60);
      return twiml('Welcome to VoiceInsights Africa! Please reply with the survey code you were given (for example AGRI123) to begin.');
    }
    campaignId = codeRow.campaign_id;
    isNewConversation = true;
  }

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: from, channel: 'whatsapp', campaignId, language: /^2$/.test(bodyText) ? 'en' : 'sw', consentGiven: true }); // Notice-based consent: the welcome message states participation is voluntary and how to opt out.
  } catch (e) {
    return twiml('Sorry, this survey is not currently active.');
  }
  const questions = await getQuestions(env, session.survey_id);

  // The message that just arrived WAS the access code, not an answer — greet
  // and ask question 1 immediately, without trying to submit "AGRI123" as a response.
  if (isNewConversation) {
    const q = questions[0];
    return twiml(`Welcome to VoiceInsights! By replying, you agree to take part in this research — your answers are recorded and analyzed for this study only. Reply STOP at any time to opt out.\n\nReply with a voice note or type your answer.\n\n${q ? q.question_text : 'Thank you.'}`);
  }
  if (!hasAudio && !hasText) {
    const q = questions[session.current_index];
    return twiml(q ? `Please reply with a voice note or type your answer: ${q.question_text}` : 'Please send a voice note or type your answer.');
  }

  try {
    let result;
    if (hasAudio) {
      const audioBuf = await fetchTwilioMedia(env, mediaUrl);
      if (!audioBuf) return twiml('Sorry, we could not receive your audio. Please try typing your answer instead, or send the voice note again.');
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

export function handleVoiceIncoming(request, env) {
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

export async function handleVoiceOutboundConnected(request, env) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaign_id');
  const language = url.searchParams.get('language') === 'en' ? 'en' : 'sw';
  const form = await request.formData();
  const callSid = form.get('CallSid');
  const base = url.origin;

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: callSid, channel: 'phone_call', campaignId, language, consentGiven: true }); // Notice-based consent: the voice greeting states participation is voluntary before any question is asked.
  } catch (e) {
    return voiceTwiml(language === 'en' ? 'Sorry, this survey is not currently active. Goodbye.' : 'Samahani, utafiti huu haupo hai kwa sasa. Kwaheri.');
  }
  const questions = await getQuestions(env, session.survey_id);
  const q = questions[0];
  const greeting = language === 'en'
    ? 'Hello, this is a call from VoiceInsights Africa. We would like to ask you a few questions. By staying on the line and answering, you agree to take part in this research — your answer will be recorded and analyzed for this study.'
    : 'Habari, huu ni ujumbe kutoka VoiceInsights Africa. Tungependa kukuuliza maswali machache. Kwa kubaki kwenye simu na kujibu, unakubali kushiriki kwenye utafiti huu.';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
  <Say voice="Polly.Joanna">${escapeXml(q ? q.question_text : 'Thank you.')}</Say>
  <Record maxLength="120" playBeep="true" action="${base}/api/voice/recording" method="POST" trim="trim-silence"/>
  <Say>We did not receive a recording. Goodbye.</Say>
</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}


export async function handleVoiceLanguage(request, env) {
  const form = await request.formData();
  const digits = form.get('Digits');
  const language = digits === '2' ? 'sw' : 'en';
  const base = new URL(request.url).origin;

  // Multiple organizations — and multiple projects within one organization —
  // can share the same Twilio number, so every inbound call must supply the
  // survey code (entered on the keypad) before we know which campaign this
  // call is even for. This is the phone equivalent of the WhatsApp/SMS code.
  const prompt = language === 'en'
    ? 'Please enter the survey code you were given, using your keypad, then press pound.'
    : 'Tafadhali bonyeza namba za utafiti ulizopewa, kisha bonyeza alama ya pound.';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="6" finishOnKey="#" action="${base}/api/voice/code?language=${language}" method="POST" timeout="10">
    <Say voice="Polly.Joanna">${escapeXml(prompt)}</Say>
  </Gather>
  <Say voice="Polly.Joanna">${escapeXml(language === 'en' ? 'We did not receive a code. Goodbye.' : 'Hatujapokea namba. Kwaheri.')}</Say>
</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}


export async function handleVoiceCode(request, env) {
  const url = new URL(request.url);
  const language = url.searchParams.get('language') === 'sw' ? 'sw' : 'en';
  const form = await request.formData();
  const digits = (form.get('Digits') || '').replace('#', '');
  const callSid = form.get('CallSid');
  const from = form.get('From');
  const base = url.origin;

  // Rate-limit by caller phone number (Twilio always supplies "From" on
  // voice webhooks too) — a valid code never counts, only wrong guesses do.
  if (from && await isOverRateLimit(env, `survey_code:voice:${from}`, 5, 60 * 60)) {
    return voiceTwiml(language === 'en' ? 'Too many invalid code attempts. Please wait and try again later. Goodbye.' : 'Majaribio mengi ya namba batili. Tafadhali subiri kisha jaribu tena. Kwaheri.');
  }

  const codeRow = await env.DB.prepare('SELECT campaign_id FROM campaign_access_codes WHERE code = ?').bind(digits).first();
  if (!codeRow) {
    if (from) await recordFailedAttempt(env, `survey_code:voice:${from}`, 60 * 60);
    return voiceTwiml(language === 'en' ? 'Sorry, that code was not recognized. Please call back and try again. Goodbye.' : 'Samahani, namba hizo hazitambuliki. Tafadhali piga tena. Kwaheri.');
  }

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: callSid, channel: 'phone_call', campaignId: codeRow.campaign_id, language, consentGiven: true });
  } catch (e) {
    return voiceTwiml('Sorry, this survey is not currently active. Goodbye.');
  }
  const questions = await getQuestions(env, session.survey_id);
  const q = questions[0];
  const consentNotice = language === 'en'
    ? 'By staying on the line and answering, you agree to take part in this research. Your answer will be recorded and analyzed for this study.'
    : 'Kwa kubaki kwenye simu na kujibu, unakubali kushiriki kwenye utafiti huu. Jibu lako litarekodiwa na kuchambuliwa kwa ajili ya utafiti huu.';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(consentNotice)}</Say>
  <Say voice="Polly.Joanna">${escapeXml(q ? q.question_text : 'Thank you.')}</Say>
  <Record maxLength="120" playBeep="true" action="${base}/api/voice/recording" method="POST" trim="trim-silence"/>
  <Say>We did not receive a recording. Goodbye.</Say>
</Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}


export async function handleVoiceRecording(request, env) {
  const form = await request.formData();
  const callSid = form.get('CallSid');
  const recordingUrl = form.get('RecordingUrl');
  const base = new URL(request.url).origin;
  if (!recordingUrl) return voiceTwiml('Sorry, no recording was received. Goodbye.');

  const session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE session_key = ? AND channel = 'phone_call' AND status = 'in_progress'`
  ).bind(callSid).first();
  if (!session) return voiceTwiml('Sorry, your session expired. Goodbye.');

  const audioBuf = await fetchTwilioMedia(env, recordingUrl + '.mp3');
  if (!audioBuf) return voiceTwiml('Sorry, we could not process your recording. Goodbye.');

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

export async function handleSmsWebhook(request, env) {
  const form = await request.formData();
  const from = form.get('From');
  const bodyText = (form.get('Body') || '').trim();

  if (/^stop$/i.test(bodyText)) {
    await env.DB.prepare(
      `UPDATE responses SET status = 'withdrawn' WHERE id = (
         SELECT response_id FROM sessions WHERE session_key = ? AND channel = 'sms' AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1
       )`
    ).bind(from).run();
    await env.DB.prepare(`UPDATE sessions SET status = 'withdrawn' WHERE session_key = ? AND channel = 'sms' AND status = 'in_progress'`).bind(from).run();
    return twiml('You have been unsubscribed and no further questions will be sent. Thank you for your time.');
  }

  // Same shared-number problem as WhatsApp — an SMS number is typically shared
  // across organizations/projects, so a brand new conversation must supply the
  // survey code first to be routed to the correct one.
  const existingSession = await env.DB.prepare(
    `SELECT campaign_id FROM sessions WHERE session_key = ? AND channel = 'sms' AND status = 'in_progress'`
  ).bind(from).first();

  let campaignId, isNewConversation = false;
  if (existingSession) {
    campaignId = existingSession.campaign_id;
  } else {
    if (await isOverRateLimit(env, `survey_code:sms:${from}`, 5, 60 * 60)) {
      return twiml('Too many invalid code attempts. Please wait and try again later.');
    }
    const codeRow = await env.DB.prepare('SELECT campaign_id FROM campaign_access_codes WHERE code = ?').bind(bodyText.toUpperCase()).first();
    if (!codeRow) {
      await recordFailedAttempt(env, `survey_code:sms:${from}`, 60 * 60);
      return twiml('Welcome to VoiceInsights Africa! Reply with the survey code you were given (e.g. AGRI123) to begin.');
    }
    campaignId = codeRow.campaign_id;
    isNewConversation = true;
  }

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey: from, channel: 'sms', campaignId, language: 'sw', consentGiven: true }); // Notice-based consent: the welcome SMS states participation is voluntary.
  } catch (e) {
    return twiml('Sorry, this survey is not currently active.');
  }
  const questions = await getQuestions(env, session.survey_id);

  if (isNewConversation) {
    return twiml(`VoiceInsights survey. By replying, you agree to take part in this research — reply STOP anytime to opt out.\n\n${questions[0] ? questions[0].question_text : 'Thank you.'}`);
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

export async function handleWebSubmit(request, env) {
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
  const questionId = form.get('question_id') || null;
  const deviceId = form.get('device_id') || null;
  const gpsLat = form.get('gps_lat') ? parseFloat(form.get('gps_lat')) : null;
  const gpsLng = form.get('gps_lng') ? parseFloat(form.get('gps_lng')) : null;
  const gpsAccuracy = form.get('gps_accuracy') ? parseFloat(form.get('gps_accuracy')) : null;
  // Consent defaults to true only when the caller doesn't send the field at
  // all (older cached enumerator app versions, or the outbound-initiated
  // flow) — respondent.html and the updated Enumerator App always send an
  // explicit value once the person has actually been asked.
  const consentGiven = form.has('consent') ? form.get('consent') === '1' : true;
  if (!audioFile || typeof audioFile === 'string') return error('audio file is required');

  let session;
  try {
    session = await getOrCreateSession(env, { sessionKey, channel: 'web_link', campaignId, language, consentGiven });
  } catch (e) {
    if (e.code === 'ALREADY_SUBMITTED') return error('This device has already submitted a response for this survey.', 409);
    return error('Campaign not found or inactive', 404);
  }

  // Record field-collection metadata once per response, whenever the device
  // supplies it — entirely optional, never blocks submission if absent.
  if (deviceId || gpsLat != null) {
    try {
      await env.DB.prepare(
        `INSERT INTO response_metadata (response_id, device_id, gps_lat, gps_lng, gps_accuracy_m) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(response_id) DO UPDATE SET device_id = excluded.device_id, gps_lat = excluded.gps_lat, gps_lng = excluded.gps_lng, gps_accuracy_m = excluded.gps_accuracy_m`
      ).bind(session.response_id, deviceId, gpsLat, gpsLng, gpsAccuracy).run();
    } catch (e) { /* metadata is best-effort — never let it block a real answer from saving */ }
  }

  // Attribute this response to the logged-in enumerator, if any — optional so
  // it never breaks the public, unauthenticated respondent.html flow.
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const enumClaims = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
      await env.DB.prepare('INSERT OR IGNORE INTO response_collector (response_id, user_id) VALUES (?, ?)').bind(session.response_id, enumClaims.sub).run();
    } catch (e) { /* not a valid enumerator token — fine, this is optional */ }
  }

  const audioBuf = await audioFile.arrayBuffer();
  try {
    const result = await submitAnswer(env, session, { audioBuf, mediaType: audioFile.type || 'audio/webm', questionId });

    // Optional photo attached to this same answer (Task 2.2) — never blocks
    // the actual survey answer if it fails; the answer above is already
    // safely saved by the time this runs.
    const photoFile = form.get('photo');
    if (photoFile && typeof photoFile !== 'string' && result.answerId) {
      try {
        const photoBuf = await photoFile.arrayBuffer();
        const photoKey = `photos/${session.channel}/${Date.now()}-${crypto.randomUUID()}.jpg`;
        await env.AUDIO_BUCKET.put(photoKey, photoBuf, { httpMetadata: { contentType: photoFile.type || 'image/jpeg' } });
        await env.DB.prepare('INSERT INTO answer_photos (answer_id, r2_key) VALUES (?, ?)').bind(result.answerId, photoKey).run();
      } catch (photoError) {
        console.error('Photo upload failed for answer', result.answerId, ':', photoError.message);
      }
    }

    return json({
      ok: true, session_key: sessionKey, transcript: result.transcript, sentiment: result.analysis ? result.analysis.sentiment : null,
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

export async function initiateOutboundCall(env, phoneNumber, voiceUrl) {
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
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Twilio outbound call failed:', errText);
      logAudit(env, { org: null, userId: null, action: 'twilio_send_failed', resourceType: 'call', resourceId: to, request: null }).catch(() => {});
      return { ok: false, reason: 'twilio_error' };
    }
    return { ok: true };
  } catch (e) {
    console.error('Twilio outbound call exception:', e.message);
    return { ok: false, reason: 'exception' };
  }
}


export async function sendTwilioMessage(env, { to, body, whatsapp = false }) {
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
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Twilio send failed:', errText);
      logAudit(env, { org: null, userId: null, action: 'twilio_send_failed', resourceType: 'message', resourceId: to, request: null }).catch(() => {});
      return { ok: false, reason: 'twilio_error' };
    }
    return { ok: true };
  } catch (e) {
    console.error('Twilio send exception:', e.message);
    return { ok: false, reason: 'exception' };
  }
}

// ============================================================
// Fraud Engine — real, deterministic heuristics (v1).
// ============================================================

export async function runFraudChecks(env, campaignId, transcript, respondentId, responseId) {
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

  // Repeated Phone — the same respondent submitting an unusually high number
  // of separate "interviews" on the same campaign, a common low-effort fraud pattern.
  if (respondentId) {
    const phoneCount = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM responses r WHERE r.campaign_id = ? AND r.respondent_id IN (
         SELECT id FROM respondents WHERE phone_number = (SELECT phone_number FROM respondents WHERE id = ?)
       )`
    ).bind(campaignId, respondentId).first();
    if (phoneCount.n > 3) {
      score = Math.max(score, 0.6);
      reasons.push(`This phone number has submitted ${phoneCount.n} separate responses on this campaign`);
    }
  }

  // GPS Mismatch — this response's location is far outside the cluster of
  // every other GPS-tagged response on the same campaign, suggesting either a
  // location spoof or an enumerator working well outside their assigned area.
  if (responseId) {
    const thisGps = await env.DB.prepare('SELECT gps_lat, gps_lng FROM response_metadata WHERE response_id = ?').bind(responseId).first();
    if (thisGps && thisGps.gps_lat != null && thisGps.gps_lng != null) {
      const { results: otherGps } = await env.DB.prepare(
        `SELECT rm.gps_lat, rm.gps_lng FROM response_metadata rm JOIN responses r ON rm.response_id = r.id
         WHERE r.campaign_id = ? AND rm.response_id != ? AND rm.gps_lat IS NOT NULL LIMIT 50`
      ).bind(campaignId, responseId).all();
      if (otherGps.length >= 3) {
        const avgLat = otherGps.reduce((s, g) => s + g.gps_lat, 0) / otherGps.length;
        const avgLng = otherGps.reduce((s, g) => s + g.gps_lng, 0) / otherGps.length;
        const distKm = haversineKm(thisGps.gps_lat, thisGps.gps_lng, avgLat, avgLng);
        if (distKm > 300) {
          score = Math.max(score, 0.5);
          reasons.push(`GPS location is ~${Math.round(distKm)}km from where the rest of this campaign's responses were collected`);
        }
      }
    }
  }

  return { score: Number(score.toFixed(2)), reasons };
}


export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}


export function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}


export function twiml(message) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export function voiceTwiml(message) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(message)}</Say></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
