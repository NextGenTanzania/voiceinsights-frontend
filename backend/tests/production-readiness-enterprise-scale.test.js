import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildProductionReadinessEnterpriseScaleV209, buildCampaignScaleEngineV209, buildEnterpriseQueueManagerV209, buildProductionReadinessCheckerV209 } from '../src/production-readiness-enterprise-scale.js';

test('v209 builds all requested production readiness modules', () => {
  const v209 = buildProductionReadinessEnterpriseScaleV209({ daily_campaigns: 20, contacts_per_campaign: 10000 });
  assert.equal(v209.version, 'v209.0.0');
  for (const key of [
    'campaign_scale_engine','enterprise_queue_manager','workload_balancer','production_monitoring_center','retry_dead_letter_engine',
    'offline_sync_hardening','report_production_pipeline','enterprise_security_layer','capacity_planning_dashboard','production_readiness_checker',
    'high_availability_mode','disaster_recovery_backup'
  ]) assert.ok(v209[key], `${key} missing`);
});

test('Campaign Scale Engine supports independent queues, parallel execution and priority scheduling', () => {
  const scale = buildCampaignScaleEngineV209({ daily_campaigns: 20, contacts_per_campaign: 8000 });
  assert.equal(scale.independent_queues_per_campaign, true);
  assert.equal(scale.parallel_execution, true);
  assert.ok(scale.priority_scheduling.length >= 3);
  assert.equal(scale.campaign_queues.length, 20);
  assert.ok(scale.campaign_queues.every(q => q.independent_queue && q.parallel_lanes.includes('ai') && q.parallel_lanes.includes('export')));
});

test('Enterprise Queue Manager includes AI, Call, WhatsApp, SMS, Offline Sync, Report and Export queues', () => {
  const qm = buildEnterpriseQueueManagerV209({ load_factor_pct: 65 });
  const keys = qm.queues.map(q => q.key);
  for (const key of ['ai_queue','call_queue','whatsapp_queue','sms_queue','offline_sync_queue','report_queue','export_queue']) assert.ok(keys.includes(key));
});

test('Production Monitoring Center covers provider, platform, AI and queue health', () => {
  const v209 = buildProductionReadinessEnterpriseScaleV209({});
  const labels = v209.production_monitoring_center.checks.map(c => c.label);
  for (const label of ['Twilio Health','WhatsApp Health','SMS Gateway Health','D1 Health','R2 Health','AI Health','Queue Health']) assert.ok(labels.includes(label));
});

test('Readiness checker blocks launch when critical configuration is missing', () => {
  const checker = buildProductionReadinessCheckerV209({ twilio_configured: false, contacts_clean: false });
  assert.equal(checker.ready_to_launch, false);
  assert.equal(checker.launch_gate, 'FIX_REQUIRED');
  assert.ok(checker.score_pct < 100);
});

test('Readiness checker approves launch when all core checks pass', () => {
  const checker = buildProductionReadinessCheckerV209({});
  assert.equal(checker.ready_to_launch, true);
  assert.equal(checker.launch_gate, 'READY_TO_LAUNCH');
  assert.equal(checker.score_pct, 100);
});

test('Report production pipeline includes queued generation, validation, rendering and signed downloads', () => {
  const v209 = buildProductionReadinessEnterpriseScaleV209({});
  const pipeline = v209.report_production_pipeline.pipeline.join(' | ');
  for (const part of ['AI analysis queue','quality validation','binary render queue','R2 storage','signed URL','audit log']) assert.ok(pipeline.includes(part));
});

test('Enterprise security layer enforces isolation, audit, signed URL and rate limiting concepts', () => {
  const v209 = buildProductionReadinessEnterpriseScaleV209({});
  const checks = v209.enterprise_security_layer.checks.map(c => c.label);
  for (const item of ['organization isolation','role permissions','audit logs','signed URL expiry','API rate limiting']) assert.ok(checks.includes(item));
});

test('Capacity planner estimates contacts, responses, AI jobs, reports and exports', () => {
  const v209 = buildProductionReadinessEnterpriseScaleV209({ daily_contacts: 200000, expected_response_rate_pct: 70, daily_campaigns: 20 });
  const f = v209.capacity_planning_dashboard.daily_forecast;
  assert.equal(f.contacts_target, 200000);
  assert.equal(f.expected_responses, 140000);
  assert.equal(f.ai_jobs, 140000);
  assert.ok(f.report_jobs > 0);
  assert.ok(f.export_jobs > 0);
});

test('High availability and disaster recovery define fallback and rollback plans', () => {
  const v209 = buildProductionReadinessEnterpriseScaleV209({});
  assert.ok(v209.high_availability_mode.provider_fallbacks.length >= 3);
  assert.ok(v209.disaster_recovery_backup.rollback.includes('wrangler rollback for Worker'));
  assert.ok(v209.disaster_recovery_backup.runbooks.includes('queue backlog'));
});

test('v209 API route and frontend page are wired', () => {
  const index = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  assert.match(index, /production-readiness-enterprise-scale/);
  assert.match(index, /allowedRoles = \['super_admin', 'org_admin', 'project_manager'\]/);
  const html = fs.readFileSync(new URL('../../site/app/production-readiness-enterprise-scale.html', import.meta.url), 'utf8');
  assert.match(html, /Enterprise Scale Command Center/);
  assert.match(html, /api\/production-readiness-enterprise-scale/);
});

test('Worker entry imports successfully with route', async () => {
  const mod = await import('../src/application.js');
  assert.ok(mod.default || mod.fetch || mod);
});
