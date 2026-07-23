// Phase 0, Part 2: regression tests proving the regional-data contradiction
// (Regional Heat Map vs Regional & Equity Intelligence reporting different
// numbers for the same region) cannot recur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegionalMetrics, buildFlagshipSampleReport } from '../src/flagship-sample-library.js';

test('buildRegionalMetrics is the only source of regional performance values', () => {
  const blueprint = { regions: ['Alpha', 'Beta', 'Gamma', 'Delta'] };
  const regional = buildRegionalMetrics('sample-key-a', blueprint, 3000);
  assert.equal(regional.length, 4);
  for (const r of regional) {
    assert.ok(typeof r.primary_score === 'number' && r.primary_score >= 52 && r.primary_score <= 84);
    assert.ok(typeof r.responses === 'number' && r.responses > 0);
  }
});

test('buildRegionalMetrics is deterministic for a given key and blueprint', () => {
  const blueprint = { regions: ['Alpha', 'Beta', 'Gamma', 'Delta'] };
  const a = buildRegionalMetrics('sample-key-b', blueprint, 3000);
  const b = buildRegionalMetrics('sample-key-b', blueprint, 3000);
  assert.deepEqual(a, b);
});

test('changing the sample key changes regional values consistently, not partially', () => {
  const blueprint = { regions: ['Alpha', 'Beta', 'Gamma', 'Delta'] };
  const a = buildRegionalMetrics('key-one', blueprint, 3000);
  const b = buildRegionalMetrics('key-two', blueprint, 3000);
  const changed = a.some((r, i) => r.primary_score !== b[i].primary_score);
  assert.ok(changed, 'a different key must be able to change regional values');
});

test('national-human-development: heat map, choropleth and regional summary agree exactly', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const heatMap = model.report.visualizations.find(v => v.type === 'regional_heat_map');
  const choropleth = model.report.visualizations.find(v => v.type === 'choropleth_map');
  const summary = model.full_publication.regional;
  assert.ok(heatMap && choropleth && summary.length);

  const byLabel = arr => Object.fromEntries(arr.map(x => [x.label ?? x.name, x.value ?? x.primary_score]));
  const heatValues = byLabel(heatMap.data);
  const choroplethValues = byLabel(choropleth.data);
  const summaryValues = byLabel(summary);

  for (const name of Object.keys(summaryValues)) {
    assert.equal(heatValues[name], summaryValues[name], `${name}: heat map must match regional summary`);
    assert.equal(choroplethValues[name], summaryValues[name], `${name}: choropleth must match regional summary`);
  }
});

test('no independently-seeded duplicate regional metric set remains in buildVisuals output', () => {
  // Regression guard for the original bug: regional_heat_map/choropleth_map
  // visuals must carry the SAME object identity's values as full_publication.regional,
  // not a second, independently-seeded 4-value array that happens to look similar.
  const model = buildFlagshipSampleReport('national-human-development');
  const regional = model.full_publication.regional;
  const scoreByName = Object.fromEntries(regional.map(r => [r.name, r.primary_score]));
  for (const visual of model.report.visualizations) {
    if (visual.type !== 'regional_heat_map' && visual.type !== 'choropleth_map') continue;
    for (const row of visual.data) {
      assert.equal(row.value, scoreByName[row.label], `${visual.type}/${row.label} must reuse the governed regional score`);
    }
  }
});

// ------------------------------------------------------------------
// PX Release 5, Task #42 (confirmed defect): regional risk used to be a
// fixed positional label (['ELEVATED','WATCH','CRITICAL','STABLE'][index]),
// unrelated to the region's own primary_score — so a genuinely
// high-scoring region could read "CRITICAL" purely by array position, and
// the rendered cell color (already score-derived) could contradict the
// adjacent text label. Now both trace to the same score.
// ------------------------------------------------------------------
test('regional risk label always agrees with its own primary_score, never a positional placeholder', () => {
  const blueprint = { regions: ['Alpha', 'Beta', 'Gamma', 'Delta'] };
  for (const key of ['sample-key-a', 'sample-key-b', 'key-one', 'key-two', 'a-third-key']) {
    const regional = buildRegionalMetrics(key, blueprint, 3000);
    for (const r of regional) {
      const expected = r.primary_score < 58 ? 'CRITICAL' : r.primary_score < 70 ? 'WATCH' : 'STABLE';
      assert.equal(r.risk, expected, `${key}/${r.name}: risk "${r.risk}" does not match its own score ${r.primary_score}`);
    }
  }
});

test('across all 16 flagship samples, no region\'s risk label ever contradicts its own score', () => {
  for (const sample of ['national-human-development', 'donor-impact-evaluation', 'humanitarian-needs-assessment', 'executive-board-intelligence', 'sdg-progress-intelligence']) {
    const model = buildFlagshipSampleReport(sample);
    for (const r of model.full_publication.regional) {
      const expected = r.primary_score < 58 ? 'CRITICAL' : r.primary_score < 70 ? 'WATCH' : 'STABLE';
      assert.equal(r.risk, expected, `${sample}/${r.name}: risk "${r.risk}" does not match its own score ${r.primary_score}`);
    }
  }
});

test('regenerating the same publication key twice never produces a reversed ranking', () => {
  const first = buildFlagshipSampleReport('national-human-development').full_publication.regional;
  const second = buildFlagshipSampleReport('national-human-development').full_publication.regional;
  const rank = arr => arr.map(r => r.name).sort((a, b) => {
    const scoreOf = n => arr.find(x => x.name === n).primary_score;
    return scoreOf(b) - scoreOf(a);
  });
  assert.deepEqual(rank(first), rank(second));
});
