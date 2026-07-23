import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { buildArtDirectionPlans } from '../src/editorial-art-direction-engine.js';
import {
  validatePublicationRhythm, detectLayoutFamilyMonotony, detectDominantVisualTypeMonotony,
  detectDecisionCanvasSimilarity, PUBLICATION_RHYTHM_VALIDATOR_VERSION,
} from '../src/publication-rhythm-validator.js';

function plansFor(sampleKey) {
  const model = buildFlagshipSampleReport(sampleKey);
  const { spreads } = composePublicationSpreads(model);
  return { plans: [...buildArtDirectionPlans(model, spreads).values()], spreads };
}

test('no three consecutive real spreads share a layout family, across all 16 real samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const { plans } = plansFor(sample.key);
    const issues = detectLayoutFamilyMonotony(plans);
    assert.equal(issues.length, 0, `${sample.key}: ${JSON.stringify(issues)}`);
  }
});

test('no three consecutive real spreads share a dominant visual type, across all 16 real samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const { plans } = plansFor(sample.key);
    const issues = detectDominantVisualTypeMonotony(plans);
    assert.equal(issues.length, 0, `${sample.key}: ${JSON.stringify(issues)}`);
  }
});

// A synthetic fixture (not a real sample) proves the detector actually
// fires on genuine monotony, not just that it happens to stay silent on
// well-behaved real data.
test('detectLayoutFamilyMonotony fires on a synthetic 3-in-a-row fixture', () => {
  const plans = [
    { spreadId: 'a', layoutFamily: 'x' }, { spreadId: 'b', layoutFamily: 'x' }, { spreadId: 'c', layoutFamily: 'x' },
    { spreadId: 'd', layoutFamily: 'y' },
  ];
  const issues = detectLayoutFamilyMonotony(plans);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, 'layout_family_monotony');
  assert.deepEqual(issues[0].spreads, ['a', 'b', 'c']);
});

test('detectDominantVisualTypeMonotony does not fire on 2-in-a-row (only 3+)', () => {
  const plans = [
    { spreadId: 'a', dominantVisualType: 'chart' }, { spreadId: 'b', dominantVisualType: 'chart' },
    { spreadId: 'c', dominantVisualType: 'table' },
  ];
  assert.equal(detectDominantVisualTypeMonotony(plans).length, 0);
});

test('detectDecisionCanvasSimilarity passes on the real composed output — decisions-a and decisions-b are never byte-identical and always carry distinct subLayouts', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const { plans, spreads } = plansFor(sample.key);
    const issues = detectDecisionCanvasSimilarity(plans, spreads);
    assert.equal(issues.length, 0, `${sample.key}: ${JSON.stringify(issues)}`);
  }
});

test('detectDecisionCanvasSimilarity fires when two synthetic plans share a subLayout', () => {
  const plans = [
    { spreadId: 'decisions-a', subLayout: 'same' }, { spreadId: 'decisions-b', subLayout: 'same' },
  ];
  const spreads = [{ id: 'decisions-a', html: '<p>a</p>' }, { id: 'decisions-b', html: '<p>b</p>' }];
  const issues = detectDecisionCanvasSimilarity(plans, spreads);
  assert.ok(issues.some(i => i.rule === 'decision_canvas_sublayout_not_distinct'));
});

test('validatePublicationRhythm runs every rule and returns a real, structured result for a real sample', () => {
  const { plans, spreads } = plansFor('national-human-development');
  const result = validatePublicationRhythm(plans, spreads);
  assert.equal(result.validator_version, PUBLICATION_RHYTHM_VALIDATOR_VERSION);
  assert.equal(typeof result.passed, 'boolean');
  assert.equal(result.issue_count, result.issues.length);
  assert.ok('high' in result.issues_by_severity && 'medium' in result.issues_by_severity && 'low' in result.issues_by_severity);
});

test('validatePublicationRhythm runs cleanly (no throw) across all 16 real samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const { plans, spreads } = plansFor(sample.key);
    assert.doesNotThrow(() => validatePublicationRhythm(plans, spreads), `${sample.key} threw`);
  }
});
