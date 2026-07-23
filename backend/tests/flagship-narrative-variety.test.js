// Editorial & Visual Maturity Pass: asserts the previously fixed/near-fixed
// narrative fields now carry real, deterministic variety across the 16
// flagship samples, instead of one hardcoded sentence repeated 16 times.
// Every assertion checks REAL variety already produced by the existing
// seeded-selection architecture — no new generative/non-deterministic
// behaviour is introduced or asserted here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport } from '../src/flagship-sample-library.js';

test('executive_brief, strategic_outlook and cost_of_inaction are no longer single hardcoded strings repeated across all 16 samples', () => {
  const values = { executive_brief: new Set(), strategic_outlook: new Set(), cost_of_inaction: new Set() };
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const book = model.report.executive_book;
    for (const field of Object.keys(values)) {
      assert.ok(book[field], `${sample.key}: ${field} must be present`);
      values[field].add(book[field]);
    }
  }
  for (const [field, set] of Object.entries(values)) {
    assert.ok(set.size > 1, `${field} must vary across the 16 samples, found only ${set.size} distinct value(s)`);
  }
});

test('expected_benefit, expected_risk and budget_requirement vary across recommendations instead of one fixed string per field', () => {
  const values = { expected_benefit: new Set(), expected_risk: new Set(), budget_requirement: new Set() };
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const rec of model.report.recommendations) {
      for (const field of Object.keys(values)) {
        assert.ok(rec[field], `${sample.key}: recommendation ${rec.id} missing ${field}`);
        values[field].add(rec[field]);
      }
      // budget_band stays a synchronized alias, not an independently
      // fabricated second value.
      assert.equal(rec.budget_band, rec.budget_requirement);
    }
  }
  for (const [field, set] of Object.entries(values)) {
    assert.ok(set.size > 1, `${field} must vary across recommendations, found only ${set.size} distinct value(s)`);
  }
});

test('budget phrasing stays tied to real strategic priority: CRITICAL recommendations never draw from the lighter standard-tier pool', () => {
  const criticalPhrases = ['detailed costing and fiduciary review required', 'dedicated budget line and phased release', 'full business case and multi-year funding commitment required'];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const rec of model.report.recommendations) {
      if (rec.strategic_priority === 'CRITICAL') {
        assert.ok(criticalPhrases.some(p => rec.budget_requirement.includes(p)), `${sample.key} ${rec.id}: CRITICAL recommendation used a non-critical budget phrase`);
      }
    }
  }
});

test('the editorial-lens pool now spans more than the original five labels across the 16-sample library', () => {
  const labels = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const finding of model.report.findings) labels.add(finding.editorial_lens);
  }
  assert.ok(labels.size >= 6, `expected an expanded editorial-lens pool (>=6 distinct labels), found ${labels.size}`);
});

test('finding text spans the 10 opening rhetorical modes (PX Release 5, Part 2), not just the original analytical/evidence-led pair', () => {
  // One fragment per FINDING_FRAMES entry, in order: analytical, contrast-led,
  // evidence-led, human-impact, risk-led, opportunity-led, geographic,
  // contextual/historical, decision-led, uncertainty-led.
  const modeFragments = [
    'reshaping', 'looks stable in aggregate but splits sharply', 'Synthetic evidence from',
    'do not experience', 'a structural risk to', 'also makes it an opportunity',
    'Start with', 'This is not a new problem', 'The choice facing', 'though not the only one',
  ];
  const modesSeen = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const finding of model.report.findings) {
      modeFragments.forEach((fragment, i) => { if (finding.text.includes(fragment)) modesSeen.add(i); });
    }
  }
  assert.ok(modesSeen.size >= 6, `expected at least 6 of the 10 rhetorical modes to appear across the 16-sample library, found ${modesSeen.size}`);
});

test('no finding text anywhere in the 16-sample library contains a plural-subject grammar defect ("gaps is/has", "outcomes is/has", etc.)', () => {
  const badPatterns = [
    /\bgaps (is|has|shows up|becomes)\b/i, /\boutcomes (is|has|shows up|becomes)\b/i,
    /\bco-benefits (is|has|shows up|becomes)\b/i, /\btransitions (is|has|shows up|becomes)\b/i,
  ];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const finding of model.report.findings) {
      for (const pattern of badPatterns) {
        assert.ok(!pattern.test(finding.text), `${sample.key}: grammar defect ${pattern} in "${finding.text}"`);
      }
    }
  }
});

test('no generated report text anywhere duplicates a word immediately after a sector name ("performance performance", "delivery delivery")', () => {
  const dupWordRe = /\b(\w+)\s+\1\b/i;
  const harmless = new Set(['is', 'that', 'had', 'very']);
  function walk(node, sampleKey) {
    if (node == null) return;
    if (typeof node === 'string') {
      const m = node.match(dupWordRe);
      if (m && !harmless.has(m[1].toLowerCase())) assert.fail(`${sampleKey}: duplicated word "${m[0]}" in "${node.slice(0, 160)}"`);
      return;
    }
    if (Array.isArray(node)) { node.forEach(v => walk(v, sampleKey)); return; }
    if (typeof node === 'object') { for (const k of Object.keys(node)) walk(node[k], sampleKey); }
  }
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    walk(model.report, sample.key);
  }
});

test('every generated field remains fully deterministic: rebuilding the same sample key twice produces byte-identical narrative fields', () => {
  const a = buildFlagshipSampleReport('national-human-development');
  const b = buildFlagshipSampleReport('national-human-development');
  assert.equal(a.report.executive_book.executive_brief, b.report.executive_book.executive_brief);
  assert.equal(a.report.executive_book.strategic_outlook, b.report.executive_book.strategic_outlook);
  assert.equal(a.report.executive_book.cost_of_inaction, b.report.executive_book.cost_of_inaction);
  assert.deepEqual(a.report.recommendations.map(r => r.expected_benefit), b.report.recommendations.map(r => r.expected_benefit));
  assert.deepEqual(a.report.recommendations.map(r => r.expected_risk), b.report.recommendations.map(r => r.expected_risk));
});
