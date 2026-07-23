// Publication Intelligence Layer — PX Release 10, Parts 1, 2, 3, 5, 6, 7.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAGSHIP_NARRATIVE_INTELLIGENCE_VERSION, buildExecutiveCommentary, buildStrategicInterpretation,
  buildSoWhat, buildPolicyImplications, buildEvidenceCommentary, EDITORIAL_TRANSITION_PHRASES, pickEditorialTransition,
} from '../src/flagship-narrative-intelligence.js';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_NARRATIVE_INTELLIGENCE_VERSION, 'string');
});

// ------------------------------------------------------------------
// Part 1: Executive Commentary
// ------------------------------------------------------------------
test('buildExecutiveCommentary never repeats the recommendation sentence itself', () => {
  const recommendation = { recommendation: 'Adopt a cabinet-owned compact.', owner: 'Permanent Secretary', timeline: '0–90 days', priority: 'CRITICAL', expected_benefit: 'Improved outcomes.', expected_risk: 'Coordination risk.' };
  const { text } = buildExecutiveCommentary(recommendation, 0);
  assert.ok(!text.includes(recommendation.recommendation), 'executive commentary must extend understanding, not repeat the recommendation verbatim');
});

test('buildExecutiveCommentary anti-repeat: a different previousIndex never yields the identical frame twice in a row', () => {
  const recommendation = { owner: 'Permanent Secretary', timeline: '0–90 days', priority: 'CRITICAL', expected_benefit: 'x', expected_risk: 'y' };
  const first = buildExecutiveCommentary(recommendation, 2);
  const second = buildExecutiveCommentary(recommendation, 2, first.frameIndex);
  assert.notEqual(second.frameIndex, first.frameIndex);
});

// ------------------------------------------------------------------
// Part 2: Strategic Interpretation
// ------------------------------------------------------------------
test('buildStrategicInterpretation computes whatChanged from real values, never fabricating a prior period that was not supplied', () => {
  const withPrior = buildStrategicInterpretation({ label: 'Coverage', currentValue: 75, priorValue: 60 });
  assert.match(withPrior.whatChanged, /up by 15/);
  const withoutPrior = buildStrategicInterpretation({ label: 'Coverage', currentValue: 75 });
  assert.match(withoutPrior.whatChanged, /no prior comparison point/i);
});

test('buildStrategicInterpretation always answers all 5 required questions', () => {
  const result = buildStrategicInterpretation({ label: 'X', currentValue: 10 });
  for (const key of ['whatChanged', 'whyItMatters', 'decisionEnabled', 'uncertaintyRemaining', 'furtherEvidenceNeeded']) {
    assert.ok(result[key] && result[key].length > 0, `missing ${key}`);
  }
});

// ------------------------------------------------------------------
// Part 3: "So What?"
// ------------------------------------------------------------------
test('buildSoWhat answers all 6 required conditions, each grounded in a real recommendation field', () => {
  const recommendation = { expected_risk: 'Coordination risk', expected_benefit: 'Better outcomes', timeline: '0–90 days', dependencies: ['Named sponsor'] };
  const result = buildSoWhat(recommendation);
  for (const key of ['ifIgnored', 'ifAddressed', 'ifAccelerated', 'ifDelayed', 'ifScaled', 'ifReplicated']) {
    assert.ok(result[key] && result[key].length > 0, `missing ${key}`);
  }
  assert.ok(result.ifIgnored.includes('coordination risk'));
  assert.equal(result.ifAddressed, recommendation.expected_benefit);
});

test('buildSoWhat never crashes on a minimal recommendation with no dependencies', () => {
  assert.doesNotThrow(() => buildSoWhat({}));
});

// ------------------------------------------------------------------
// Part 5: Policy Implications
// ------------------------------------------------------------------
test('buildPolicyImplications always includes a Policy implication and a Monitoring implication when a monitoring_indicator exists', () => {
  const recommendation = { recommendation: 'Publish a scorecard.', monitoring_indicator: 'Milestone rate' };
  const implications = buildPolicyImplications(recommendation);
  assert.ok(implications.some(i => i.implication === 'Policy implication'));
  assert.ok(implications.some(i => i.implication === 'Monitoring implication'));
});

test('buildPolicyImplications never fabricates an implication with no matching real signal', () => {
  const recommendation = { recommendation: 'Do a generic thing.' };
  const implications = buildPolicyImplications(recommendation);
  assert.ok(!implications.some(i => i.implication === 'Budget implication'), 'no budget keyword or field should not produce a Budget implication');
});

// ------------------------------------------------------------------
// Part 6: Evidence Commentary
// ------------------------------------------------------------------
test('buildEvidenceCommentary computes real statistics, never inventing a confidence figure', () => {
  const evidence = [{ confidence_score: 90, region: 'A' }, { confidence_score: 96, region: 'B' }];
  const result = buildEvidenceCommentary(evidence);
  assert.equal(result.reliability, 'Average confidence score of 93% across linked records.');
  assert.equal(result.consistency, 'Consistent across 2 distinct regions.');
  assert.equal(result.completeness, '2 linked evidence records.');
});

test('buildEvidenceCommentary honestly flags a gap when only one evidence record exists', () => {
  const result = buildEvidenceCommentary([{ confidence_score: 90, region: 'A' }]);
  assert.match(result.gaps, /second independent source/i);
});

test('buildEvidenceCommentary never crashes on empty evidence', () => {
  const result = buildEvidenceCommentary([]);
  assert.match(result.strength, /not assessed/i);
});

// ------------------------------------------------------------------
// Part 7: Editorial transitions
// ------------------------------------------------------------------
test('pickEditorialTransition never returns the same phrase index twice in a row when a previous index is supplied', () => {
  const first = pickEditorialTransition(3);
  const second = pickEditorialTransition(3, first.index);
  assert.notEqual(second.index, first.index);
});

test('EDITORIAL_TRANSITION_PHRASES matches the specific examples named in the brief', () => {
  assert.ok(EDITORIAL_TRANSITION_PHRASES.some(p => p.startsWith('Building on the previous findings')));
  assert.ok(EDITORIAL_TRANSITION_PHRASES.some(p => p.startsWith('Taken together')));
});

// ------------------------------------------------------------------
// Integration: real 16-sample catalog
// ------------------------------------------------------------------
test('every real flagship sample attaches executive_commentary, so_what, policy_implications, evidence_commentary and section_transitions for every finding/recommendation', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const r = model.report;
    assert.equal(r.executive_commentary.length, r.recommendations.length);
    assert.equal(r.so_what.length, r.recommendations.length);
    assert.equal(r.policy_implications.length, r.recommendations.length);
    assert.equal(r.evidence_commentary.length, r.findings.length);
    assert.equal(r.section_transitions.length, r.findings.length);
  }
});

test('no two consecutive executive_commentary entries share the same frame in any of the 16 real samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const texts = model.report.executive_commentary.map(c => c.text);
    for (let i = 1; i < texts.length; i++) {
      assert.notEqual(texts[i], texts[i - 1], `${sample.key}: consecutive executive commentary entries are identical`);
    }
  }
});

test('rebuilding the same sample key twice produces byte-identical narrative intelligence output (determinism)', () => {
  const a = buildFlagshipSampleReport('national-human-development');
  const b = buildFlagshipSampleReport('national-human-development');
  assert.deepEqual(a.report.executive_commentary, b.report.executive_commentary);
  assert.deepEqual(a.report.so_what, b.report.so_what);
  assert.deepEqual(a.report.evidence_commentary, b.report.evidence_commentary);
});
