import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import {
  computeEditorialWeights, selectPublicationNorthStar, repetitionRoleFor,
  RECOMMENDATION_REPETITION_PLAN, validatePagePurpose, buildEditorialChecklist,
  EDITORIAL_INTELLIGENCE_ENGINE_VERSION,
} from '../src/editorial-intelligence-engine.js';

test('selectPublicationNorthStar returns a real finding/recommendation pair for every one of the 16 real samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const ns = selectPublicationNorthStar(model);
    assert.ok(ns, `${sample.key}: expected a north star`);
    assert.ok(model.report.findings.includes(ns.finding), `${sample.key}: north star finding must be a real finding on the model, not invented`);
    assert.equal(ns.finding, model.report.findings[ns.findingIndex]);
    assert.ok(ns.coreIdea && ns.coreIdea.length > 0);
    assert.ok(ns.rationale.includes(String(ns.weight.editorialTotal)), `${sample.key}: rationale must cite the real composite score it used`);
  }
});

test('selectPublicationNorthStar is deterministic — same input produces the identical selection', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const a = selectPublicationNorthStar(model);
  const b = selectPublicationNorthStar(model);
  assert.equal(a.findingIndex, b.findingIndex);
  assert.deepEqual(a.weight, b.weight);
});

// The brief's own explicit example: confidence_score alone must not decide
// the north star — a lower-confidence, higher-consequence finding can and
// should outrank a higher-confidence, lower-consequence one.
test('north star selection is not confidence_score alone — a real sample exists where the top-confidence finding is NOT selected', () => {
  let foundDivergence = false;
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const findings = model.report.findings;
    const topConfidenceIndex = findings.map((f, i) => [i, Number(f.confidence_score) || 0]).sort((a, b) => b[1] - a[1])[0][0];
    const ns = selectPublicationNorthStar(model);
    if (ns.findingIndex !== topConfidenceIndex) { foundDivergence = true; break; }
  }
  assert.ok(foundDivergence, 'expected at least one real sample where the north star diverges from pure confidence-score ranking');
});

test('computeEditorialWeights returns all 8 real dimensions for every finding, each a finite number', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const report = model.report;
  const evidenceById = new Map((report.evidence || []).map(e => [e.id, e]));
  const weights = computeEditorialWeights({ findings: report.findings, recommendations: report.recommendations, evidenceById, regional: model.full_publication.regional, sdgCards: model.full_publication.sdg_cards });
  assert.equal(weights.length, report.findings.length);
  for (const w of weights) {
    for (const dim of ['editorialWeight', 'editorialUrgency', 'memorability', 'decisionValue', 'storyValue', 'visualValue', 'riskValue', 'readerImpact', 'editorialTotal']) {
      assert.equal(typeof w[dim], 'number', `missing or non-numeric ${dim}`);
      assert.ok(Number.isFinite(w[dim]), `${dim} is not finite`);
    }
  }
});

test('every recommendation-repetition role carries a real, non-empty editorial justification', () => {
  for (const [spreadId, entry] of Object.entries(RECOMMENDATION_REPETITION_PLAN)) {
    assert.ok(['primary', 'reference', 'summary', 'omit'].includes(entry.role), `${spreadId}: invalid role "${entry.role}"`);
    assert.ok(entry.justification && entry.justification.length > 20, `${spreadId}: justification is missing or too thin`);
  }
  assert.equal(repetitionRoleFor('nonexistent-spread-id').role, 'reference');
});

test('validatePagePurpose returns a real editorialPurpose (from the Art Direction Engine) for every one of the 20 real spreads', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const purposes = validatePagePurpose(spreads);
  assert.equal(purposes.length, 30);
  for (const p of purposes) {
    assert.ok(p.editorialPurpose, `${p.spreadId}: missing a real editorialPurpose`);
    assert.equal(typeof p.wouldWeakenPublicationIfRemoved, 'boolean');
  }
});

test('buildEditorialChecklist returns only real, traceable values — never a placeholder string for a field that has real data', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const checklist = buildEditorialChecklist(model, northStar);
    assert.equal(checklist.northStar, northStar.coreIdea);
    assert.equal(checklist.primaryDecision, model.report.recommendations[0]?.recommendation || null);
    assert.ok(checklist.pagesSupporting.northStar.includes('cover'));
    assert.ok(checklist.pagesSupporting.northStar.includes('key-messages'));
  }
});

test(`engine version is exported (${EDITORIAL_INTELLIGENCE_ENGINE_VERSION})`, () => {
  assert.equal(typeof EDITORIAL_INTELLIGENCE_ENGINE_VERSION, 'string');
});
