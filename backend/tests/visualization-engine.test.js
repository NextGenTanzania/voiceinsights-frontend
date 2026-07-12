// Run with: node --test tests/visualization-engine.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectChartType, buildChartSpecs } from '../src/visualization-engine.js';

test('a single scalar value (not an array) always gets a KPI card', () => {
  assert.equal(selectChartType(42, 'response_rate'), 'kpi_card');
  assert.equal(selectChartType(null, 'anything'), 'kpi_card');
});

test('time-series shaped data (has a date/period field) always gets a line chart, regardless of hint', () => {
  const data = [{ period: '2026-01', n: 5 }, { period: '2026-02', n: 8 }];
  assert.equal(selectChartType(data, 'demographic'), 'line'); // shape wins over a mismatched hint
});

test('the "trend" hint forces a line chart even without explicit date fields', () => {
  const data = [{ label: 'Round 1', n: 10 }, { label: 'Round 2', n: 15 }];
  assert.equal(selectChartType(data, 'trend comparison'), 'line');
});

test('demographic/sentiment data with few categories (<=5) becomes a donut', () => {
  const gender = [{ label: 'Male', n: 40 }, { label: 'Female', n: 55 }, { label: 'Not provided', n: 5 }];
  assert.equal(selectChartType(gender, 'demographic gender'), 'donut');

  const sentiment = [{ label: 'positive', n: 20 }, { label: 'neutral', n: 10 }, { label: 'negative', n: 5 }];
  assert.equal(selectChartType(sentiment, 'sentiment'), 'donut');
});

test('demographic data with MANY categories (>5) falls back to a bar chart, never an unreadable donut', () => {
  const ageBrackets = Array.from({ length: 8 }, (_, i) => ({ label: `${i * 10}-${i * 10 + 9}`, n: i + 1 }));
  assert.equal(selectChartType(ageBrackets, 'demographic age'), 'bar');
});

test('channel comparison always gets a bar chart', () => {
  const channels = [{ label: 'SMS', n: 30 }, { label: 'WhatsApp', n: 50 }, { label: 'Voice', n: 10 }];
  assert.equal(selectChartType(channels, 'channel comparison'), 'bar');
});

test('geographic data (real shape: label+n) with a "regional map" hint gets a map chart type', () => {
  const regions = [{ label: 'Dar es Salaam', n: 40 }, { label: 'Arusha', n: 20 }];
  assert.equal(selectChartType(regions, 'regional map'), 'map');
});

test('explicit lat/lng data gets a map chart type even without a matching hint', () => {
  const points = [{ lat: -6.8, lng: 39.2, n: 5 }, { lat: -3.4, lng: 36.7, n: 3 }];
  assert.equal(selectChartType(points, ''), 'map');
});

test('a large generic categorical set (>5, no special hint) defaults to bar', () => {
  const topics = Array.from({ length: 10 }, (_, i) => ({ topic: `topic_${i}`, count: i }));
  assert.equal(selectChartType(topics, ''), 'bar');
});

test('a small (2-3) generic categorical set with no special hint still reads fine as a donut', () => {
  const yesNo = [{ label: 'Yes', n: 70 }, { label: 'No', n: 30 }];
  assert.equal(selectChartType(yesNo, ''), 'donut');
});

test('buildChartSpecs assembles specs only for datasets that actually have data (no empty-array chart specs)', () => {
  const specs = buildChartSpecs({
    demographics: { gender: [{ label: 'Male', n: 5 }], age: [], regions: [{ region: 'Dodoma', n: 3 }] },
    findings: { sentiment: [{ label: 'positive', n: 5 }], topics: [] },
    dataQuality: { avg_fraud_score: 0.1 },
  });
  const sections = specs.map(s => s.section);
  assert.ok(sections.includes('demographics_gender'));
  assert.ok(!sections.includes('demographics_age')); // empty array — correctly skipped
  assert.ok(sections.includes('geographic_coverage'));
  assert.ok(sections.includes('sentiment_analysis'));
  assert.ok(!sections.includes('emerging_themes')); // empty array — correctly skipped
  assert.ok(sections.includes('data_quality_score'));
});

test('buildChartSpecs picks chart types consistent with selectChartType for the same data', () => {
  const specs = buildChartSpecs({
    demographics: { gender: [{ label: 'Male', n: 5 }, { label: 'Female', n: 8 }], age: [], regions: [] },
    findings: { sentiment: [], topics: [] },
    dataQuality: null,
  });
  const genderSpec = specs.find(s => s.section === 'demographics_gender');
  assert.equal(genderSpec.chart_type, 'donut'); // 2 categories, demographic hint -> donut
});
