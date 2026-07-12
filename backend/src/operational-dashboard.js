import { buildEnterpriseMetricsSnapshot } from './enterprise-observability.js';
import { evaluateAlertRules, summarizeAlertState } from './alert-manager.js';
import { buildCapacityPlan } from './capacity-planner.js';

async function safeFirst(env, sql, fallback = { n: 0 }) {
  try { return await env.DB.prepare(sql).first(); } catch (_) { return fallback; }
}

export async function buildOperationalDashboard(env, options = {}) {
  const activeOrgs = await safeFirst(env, `SELECT COUNT(*) as n FROM organizations WHERE status = 'active'`);
  const activeProjects = await safeFirst(env, `SELECT COUNT(*) as n FROM campaigns WHERE status IN ('active','scheduled')`);
  const runningSurveys = await safeFirst(env, `SELECT COUNT(*) as n FROM surveys WHERE status IN ('active','published')`);
  const reportsToday = await safeFirst(env, `SELECT COUNT(*) as n FROM generated_reports WHERE date(created_at) = date('now')`);
  const exportsToday = await safeFirst(env, `SELECT COALESCE(SUM(demo_downloads),0) as n FROM generated_reports WHERE is_demo = 1`);
  const failedAiJobs = await safeFirst(env, `SELECT COUNT(*) as n FROM ai_processing_queue WHERE status = 'failed'`, { n: 0 });
  const pendingAiJobs = await safeFirst(env, `SELECT COUNT(*) as n FROM ai_processing_queue WHERE status IN ('pending','processing')`, { n: 0 });

  const metrics = buildEnterpriseMetricsSnapshot({
    api: { latency_ms_p95: options.api_latency_ms_p95 || 0, error_rate_pct: options.api_error_rate_pct || 0, request_count_24h: options.request_count_24h || 0 },
    ai: { pending_jobs: pendingAiJobs.n, failed_jobs: failedAiJobs.n, avg_processing_time_ms: options.avg_ai_processing_time_ms || 0 },
    rendering: options.rendering || {},
    exportMetrics: { generated_24h: exportsToday.n, failed_24h: options.failed_exports_24h || 0 },
    sync: options.sync || {},
    storage: options.storage || {},
    database: options.database || {},
  });
  const alerts = summarizeAlertState(evaluateAlertRules(metrics));
  return {
    generated_at: new Date().toISOString(),
    overview: {
      active_organizations: activeOrgs.n,
      active_projects: activeProjects.n,
      running_surveys: runningSurveys.n,
      daily_reports_generated: reportsToday.n,
      exports_generated: exportsToday.n,
    },
    operations: {
      pending_ai_jobs: pendingAiJobs.n,
      failed_ai_jobs: failedAiJobs.n,
      rendering_queue: metrics.rendering.queue_depth,
      failed_rendering_jobs: metrics.rendering.failed_jobs,
      retry_queue: (metrics.rendering.failed_jobs || 0) + (metrics.ai.failed_jobs || 0),
      storage_usage: metrics.storage,
      api_performance: metrics.api,
      worker_performance: { average_render_time_ms: metrics.rendering.avg_render_time_ms, average_ai_processing_time_ms: metrics.ai.avg_processing_time_ms },
    },
    metrics,
    alerts,
    capacity: buildCapacityPlan({ ...metrics, reports: { generated_per_day: reportsToday.n, total: reportsToday.n }, rendering: { ...metrics.rendering, jobs_per_day: exportsToday.n } }),
  };
}

export function buildOperationalDashboardContract() {
  return {
    audience: 'Super Admin / Platform Operations',
    refresh_interval_seconds: 60,
    cards: ['active organizations', 'active projects', 'running surveys', 'pending AI jobs', 'rendering queue', 'failed jobs', 'storage usage', 'API performance', 'daily reports', 'exports'],
    access_control: 'super_admin only',
  };
}
