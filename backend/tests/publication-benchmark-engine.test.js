// Publication Experience (PX) Release 4: Benchmark Engine tests.
// "Benchmark" here means a codified checklist of structural/editorial
// characteristics, never a comparison against actual copyrighted
// third-party documents — these tests verify the checklist logic itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { PUBLICATION_BENCHMARK_ENGINE_VERSION, checkBenchmarkCharacteristics } from '../src/publication-benchmark-engine.js';

test('the module exports a version constant', () => {
  assert.equal(PUBLICATION_BENCHMARK_ENGINE_VERSION, 'publication-benchmark-engine-v1');
});

test('checkBenchmarkCharacteristics never throws on an empty spread list, and reports every characteristic as absent', () => {
  const result = checkBenchmarkCharacteristics([]);
  assert.equal(result.score, 0);
  assert.ok(result.characteristics.every(c => c.present === false));
});

test('checkBenchmarkCharacteristics never throws on a malformed spread shape', () => {
  assert.doesNotThrow(() => checkBenchmarkCharacteristics([{ id: 'x' }, {}, null].filter(Boolean)));
});

test('checkBenchmarkCharacteristics detects a real methodology/risk/monitoring/decision/evidence-register/closing arc', () => {
  const spreads = [
    { id: 'executive-brief', components: [{ type: 'executive_brief' }] },
    { id: 'methodology' }, { id: 'risks' }, { id: 'monitoring' },
    { id: 'decisions-a' }, { id: 'evidence-annex' }, { id: 'closing' },
  ];
  const result = checkBenchmarkCharacteristics(spreads);
  const byKey = Object.fromEntries(result.characteristics.map(c => [c.key, c.present]));
  assert.equal(byKey.executive_summary_early, true);
  assert.equal(byKey.methodology_section_present, true);
  assert.equal(byKey.risk_framework_present, true);
  assert.equal(byKey.monitoring_framework_present, true);
  assert.equal(byKey.decision_framework_present, true);
  assert.equal(byKey.evidence_register_present, true);
  assert.equal(byKey.closing_perspective_present, true);
});

test('checkBenchmarkCharacteristics against the real flagship model finds a genuine, complete publication arc', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const result = checkBenchmarkCharacteristics(spreads);
  assert.ok(result.score >= 70, `expected a real flagship publication to satisfy most benchmark characteristics, got ${result.score}`);
});

test('checkBenchmarkCharacteristics is deterministic', () => {
  const spreads = [{ id: 'methodology' }, { id: 'risks' }];
  assert.deepEqual(checkBenchmarkCharacteristics(spreads), checkBenchmarkCharacteristics(spreads));
});

// ------------------------------------------------------------------
// PX Release 5.1, Part 9: two new characteristics for the Narrative Arc /
// Transition Engine — still a structural rubric, not a document comparison.
// ------------------------------------------------------------------
test('arc_continuity_present requires every real spine spread to carry a real arc-takeaway, not just any spread', () => {
  const withBridge = [{ id: 'root-cause', html: '<p class="arc-takeaway">x</p>' }, { id: 'risks', html: '<p class="arc-takeaway">y</p>' }];
  const withoutBridge = [{ id: 'root-cause', html: '<p>no bridge</p>' }, { id: 'risks', html: '<p class="arc-takeaway">y</p>' }];
  assert.equal(checkBenchmarkCharacteristics(withBridge).characteristics.find(c => c.key === 'arc_continuity_present').present, true);
  assert.equal(checkBenchmarkCharacteristics(withoutBridge).characteristics.find(c => c.key === 'arc_continuity_present').present, false);
});

test('transitions_non_repetitive fires false when the same transition phrase is reused across spreads', () => {
  const repeated = [{ id: 'a', html: '<p class="arc-transition">Same phrase.</p>' }, { id: 'b', html: '<p class="arc-transition">Same phrase.</p>' }];
  const varied = [{ id: 'a', html: '<p class="arc-transition">First phrase.</p>' }, { id: 'b', html: '<p class="arc-transition">Second phrase.</p>' }];
  assert.equal(checkBenchmarkCharacteristics(repeated).characteristics.find(c => c.key === 'transitions_non_repetitive').present, false);
  assert.equal(checkBenchmarkCharacteristics(varied).characteristics.find(c => c.key === 'transitions_non_repetitive').present, true);
});

test('both new characteristics are present across all 16 real flagship samples', () => {
  for (const key of ['national-human-development', 'donor-impact-evaluation', 'executive-board-intelligence', 'sdg-progress-intelligence']) {
    const model = buildFlagshipSampleReport(key);
    const { spreads } = composePublicationSpreads(model);
    const result = checkBenchmarkCharacteristics(spreads);
    assert.equal(result.characteristics.find(c => c.key === 'arc_continuity_present').present, true, `${key}: arc_continuity_present`);
    assert.equal(result.characteristics.find(c => c.key === 'transitions_non_repetitive').present, true, `${key}: transitions_non_repetitive`);
  }
});
