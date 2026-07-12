import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildVRDSShowcaseExperience, buildVRDSShowcaseCard, buildVRDSShowcaseInfographicPages } from '../src/vrds-showcase-experience.js';
import { buildExecutiveSummaryFormat, buildDonorBriefFormat, buildPolicyBriefFormat } from '../src/multi-format-renderer.js';

const indexSource = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
const viewerSource = fs.readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');
const librarySource = fs.readFileSync(new URL('../../site/sample-reports.html', import.meta.url), 'utf8');
const showcaseCss = fs.readFileSync(new URL('../../site/assets/css/vrds-showcase.css', import.meta.url), 'utf8');

const demoModel = {
  id: 'report_demo_v1822',
  is_demo: true,
  demo_country: 'Tanzania',
  metadata: { template_id: 'sdg_progress', template_name: 'SDG Progress Report', organization_name: 'VoiceInsights Demo Organization', campaign_name: 'SDG Demo', generated_at: '2026-01-01T00:00:00Z', standards: ['SDG'] },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 6 },
  demographics: { regions: [{ label: 'Dar es Salaam', n: 230 }, { label: 'Mwanza', n: 170 }], gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }], age: [{ label: '18-25', n: 220 }] },
  findings: { sentiment: [{ label: 'positive', n: 640 }, { label: 'negative', n: 120 }], topics: [{ topic: 'service access', count: 40 }], representative_quotes: [{ raw_text: 'Services improved but some areas still need support.' }] },
  narrative: { executive_summary: 'Progress is visible while climate resilience and income security remain priority gaps.', key_findings: ['Climate resilience is the highest priority signal.', 'Income security remains a secondary concern.', 'Dar es Salaam has the largest evidence base.', 'Female participation is balanced.', 'Positive sentiment is a useful foundation.'], risks: ['Climate resilience gaps may reduce progress.'], opportunities: ['Use SDG scorecards to focus planning.'], conclusions: 'Leadership should focus on weakest SDG indicators.' },
  recommendations: { immediate: ['Prioritise weakest SDG indicators in the next planning cycle.'], medium_term: ['Build an integrated SDG dashboard.'], long_term: ['Align local SDG monitoring with national planning.'] },
  data_quality: { score: 94, avg_fraud_score: 0.03, flagged_response_count: 0 },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'How would you describe progress?', question_type: 'open_voice' }] },
  report_quality_gate_v19: { overall_score: 94, status: 'passed', dimensions: [{ key: 'citation_coverage', score: 90 }] },
};

test('Worker entry imports successfully after track-download syntax fix', async () => {
  await import('../src/application.js');
});

test('track-download route uses safe published demo filter with valid SQL quoting', () => {
  assert.match(indexSource, /track-download/);
  assert.match(indexSource, /UPDATE generated_reports SET demo_downloads = demo_downloads \+ 1 WHERE id = \? AND is_demo = 1 AND status = 'published'/);
  assert.doesNotMatch(indexSource, /env\.DB\.prepare\('UPDATE generated_reports[\s\S]*status = 'published''\)/);
});

test('public pages avoid buyer-facing technical implementation language in visible labels', () => {
  const visibleBlocks = viewerSource
    .replace(/function\s+\w+\([^]*?<\/script>/g, '')
    .replace(/console\.error\([^\n]+/g, '')
    + librarySource.replace(/function\s+\w+\([^]*?<\/script>/g, '');
  for (const phrase of ['VoiceInsights Intelligence OS v7.0','Report Trust & Evidence Layer','Structured assistant actions','VRDS Showcase Experience']) {
    assert.doesNotMatch(visibleBlocks, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(viewerSource, /Executive Intelligence Report/);
  assert.match(viewerSource, /Evidence & Confidence Panel/);
  assert.match(viewerSource, /Decision Support Assistant/);
});

test('export previews contain report-like cover and skip raw implementation packages', () => {
  assert.match(viewerSource, /Cover', '-----'/);
  assert.match(viewerSource, /Methodology & Evidence Note/);
  assert.match(viewerSource, /vrds_report_experience/);
  assert.match(viewerSource, /report_experience/);
  assert.match(viewerSource, /skip = new Set/);
  assert.match(viewerSource, /Export preview prepared from the public demonstration report evidence package/);
});

test('board deck preview is honestly labelled and compressed in format manifest', () => {
  const exp = buildVRDSShowcaseExperience(demoModel);
  const board = exp.export_manifest.find(f => f.key === 'ai_talking_points');
  assert.equal(board.label, 'Board Deck Outline Preview');
  assert.match(board.export_note, /Presentation-ready outline/);
  const executiveBrief = exp.executive_brief;
  assert.ok(executiveBrief.five_key_findings.length <= 5);
  assert.ok(executiveBrief.three_recommended_decisions.length <= 3);
});

test('donor and government exports include required procurement sections and clean preview metadata', () => {
  const donor = buildDonorBriefFormat(demoModel);
  assert.ok(donor.value_for_money);
  assert.ok(donor.results);
  assert.ok(donor.risks);
  assert.ok(donor.recommendations);
  assert.ok(donor.export_preview.cover.report_title);
  const policy = buildPolicyBriefFormat(demoModel);
  assert.ok(policy.problem);
  assert.ok(policy.options);
  assert.ok(policy.recommendations);
  assert.ok(policy.export_preview.sections.includes('Methodology'));
  const exec = buildExecutiveSummaryFormat(demoModel);
  assert.ok(exec.export_preview.export_note.includes('clean export preview'));
});

test('infographics expose publication-page structure and mobile-safe hooks', () => {
  const set = buildVRDSShowcaseInfographicPages(demoModel);
  for (const page of set.pages.slice(1, 7)) {
    assert.ok(page.layout);
    assert.ok(page.evidence_label);
  }
  assert.match(viewerSource, /vrds-publication-page/);
  assert.match(viewerSource, /vrds-main-visual/);
  assert.match(showcaseCss, /v182\.2 excellence polish/);
  assert.match(showcaseCss, /@media\(max-width:680px\)/);
  assert.match(showcaseCss, /overflow-wrap:anywhere/);
});

test('all 16 sample cards retain buyer-ready metadata after label polish', () => {
  const templates = ['health_survey','education_assessment','agriculture_survey','livelihood_assessment','humanitarian_needs','baseline_study','endline_evaluation','market_research','customer_satisfaction','employee_engagement','citizen_feedback','community_scorecard','monitoring_report','quarterly_performance','annual_impact','sdg_progress'];
  for (const template_id of templates) {
    const card = buildVRDSShowcaseCard({ ...demoModel, metadata: { ...demoModel.metadata, template_id } });
    assert.ok(card.sector_badge, template_id);
    assert.ok(card.audience_badges.length, template_id);
    assert.ok(card.standards_badges.length, template_id);
    assert.ok(card.preview_thumbnail.headline, template_id);
    assert.ok(card.actions.length >= 6, template_id);
  }
});
