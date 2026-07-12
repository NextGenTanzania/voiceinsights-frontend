// VoiceInsights v186 Rendering Monitoring

import { buildRenderingQueueMetrics } from './rendering-queue.js';

export const V186_RENDERING_MONITORING_VERSION = 'v186-rendering-monitoring';

export function buildRenderingHealth(jobs = [], options = {}) {
  const metrics = buildRenderingQueueMetrics(jobs);
  const avgRenderTimeMs = options.avgRenderTimeMs ?? computeAverageDuration(jobs);
  const healthy = metrics.failure_rate_pct <= (options.maxFailureRatePct ?? 10) && metrics.queue_length <= (options.maxQueueLength ?? 1000);
  return {
    monitoring_version: V186_RENDERING_MONITORING_VERSION,
    healthy,
    metrics: {
      ...metrics,
      avg_render_time_ms: avgRenderTimeMs,
      renderer_health: healthy ? 'operational' : 'degraded',
    },
    alerts: healthy ? [] : ['Rendering failure rate or queue length exceeded configured threshold.'],
  };
}

function computeAverageDuration(jobs = []) {
  const values = jobs.map(j => j.metrics?.duration_ms).filter(v => Number.isFinite(v));
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
