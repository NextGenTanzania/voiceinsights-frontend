import { createCorrelationId, sanitizeLogValue, buildStructuredLog } from './structured-logger.js';

export function startTrace({ request, name = 'request', actor = null } = {}) {
  const correlationId = request?.headers?.get?.('x-correlation-id') || request?.headers?.get?.('cf-ray') || createCorrelationId('trace');
  const start = Date.now();
  return {
    name,
    correlation_id: correlationId,
    start_time: new Date(start).toISOString(),
    actor: actor ? { id: actor.id || actor.sub || null, role: actor.role || null } : null,
    finish(extra = {}) {
      const duration_ms = Date.now() - start;
      return sanitizeLogValue({
        trace_name: name,
        correlation_id: correlationId,
        duration_ms,
        finished_at: new Date().toISOString(),
        ...extra,
      });
    },
  };
}

export function buildMetric(name, value, unit = 'count', tags = {}) {
  return sanitizeLogValue({ name, value, unit, tags, recorded_at: new Date().toISOString() });
}

export function buildEnterpriseMetricsSnapshot({ api = {}, rendering = {}, ai = {}, exportMetrics = {}, sync = {}, storage = {}, database = {} } = {}) {
  return {
    generated_at: new Date().toISOString(),
    api: {
      latency_ms_p50: api.latency_ms_p50 ?? 0,
      latency_ms_p95: api.latency_ms_p95 ?? 0,
      error_rate_pct: api.error_rate_pct ?? 0,
      request_count_24h: api.request_count_24h ?? 0,
    },
    rendering: {
      queue_depth: rendering.queue_depth ?? 0,
      failed_jobs: rendering.failed_jobs ?? 0,
      avg_render_time_ms: rendering.avg_render_time_ms ?? 0,
      success_rate_pct: rendering.success_rate_pct ?? 100,
    },
    ai: {
      pending_jobs: ai.pending_jobs ?? 0,
      failed_jobs: ai.failed_jobs ?? 0,
      avg_processing_time_ms: ai.avg_processing_time_ms ?? 0,
      success_rate_pct: ai.success_rate_pct ?? 100,
    },
    exports: {
      generated_24h: exportMetrics.generated_24h ?? 0,
      failed_24h: exportMetrics.failed_24h ?? 0,
      avg_size_mb: exportMetrics.avg_size_mb ?? 0,
    },
    sync: {
      pending_sync_items: sync.pending_sync_items ?? 0,
      failed_sync_items: sync.failed_sync_items ?? 0,
      avg_sync_delay_ms: sync.avg_sync_delay_ms ?? 0,
    },
    storage,
    database,
  };
}

export function buildRequestLog({ request, actor, outcome = 'success', durationMs = 0, status = 200, meta = {} } = {}) {
  return buildStructuredLog({
    event: 'request_trace',
    request,
    actor,
    level: status >= 500 ? 'error' : status >= 400 ? 'warning' : 'info',
    message: `${request?.method || 'GET'} ${new URL(request?.url || 'https://local/').pathname} ${status}`,
    metrics: { duration_ms: durationMs, status },
    meta: { outcome, ...meta },
  });
}

export function buildObservabilityContract() {
  return {
    pii_policy: 'No passwords, tokens, API keys, raw audio, raw transcripts, or respondent PII in logs.',
    correlation_header: 'x-correlation-id',
    trace_dimensions: ['route', 'organization_id', 'actor_role', 'resource_type', 'format', 'channel'],
    metric_families: ['api', 'rendering', 'ai', 'exports', 'sync', 'storage', 'database'],
    retention_guidance: 'Keep operational logs only as long as needed for troubleshooting and compliance.',
  };
}
