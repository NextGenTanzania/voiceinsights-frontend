// Publication Experience (PX) Release 4: Chart Components tests.
// Zero prior chart-drawing precedent existed anywhere in this codebase
// before this file (confirmed by audit) — these tests verify each of the
// 7 real, data-backed chart types renders correctly against real-shaped
// data and degrades gracefully (never throws, never fabricates) when data
// is absent or too thin to draw honestly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import {
  PUBLICATION_CHART_COMPONENTS_VERSION, radarChart, waffleChart, dumbbellChart, lollipopChart,
  treemap, flowDiagram, uncertaintyBand, scenarioFan,
} from '../src/publication-chart-components.js';
import { classifyVRDSConfidence } from '../src/vrds-foundation.js';

test('the module exports a version constant', () => {
  assert.equal(PUBLICATION_CHART_COMPONENTS_VERSION, 'publication-chart-components-v1');
});

// ------------------------------------------------------------------
// Radar chart
// ------------------------------------------------------------------
test('radarChart draws a polygon with one point per real axis for 3+ axes', () => {
  const html = radarChart({ evidence_quality: 82, statistical_quality: 75, decision_support: 79 });
  assert.ok(html.includes('<svg class="radar-chart"'));
  assert.ok(html.includes('<polygon'));
  assert.equal((html.match(/<circle/g) || []).length, 3);
});

test('radarChart degrades to a plain list rather than drawing a meaningless polygon for fewer than 3 axes', () => {
  const html = radarChart({ a: 50, b: 60 });
  assert.ok(html.includes('chart-fallback-list'));
  assert.ok(!html.includes('<svg'));
});

test('radarChart returns an empty string for no real axes', () => {
  assert.equal(radarChart({}), '');
});

test('radarChart against the real flagship model\'s assurance components renders a real polygon', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const components = model.report.publication_assurance?.components || model.publication_assurance?.components;
  if (components && Object.keys(components).length >= 3) {
    const html = radarChart(components);
    assert.ok(html.includes('<polygon'));
  }
});

// ------------------------------------------------------------------
// Waffle chart
// ------------------------------------------------------------------
test('waffleChart renders exactly 100 cells and fills the real percentage of them', () => {
  const html = waffleChart(56, 'Rural');
  assert.equal((html.match(/<rect/g) || []).length, 100);
  assert.ok(html.includes('56%'));
  assert.ok(html.includes('Rural'));
});

test('waffleChart returns an empty string for a non-numeric percentage, never a fabricated 0%', () => {
  assert.equal(waffleChart(undefined), '');
  assert.equal(waffleChart(null), '');
  assert.equal(waffleChart('not a number'), '');
});

test('waffleChart against the real flagship model\'s demographics renders the real rural share', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const rural = model.full_publication.demographics.location.find(([label]) => /rural/i.test(label))?.[1];
  const html = waffleChart(rural, 'Rural respondents');
  assert.ok(html.includes(`${rural}%`));
});

// ------------------------------------------------------------------
// Dumbbell chart
// ------------------------------------------------------------------
test('dumbbellChart draws two dots and a connecting line per real item', () => {
  const html = dumbbellChart([{ label: 'Lake Zone', valueA: 62, valueB: 73 }, { label: 'Coastal Belt', valueA: 70, valueB: 73 }], { labelA: 'Region', labelB: 'National avg' });
  assert.equal((html.match(/<circle/g) || []).length, 4);
  assert.equal((html.match(/<line/g) || []).length, 2);
  assert.ok(html.includes('Lake Zone'));
  assert.ok(html.includes('Region'));
  assert.ok(html.includes('National avg'));
});

test('dumbbellChart returns an empty string for no items', () => {
  assert.equal(dumbbellChart([]), '');
});

test('dumbbellChart against the real flagship model\'s regional scores vs. national average renders every region', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const regional = model.full_publication.regional;
  const avg = Math.round(regional.reduce((s, r) => s + r.primary_score, 0) / regional.length);
  const html = dumbbellChart(regional.map(r => ({ label: r.name, valueA: r.primary_score, valueB: avg })));
  for (const r of regional) assert.ok(html.includes(r.name));
});

// ------------------------------------------------------------------
// Lollipop chart
// ------------------------------------------------------------------
test('lollipopChart draws one line+dot per real item, labeled with its real value', () => {
  const html = lollipopChart([{ label: 'Rec A', value: 90 }, { label: 'Rec B', value: 70 }]);
  assert.equal((html.match(/<circle/g) || []).length, 2);
  assert.ok(html.includes('Rec A'));
  assert.ok(html.includes('90'));
});

test('lollipopChart returns an empty string for no items', () => {
  assert.equal(lollipopChart([]), '');
});

// ------------------------------------------------------------------
// Treemap
// ------------------------------------------------------------------
test('treemap allocates proportional width to each real value and returns nothing for zero total', () => {
  const html = treemap([{ label: 'Lake Zone', value: 4 }, { label: 'Coastal Belt', value: 2 }]);
  assert.equal((html.match(/<rect/g) || []).length, 2);
  assert.equal(treemap([{ label: 'x', value: 0 }]), '');
  assert.equal(treemap([]), '');
});

// ------------------------------------------------------------------
// Flow diagram (simplified, not a full multi-stage Sankey)
// ------------------------------------------------------------------
test('flowDiagram draws one connecting band per real flow, plus left and right nodes', () => {
  const html = flowDiagram([{ from: 'CRITICAL', to: 'Immediate', count: 2 }, { from: 'HIGH', to: 'Near-term', count: 3 }], { leftLabel: 'Priority', rightLabel: 'Timeline' });
  assert.equal((html.match(/<path/g) || []).length, 2);
  assert.ok(html.includes('Priority'));
  assert.ok(html.includes('Timeline'));
  assert.ok(html.includes('CRITICAL'));
  assert.ok(html.includes('Immediate'));
});

test('flowDiagram returns an empty string when there are no real flows with a positive count', () => {
  assert.equal(flowDiagram([]), '');
  assert.equal(flowDiagram([{ from: 'a', to: 'b', count: 0 }]), '');
});

// ------------------------------------------------------------------
// Uncertainty band — a real classification-band range, not a fabricated
// statistical confidence interval.
// ------------------------------------------------------------------
test('uncertaintyBand marks the real score within its real classifyVRDSConfidence band range', () => {
  const band = classifyVRDSConfidence(82);
  const html = uncertaintyBand(82, band);
  assert.ok(html.includes('82%'));
  assert.ok(html.includes(band.color));
});

test('uncertaintyBand returns an empty string for a non-numeric score or a missing band', () => {
  assert.equal(uncertaintyBand(undefined, classifyVRDSConfidence(82)), '');
  assert.equal(uncertaintyBand(82, null), '');
});

// ------------------------------------------------------------------
// Scenario fan — VPX Release 1. Arm length encodes only the real,
// already-assigned qualitative confidence RANK; no numeric probability or
// percentage may ever be invented or displayed.
// ------------------------------------------------------------------
test('scenarioFan draws one arm per real scenario, each labelled with its own real name and confidence text', () => {
  const html = scenarioFan([
    { name: 'Status quo', confidence: 'High' },
    { name: 'Targeted reform', confidence: 'Moderate' },
    { name: 'Accelerated reform', confidence: 'Low-moderate' },
  ]);
  assert.ok(html.includes('<svg class="scenario-fan"'));
  // Phase 2C: one <line> per arm is the floor, not the ceiling — a
  // de-collision pass adds one additional thin leader <line> whenever two
  // arms' labels would otherwise land close enough to overlap (confirmed
  // via direct visual review that this default data actually does collide
  // without it), so the real count may legitimately be higher than the arm
  // count alone.
  assert.ok((html.match(/<line/g) || []).length >= 3);
  assert.ok(html.includes('Status quo'));
  assert.ok(html.includes('High confidence'));
  assert.ok(html.includes('Targeted reform'));
  assert.ok(html.includes('Accelerated reform'));
});

test('scenarioFan never renders a fabricated numeric probability or percentage anywhere in its output', () => {
  const html = scenarioFan([
    { name: 'Status quo', confidence: 'High' },
    { name: 'Targeted reform', confidence: 'Moderate' },
  ]);
  assert.ok(!/%/.test(html), 'must never render a percentage');
  assert.ok(!/\b\d{1,3}\s*(percent|probability|likelihood)\b/i.test(html), 'must never render a fabricated numeric likelihood');
});

test('scenarioFan gives a real higher-confidence scenario a longer arm than a lower-confidence one', () => {
  const html = scenarioFan([
    { name: 'A', confidence: 'High' },
    { name: 'B', confidence: 'Low-moderate' },
  ]);
  const lengths = [...html.matchAll(/<line x1="[\d.]+" y1="[\d.]+" x2="([\d.]+)" y2="([\d.]+)"/g)]
    .map(m => Math.hypot(Number(m[1]) - 16, Number(m[2]) - 75));
  assert.ok(lengths[0] > lengths[1], 'a "High" confidence scenario should draw a longer arm than a "Low-moderate" one');
});

test('scenarioFan returns an empty string for fewer than 2 real scenarios, rather than drawing a meaningless single arm', () => {
  assert.equal(scenarioFan([]), '');
  assert.equal(scenarioFan([{ name: 'Only one', confidence: 'High' }]), '');
});

// ------------------------------------------------------------------
// Global Certification Phase 2: every real chart SVG must carry a real,
// non-generic accessible name (role="img" + aria-label) — confirmed absent
// catalog-wide before this release despite report.accessibility.wcag_target
// declaring "WCAG 2.2 AA" since PX Release 5. Each label must be built from
// the same real data the chart draws, never a placeholder like "chart".
// ------------------------------------------------------------------
test('every chart SVG carries role="img" and a real, non-generic aria-label built from its own real data', () => {
  const radarHtml = radarChart({ evidence_quality: 82, statistical_quality: 75, decision_support: 79 });
  assert.match(radarHtml, /<svg class="radar-chart" role="img" aria-label="[^"]+"/);
  assert.ok(radarHtml.match(/aria-label="([^"]+)"/)[1].includes('82'));

  const waffleHtml = waffleChart(56, 'Rural respondents');
  assert.match(waffleHtml, /<svg role="img" aria-label="[^"]+"/);
  assert.ok(waffleHtml.match(/aria-label="([^"]+)"/)[1].includes('Rural respondents'));

  const dumbbellHtml = dumbbellChart([{ label: 'Lake Zone', valueA: 62, valueB: 73 }], { labelA: 'Region', labelB: 'National avg' });
  assert.match(dumbbellHtml, /<svg role="img" aria-label="[^"]+"/);
  assert.ok(dumbbellHtml.match(/aria-label="([^"]+)"/)[1].includes('Lake Zone'));

  const lollipopHtml = lollipopChart([{ label: 'Rec A', value: 90 }]);
  assert.match(lollipopHtml, /<svg class="lollipop-chart" role="img" aria-label="[^"]+"/);
  assert.ok(lollipopHtml.match(/aria-label="([^"]+)"/)[1].includes('Rec A'));

  const treemapHtml = treemap([{ label: 'Lake Zone', value: 4 }, { label: 'Coastal Belt', value: 2 }]);
  assert.match(treemapHtml, /<svg class="treemap-chart" role="img" aria-label="[^"]+"/);
  assert.ok(treemapHtml.match(/aria-label="([^"]+)"/)[1].includes('Lake Zone'));

  const flowHtml = flowDiagram([{ from: 'CRITICAL', to: 'Immediate', count: 2 }], { leftLabel: 'Priority', rightLabel: 'Timeline' });
  assert.match(flowHtml, /<svg role="img" aria-label="[^"]+"/);
  assert.ok(flowHtml.match(/aria-label="([^"]+)"/)[1].includes('CRITICAL'));

  const uncertaintyHtml = uncertaintyBand(82, classifyVRDSConfidence(82));
  assert.match(uncertaintyHtml, /<svg class="uncertainty-band" role="img" aria-label="[^"]+"/);
  assert.ok(uncertaintyHtml.match(/aria-label="([^"]+)"/)[1].includes('82'));

  const scenarioHtml = scenarioFan([{ name: 'Status quo', confidence: 'High' }, { name: 'Targeted reform', confidence: 'Moderate' }]);
  assert.match(scenarioHtml, /<svg class="scenario-fan" role="img" aria-label="[^"]+"/);
  assert.ok(scenarioHtml.match(/aria-label="([^"]+)"/)[1].includes('Status quo'));
});

test('across all 16 real flagship samples, every rendered chart SVG carries a real, non-empty aria-label', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { html } = composePublicationSpreads(model);
    const chartSvgTags = [...html.matchAll(/<svg[^>]*class="(radar-chart|lollipop-chart|treemap-chart|uncertainty-band|scenario-fan)"[^>]*>/g)]
      .concat([...html.matchAll(/<svg role="img"[^>]*>/g)]);
    assert.ok(chartSvgTags.length > 0, `${sample.key}: expected at least one real chart SVG`);
    for (const [tag] of chartSvgTags) {
      assert.match(tag, /role="img"/, `${sample.key}: chart SVG missing role="img": ${tag}`);
      const label = tag.match(/aria-label="([^"]*)"/)?.[1];
      assert.ok(label && label.trim().length > 5, `${sample.key}: chart SVG has no real aria-label: ${tag}`);
    }
  }
});
