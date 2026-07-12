// Enterprise structured logging for VoiceInsights Africa v188.
// Designed for Cloudflare Workers: JSON logs, no PII/secrets, correlation-safe.

const SECRET_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /token/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /jwt/i,
  /bearer/i,
];

export function createCorrelationId(prefix = 'vi') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function getCorrelationId(request, fallbackPrefix = 'vi') {
  const fromHeader = request?.headers?.get?.('x-correlation-id') || request?.headers?.get?.('cf-ray');
  return fromHeader || createCorrelationId(fallbackPrefix);
}

export function sanitizeLogValue(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/bearer\s+[a-z0-9._-]+/i.test(value)) return '[redacted]';
    if (value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(v => sanitizeLogValue(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SECRET_PATTERNS.some(p => p.test(key)) ? '[redacted]' : sanitizeLogValue(val, depth + 1);
  }
  return out;
}

export function buildStructuredLog({ level = 'info', event, correlationId, request, actor, orgId, resource, message, metrics = {}, meta = {} } = {}) {
  const url = request ? new URL(request.url) : null;
  return sanitizeLogValue({
    ts: new Date().toISOString(),
    level,
    event: event || 'platform_event',
    correlation_id: correlationId || getCorrelationId(request),
    method: request?.method,
    path: url?.pathname,
    actor: actor ? { id: actor.id || actor.sub || null, role: actor.role || null } : undefined,
    organization_id: orgId || actor?.org || actor?.organization_id,
    resource,
    message,
    metrics,
    meta,
  });
}

export function emitStructuredLog(payload, sink = console) {
  const log = buildStructuredLog(payload);
  const serialized = JSON.stringify(log);
  if (log.level === 'error') sink.error(serialized);
  else if (log.level === 'warning' || log.level === 'warn') sink.warn(serialized);
  else sink.log(serialized);
  return log;
}

export function buildAuditEvent({ action, actor, orgId, resourceType, resourceId, outcome = 'success', correlationId, metadata = {} } = {}) {
  return sanitizeLogValue({
    event_type: 'audit_event',
    action,
    actor_id: actor?.id || actor?.sub || null,
    actor_role: actor?.role || null,
    organization_id: orgId || actor?.org || actor?.organization_id || null,
    resource_type: resourceType,
    resource_id: resourceId,
    outcome,
    correlation_id: correlationId,
    metadata,
    created_at: new Date().toISOString(),
  });
}
