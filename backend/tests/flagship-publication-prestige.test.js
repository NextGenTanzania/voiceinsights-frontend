// Publication Prestige Review — PX Release 10, Part 13.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_PUBLICATION_PRESTIGE_VERSION, reviewPublicationPrestige } from '../src/flagship-publication-prestige.js';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_PUBLICATION_PRESTIGE_VERSION, 'string');
});

test('reviewPublicationPrestige returns exactly 8 named reviewer verdicts, each with a stated rationale', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { verdicts } = reviewPublicationPrestige(model.report);
  assert.equal(verdicts.length, 8);
  for (const v of verdicts) assert.ok(v.reviewer && typeof v.satisfied === 'boolean' && v.rationale);
});

test('weaknesses are returned for every unsatisfied verdict, and only those', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const result = reviewPublicationPrestige(model.report);
  const unsatisfiedCount = result.verdicts.filter(v => !v.satisfied).length;
  assert.equal(result.weaknesses.length, unsatisfiedCount);
});

test('overallReady is true only when every verdict is satisfied', () => {
  const allPass = { editorial_consensus: { consensus: true, editors: [{ editor: 'Research Editor', pass: true }, { editor: 'Statistician', pass: true }] }, donor_intelligence: [{ dimension: 'x', present: true }], government_intelligence: [{ use: 'Cabinet paper', ready: true }, { use: 'Ministries', ready: true }, { use: 'Budget guidance', ready: true }, { use: 'Regional / local government', ready: true }], knowledge_validation: { valid: true }, decision_intelligence: [{ decisionCategory: ['Board Decision'] }] };
  const result = reviewPublicationPrestige(allPass);
  assert.ok(result.verdicts.every(v => v.satisfied === true) || result.overallReady === false);
  // Donor evaluation panel requires ALL dimensions present; with only one
  // dimension supplied here it is trivially satisfied, so overallReady can
  // legitimately be true for this fully-passing synthetic fixture.
});

test('a report with no real signals at all fails every verdict, never defaulting to a false pass', () => {
  const result = reviewPublicationPrestige({});
  assert.equal(result.overallReady, false);
  assert.ok(result.verdicts.every(v => v.satisfied === false));
});

// ------------------------------------------------------------------
// Regression: government_intelligence's "Regional / local government"
// check previously read report.full_publication.regional, which is not
// set until AFTER government_intelligence is computed in
// flagship-sample-library.js — silently producing ready:false for every
// one of the 16 real samples until this Prestige Review caught it.
// ------------------------------------------------------------------
test('every real flagship sample satisfies "Regional / local government" government-readiness (regression: ordering bug)', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const regionalUse = model.report.government_intelligence.find(g => g.use === 'Regional / local government');
    assert.equal(regionalUse.ready, true, `${sample.key}: Regional / local government readiness incorrectly false`);
  }
});

test('every real flagship sample computes a full prestige review with 8 verdicts', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    assert.equal(model.report.publication_prestige.verdicts.length, 8);
  }
});

test('the Board verdict is honestly false for a non-board-owned publication, not force-passed', () => {
  const model = buildFlagshipSampleReport('national-human-development'); // government profile, not board
  const board = model.report.publication_prestige.verdicts.find(v => v.reviewer === 'Board');
  assert.equal(board.satisfied, false);
});

test('rebuilding the same sample key twice produces a byte-identical prestige review (determinism)', () => {
  const a = buildFlagshipSampleReport('national-human-development');
  const b = buildFlagshipSampleReport('national-human-development');
  assert.deepEqual(a.report.publication_prestige, b.report.publication_prestige);
});
