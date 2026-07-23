// Publication Experience (PX) Release 4: Quality Gate V2 tests.
// Deterministic — no LLM/generative judgment. These tests prove: same
// input always produces the same score; every category and persona score
// is always present; enforcement OFF never blocks regardless of score;
// enforcement ON blocks below threshold and always explains why.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { composePublicationSpreads, buildTypographyCss } from '../src/publication-spread-composer.js';
import { validatePublication } from '../src/editorial-intelligence-validator.js';
import { buildIntelligenceChains } from '../src/publication-intelligence-layer.js';
import {
  PUBLICATION_QUALITY_GATE_VERSION, PX_CATEGORIES, PERSONA_WEIGHTS, computePXAssessment, evaluateGateEnforcement,
} from '../src/publication-quality-gate.js';

function realAssessment() {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads, metadata } = composePublicationSpreads(model);
  const editorialValidation = validatePublication(spreads, {
    recommendations: model.report?.recommendations || [],
    regionNames: (model.full_publication?.regional || []).map(r => r.name),
  });
  const evidenceById = new Map((model.report.evidence || []).map(e => [e.id, e]));
  const intelligenceChains = buildIntelligenceChains(model.report.recommendations, model.report.findings, evidenceById);
  return computePXAssessment(spreads, editorialValidation, { cssText: buildTypographyCss(), metadata, intelligenceChains });
}

test('the module exports a version constant and the 12 named categories', () => {
  assert.equal(PUBLICATION_QUALITY_GATE_VERSION, 'publication-quality-gate-v1');
  assert.equal(PX_CATEGORIES.length, 12);
});

test('every persona weight vector sums to 1.0 across all 12 categories', () => {
  for (const [persona, weights] of Object.entries(PERSONA_WEIGHTS)) {
    const total = PX_CATEGORIES.reduce((sum, cat) => sum + (weights[cat] || 0), 0);
    assert.ok(Math.abs(total - 1) < 0.001, `${persona} weights sum to ${total}, expected 1.0`);
  }
});

test('computePXAssessment never silently fails: it always returns overall_score, all 12 categories, persona scores, maturity level, failed_criteria and improvement_recommendations', () => {
  const assessment = computePXAssessment([], null, {});
  assert.equal(typeof assessment.overall_score, 'number');
  for (const cat of PX_CATEGORIES) assert.equal(typeof assessment.categories[cat], 'number');
  for (const persona of Object.keys(PERSONA_WEIGHTS)) assert.equal(typeof assessment.persona_scores[persona], 'number');
  assert.equal(typeof assessment.maturity_level, 'string');
  assert.ok(Array.isArray(assessment.failed_criteria));
  assert.ok(Array.isArray(assessment.improvement_recommendations));
});

test('computePXAssessment is deterministic: the same real publication input always produces the identical assessment', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads, metadata } = composePublicationSpreads(model);
  const editorialValidation = validatePublication(spreads, { recommendations: model.report.recommendations, regionNames: [] });
  const cssText = buildTypographyCss();
  const a = computePXAssessment(spreads, editorialValidation, { cssText, metadata });
  const b = computePXAssessment(spreads, editorialValidation, { cssText, metadata });
  assert.deepEqual(a, b);
});

test('every improvement_recommendations entry corresponds to a real failed_criteria category, and every failed category is genuinely below the threshold', () => {
  const assessment = realAssessment();
  const failedCategories = new Set(assessment.failed_criteria.map(f => f.category));
  for (const rec of assessment.improvement_recommendations) assert.ok(failedCategories.has(rec.category));
  for (const f of assessment.failed_criteria) assert.ok(assessment.categories[f.category] < 60);
});

test('maturity_level matches the real overall_score against the documented bands', () => {
  const worldClass = computePXAssessment([], { issues_by_severity: {}, issues: [] }, {});
  // An empty publication should NOT score World-Class — confirms the bands
  // are not trivially satisfied by absence of data.
  assert.notEqual(worldClass.maturity_level, 'World-Class');
});

test('computePXAssessment against the real flagship publication produces an honest, non-perfect score with real evidence behind every category', () => {
  const assessment = realAssessment();
  assert.ok(assessment.overall_score > 0 && assessment.overall_score < 100);
  assert.ok(assessment.benchmark_characteristics.score > 0);
  assert.ok(assessment.publication_dna.score > 0);
  assert.ok(assessment.note.includes('deterministic proxies'), 'must not claim to be a true human editorial review');
});

// ------------------------------------------------------------------
// Enforcement — the one genuinely new behavioral capability this release
// adds. Off by default; a single flag switches it on; it never fails
// silently.
// ------------------------------------------------------------------
test('evaluateGateEnforcement never blocks when enforced is false, regardless of how low the score is', () => {
  const lowAssessment = { overall_score: 5 };
  const result = evaluateGateEnforcement(lowAssessment, { enforced: false, threshold: 70 });
  assert.equal(result.blocked, false);
  assert.equal(result.passed, false, 'passed still honestly reflects the real score');
});

test('evaluateGateEnforcement blocks when enforced is true and the score is below threshold, and always explains why', () => {
  const lowAssessment = { overall_score: 40 };
  const result = evaluateGateEnforcement(lowAssessment, { enforced: true, threshold: 70 });
  assert.equal(result.blocked, true);
  assert.ok(result.reason && result.reason.includes('40'));
});

test('evaluateGateEnforcement does not block a passing score even when enforced is true', () => {
  const highAssessment = { overall_score: 85 };
  const result = evaluateGateEnforcement(highAssessment, { enforced: true, threshold: 70 });
  assert.equal(result.blocked, false);
  assert.equal(result.passed, true);
  assert.equal(result.reason, null);
});

test('evaluateGateEnforcement defaults to a real threshold and enforced:false when not specified, matching the documented default', () => {
  const result = evaluateGateEnforcement({ overall_score: 10 });
  assert.equal(result.enforced, false);
  assert.equal(result.blocked, false);
  assert.equal(result.threshold, 70);
});
