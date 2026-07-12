import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildVoiceInsightsCloudV210, buildCloudModulesV210, buildAutomationHubV210, buildMarketplaceLayerV210, buildCloudEventBusV210 } from '../src/voiceinsights-cloud.js';

test('v210 builds VoiceInsights Cloud with the requested 18 core modules', () => {
  const cloud = buildVoiceInsightsCloudV210({});
  assert.equal(cloud.version, 'v210.0.0');
  assert.equal(cloud.platform_name, 'VoiceInsights Cloud™');
  const modules = cloud.modules;
  for (const key of [
    'admin_platform','organization_platform','enumerator_app','web_surveys','phone_engine','whatsapp_engine','sms_engine','ai_engine','report_engine','sdk','public_api','integration_hub','knowledge_cloud','benchmark_cloud','voice_intelligence','monitoring','security','analytics'
  ]) assert.ok(modules[key], `${key} missing`);
});

test('v210 includes Automation Hub, Marketplace Layer and Cloud Event Bus', () => {
  const cloud = buildVoiceInsightsCloudV210({ daily_events: 750000 });
  assert.equal(cloud.automation_hub.name, 'Automation Hub');
  assert.equal(cloud.marketplace_layer.name, 'Marketplace Layer');
  assert.equal(cloud.cloud_event_bus.name, 'Cloud Event Bus');
  assert.equal(cloud.cloud_event_bus.event_volume_target_per_day, 750000);
});

test('Integration Hub covers enterprise, research, analytics and productivity systems', () => {
  const modules = buildCloudModulesV210({});
  const caps = modules.integration_hub.capabilities.join(' | ');
  for (const item of ['DHIS2','KoboToolbox','ODK Central','SurveyCTO','REDCap','Salesforce','Dynamics 365','Power BI','Tableau','Looker Studio','Microsoft 365','Google Workspace']) assert.ok(caps.includes(item));
});

test('Cloud Event Bus defines canonical events and reliable delivery contract', () => {
  const bus = buildCloudEventBusV210({});
  assert.ok(bus.canonical_events.includes('campaign.launched'));
  assert.ok(bus.canonical_events.includes('report.generated'));
  assert.ok(bus.reliability.includes('idempotency key'));
  assert.ok(bus.schema_contract.required_fields.includes('organization_id'));
});

test('Knowledge Cloud, Benchmark Cloud and Voice Intelligence form the intelligence cloud layer', () => {
  const cloud = buildVoiceInsightsCloudV210({});
  assert.ok(cloud.intelligence_cloud.knowledge_cloud.capabilities.includes('AI Q&A'));
  assert.ok(cloud.intelligence_cloud.benchmark_cloud.capabilities.includes('sector benchmarks'));
  assert.ok(cloud.intelligence_cloud.voice_intelligence.capabilities.includes('emotion'));
});

test('v210 API route and frontend cloud page are wired', () => {
  const index = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  assert.match(index, /voiceinsights-cloud/);
  assert.match(index, /buildVoiceInsightsCloudV210/);
  const html = fs.readFileSync(new URL('../../site/app/voiceinsights-cloud.html', import.meta.url), 'utf8');
  assert.match(html, /VoiceInsights Cloud™/);
  assert.match(html, /api\/voiceinsights-cloud/);
});

test('Worker entry imports successfully with route', async () => {
  const mod = await import('../src/application.js');
  assert.ok(mod.default || mod.fetch || mod);
});
