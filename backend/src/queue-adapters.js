import { analyzeText, transcribeAudio, sendTwilioMessage, initiateOutboundCall } from './channel-pipeline.js';
import { buildDocumentModel } from './report-generator.js';
import { buildDocumentComposition } from './document-composer.js';
import { renderPdfBinary, renderPptxBinary, storeBinaryArtifact } from './dedicated-binary-renderer.js';
import { renderDocxBinary, renderXlsxBinary } from './office-export-engine.js';
import { sendEmail, sendPushNotification } from './notifications.js';

function permanent(message, code = 'INVALID_JOB_PAYLOAD', status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.retryable = false;
  return error;
}

function required(value, name) {
  if (value === undefined || value === null || value === '') throw permanent(`${name} is required`);
  return value;
}

async function loadPayloadBytes(message, env) {
  if (message.payload_ref) {
    if (!env.AUDIO_BUCKET?.get) throw permanent('AUDIO_BUCKET binding is unavailable', 'STORAGE_NOT_CONFIGURED', 503);
    const object = await env.AUDIO_BUCKET.get(message.payload_ref);
    if (!object) throw permanent('Referenced payload was not found', 'PAYLOAD_NOT_FOUND', 404);
    return object.arrayBuffer();
  }
  if (message.payload?.base64) {
    const binary = atob(message.payload.base64);
    return Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
  }
  throw permanent('payload_ref or payload.base64 is required');
}

async function translateText(env, { text, target_language, source_language = 'auto' }) {
  required(text, 'payload.text');
  required(target_language, 'payload.target_language');
  const prompt = `Translate the following research text from ${source_language} to ${target_language}. Preserve meaning, numbers, evidence identifiers and formatting. Return only the translation.\n\n${text}`;
  if (env.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.ANTHROPIC_TRANSLATION_MODEL || 'claude-3-5-haiku-latest', max_tokens: 4096, temperature: 0, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw Object.assign(new Error(`Anthropic translation failed (${response.status})`), { code: 'AI_PROVIDER_ERROR', status: response.status, retryable: response.status >= 429 });
    const data = await response.json();
    return { text: data.content?.map(x => x.text || '').join('') || '', provider: 'anthropic', model: data.model || null };
  }
  if (env.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini', temperature: 0, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw Object.assign(new Error(`OpenAI translation failed (${response.status})`), { code: 'AI_PROVIDER_ERROR', status: response.status, retryable: response.status >= 429 });
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || '', provider: 'openai', model: data.model || null };
  }
  throw permanent('No translation provider is configured', 'ADAPTER_NOT_CONFIGURED', 501);
}

async function processReport(message, env) {
  const payload = message.payload || {};
  const documentModel = await buildDocumentModel(env, {
    templateId: required(payload.template_id, 'payload.template_id'),
    organizationId: message.tenant_id,
    campaignId: required(payload.campaign_id || message.project_id, 'payload.campaign_id')
  });
  const key = payload.output_key || `reports/${message.tenant_id}/${message.job_id}/document-model.json`;
  if (!env.AUDIO_BUCKET?.put) throw permanent('R2 storage binding is unavailable', 'STORAGE_NOT_CONFIGURED', 503);
  await env.AUDIO_BUCKET.put(key, JSON.stringify(documentModel), { httpMetadata: { contentType: 'application/json' } });
  return { ok: true, object_key: key, report_id: payload.report_id || message.job_id };
}

async function processExport(message, env) {
  const payload = message.payload || {};
  let documentModel = payload.document_model;
  if (!documentModel && payload.document_model_key) {
    const obj = await env.AUDIO_BUCKET.get(payload.document_model_key);
    if (!obj) throw permanent('Document model was not found', 'PAYLOAD_NOT_FOUND', 404);
    documentModel = await obj.json();
  }
  if (!documentModel) {
    documentModel = await buildDocumentModel(env, {
      templateId: required(payload.template_id, 'payload.template_id'),
      organizationId: message.tenant_id,
      campaignId: required(payload.campaign_id || message.project_id, 'payload.campaign_id')
    });
  }
  const format = message.job_type.split('.')[1];
  const composition = buildDocumentComposition(documentModel, format, payload.options || {});
  let artifact;
  if (format === 'pdf') artifact = await renderPdfBinary(composition, payload.options || {});
  else if (format === 'pptx') artifact = await renderPptxBinary(composition, payload.options || {});
  else if (format === 'docx') artifact = await renderDocxBinary(documentModel, payload.options || {});
  else if (format === 'xlsx') artifact = await renderXlsxBinary(documentModel, payload.options || {});
  else throw permanent(`Unsupported export format ${format}`);
  const stored = await storeBinaryArtifact(env, {
    id: message.job_id,
    tenant_id: message.tenant_id,
    report_id: payload.report_id || message.job_id,
    format
  }, artifact);
  return { ok: true, format, ...stored };
}

async function processOfflineSync(message, env) {
  const payload = message.payload || {};
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!records.length) throw permanent('payload.records must contain at least one record');
  let accepted = 0;
  let duplicates = 0;
  for (const record of records) {
    const idempotency = required(record.idempotency_key || record.client_record_id, 'record.idempotency_key');
    const existing = await env.DB.prepare('SELECT id FROM offline_sync_records WHERE organization_id=? AND idempotency_key=?').bind(message.tenant_id, idempotency).first();
    if (existing) { duplicates += 1; continue; }
    await env.DB.prepare(`INSERT INTO offline_sync_records
      (id,organization_id,project_id,idempotency_key,payload_json,status,created_at,updated_at)
      VALUES (?,?,?,?,?,'accepted',datetime('now'),datetime('now'))`)
      .bind(crypto.randomUUID(), message.tenant_id, message.project_id, idempotency, JSON.stringify(record)).run();
    accepted += 1;
  }
  return { ok: true, accepted, duplicates, total: records.length };
}

const BUILTIN_ADAPTERS = Object.freeze({
  'ai.processing': async (message, env) => ({ ok: true, analysis: await analyzeText(env, required(message.payload?.text, 'payload.text')) }),
  'audio.transcription': async (message, env) => ({ ok: true, transcript: await transcribeAudio(env, await loadPayloadBytes(message, env), message.payload?.media_type || 'audio/mpeg') }),
  'translation': async (message, env) => ({ ok: true, ...(await translateText(env, message.payload || {})) }),
  'whatsapp.delivery': async (message, env) => ({ ok: true, provider_result: await sendTwilioMessage(env, { to: required(message.payload?.to, 'payload.to'), body: required(message.payload?.body, 'payload.body'), whatsapp: true }) }),
  'sms.delivery': async (message, env) => ({ ok: true, provider_result: await sendTwilioMessage(env, { to: required(message.payload?.to, 'payload.to'), body: required(message.payload?.body, 'payload.body'), whatsapp: false }) }),
  'voice.processing': async (message, env) => ({ ok: true, provider_result: await initiateOutboundCall(env, required(message.payload?.to, 'payload.to'), required(message.payload?.voice_url, 'payload.voice_url')) }),
  'report.generation': processReport,
  'export.pdf': processExport,
  'export.docx': processExport,
  'export.pptx': processExport,
  'export.xlsx': processExport,
  'notification.delivery': async (message, env) => {
    const p = message.payload || {};
    if (p.channel === 'push') return { ok: true, provider_result: await sendPushNotification(env, required(p.user_id, 'payload.user_id'), { title: required(p.title, 'payload.title'), body: required(p.body, 'payload.body'), link: p.link || null }) };
    return { ok: true, provider_result: await sendEmail(env, { to: required(p.to, 'payload.to'), subject: required(p.subject, 'payload.subject'), html: required(p.html, 'payload.html') }) };
  },
  'offline.sync': processOfflineSync,
  'webhook.followup': async (message, env) => {
    if (!message.payload?.url) throw permanent('payload.url is required');
    const response = await fetch(message.payload.url, { method: message.payload.method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(message.payload.body || {}) });
    if (!response.ok) throw Object.assign(new Error(`Webhook follow-up failed (${response.status})`), { code: 'WEBHOOK_DELIVERY_ERROR', status: response.status, retryable: response.status >= 429 });
    return { ok: true, status: response.status };
  }
});

export function resolveQueueAdapter(jobType, env = {}) {
  const injected = env.JOB_ADAPTERS && env.JOB_ADAPTERS[jobType];
  if (typeof injected === 'function') return injected;
  return BUILTIN_ADAPTERS[jobType] || null;
}

export async function executeQueueAdapter(message, env, context = {}) {
  if (message.job_type === 'ops.aggregate' && typeof context.aggregate === 'function') {
    await context.aggregate(env);
    return { ok: true, outcome: 'aggregated' };
  }
  const adapter = resolveQueueAdapter(message.job_type, env);
  if (!adapter) throw permanent(`No production adapter configured for ${message.job_type}`, 'ADAPTER_NOT_CONFIGURED', 501);
  const result = await adapter(message, env);
  if (!result || result.ok !== true) {
    const error = new Error(result?.error || `Adapter failed for ${message.job_type}`);
    error.code = result?.code || 'ADAPTER_FAILURE';
    error.status = result?.status || 500;
    error.retryable = result?.retryable !== false;
    throw error;
  }
  return result;
}
