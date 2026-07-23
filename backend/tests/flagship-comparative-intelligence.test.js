// Comparative Intelligence — PX Release 10, Part 4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_COMPARATIVE_INTELLIGENCE_VERSION, compareRegionalPerformance, compareEvidenceStrength } from '../src/flagship-comparative-intelligence.js';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_COMPARATIVE_INTELLIGENCE_VERSION, 'string');
});

test('compareRegionalPerformance computes highest/lowest/disparity from real scores, never fabricating a number', () => {
  const regional = [{ name: 'A', primary_score: 80 }, { name: 'B', primary_score: 60 }, { name: 'C', primary_score: 70 }, { name: 'D', primary_score: 90 }];
  const result = compareRegionalPerformance(regional);
  assert.equal(result.highest.name, 'D');
  assert.equal(result.lowest.name, 'B');
  assert.equal(result.largestDisparity, 30);
  assert.equal(result.median, 75);
});

test('compareRegionalPerformance honestly discloses that "strongest improvement" is not available rather than inventing a trend', () => {
  const result = compareRegionalPerformance([{ name: 'A', primary_score: 80 }, { name: 'B', primary_score: 60 }]);
  assert.equal(result.strongestImprovement, null);
  assert.match(result.strongestImprovementRationale, /not available/i);
});

test('compareRegionalPerformance returns null for an empty regional array rather than throwing', () => {
  assert.equal(compareRegionalPerformance([]), null);
});

test('compareEvidenceStrength identifies the real strongest and weakest evidence by confidence_score', () => {
  const evidence = [{ id: 'E1', confidence_score: 90, region: 'A' }, { id: 'E2', confidence_score: 98, region: 'B' }, { id: 'E3', confidence_score: 85, region: 'C' }];
  const result = compareEvidenceStrength(evidence);
  assert.equal(result.strongestEvidence.id, 'E2');
  assert.equal(result.largestUncertainty.id, 'E3');
});

test('compareEvidenceStrength returns null when no evidence carries a confidence score', () => {
  assert.equal(compareEvidenceStrength([{ id: 'E1' }]), null);
});

test('every real flagship sample computes real, non-null comparative intelligence for both regional and evidence', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const ci = model.report.comparative_intelligence;
    assert.ok(ci.regional);
    assert.ok(ci.evidence);
    assert.ok(ci.regional.largestDisparity >= 0);
  }
});
