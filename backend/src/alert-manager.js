export const ALERT_SEVERITY = { OK: 'resolved', WARNING: 'warning', CRITICAL: 'critical' };

export function createAlert({ code, title, severity = ALERT_SEVERITY.WARNING, message, metric, threshold, value, runbook, service }) {
  return {
    id: `alert_${code}_${Date.now().toString(36)}`,
    code,
    service,
    title,
    severity,
    message,
    metric,
    threshold,
    value,
    runbook,
    created_at: new Date().toISOString(),
  };
}

export function evaluateAlertRules(snapshot = {}) {
  const alerts = [];
  const api = snapshot.api || {};
  const rendering = snapshot.rendering || {};
  const ai = snapshot.ai || {};
  const exports = snapshot.exports || {};
  const sync = snapshot.sync || {};

  if ((api.error_rate_pct || 0) >= 5) alerts.push(createAlert({ code: 'api_error_rate', service: 'api', title: 'API error rate is elevated', severity: 'critical', metric: 'api.error_rate_pct', threshold: 5, value: api.error_rate_pct, runbook: 'Check recent deployments, Worker logs and D1 availability.' }));
  if ((api.latency_ms_p95 || 0) >= 2500) alerts.push(createAlert({ code: 'api_latency', service: 'api', title: 'API latency is elevated', severity: 'warning', metric: 'api.latency_ms_p95', threshold: 2500, value: api.latency_ms_p95, runbook: 'Inspect slow queries, queues and upstream AI providers.' }));
  if ((rendering.failed_jobs || 0) > 0) alerts.push(createAlert({ code: 'render_failed', service: 'rendering', title: 'Rendering jobs are failing', severity: (rendering.failed_jobs || 0) > 5 ? 'critical' : 'warning', metric: 'rendering.failed_jobs', threshold: 1, value: rendering.failed_jobs, runbook: 'Open rendering queue, retry failed jobs and inspect renderer health.' }));
  if ((rendering.queue_depth || 0) >= 100) alerts.push(createAlert({ code: 'render_queue_congestion', service: 'rendering', title: 'Rendering queue is congested', severity: 'critical', metric: 'rendering.queue_depth', threshold: 100, value: rendering.queue_depth, runbook: 'Scale rendering workers or pause non-critical exports.' }));
  if ((ai.failed_jobs || 0) > 0) alerts.push(createAlert({ code: 'ai_failed', service: 'ai', title: 'AI jobs are failing', severity: (ai.failed_jobs || 0) > 10 ? 'critical' : 'warning', metric: 'ai.failed_jobs', threshold: 1, value: ai.failed_jobs, runbook: 'Check provider status, retry queue and API key health.' }));
  if ((exports.failed_24h || 0) > 0) alerts.push(createAlert({ code: 'export_failed', service: 'exports', title: 'Report exports are failing', severity: 'warning', metric: 'exports.failed_24h', threshold: 1, value: exports.failed_24h, runbook: 'Check renderer output validation and R2 write permissions.' }));
  if ((sync.failed_sync_items || 0) >= 10) alerts.push(createAlert({ code: 'sync_failures', service: 'sync', title: 'Offline sync failures are repeated', severity: 'warning', metric: 'sync.failed_sync_items', threshold: 10, value: sync.failed_sync_items, runbook: 'Inspect device connectivity, queue records and conflict resolution.' }));

  return alerts;
}

export function summarizeAlertState(alerts = []) {
  const critical = alerts.filter(a => a.severity === 'critical').length;
  const warning = alerts.filter(a => a.severity === 'warning').length;
  return {
    status: critical ? 'critical' : warning ? 'warning' : 'operational',
    critical,
    warning,
    resolved: alerts.filter(a => a.severity === 'resolved').length,
    alerts,
  };
}
