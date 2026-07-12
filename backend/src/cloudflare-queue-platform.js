import { newId } from './auth.js';
import { executeQueueAdapter } from './queue-adapters.js';

export const QUEUE_SCHEMA_VERSION = 1;
export const SUPPORTED_JOB_TYPES = new Set([
  'ai.processing','audio.transcription','translation','whatsapp.delivery','sms.delivery','voice.processing',
  'report.generation','export.pdf','export.docx','export.pptx','export.xlsx','notification.delivery',
  'offline.sync','webhook.followup','ops.aggregate'
]);

const SENSITIVE = /(authorization|token|secret|password|api[_-]?key|auth[_-]?token)/i;
export function sanitizeObject(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.map(v => sanitizeObject(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k,v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : sanitizeObject(v, depth + 1);
    return out;
  }
  if (typeof value === 'string') return value.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]').slice(0, 4000);
  return value;
}

export function buildQueueMessage(input = {}) {
  if (!SUPPORTED_JOB_TYPES.has(input.jobType)) throw new Error(`Unsupported job type: ${input.jobType}`);
  if (!input.tenantId) throw new Error('tenantId is required');
  const createdAt = input.createdAt || new Date().toISOString();
  const jobId = input.jobId || newId('job');
  return {
    schema_version: QUEUE_SCHEMA_VERSION,
    job_id: jobId,
    job_type: input.jobType,
    tenant_id: input.tenantId,
    project_id: input.projectId || null,
    actor_id: input.actorId || null,
    correlation_id: input.correlationId || crypto.randomUUID(),
    causation_id: input.causationId || null,
    idempotency_key: input.idempotencyKey || `${input.tenantId}:${input.jobType}:${jobId}`,
    priority: Number.isFinite(input.priority) ? input.priority : 5,
    created_at: createdAt,
    attempt: Number(input.attempt || 0),
    max_attempts: Number(input.maxAttempts || 5),
    payload_ref: input.payloadRef || null,
    payload: sanitizeObject(input.payload || {}),
  };
}

async function recordEvent(env, message, eventName, details = {}) {
  await env.DB.prepare(`INSERT INTO queue_events
    (id,job_id,queue_name,job_type,tenant_id,correlation_id,event_name,attempt,duration_ms,error_class,details_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .bind(newId('qevt'), message.job_id, details.queueName || 'operations', message.job_type, message.tenant_id,
      message.correlation_id, eventName, Number(details.attempt ?? message.attempt ?? 0), details.durationMs ?? null,
      details.errorClass || null, JSON.stringify(sanitizeObject(details))).run();
}

export const QUEUE_BINDING_BY_JOB_TYPE = Object.freeze({
  'ai.processing':'AI_QUEUE','audio.transcription':'TRANSCRIPTION_QUEUE','translation':'TRANSLATION_QUEUE',
  'whatsapp.delivery':'WHATSAPP_QUEUE','sms.delivery':'SMS_QUEUE','voice.processing':'VOICE_QUEUE',
  'report.generation':'REPORT_QUEUE','export.pdf':'EXPORT_QUEUE','export.docx':'EXPORT_QUEUE',
  'export.pptx':'EXPORT_QUEUE','export.xlsx':'EXPORT_QUEUE','notification.delivery':'NOTIFICATION_QUEUE',
  'offline.sync':'OFFLINE_SYNC_QUEUE','webhook.followup':'OPERATIONS_QUEUE','ops.aggregate':'OPERATIONS_QUEUE'
});

export async function enqueueJob(env, input, queueBinding = null) {
  queueBinding = queueBinding || QUEUE_BINDING_BY_JOB_TYPE[input.jobType] || 'OPERATIONS_QUEUE';
  const message = buildQueueMessage(input);
  const queue = env[queueBinding];
  if (!queue?.send) throw new Error(`Queue binding ${queueBinding} is unavailable`);
  const existing = await env.DB.prepare('SELECT job_id,status FROM queue_jobs WHERE idempotency_key=?').bind(message.idempotency_key).first();
  if (existing) return { accepted: false, duplicate: true, job_id: existing.job_id, status: existing.status };
  await env.DB.prepare(`INSERT INTO queue_jobs
    (job_id,idempotency_key,queue_name,job_type,tenant_id,project_id,actor_id,correlation_id,causation_id,status,attempts,max_attempts,payload_ref,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,'pending',0,?,?,datetime('now'),datetime('now'))`)
    .bind(message.job_id,message.idempotency_key,queueBinding,message.job_type,message.tenant_id,message.project_id,message.actor_id,
      message.correlation_id,message.causation_id,message.max_attempts,message.payload_ref).run();
  await recordEvent(env, message, 'queued', { queueName: queueBinding });
  await queue.send(message);
  return { accepted: true, duplicate: false, job_id: message.job_id, correlation_id: message.correlation_id, status: 'queued' };
}

function classifyError(error) {
  const code = String(error?.code || 'APPLICATION_ERROR');
  const status = Number(error?.status || 0);
  if (error?.retryable === false || ['INVALID_MESSAGE','TENANT_MISMATCH','UNSUPPORTED_SCHEMA','ADAPTER_NOT_CONFIGURED'].includes(code) || [400,401,403,404,422,501].includes(status)) return { retryable:false, errorClass:code };
  if (status === 429) return { retryable:true, errorClass:'RATE_LIMITED' };
  return { retryable:true, errorClass:code };
}

export function retryDelaySeconds(attempt, base = 30, max = 3600, random = Math.random) {
  const bounded = Math.min(max, base * (2 ** Math.max(0, attempt - 1)));
  return Math.max(1, Math.floor(bounded * (0.75 + random() * 0.5)));
}

async function executeJob(message, env) {
  // Fail closed: an unconfigured domain adapter is a terminal operational
  // failure, never a successful completion. This prevents dashboards from
  // claiming that AI, Twilio, rendering or exports completed when only the
  // transport layer ran.
  return executeQueueAdapter(message, env, { aggregate: aggregateQueueMetrics });
}

export async function processQueueBatch(batch, env) {
  const results = [];
  for (const item of batch.messages || []) {
    const message = item.body;
    const started = Date.now();
    try {
      if (!message || message.schema_version !== QUEUE_SCHEMA_VERSION) throw Object.assign(new Error('Unsupported queue schema'), { code:'UNSUPPORTED_SCHEMA' });
      if (!SUPPORTED_JOB_TYPES.has(message.job_type) || !message.tenant_id || !message.job_id) throw Object.assign(new Error('Invalid queue message'), { code:'INVALID_MESSAGE' });
      const job = await env.DB.prepare('SELECT * FROM queue_jobs WHERE job_id=?').bind(message.job_id).first();
      if (!job) throw Object.assign(new Error('Queue job registry entry missing'), { code:'INVALID_MESSAGE' });
      if (job.tenant_id !== message.tenant_id) throw Object.assign(new Error('Tenant mismatch'), { code:'TENANT_MISMATCH' });
      if (job.status === 'completed') { item.ack(); results.push({job_id:message.job_id,status:'duplicate_acknowledged'}); continue; }
      await env.DB.prepare(`UPDATE queue_jobs SET status='processing',attempts=attempts+1,processing_started_at=datetime('now'),updated_at=datetime('now') WHERE job_id=?`).bind(message.job_id).run();
      await recordEvent(env, message, 'processing', { queueName: batch.queue, attempt: (job.attempts || 0) + 1 });
      const result = await executeJob(message, env);
      const duration = Date.now() - started;
      await env.DB.prepare(`UPDATE queue_jobs SET status='completed',completed_at=datetime('now'),updated_at=datetime('now'),result_json=? WHERE job_id=?`).bind(JSON.stringify(result),message.job_id).run();
      await recordEvent(env, message, 'completed', { queueName: batch.queue, durationMs:duration });
      item.ack(); results.push({job_id:message.job_id,status:'completed'});
    } catch (error) {
      const classification = classifyError(error);
      const attempts = Number(message?.attempt || 0) + 1;
      await env.DB.prepare(`UPDATE queue_jobs SET status=?,last_error=?,updated_at=datetime('now') WHERE job_id=?`)
        .bind(classification.retryable && attempts < Number(message?.max_attempts || 5) ? 'retrying' : 'dead_letter', String(error.message || 'processing failure').slice(0,500), message?.job_id || '').run().catch(()=>{});
      await recordEvent(env, message || {job_id:'unknown',job_type:'unknown',tenant_id:'unknown',correlation_id:null}, 'failed', { queueName:batch.queue, durationMs:Date.now()-started, errorClass:classification.errorClass, message:error.message }).catch(()=>{});
      if (classification.retryable && attempts < Number(message?.max_attempts || 5)) {
        item.retry({ delaySeconds: retryDelaySeconds(attempts) });
      } else {
        await env.DB.prepare(`INSERT INTO queue_dead_letters
          (id,job_id,queue_name,tenant_id,correlation_id,attempt_count,error_class,error_message,payload_json,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,'open',datetime('now'),datetime('now'))`)
          .bind(newId('dlq'),message?.job_id || 'unknown',batch.queue || 'operations',message?.tenant_id || 'unknown',message?.correlation_id || null,
            attempts,classification.errorClass,String(error.message || 'processing failure').slice(0,500),JSON.stringify(sanitizeObject(message))).run().catch(()=>{});
        item.ack();
      }
      results.push({job_id:message?.job_id,status:classification.retryable?'retrying':'dead_letter'});
    }
  }
  return results;
}

export async function aggregateQueueMetrics(env) {
  await env.DB.prepare(`INSERT INTO operational_metric_aggregates
    (id,metric_date,queue_name,queued,completed,failed,retried,dead_letter,avg_processing_ms,created_at)
    SELECT lower(hex(randomblob(16))),date('now'),queue_name,
      SUM(event_name='queued'),SUM(event_name='completed'),SUM(event_name='failed'),SUM(event_name='retrying'),SUM(event_name='dead_letter'),
      AVG(CASE WHEN event_name='completed' THEN duration_ms END),datetime('now')
    FROM queue_events WHERE created_at >= datetime('now','-1 day') GROUP BY queue_name
    ON CONFLICT(metric_date,queue_name) DO UPDATE SET queued=excluded.queued,completed=excluded.completed,failed=excluded.failed,
    retried=excluded.retried,dead_letter=excluded.dead_letter,avg_processing_ms=excluded.avg_processing_ms,created_at=excluded.created_at`).run();
}
