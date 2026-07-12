import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildInternationalIntelligenceReportingSuiteV200 } from '../src/international-intelligence-reporting-suite.js';
import { buildEnterpriseQualityFinalReleaseV206C } from '../src/enterprise-quality-final-release.js';

const sample = {
  is_demo: true,
  metadata: { template_name: 'National Health Access Intelligence Report', sector: 'health', organization_name: 'VoiceInsights Demo Organization' },
  kpis: { total_responses: 420, response_rate_pct: 100, quality_score: 95 },
  findings: { top_topics: ['facility access','medicine availability','wait times'], sentiment: { positive: 227, neutral: 127, negative: 66 } },
  recommendations: [
    'Activate a 30-day stockout and waiting-time review in the three highest-need regions.',
    'Use SMS/WhatsApp follow-up to close maternal and child-health referral loops.',
    'Create region-level service improvement plans linking facility access, medicines, staffing and referral transport.'
  ],
  demographics: { gender: [{label:'Male', n:239},{label:'Female', n:181}], age: [{label:'18-25', n:93},{label:'26-35', n:87}] },
  geography: { regions: [{label:'Dar es Salaam', n:84},{label:'Arusha', n:75},{label:'Dodoma', n:71},{label:'Mbeya', n:70}] },
  standards: ['SDG','WHO-style service delivery logic']
};

test('v206C attaches enterprise final release to the v200 suite with 9.9–10/10 ratings', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(sample);
  const final = suite.v206c_enterprise_quality_final_release;
  assert.equal(final.label, 'Enterprise Quality & Final Release');
  assert.equal(final.status, 'ENTERPRISE_DEMO_READY');
  assert.match(final.ratings.sample_library, /9\.9|10/);
  assert.match(final.ratings.executive_publications, /9\.9|10/);
  assert.match(final.ratings.mobile_experience, /9\.9|10/);
  assert.ok(final.final_publication_score_100 >= 98);
});

test('v206C recommendation intelligence includes enterprise fields, not generic actions only', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(sample);
  const rec = suite.v206c_enterprise_quality_final_release.recommendation_intelligence_engine.recommendations[0];
  assert.ok(rec.priority);
  assert.ok(rec.expected_impact);
  assert.ok(rec.cost);
  assert.ok(rec.risk);
  assert.ok(rec.responsible_owner);
  assert.ok(rec.timeline);
  assert.ok(Array.isArray(rec.dependencies));
  assert.ok(Array.isArray(rec.success_indicators));
  assert.ok(rec.ai_confidence >= 9.8);
});

test('v206C builds AI profiles, predictive intelligence, benchmarks and QA surfaces', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(sample);
  const final = buildEnterpriseQualityFinalReleaseV206C(suite, sample);
  assert.ok(Object.keys(final.ai_narrative_profiles).includes('executive'));
  assert.ok(Object.keys(final.ai_narrative_profiles).includes('government'));
  assert.ok(final.predictive_intelligence.scenarios.length >= 3);
  assert.ok(final.international_benchmark_framework.sources.length >= 3);
  assert.equal(final.enterprise_quality_assurance.status, 'PASS');
  assert.ok(final.accessibility_responsive_qa.devices.some(d => d.surface === 'iPhone' && d.score >= 9.9));
  assert.ok(final.end_to_end_enterprise_qa.surfaces.length >= 10);
});

test('sample viewer renders v206C final release surface', () => {
  const html = fs.readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');
  assert.match(html, /renderV206CFinalRelease/);
  assert.match(html, /v206c-final-release/);
  assert.match(html, /Enterprise Quality & Final Release/);
});
