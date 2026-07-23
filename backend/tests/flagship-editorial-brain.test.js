// Editorial Brain — PX Release 8 tests.
// The Brain is a pre-write PLANNING layer: it never generates a sentence,
// only a rank, a tier, a weight, or a pass/fail. These tests verify the
// planning decisions directly (unit-level) and verify the real 16-sample
// flagship library actually changed behavior as a result of consuming
// them (integration-level) — not just that the module loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAGSHIP_EDITORIAL_BRAIN_VERSION, planEditorialStrategy, audienceThinkingProfile,
  AUDIENCE_THINKING_PROFILES, NARRATIVE_ROLE_BY_SPREAD_ID, NARRATIVE_ROLES,
  EDITORIAL_CONSENSUS_EDITORS, runEditorialConsensus, checkCatalogConsistency,
} from '../src/flagship-editorial-brain.js';
import { SPINE_SPREAD_ORDER } from '../src/flagship-narrative-arc.js';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_EDITORIAL_BRAIN_VERSION, 'string');
});

// ------------------------------------------------------------------
// planEditorialStrategy
// ------------------------------------------------------------------
test('planEditorialStrategy is a pure function: identical evidence input produces identical output', () => {
  const evidence = Array.from({ length: 10 }, (_, i) => ({ statistic: { value: 90 - i } }));
  const a = planEditorialStrategy({ evidence, subjectCount: 5 });
  const b = planEditorialStrategy({ evidence, subjectCount: 5 });
  assert.deepEqual(a.rankOfIndex, b.rankOfIndex);
  assert.equal(a.heroIndex, b.heroIndex);
});

test('planEditorialStrategy produces a genuine permutation of ranks, never a repeated or skipped rank', () => {
  const evidence = Array.from({ length: 10 }, (_, i) => ({ statistic: { value: 90 - i * 3 } }));
  const { rankOfIndex } = planEditorialStrategy({ evidence, subjectCount: 5 });
  assert.equal(rankOfIndex.length, 5);
  assert.deepEqual([...rankOfIndex].sort((x, y) => x - y), [0, 1, 2, 3, 4]);
});

test('planEditorialStrategy ranks the subject with the real worst (lowest) average evidence value as rank 0 / heroIndex', () => {
  // Subject index 2 is linked to evidence[2] and evidence[5] (i and i+3) —
  // give it the lowest real values and confirm it wins the ranking.
  const evidence = Array.from({ length: 10 }, (_, i) => ({ statistic: { value: 80 } }));
  evidence[2].statistic.value = 54;
  evidence[5].statistic.value = 54;
  const { heroIndex, rankOfIndex } = planEditorialStrategy({ evidence, subjectCount: 5 });
  assert.equal(heroIndex, 2);
  assert.equal(rankOfIndex[2], 0);
});

test('priorityTierForIndex assigns exactly 2 CRITICAL, 2 HIGH, 1 MEDIUM across 5 subjects, by rank not position', () => {
  const evidence = Array.from({ length: 10 }, (_, i) => ({ statistic: { value: 90 - i } }));
  const { priorityTierForIndex } = planEditorialStrategy({ evidence, subjectCount: 5 });
  const tiers = [0, 1, 2, 3, 4].map(priorityTierForIndex);
  assert.deepEqual(tiers.slice().sort(), ['CRITICAL', 'CRITICAL', 'HIGH', 'HIGH', 'MEDIUM']);
});

test('timelineForIndex gives the most urgent window to rank 0 and the least urgent to the last rank', () => {
  const evidence = Array.from({ length: 10 }, (_, i) => ({ statistic: { value: 90 - i } }));
  const { timelineForIndex, rankOfIndex } = planEditorialStrategy({ evidence, subjectCount: 5 });
  const rank0Index = rankOfIndex.indexOf(0);
  const lastRankIndex = rankOfIndex.indexOf(4);
  assert.equal(timelineForIndex(rank0Index), '0–90 days');
  assert.equal(timelineForIndex(lastRankIndex), '6–18 months');
});

// ------------------------------------------------------------------
// Audience thinking profiles
// ------------------------------------------------------------------
test('audienceThinkingProfile returns a distinct, real profile for each of the 10 real sample.profile values', () => {
  const realProfiles = ['government', 'donor', 'humanitarian', 'board', 'corporate', 'ngo', 'research', 'interactive', 'evidence', 'un'];
  const seen = new Set();
  for (const profile of realProfiles) {
    const weights = audienceThinkingProfile(profile);
    assert.equal(weights, AUDIENCE_THINKING_PROFILES[profile]);
    seen.add(JSON.stringify(weights));
  }
  assert.ok(seen.size >= 6, `expected genuinely distinct weight sets across the 10 real profiles, found only ${seen.size}`);
});

test('audienceThinkingProfile falls back to a sane default for an unrecognized profile rather than throwing', () => {
  assert.doesNotThrow(() => audienceThinkingProfile('not-a-real-profile'));
  const fallback = audienceThinkingProfile('not-a-real-profile');
  assert.ok(Number.isFinite(fallback.urgencyBias));
});

// ------------------------------------------------------------------
// Narrative role mapping
// ------------------------------------------------------------------
test('every real spine spread has a declared narrative role, and every declared role is one of the 8 named roles', () => {
  for (const spreadId of SPINE_SPREAD_ORDER) {
    const role = NARRATIVE_ROLE_BY_SPREAD_ID[spreadId];
    assert.ok(role, `spine spread "${spreadId}" has no declared narrative role`);
    assert.ok(NARRATIVE_ROLES.includes(role), `"${role}" is not one of the 8 declared narrative roles`);
  }
});

// ------------------------------------------------------------------
// Eight-editor consensus
// ------------------------------------------------------------------
test('there are exactly 8 named editors', () => {
  assert.equal(EDITORIAL_CONSENSUS_EDITORS.length, 8);
  assert.equal(new Set(EDITORIAL_CONSENSUS_EDITORS.map(e => e.editor)).size, 8);
});

test('runEditorialConsensus passes on a well-formed synthetic report', () => {
  const report = {
    sector: 'Test Sector',
    findings: [{ evidence_ids: ['E1'] }],
    recommendations: [{ evidence_used: ['E1'], budget_requirement: 'Low', timeline: '0–90 days', owner: 'Someone', priority: 'CRITICAL', recommendation: 'Do the thing.' }],
    statistical_intelligence: { confidence_intervals: '95%', design_effect: 1.2 },
    executive_book: { executive_brief: 'A short thesis statement.' },
  };
  const { consensus, editors } = runEditorialConsensus(report);
  assert.equal(consensus, true);
  assert.ok(editors.every(e => e.pass));
});

test('runEditorialConsensus fails the specific editor whose real check is violated, not all of them', () => {
  const report = {
    sector: 'Test Sector',
    findings: [{ evidence_ids: [] }], // Research Editor should fail
    recommendations: [{ evidence_used: ['E1'], budget_requirement: 'Low', timeline: '0–90 days', owner: 'Someone', priority: 'CRITICAL', recommendation: 'Do the thing.' }],
    statistical_intelligence: { confidence_intervals: '95%', design_effect: 1.2 },
    executive_book: { executive_brief: 'A short thesis statement.' },
  };
  const { consensus, editors } = runEditorialConsensus(report);
  assert.equal(consensus, false);
  const research = editors.find(e => e.editor === 'Research Editor');
  assert.equal(research.pass, false);
  const policy = editors.find(e => e.editor === 'Policy Editor');
  assert.equal(policy.pass, true, 'a defect in one editor\'s check must not fail an unrelated editor');
});

test('the Communications Director editor catches the confirmed "for {sector}" redundant-suffix defect', () => {
  const report = {
    sector: 'Human Development',
    findings: [{ evidence_ids: ['E1'] }],
    recommendations: [{ evidence_used: ['E1'], budget_requirement: 'Low', timeline: '0–90 days', owner: 'Someone', priority: 'CRITICAL', recommendation: 'Adopt a compact for human development.' }],
    statistical_intelligence: { confidence_intervals: '95%', design_effect: 1.2 },
    executive_book: { executive_brief: 'A short thesis statement.' },
  };
  const { editors } = runEditorialConsensus(report);
  const comms = editors.find(e => e.editor === 'Communications Director');
  assert.equal(comms.pass, false);
});

// ------------------------------------------------------------------
// Catalog consistency detector
// ------------------------------------------------------------------
test('checkCatalogConsistency flags a field with a real collision and names the colliding sample keys', () => {
  const built = [
    { key: 'a', model: { value: 'Same sentence.' } },
    { key: 'b', model: { value: 'Different sentence.' } },
    { key: 'c', model: { value: 'Same sentence.' } },
  ];
  const [result] = checkCatalogConsistency(built, { field: m => m.value });
  assert.equal(result.consistent, false);
  assert.equal(result.distinctCount, 2);
  assert.deepEqual(result.collisions, [['a', 'c']]);
});

test('checkCatalogConsistency reports consistent when every sample genuinely differs', () => {
  const built = [
    { key: 'a', model: { value: 'One.' } },
    { key: 'b', model: { value: 'Two.' } },
  ];
  const [result] = checkCatalogConsistency(built, { field: m => m.value });
  assert.equal(result.consistent, true);
  assert.equal(result.collisions.length, 0);
});

// ------------------------------------------------------------------
// Integration: the real 16-sample flagship library actually changed
// behavior as a result of consuming the Brain's decisions.
// ------------------------------------------------------------------
test('priority tier is no longer purely positional across the 16 real flagship samples', () => {
  let allDefaultPattern = true;
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const criticalIndices = model.report.recommendations
      .map((r, i) => ({ i, tier: r.strategic_priority }))
      .filter(x => x.tier === 'CRITICAL').map(x => x.i);
    if (JSON.stringify(criticalIndices) !== '[0,1]') allDefaultPattern = false;
  }
  assert.ok(!allDefaultPattern, 'every sample still assigns CRITICAL to indices [0,1] — priority tier is still purely positional');
});

test('every real flagship sample passes its own 8-editor consensus check', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    assert.equal(model.report.editorial_consensus.consensus, true, `${sample.key} failed consensus: ${JSON.stringify(model.report.editorial_consensus.editors.filter(e => !e.pass))}`);
  }
});

test('strategic_outlook is now genuinely distinct across all real flagship samples (previously 6/16, a confirmed verbatim collision)', () => {
  const values = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    values.add(model.report.executive_book.strategic_outlook);
  }
  assert.equal(values.size, FLAGSHIP_SAMPLE_REPORTS.length);
});

test('rebuilding the same sample key twice produces a byte-identical editorial_brain plan (determinism)', () => {
  const a = buildFlagshipSampleReport('national-human-development');
  const b = buildFlagshipSampleReport('national-human-development');
  assert.deepEqual(a.report.editorial_brain, b.report.editorial_brain);
});
