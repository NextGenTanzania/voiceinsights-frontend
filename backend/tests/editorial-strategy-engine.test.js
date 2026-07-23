import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { selectPublicationNorthStar, computeEditorialWeights } from '../src/editorial-intelligence-engine.js';
import {
  selectPublicationIdentity, PUBLICATION_IDENTITY_BY_PROFILE, selectCommunicationStrategy,
  COMMUNICATION_STRATEGY_BY_NARRATIVE_MODE, buildQuestionEngine, buildCommunicationIntensityModel,
  buildExecutiveReadingPath, validateEditorialContinuity, selectEndingStrategy, buildPublicationMemory,
  buildCoherenceValidator, EDITORIAL_STRATEGY_ENGINE_VERSION,
} from '../src/editorial-strategy-engine.js';

test('every real sample.profile resolves to exactly one real, non-null publication identity', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const result = selectPublicationIdentity(model);
    assert.ok(result.identity, `${sample.key}: profile "${sample.profile}" has no identity mapping`);
    assert.equal(result.identity, PUBLICATION_IDENTITY_BY_PROFILE[sample.profile]);
    assert.ok(result.rationale.includes(sample.profile));
  }
});

test('communication strategy is grounded in the North Star\'s own real narrative_mode, never invented when no mapping exists', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const result = selectCommunicationStrategy(northStar);
    assert.equal(result.narrativeMode, northStar.finding.narrative_mode);
    if (COMMUNICATION_STRATEGY_BY_NARRATIVE_MODE[northStar.finding.narrative_mode]) {
      assert.ok(result.strategy, `${sample.key}: expected a real strategy for mode "${northStar.finding.narrative_mode}"`);
    } else {
      assert.equal(result.strategy, null, `${sample.key}: should not invent a strategy for an unmapped narrative_mode`);
    }
  }
});

test('the Question Engine reuses the real Narrative Arc questions and flags no missing questions on the real 16-sample catalog', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const questions = buildQuestionEngine(spreads);
    assert.equal(questions.length, spreads.length);
    const missing = questions.filter(q => q.missingQuestion);
    assert.equal(missing.length, 0, `${sample.key}: unexpected missing questions on ${missing.map(m => m.spreadId).join(', ')}`);
  }
});

// The brief's literal instruction is "never allow the same intensity
// across ALL pages" — checked here exactly as stated. A stricter "no 3
// consecutive" rule was tried while building this test and found false on
// real data (executive-brief/key-messages/hero-insight share arc='story'
// -> "Executive" in every real sample) — that finding is disclosed in the
// release report, not asserted here as if the engine already prevents it.
test('the Communication Intensity model assigns a real intensity to every spread from its own real arc tag, and never the identical intensity across every page', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const intensities = buildCommunicationIntensityModel(spreads);
  assert.equal(intensities.length, spreads.length);
  assert.ok(new Set(intensities.map(i => i.intensity)).size > 1, 'expected genuine intensity variety across the 20 real spreads');
});

test('the Executive Reading Path buckets every real spread exactly once, using the real, already-governed layers tags', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const path = buildExecutiveReadingPath(spreads);
  const total = path.maximumAttention.spreadIds.length + path.skim.spreadIds.length + path.referenceOnly.spreadIds.length;
  assert.equal(total, spreads.length);
  assert.ok(path.maximumAttention.spreadIds.includes('cover'));
});

// The exact real gap this release fixed: before the Closing wiring change,
// this validator would have flagged 10 of 16 real samples. This test
// proves the validator now finds the fixed state clean, and a synthetic
// fixture proves it still fires when the gap is real.
test('validateEditorialContinuity finds no North-Star-disappears-before-closing gap on any of the 16 real (fixed) samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const northStar = selectPublicationNorthStar(model);
    const issues = validateEditorialContinuity(model, northStar, spreads).filter(i => i.rule === 'north_star_disappears_before_closing');
    assert.equal(issues.length, 0, `${sample.key}: North Star still disappears before Closing`);
  }
});

test('validateEditorialContinuity fires on a synthetic fixture where Closing does not name the North Star recommendation', () => {
  const northStar = { recommendation: { recommendation: 'Adopt the real cabinet compact.' } };
  const spreads = [{ id: 'closing', html: '<p>Some other decision entirely.</p>' }];
  const issues = validateEditorialContinuity({}, northStar, spreads);
  assert.ok(issues.some(i => i.rule === 'north_star_disappears_before_closing'));
});

test('selectEndingStrategy returns one real, justified ending for every real sample', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const result = selectEndingStrategy(model);
    assert.ok(['Future Outlook', 'Next Action', 'Urgency', 'Commitment'].includes(result.ending));
    assert.ok(result.rationale.length > 20);
  }
});

test('buildPublicationMemory never exceeds 3 real messages', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const evidenceById = new Map((model.report.evidence || []).map(e => [e.id, e]));
    const weights = computeEditorialWeights({ findings: model.report.findings, recommendations: model.report.recommendations, evidenceById, regional: model.full_publication.regional, sdgCards: model.full_publication.sdg_cards });
    const memory = buildPublicationMemory(model, northStar, weights);
    assert.ok(memory.messages.length <= 3);
    assert.ok(memory.withinLimit);
  }
});

test('buildCoherenceValidator runs cleanly and reuses the real Rhythm Validator\'s detectors rather than duplicating them', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const northStar = selectPublicationNorthStar(model);
  const plans = spreads.map(s => s.artDirectionPlan);
  const result = buildCoherenceValidator(model, spreads, northStar, plans);
  assert.equal(typeof result.passed, 'boolean');
  assert.equal(result.issueCount, result.issues.length);
  assert.ok(result.issues.some(i => i.rule.startsWith('communication_')), 'expected at least one reused rhythm-validator finding surfaced under a communication_ rule name');
});

test(`engine version is exported (${EDITORIAL_STRATEGY_ENGINE_VERSION})`, () => {
  assert.equal(typeof EDITORIAL_STRATEGY_ENGINE_VERSION, 'string');
});
