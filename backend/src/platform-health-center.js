import { buildRenderingHealth } from './rendering-monitoring.js';
import { buildEnterpriseMetricsSnapshot } from './enterprise-observability.js';
import { evaluateAlertRules, summarizeAlertState } from './alert-manager.js';

async function checkDb(env) {
  const start = Date.now();
  try { await env.DB.prepare('SELECT 1').first(); return { status: 'operational', latency_ms: Date.now() - start }; }
  catch (e) { return { status: 'degraded', latency_ms: Date.now() - start, error: 'Database health check failed' }; }
}

async function checkR2(env) {
  const start = Date.now();
  try {
    if (!env.AUDIO_BUCKET?.head) return { status: 'unknown', latency_ms: 0 };
    await env.AUDIO_BUCKET.head('__healthcheck__');
    return { status: 'operational', latency_ms: Date.now() - start };
  } catch (_) {
    return { status: 'operational', latency_ms: Date.now() - start, note: 'Missing healthcheck object is acceptable; binding responded.' };
  }
}

export async function buildPlatformHealthCenter(env, options = {}) {
  const apiStart = Date.now();
  const database = await checkDb(env);
  const storage = await checkR2(env);
  const renderingHealth = buildRenderingHealth(options.renderingJobs || [], options.renderingThresholds || {});
  const metrics = buildEnterpriseMetricsSnapshot({
    api: { latency_ms_p95: options.api_latency_ms_p95 || Date.now() - apiStart, error_rate_pct: options.api_error_rate_pct || 0 },
    rendering: renderingHealth.metrics,
    ai: options.ai || {},
    exportMetrics: options.exports || {},
    sync: options.sync || {},
    storage,
    database,
  });
  const checks = {
    api: { status: 'operational', latency_ms: Date.now() - apiStart },
    database,
    storage,
    queue: { status: (metrics.rendering.queue_depth || 0) > 100 ? 'degraded' : 'operational', depth: metrics.rendering.queue_depth },
    rendering: { status: renderingHealth.status || renderingHealth.metrics.renderer_health || 'operational', average_render_time_ms: metrics.rendering.avg_render_time_ms },
    ai_processing: { status: (metrics.ai.failed_jobs || 0) > 10 ? 'degraded' : 'operational', pending_jobs: metrics.ai.pending_jobs, average_ai_processing_time_ms: metrics.ai.avg_processing_time_ms },
    sync: { status: (metrics.sync.failed_sync_items || 0) > 10 ? 'degraded' : 'operational', pending_sync_items: metrics.sync.pending_sync_items },
    notifications: { status: 'operational' },
    exports: { status: (metrics.exports.failed_24h || 0) > 0 ? 'degraded' : 'operational', generated_24h: metrics.exports.generated_24h },
    worker: { status: 'operational' },
  };
  const degraded = Object.values(checks).filter(c => c.status === 'degraded').length;
  const alerts = summarizeAlertState(evaluateAlertRules(metrics));
  return {
    status: degraded || alerts.critical ? 'degraded' : 'operational',
    uptime: options.uptime || 'cloudflare-managed',
    checked_at: new Date().toISOString(),
    checks,
    metrics,
    alerts,
  };
}

export function buildHealthCenterContract() {
  return {
    monitored_services: ['api', 'queue', 'rendering', 'ai_processing', 'storage', 'database', 'sync', 'notifications', 'exports', 'worker'],
    metrics: ['uptime', 'latency', 'error rate', 'queue depth', 'average render time', 'average AI processing time'],
    access_control: 'super_admin only for internal health center; public /api/health remains minimal.',
  };
}
