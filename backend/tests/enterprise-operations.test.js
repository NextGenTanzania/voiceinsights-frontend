import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCorrelationId, sanitizeLogValue, buildStructuredLog, buildAuditEvent } from '../src/structured-logger.js';
import { startTrace, buildEnterpriseMetricsSnapshot, buildObservabilityContract } from '../src/enterprise-observability.js';
import { buildPlatformHealthCenter, buildHealthCenterContract } from '../src/platform-health-center.js';
import { buildOperationalDashboard, buildOperationalDashboardContract } from '../src/operational-dashboard.js';
import { evaluateAlertRules, summarizeAlertState } from '../src/alert-manager.js';
import { buildCapacityPlan, estimateGrowth } from '../src/capacity-planner.js';
import { buildDisasterRecoveryPlan, buildDRReadinessScore, buildIncidentResponseRunbook } from '../src/disaster-recovery.js';
import { buildIncidentPacket, classifyIncident } from '../src/incident-response.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
const src = (p) => readFileSync(join(root, p), 'utf8');
const site = (p) => readFileSync(join(repo, 'site', p), 'utf8');

function fakeEnv() {
  return {
    DB: { prepare(sql) { return { first: async () => ({ n: sql.includes('SUM') ? 12 : 3 }), all: async () => ({ results: [] }) }; } },
    AUDIO_BUCKET: { head: async () => null },
  };
}

test('v188 enterprise operations modules exist and Worker imports', async () => {
  for (const f of ['platform-health-center.js','enterprise-observability.js','structured-logger.js','operational-dashboard.js','alert-manager.js','capacity-planner.js','disaster-recovery.js','incident-response.js']) {
    assert.ok(existsSync(join(root, 'src', f)), `${f} missing`);
  }
  const worker = await import('../src/application.js');
  assert.equal(typeof worker.default.fetch, 'function');
  assert.equal(typeof worker.default.scheduled, 'function');
});

test('structured logger creates correlation IDs and redacts secrets and tokens', () => {
  const id = createCorrelationId('ops');
  assert.match(id, /^ops_/);
  const sanitized = sanitizeLogValue({ Authorization: 'Bearer abc.def.secret', password: 'pass', nested: { api_key: 'x', ok: 'safe' } });
  assert.equal(sanitized.Authorization, '[redacted]');
  assert.equal(sanitized.password, '[redacted]');
  assert.equal(sanitized.nested.api_key, '[redacted]');
  assert.equal(sanitized.nested.ok, 'safe');
  const log = buildStructuredLog({ event: 'render_completed', meta: { token: 'secret' } });
  assert.equal(log.meta.token, '[redacted]');
  const audit = buildAuditEvent({ action: 'download', actor: { sub: 'u1', role: 'super_admin', org: 'org1' }, resourceType: 'render', resourceId: 'r1' });
  assert.equal(audit.action, 'download');
  assert.equal(audit.organization_id, 'org1');
});

test('observability snapshot covers API, rendering, AI, exports, sync, storage and database metrics', () => {
  const trace = startTrace({ name: 'qa' });
  const finished = trace.finish({ status: 'ok' });
  assert.equal(finished.trace_name, 'qa');
  const metrics = buildEnterpriseMetricsSnapshot({ api: { error_rate_pct: 2 }, rendering: { queue_depth: 7 }, ai: { pending_jobs: 3 }, exportMetrics: { generated_24h: 5 }, sync: { failed_sync_items: 1 } });
  assert.equal(metrics.api.error_rate_pct, 2);
  assert.equal(metrics.rendering.queue_depth, 7);
  assert.equal(metrics.ai.pending_jobs, 3);
  assert.equal(metrics.exports.generated_24h, 5);
  assert.equal(metrics.sync.failed_sync_items, 1);
  assert.ok(buildObservabilityContract().metric_families.includes('rendering'));
});

test('platform health center monitors required services and degrades on operational problems', async () => {
  const health = await buildPlatformHealthCenter(fakeEnv(), { renderingJobs: [], ai: { failed_jobs: 11 }, sync: { failed_sync_items: 12 }, exports: { failed_24h: 1 } });
  for (const service of ['api','queue','rendering','ai_processing','storage','database','sync','notifications','exports','worker']) assert.ok(health.checks[service], `missing ${service}`);
  assert.equal(health.status, 'degraded');
  const contract = buildHealthCenterContract();
  assert.ok(contract.monitored_services.includes('exports'));
});

test('operational dashboard exposes enterprise operations cards and Super Admin contract', async () => {
  const dashboard = await buildOperationalDashboard(fakeEnv(), { rendering: { queue_depth: 4, failed_jobs: 1 }, failed_exports_24h: 2 });
  assert.equal(dashboard.overview.active_organizations, 3);
  assert.equal(dashboard.operations.rendering_queue, 4);
  assert.equal(dashboard.operations.retry_queue, 4);
  assert.equal(dashboard.alerts.warning > 0 || dashboard.alerts.critical > 0, true);
  const contract = buildOperationalDashboardContract();
  assert.equal(contract.access_control, 'super_admin only');
});

test('alert manager detects failed renders, AI jobs, queue congestion, latency and sync failures', () => {
  const metrics = buildEnterpriseMetricsSnapshot({ api: { error_rate_pct: 8, latency_ms_p95: 3000 }, rendering: { failed_jobs: 7, queue_depth: 150 }, ai: { failed_jobs: 12 }, exportMetrics: { failed_24h: 2 }, sync: { failed_sync_items: 20 } });
  const alerts = evaluateAlertRules(metrics);
  const state = summarizeAlertState(alerts);
  assert.equal(state.status, 'critical');
  for (const code of ['api_error_rate','render_failed','render_queue_congestion','ai_failed','export_failed','sync_failures']) assert.ok(alerts.some(a => a.code === code), `missing ${code}`);
});

test('capacity planner estimates storage, database, AI, report, render and sync growth', () => {
  const projection = estimateGrowth({ current: { storage_gb: 10, reports: 100 }, daily: { storage_gb: 1, reports: 5 }, horizonDays: 30 });
  assert.equal(projection.projected_storage_gb, 40);
  assert.equal(projection.projected_reports, 250);
  const plan = buildCapacityPlan({ rendering: { queue_utilisation_pct: 90 }, storage: { used_gb: 10, growth_gb_per_day: 1 }, database: { rows: 1000, growth_rows_per_day: 100 }, reports: { total: 10, generated_per_day: 5 } });
  assert.ok(plan.risks.some(r => /Rendering queue/.test(r)));
  assert.equal(plan.projections.length, 4);
});

test('disaster recovery and incident response define backup, restore, rollback and runbooks', () => {
  const dr = buildDisasterRecoveryPlan();
  assert.ok(dr.backup_strategy.length >= 4);
  assert.ok(dr.restore_process.length >= 5);
  assert.match(dr.rollback.backend, /wrangler rollback/);
  // Global Certification Phase 2: buildDRReadinessScore() previously
  // defaulted every check to true, so an unparameterized call silently
  // reported "ready" regardless of real state — the exact "invented
  // compliance" the platform's own governance now forbids. A no-evidence
  // call must report unready, and the real production call site
  // (application.js's /api/ops/disaster-recovery route) must state actual,
  // source-verified evidence for the two checks it can honestly claim.
  const unverifiedReadiness = buildDRReadinessScore();
  assert.equal(unverifiedReadiness.status, 'needs_attention');
  assert.equal(unverifiedReadiness.score, 0);
  const realReadiness = buildDRReadinessScore({ hasBackups: false, hasRollback: true, hasQueueRecovery: true, hasRunbooks: true, hasMonitoring: false });
  assert.equal(realReadiness.status, 'needs_attention');
  assert.equal(realReadiness.score, 60);
  assert.equal(realReadiness.checks.hasBackups, false);
  const runbook = buildIncidentResponseRunbook({ incidentType: 'rendering' });
  assert.ok(runbook.steps.some(s => /rendering queue/i.test(s)));
  assert.equal(classifyIncident({ severity: 'critical' }).level, 'SEV1');
  const packet = buildIncidentPacket({ service: 'rendering', severity: 'critical', title: 'Renderer failure' });
  assert.equal(packet.classification.level, 'SEV1');
});

test('index exposes super-admin gated operations APIs without public exposure', () => {
  const index = src('src/application.js');
  for (const route of ['/api/ops/health-center','/api/ops/dashboard','/api/ops/alerts','/api/ops/capacity','/api/ops/disaster-recovery','/api/ops/observability-contract','/api/ops/incident-packet']) {
    assert.ok(index.includes(route), `missing ${route}`);
  }
  const opsBlock = index.slice(index.indexOf('v188 ENTERPRISE OPERATIONS'), index.indexOf('v188 ENTERPRISE OPERATIONS') + 3200);
  assert.match(opsBlock, /requireAuth\(request, env\)/);
  assert.match(opsBlock, /claims\.role !== 'super_admin'/);
});

test('internal operational dashboard page exists and calls operations endpoints', () => {
  const html = site('admin/operations.html');
  assert.match(html, /Platform Health Center/);
  assert.match(html, /\/api\/ops\/health-center/);
  assert.match(html, /\/api\/ops\/dashboard/);
  assert.match(html, /\/api\/ops\/alerts/);
  assert.match(html, /Authorization:`Bearer \$\{token\}`/);
});
