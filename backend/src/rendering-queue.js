// VoiceInsights v186 Rendering Queue
// Pure lifecycle helpers for queue-backed rendering. No schema changes required.

import { buildRenderObjectKey, normalizeRenderFormat, getRendererType } from './document-composer.js';

export const V186_RENDERING_QUEUE_VERSION = 'v186-rendering-queue';
export const RENDER_JOB_STATUSES = Object.freeze(['pending', 'processing', 'completed', 'failed', 'cancelled', 'timed_out']);

export function newRenderJobId(seed = '') {
  const suffix = Math.random().toString(36).slice(2, 10);
  const prefix = seed ? String(seed).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) : Date.now().toString(36);
  return `render_job_${prefix}_${suffix}`;
}

export function buildRenderIdempotencyKey({ tenantId, reportId, format, version = 'latest' } = {}) {
  return [tenantId || 'unknown', reportId || 'report', normalizeRenderFormat(format), version].join(':');
}

export function createRenderJob(input = {}) {
  if (!input.reportId) throw new Error('reportId is required');
  if (!input.format) throw new Error('format is required');
  const format = normalizeRenderFormat(input.format);
  const tenantId = input.tenantId || input.organizationId || 'unknown';
  const version = input.version || 'latest';
  const idempotencyKey = input.idempotencyKey || buildRenderIdempotencyKey({ tenantId, reportId: input.reportId, format, version });
  const now = input.now || new Date().toISOString();
  return {
    queue_version: V186_RENDERING_QUEUE_VERSION,
    id: input.id || newRenderJobId(input.reportId),
    idempotency_key: idempotencyKey,
    tenant_id: tenantId,
    report_id: input.reportId,
    format,
    renderer_type: getRendererType(format),
    priority: Number.isFinite(input.priority) ? input.priority : 5,
    status: 'pending',
    attempts: 0,
    max_attempts: input.maxAttempts || 3,
    requested_by: input.requestedBy || 'system',
    created_at: now,
    updated_at: now,
    timeout_ms: input.timeoutMs || 120000,
    object_key: buildRenderObjectKey({ tenantId, reportId: input.reportId, format, version }),
    metrics: { queued_at: now },
    audit: [{ at: now, event: 'queued', actor: input.requestedBy || 'system' }],
  };
}

export function transitionRenderJob(job, nextStatus, details = {}) {
  if (!RENDER_JOB_STATUSES.includes(nextStatus)) throw new Error(`Invalid render job status: ${nextStatus}`);
  const now = details.now || new Date().toISOString();
  const updated = {
    ...job,
    status: nextStatus,
    updated_at: now,
    audit: [...(job.audit || []), { at: now, event: nextStatus, actor: details.actor || 'renderer', message: details.message || null }],
  };
  if (nextStatus === 'processing') {
    updated.attempts = (job.attempts || 0) + 1;
    updated.metrics = { ...(job.metrics || {}), processing_started_at: now };
  }
  if (nextStatus === 'completed') {
    updated.completed_at = now;
    updated.result = details.result || job.result || null;
    updated.metrics = { ...(updated.metrics || {}), completed_at: now, duration_ms: details.durationMs ?? null };
  }
  if (nextStatus === 'failed') {
    updated.failed_at = now;
    updated.last_error = sanitizeRenderError(details.error || details.message || 'Rendering failed');
  }
  return updated;
}

export function sanitizeRenderError(error) {
  const message = String(error?.message || error || 'Rendering failed');
  return message.replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, '$1[redacted]').replace(/SELECT|INSERT|UPDATE|DELETE|SQLITE|stack/gi, '[redacted]');
}

export function shouldRetryRenderJob(job) {
  return job.status === 'failed' && (job.attempts || 0) < (job.max_attempts || 3);
}

export function buildQueueRecoveryPlan(jobs = []) {
  const stuck = jobs.filter(j => j.status === 'processing');
  const failedRetryable = jobs.filter(shouldRetryRenderJob);
  return {
    queue_version: V186_RENDERING_QUEUE_VERSION,
    stuck_jobs: stuck.map(j => j.id),
    retryable_failed_jobs: failedRetryable.map(j => j.id),
    recovery_actions: [
      'Move stuck processing jobs older than timeout_ms to timed_out.',
      'Requeue failed jobs whose attempts are below max_attempts.',
      'Keep completed jobs immutable and downloadable through signed URL only.',
    ],
  };
}

export function buildRenderingQueueMetrics(jobs = []) {
  const count = (s) => jobs.filter(j => j.status === s).length;
  const completed = count('completed');
  const failed = count('failed');
  const total = jobs.length || 1;
  return {
    queue_version: V186_RENDERING_QUEUE_VERSION,
    queue_length: jobs.filter(j => ['pending', 'processing'].includes(j.status)).length,
    pending: count('pending'),
    processing: count('processing'),
    completed,
    failed,
    retryable: jobs.filter(shouldRetryRenderJob).length,
    success_rate_pct: Math.round((completed / total) * 100),
    failure_rate_pct: Math.round((failed / total) * 100),
  };
}
