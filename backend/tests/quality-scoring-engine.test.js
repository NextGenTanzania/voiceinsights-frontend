// Run with: node --test tests/quality-scoring-engine.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreReportQuality } from '../src/quality-scoring-engine.js';

function emptyModel() {
  return {
    demographics: { gender: [], age: [], regions: [] },
    findings: { sentiment: [], topics: [] },
    kpis: { total_responses: 0, response_rate_pct: null },
    narrative: null,
    charts: [],
    recommendations: null,
    metadata: { standards: [] },
    data_quality: { flagged_response_count: 0 },
  };
}

test('a completely empty report scores 0 on every dimension that requires content', () => {
  const scores = scoreReportQuality(emptyModel());
  assert.equal(scores.data_completeness, 0);
  assert.equal(scores.sample_quality, 0);
  assert.equal(scores.narrative_coverage, 0);
  assert.equal(scores.chart_coverage, 0);
  assert.equal(scores.recommendation_quality, 0);
  assert.equal(scores.standards_compliance, 0);
});

test('sample_quality bands scale with real response count, never fabricated', () => {
  const m1 = emptyModel(); m1.kpis.total_responses = 10;
  assert.equal(scoreReportQuality(m1).sample_quality, 20);

  const m2 = emptyModel(); m2.kpis.total_responses = 150;
  assert.equal(scoreReportQuality(m2).sample_quality, 60);

  const m3 = emptyModel(); m3.kpis.total_responses = 400;
  assert.equal(scoreReportQuality(m3).sample_quality, 100);
});

test('narrative_coverage correctly ignores the honest "not enough data" placeholder as unfilled', () => {
  const m = emptyModel();
  m.narrative = {
    executive_summary: 'Not enough data has been collected yet to generate this section.',
    key_findings: [], discussion: '', conclusions: '', risks: [], opportunities: [], lessons_learned: '',
  };
  assert.equal(scoreReportQuality(m).narrative_coverage, 0);
});

test('narrative_coverage correctly counts genuinely filled fields', () => {
  const m = emptyModel();
  m.narrative = {
    executive_summary: 'Real summary text.',
    key_findings: ['finding 1'],
    discussion: 'Real discussion.',
    conclusions: '', risks: [], opportunities: [], lessons_learned: '',
  };
  const scores = scoreReportQuality(m);
  assert.equal(scores.narrative_coverage, Math.round((3 / 7) * 100));
});

test('a high fraud-flag ratio correctly lowers ai_confidence', () => {
  const clean = emptyModel(); clean.kpis.total_responses = 100; clean.data_quality.flagged_response_count = 0;
  const flagged = emptyModel(); flagged.kpis.total_responses = 100; flagged.data_quality.flagged_response_count = 40;
  assert.equal(scoreReportQuality(clean).ai_confidence, 100);
  assert.ok(scoreReportQuality(flagged).ai_confidence < 100);
});

test('overall_quality_score is the plain average of all dimensions (transparent, not hidden weighting)', () => {
  const m = emptyModel();
  m.kpis.total_responses = 400; m.kpis.response_rate_pct = 80;
  m.metadata.standards = ['SDG'];
  const scores = scoreReportQuality(m);
  const dims = Object.entries(scores).filter(([k]) => k !== 'overall_quality_score').map(([, v]) => v);
  const expectedAvg = Math.round(dims.reduce((s, v) => s + v, 0) / dims.length);
  assert.equal(scores.overall_quality_score, expectedAvg);
});

test('a fully-populated, high-quality report scores highly across every dimension', () => {
  const m = {
    demographics: { gender: [{ label: 'M', n: 5 }], age: [{ label: '18-25', n: 5 }], regions: [{ label: 'Dodoma', n: 5 }] },
    findings: { sentiment: [{ label: 'positive', n: 5 }], topics: [{ topic: 'health', count: 3 }] },
    kpis: { total_responses: 400, response_rate_pct: 90 },
    narrative: {
      executive_summary: 'Real.', key_findings: ['a', 'b'], discussion: 'Real.', conclusions: 'Real.',
      risks: ['risk'], opportunities: ['opp'], lessons_learned: 'Real.',
    },
    charts: [{ section: 'a' }, { section: 'b' }, { section: 'c' }, { section: 'd' }, { section: 'e' }],
    recommendations: { immediate: ['a', 'b'], medium_term: ['c', 'd'], long_term: ['e', 'f'] },
    metadata: { standards: ['SDG', 'WHO'] },
    data_quality: { flagged_response_count: 0 },
  };
  const scores = scoreReportQuality(m);
  assert.ok(scores.overall_quality_score >= 90, `expected high score, got ${scores.overall_quality_score}`);
});
