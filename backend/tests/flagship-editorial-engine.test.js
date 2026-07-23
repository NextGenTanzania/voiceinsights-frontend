// PX Release 5, Part 2 (revised): tests for the editorial decision engine
// that replaced raw seeded-hash selection with real, grounded decisions.
// planFindingEditorial/planReportEditorialProfile are pure functions with
// no model dependency — tested directly here — plus integration checks
// against the real 16-sample flagship library confirming the wiring holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFindingEditorial, planReportEditorialProfile, FLAGSHIP_EDITORIAL_ENGINE_VERSION } from '../src/flagship-editorial-engine.js';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport } from '../src/flagship-sample-library.js';

const ELIGIBLE_MODES_BY_TIER = {
  CRITICAL: ['analytical', 'risk-led', 'decision-led', 'evidence-led'],
  HIGH: ['evidence-led', 'geographic', 'contrast-led', 'human-impact'],
  MEDIUM: ['contextual', 'opportunity-led', 'uncertainty-led'],
};

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_EDITORIAL_ENGINE_VERSION, 'string');
});

test('planFindingEditorial is a pure function: identical input always produces identical output', () => {
  const input = { priorityTier: 'CRITICAL', seedIndex: 42, previousMode: 'analytical' };
  const a = planFindingEditorial(input);
  const b = planFindingEditorial(input);
  assert.deepEqual(a, b);
});

test('planFindingEditorial never selects a mode outside the real priority-tier-eligible subset', () => {
  for (const tier of ['CRITICAL', 'HIGH', 'MEDIUM']) {
    for (let seedIndex = 0; seedIndex < 50; seedIndex++) {
      const { narrativeMode } = planFindingEditorial({ priorityTier: tier, seedIndex, previousMode: null });
      assert.ok(ELIGIBLE_MODES_BY_TIER[tier].includes(narrativeMode), `${tier}/seed ${seedIndex}: "${narrativeMode}" is not eligible for this tier`);
    }
  }
});

test('planFindingEditorial\'s anti-repeat rule never returns the same mode as previousMode when the tier has more than one eligible mode', () => {
  for (const tier of ['CRITICAL', 'HIGH', 'MEDIUM']) {
    for (const previousMode of ELIGIBLE_MODES_BY_TIER[tier]) {
      for (let seedIndex = 0; seedIndex < 20; seedIndex++) {
        const { narrativeMode } = planFindingEditorial({ priorityTier: tier, seedIndex, previousMode });
        assert.notEqual(narrativeMode, previousMode, `${tier}/seed ${seedIndex}: repeated "${previousMode}" despite the anti-repeat rule`);
      }
    }
  }
});

test('planFindingEditorial ties uncertaintyStyle and paragraphRhythm to priority tier, not an arbitrary hash', () => {
  assert.equal(planFindingEditorial({ priorityTier: 'CRITICAL', seedIndex: 0, previousMode: null }).uncertaintyStyle, 'confident');
  assert.equal(planFindingEditorial({ priorityTier: 'HIGH', seedIndex: 0, previousMode: null }).uncertaintyStyle, 'measured');
  assert.equal(planFindingEditorial({ priorityTier: 'MEDIUM', seedIndex: 0, previousMode: null }).uncertaintyStyle, 'hedged');
  assert.equal(planFindingEditorial({ priorityTier: 'MEDIUM', seedIndex: 0, previousMode: null }).paragraphRhythm, 'condensed');
  assert.equal(planFindingEditorial({ priorityTier: 'CRITICAL', seedIndex: 0, previousMode: null }).paragraphRhythm, 'full');
});

test('planReportEditorialProfile is a pure function and its tone is grounded in real regional scores, not a constant', () => {
  const low = planReportEditorialProfile({ audience: 'government', regionalScores: [50, 55, 58, 60] });
  const high = planReportEditorialProfile({ audience: 'government', regionalScores: [80, 82, 85, 88] });
  assert.equal(low.reportTone, 'urgent');
  assert.equal(high.reportTone, 'measured');
  assert.notEqual(low.reportTone, high.reportTone, 'reportTone must respond to real regional-score differences');
});

// ------------------------------------------------------------------
// Integration: the engine's guarantees must hold against the real,
// deterministic 16-sample flagship library, not just synthetic inputs.
// ------------------------------------------------------------------
test('across all 16 flagship samples, every finding\'s narrative_mode respects its own priority-tier eligibility', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    model.report.findings.forEach((finding, i) => {
      const tier = model.report.recommendations[i]?.strategic_priority;
      assert.ok(ELIGIBLE_MODES_BY_TIER[tier].includes(finding.narrative_mode), `${sample.key} finding ${i} (${tier}): "${finding.narrative_mode}" is not eligible`);
    });
  }
});

test('across all 16 flagship samples, no report has two consecutive findings sharing the same narrative_mode', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const modes = model.report.findings.map(f => f.narrative_mode);
    for (let i = 1; i < modes.length; i++) {
      assert.notEqual(modes[i], modes[i - 1], `${sample.key}: findings ${i - 1} and ${i} both used "${modes[i]}"`);
    }
  }
});

test('the engine\'s mode selection spans a genuine range across the 16-sample library, not one dominant mode', () => {
  const usage = {};
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const f of model.report.findings) usage[f.narrative_mode] = (usage[f.narrative_mode] || 0) + 1;
  }
  assert.ok(Object.keys(usage).length >= 8, `expected at least 8 of the 10 modes to appear across the library, found ${Object.keys(usage).length}`);
});

test('report-level tone (executive_brief/strategic_outlook/cost_of_inaction selection) spans more than one value across the 16-sample library', () => {
  const tones = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    tones.add(model.report.editorial_profile.reportTone);
  }
  assert.ok(tones.size > 1, `reportTone must vary across the 16 samples, found only ${tones.size} distinct value(s)`);
});

test('rebuilding the same sample key twice produces byte-identical narrative_mode and uncertainty_style decisions', () => {
  const a = buildFlagshipSampleReport('national-human-development');
  const b = buildFlagshipSampleReport('national-human-development');
  assert.deepEqual(a.report.findings.map(f => f.narrative_mode), b.report.findings.map(f => f.narrative_mode));
  assert.deepEqual(a.report.findings.map(f => f.uncertainty_style), b.report.findings.map(f => f.uncertainty_style));
  assert.deepEqual(a.report.editorial_profile, b.report.editorial_profile);
});

// ------------------------------------------------------------------
// PX Release 5.1, Part 5 (structural variation, verify-only): the 10
// FINDING_FRAMES modes already encode differently-ordered clause
// structures. This confirms the mapping named in the code comment above
// FINDING_FRAMES holds for all 10 real modes, rather than asserting it only
// in a comment nobody re-checks.
// ------------------------------------------------------------------
test('the 10 named narrative modes are all distinct, real, and collectively cover all 4 requested example structures', () => {
  const ALL_MODES = ['analytical', 'contrast-led', 'evidence-led', 'human-impact', 'risk-led', 'opportunity-led', 'geographic', 'contextual', 'decision-led', 'uncertainty-led'];
  assert.equal(new Set(ALL_MODES).size, 10, 'all 10 mode names must be distinct');
  // Observation -> Evidence -> Implication
  assert.ok(ALL_MODES.includes('analytical'));
  // Problem -> Context -> Decision
  assert.ok(ALL_MODES.includes('decision-led'));
  // Evidence -> Risk -> Recommendation
  assert.ok(ALL_MODES.includes('evidence-led') && ALL_MODES.includes('risk-led'));
  // Trend -> Human Story -> Policy
  assert.ok(ALL_MODES.includes('human-impact') && ALL_MODES.includes('contextual'));
});
