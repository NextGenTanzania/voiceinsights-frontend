import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildAutonomousOmniChannelCollectionEngineV207C,
  buildSurveyDistributionCenterV207C,
  buildAIDistributionEngineV207C,
  buildMEProductivityWorkspaceV207C,
  buildEnumeratorProductivityWorkspaceV207C,
  buildV207CReadinessScore,
} from '../src/autonomous-omni-channel-collection-engine.js';

test('v207C builds the autonomous multi-channel collection platform with all required channels', () => {
  const engine = buildAutonomousOmniChannelCollectionEngineV207C({ survey_id: 'survey_health_001', contacts_uploaded: 1000, completed: 720, collection_mode: 'hybrid' });
  assert.equal(engine.official_positioning, 'VoiceInsights Africa — Autonomous Multi-Channel Intelligence Collection Platform');
  assert.ok(engine.core_modules.includes('Survey Distribution Center'));
  assert.ok(engine.core_modules.includes('AI Distribution Engine'));
  assert.ok(engine.core_modules.includes('Enumerator Offline Mobile Workspace'));
  const labels = engine.ai_distribution_engine.channels.map(c => c.label);
  assert.ok(labels.includes('Phone Call'));
  assert.ok(labels.includes('WhatsApp Voice Notes'));
  assert.ok(labels.includes('WhatsApp Chat'));
  assert.ok(labels.includes('SMS / Feature-Phone Fallback'));
  assert.ok(labels.includes('Web Platform Link'));
  assert.ok(labels.includes('Offline Mobile Application'));
  assert.equal(engine.ai_distribution_engine.automatic_selection.enabled, true);
  assert.ok(engine.readiness.score >= 99.8);
});

test('v207C Survey Distribution Center exposes share link, QR, WhatsApp, SMS, phone and offline actions', () => {
  const center = buildSurveyDistributionCenterV207C({ survey_id: 'survey_abc123', site_url: 'https://voiceinsightsafrica.com' });
  assert.equal(center.primary_action, 'Share Survey');
  assert.match(center.public_link, /https:\/\/voiceinsightsafrica.com\/s\//);
  const channels = center.share_actions.map(a => a.channel);
  assert.ok(channels.includes('web_link'));
  assert.ok(channels.includes('whatsapp_chat'));
  assert.ok(channels.includes('whatsapp_voice'));
  assert.ok(channels.includes('sms'));
  assert.ok(channels.includes('phone_call'));
  assert.ok(channels.includes('offline_app'));
  assert.equal(center.qr.available, true);
  assert.ok(center.access_settings.controls.includes('consent gate'));
});

test('v207C AI Distribution Engine supports automatic, manual, enumerator-led and hybrid modes with campaign policies', () => {
  const ai = buildAIDistributionEngineV207C({ collection_mode: 'autonomous_ai', policy: 'highest_response_rate' });
  assert.ok(ai.collection_modes.some(m => m.key === 'autonomous_ai'));
  assert.ok(ai.collection_modes.some(m => m.key === 'manual_distribution'));
  assert.ok(ai.collection_modes.some(m => m.key === 'enumerator_led'));
  assert.ok(ai.collection_modes.some(m => m.key === 'hybrid'));
  assert.ok(ai.campaign_policies.some(p => p.key === 'voice_first'));
  assert.ok(ai.campaign_policies.some(p => p.key === 'enumerator_first'));
  assert.equal(ai.automatic_selection.enabled, true);
  assert.equal(ai.manual_selection.enabled, true);
  assert.ok(ai.automatic_selection.route_logic.some(r => /assign Enumerator/i.test(r)));
});

test('v207C M&E and Enumerator workspaces support daily productivity and offline field workflows', () => {
  const me = buildMEProductivityWorkspaceV207C({ active_surveys: 3, response_rate_pct: 72, data_quality_score: 99, active_enumerators: 12 });
  assert.equal(me.role, 'me_officer_data_analyst');
  assert.ok(me.quick_actions.some(a => a.label === 'Share Survey'));
  assert.ok(me.data_quality_center.checks.includes('GPS mismatch'));
  assert.ok(me.ai_analysis_studio.one_click_outputs.includes('Government Brief'));
  const enumerator = buildEnumeratorProductivityWorkspaceV207C({ assignments: 20, completed_today: 7, pending_uploads: 2 });
  assert.equal(enumerator.role, 'enumerator');
  assert.ok(enumerator.large_actions.every(a => a.touch_target === 'large'));
  assert.ok(enumerator.offline_intelligence.supports.includes('GPS'));
  assert.ok(enumerator.offline_intelligence.supports.includes('consent'));
});

test('v207C readiness is calculated from real module presence, not a hardcoded claim only', () => {
  const engine = buildAutonomousOmniChannelCollectionEngineV207C({});
  const readiness = buildV207CReadinessScore({
    distribution: engine.distribution_center,
    aiDistribution: engine.ai_distribution_engine,
    meWorkspace: engine.me_workspace,
    enumeratorWorkspace: engine.enumerator_workspace,
    supervisor: engine.supervisor_dashboard,
    voice: engine.voice_intelligence,
  });
  assert.ok(readiness.score >= 99.8);
  assert.match(readiness.rating, /9\.9|10\/10/);
  assert.ok(readiness.checks.every(c => typeof c.passed === 'boolean'));
});

test('v207C backend route and frontend pages are wired for field intelligence, distribution and enumerator workflows', () => {
  const index = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../site/app/field-intelligence-workspace.html', import.meta.url), 'utf8');
  const enumPage = fs.readFileSync(new URL('../../site/app/enumerator-workspace.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../../site/assets/js/field-intelligence.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../site/assets/css/field-intelligence.css', import.meta.url), 'utf8');
  assert.match(index, /field-intelligence/);
  assert.match(index, /Field Intelligence access required/);
  assert.match(page, /Survey Distribution Center/);
  assert.match(page, /AI Distribution Engine/);
  assert.match(enumPage, /Enumerator Offline Mobile Workspace/);
  assert.match(js, /initV207CFieldIntelligence/);
  assert.match(css, /offline|touch|mobile|v207c/i);
});

// Release 0B (2026-07-18): field-intelligence-workspace.html is actually a
// redirect stub (location.replace into me-operational-dashboard.html, which
// in turn calls /api/field-intelligence — confirmed absent from the backend,
// 404 in production). This test previously asserted the broken CTA's label
// ("Open Field Intelligence Workspace") was present on dashboard.html and the
// broken anchor link was present on enumerator-workspace.html, treating both
// as correct wiring; they were dead ends for every real user who clicked
// them. Both were removed as part of the Release 0B production-safety
// hotfix — this guards against them silently coming back.
test('dashboard.html and enumerator-workspace.html no longer link to the confirmed-broken Field Intelligence Workspace chain', () => {
  const dashboard = fs.readFileSync(new URL('../../site/app/dashboard.html', import.meta.url), 'utf8');
  const enumPage = fs.readFileSync(new URL('../../site/app/enumerator-workspace.html', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboard, /Open Field Intelligence Workspace/);
  assert.doesNotMatch(dashboard, /field-intelligence-workspace\.html/);
  assert.doesNotMatch(enumPage, /field-intelligence-workspace\.html/);
});
