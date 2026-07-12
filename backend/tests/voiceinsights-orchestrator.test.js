import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildVoiceInsightsOrchestratorV208, buildCampaignSimulatorV208, buildIntegrationHubV208, buildVoiceInsightsSDKV208 } from '../src/voiceinsights-orchestrator.js';

test('v208 builds VoiceInsights Orchestrator with policy, routing, simulator, integrations and SDK', () => {
  const engine = buildVoiceInsightsOrchestratorV208({ contacts_uploaded: 12000, policy: 'adaptive_intelligence' });
  assert.equal(engine.release, 'v208 — VoiceInsights Orchestrator™');
  assert.equal(engine.system_name, 'Autonomous Campaign Intelligence Operating System (ACIOS)');
  assert.ok(engine.policy_engine.policies.length >= 8);
  assert.equal(engine.ai_distribution_engine_2.ranked_channels.length, 6);
  assert.ok(engine.campaign_simulator.forecast.estimated_cost_usd > 0);
  assert.ok(engine.enumerator_dispatch_engine.dispatch_triggers.includes('digital channels failed'));
  assert.ok(engine.integration_hub.public_api.webhooks.includes('report.ready'));
  assert.ok(engine.sdk.core_methods.some(m => m.method === 'launchCampaign'));
  assert.ok(engine.readiness.score >= 99.9);
});

test('v208 simulator changes forecasts by campaign policy', () => {
  const lowCost = buildCampaignSimulatorV208({ contacts_uploaded: 1000, policy: 'lowest_cost' });
  const voiceFirst = buildCampaignSimulatorV208({ contacts_uploaded: 1000, policy: 'voice_first' });
  assert.ok(lowCost.forecast.estimated_cost_usd < voiceFirst.forecast.estimated_cost_usd);
  assert.notEqual(lowCost.forecast.expected_completion_rate_pct, voiceFirst.forecast.expected_completion_rate_pct);
});

test('v208 integration hub and SDK expose partner ecosystem contract', () => {
  const hub = buildIntegrationHubV208();
  const sdk = buildVoiceInsightsSDKV208();
  assert.ok(hub.adapters.some(a => a.systems.includes('DHIS2')));
  assert.ok(hub.adapters.some(a => a.systems.includes('Twilio Voice')));
  assert.ok(hub.public_api.capabilities.includes('launch campaign'));
  assert.ok(sdk.example.includes('createCampaign'));
});

test('v208 API route is present and role gated in Worker entry', () => {
  const index = readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  assert.match(index, /voiceinsights-orchestrator/);
  assert.match(index, /Campaign Orchestrator access required/);
  assert.match(index, /buildVoiceInsightsOrchestratorV208/);
});

test('v208 site page and SDK docs exist in release package', () => {
  const page = readFileSync(new URL('../../site/app/voiceinsights-orchestrator.html', import.meta.url), 'utf8');
  const sdk = readFileSync(new URL('../../sdk/voiceinsights-sdk.js', import.meta.url), 'utf8');
  assert.match(page, /VoiceInsights Orchestrator/);
  assert.match(page, /Campaign Intelligence Simulator/);
  assert.match(sdk, /class VoiceInsights/);
  assert.match(sdk, /launchCampaign/);
});
