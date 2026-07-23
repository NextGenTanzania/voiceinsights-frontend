import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInternationalIntelligenceReportingSuiteV200 } from '../src/international-intelligence-reporting-suite.js';
import { buildPublicationExcellenceScoreV206 } from '../src/international-publication-quality-engine.js';

const sample = {
  is_demo: true,
  metadata: { template_name: 'National Health Access Intelligence Report', sector: 'health', organization_name: 'VoiceInsights Demo Organization', campaign_name: 'Health Access Demo' },
  kpis: { total_responses: 420, response_rate_pct: 100, quality_score: 95 },
  findings: { top_topics: ['facility access','medicine availability'], sentiment: { positive: 227, neutral: 127, negative: 66 } },
  recommendations: [
    'Activate a 30-day stockout and waiting-time review in the three highest-need regions.',
    'Use SMS/WhatsApp follow-up to close maternal and child-health referral loops.',
    'Create region-level service improvement plans linking facility access, medicines, staffing and referral transport.'
  ],
  demographics: { gender: [{label:'Male', n:239},{label:'Female', n:181}], age: [{label:'18-25', n:93},{label:'26-35', n:87}] },
  geography: { regions: [{label:'Dar es Salaam', n:84},{label:'Arusha', n:75},{label:'Dodoma', n:71},{label:'Mbeya', n:70}] },
  standards: ['SDG','WHO-style service delivery logic']
};

test('v206 publication excellence scores every flagship dimension at 9.8+/10', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(sample);
  const v206 = suite.v206_publication_excellence;
  assert.equal(v206.label, 'International Publication Excellence');
  assert.ok(v206.rating_10 >= 9.8);
  assert.ok(v206.dimension_scores.length >= 10);
  for (const d of v206.dimension_scores) assert.ok(d.score_10 >= 9.8, `${d.key} below threshold`);
  assert.equal(v206.public_card.cta_label, 'Open Intelligence Report');
});

test('v206 score is computed from report package evidence, not a static card label', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(sample);
  const score = buildPublicationExcellenceScoreV206(sample, suite);
  assert.equal(score.quality_gate.no_hardcoded_score_rule.includes('not from a static card label'), true);
  assert.equal(score.evidence_summary.audience_products_ready, true);
  assert.equal(score.evidence_summary.sdg_framework_ready, true);
  assert.ok(score.evidence_summary.infographic_pages >= 8);
});

test('v206 quality gate can genuinely fail on a poor-quality document (score is not floored at 9.8)', () => {
  const poorModel = { kpis: {}, findings: {} };
  const poorSuite = {};
  const score = buildPublicationExcellenceScoreV206(poorModel, poorSuite);
  assert.ok(score.rating_10 < 9.8, `expected a poor document to score below the 9.8 threshold, got ${score.rating_10}`);
  assert.equal(score.status, 'REQUIRES_PUBLICATION_REVIEW');
  assert.equal(score.quality_gate.export_allowed, false);
  assert.ok(score.dimension_scores.some(d => d.status === 'REVIEW'), 'expected at least one dimension to be flagged for review on a poor document');
});
