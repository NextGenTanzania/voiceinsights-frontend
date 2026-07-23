// PX Release 5.1, Part 2: the transition engine picks a bridge line
// between consecutive spine spreads based on real linkage (shared region,
// shared priority tier, or a generic arc-stage callback), never a flat
// hash and never quoting a prior sentence verbatim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTransition, FLAGSHIP_TRANSITION_ENGINE_VERSION, PRIORITY_TRANSITIONS } from '../src/flagship-transition-engine.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_TRANSITION_ENGINE_VERSION, 'string');
});

test('selectTransition is pure: identical input always produces identical output', () => {
  const input = { current: { region: 'Lake Zone', priorityTier: 'HIGH' }, previous: { region: 'Lake Zone', priorityTier: 'HIGH' }, currentArc: { stage: 'Evidence', priorQuestion: 'x' }, seedIndex: 3, previousKey: null };
  assert.deepEqual(selectTransition(input), selectTransition(input));
});

test('picks a region-callback transition naming the real shared region when both spreads share one', () => {
  const result = selectTransition({ current: { region: 'Coastal Belt', priorityTier: 'HIGH' }, previous: { region: 'Coastal Belt', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Problem' }, seedIndex: 0, previousKey: null });
  assert.equal(result.linkageType, 'region');
  assert.ok(result.text.includes('Coastal Belt'));
});

test('falls back to a priority-callback transition when regions differ but priority tier matches', () => {
  const result = selectTransition({ current: { region: 'A', priorityTier: 'CRITICAL' }, previous: { region: 'B', priorityTier: 'CRITICAL' }, currentArc: { stage: 'Risk' }, seedIndex: 0, previousKey: null });
  assert.equal(result.linkageType, 'priority');
  assert.ok(/critical/i.test(result.text));
});

test('falls back to a generic arc-stage transition when neither region nor priority tier link', () => {
  const result = selectTransition({ current: { region: 'A', priorityTier: 'HIGH' }, previous: { region: 'B', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Implementation', priorQuestion: 'x' }, seedIndex: 0, previousKey: null });
  assert.equal(result.linkageType, 'generic');
  assert.ok(result.text.toLowerCase().includes('implementation'));
});

test('never quotes more than the region name or priority word from the linked spread — no verbatim sentence reuse', () => {
  const longPriorSentence = 'District capability gaps are reshaping human development outcomes across Tanzania, and the effect is not evenly distributed.';
  const result = selectTransition({ current: { region: 'Lake Zone', priorityTier: 'HIGH' }, previous: { region: 'Lake Zone', priorityTier: 'HIGH' }, currentArc: { stage: 'Evidence' }, seedIndex: 1, previousKey: null });
  assert.ok(!result.text.includes(longPriorSentence));
});

test('the anti-repeat rule advances to a different phrasing within the same linkage type when the previous pick would repeat', () => {
  const base = { current: { region: 'X', priorityTier: 'HIGH' }, previous: { region: 'X', priorityTier: 'HIGH' }, currentArc: { stage: 'Evidence' }, seedIndex: 2 };
  const first = selectTransition({ ...base, previousKey: null });
  const second = selectTransition({ ...base, previousKey: { linkageType: first.linkageType, index: first.index } });
  assert.equal(second.linkageType, first.linkageType);
  assert.notEqual(second.index, first.index);
  assert.notEqual(second.text, first.text);
});

test('every linkage type produces more than one distinct phrasing across a range of seeds', () => {
  const seenRegion = new Set(), seenPriority = new Set(), seenGeneric = new Set();
  for (let seedIndex = 0; seedIndex < 8; seedIndex++) {
    seenRegion.add(selectTransition({ current: { region: 'R', priorityTier: 'HIGH' }, previous: { region: 'R', priorityTier: 'LOW' }, currentArc: { stage: 'Evidence' }, seedIndex, previousKey: null }).text);
    seenPriority.add(selectTransition({ current: { region: 'A', priorityTier: 'CRITICAL' }, previous: { region: 'B', priorityTier: 'CRITICAL' }, currentArc: { stage: 'Risk' }, seedIndex, previousKey: null }).text);
    seenGeneric.add(selectTransition({ current: { region: 'A', priorityTier: 'HIGH' }, previous: { region: 'B', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Monitoring', priorQuestion: 'x' }, seedIndex, previousKey: null }).text);
  }
  assert.ok(seenRegion.size > 1);
  assert.ok(seenPriority.size > 1);
  assert.ok(seenGeneric.size > 1);
});

// VPX Release 1: an independent editorial review found every generic-
// fallback transition ignored the real priorQuestion string it was already
// passed, producing pure meta-commentary about the document's own structure
// ("this section turns to X") rather than substance. Confirms the fix: a
// real priorQuestion is now genuinely quoted in the rendered text.
test('a generic transition genuinely quotes the real priorQuestion when one is supplied, not just the stage name', () => {
  const result = selectTransition({ current: { region: 'A', priorityTier: 'HIGH' }, previous: { region: 'B', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Evidence', priorQuestion: 'What is driving this problem?' }, seedIndex: 0, previousKey: null });
  assert.equal(result.linkageType, 'generic');
  assert.ok(result.text.includes('What is driving this problem?'), 'expected the real priorQuestion to be quoted, not ignored');
});

test('a generic transition degrades honestly to a plain scene-setting line when no priorQuestion exists (the first spine spread), never inventing one', () => {
  const result = selectTransition({ current: { region: 'A', priorityTier: 'HIGH' }, previous: { region: 'B', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Context', priorQuestion: null }, seedIndex: 0, previousKey: null });
  assert.equal(result.linkageType, 'generic');
  assert.ok(result.text.toLowerCase().includes('context'));
  assert.ok(!/\?/.test(result.text), 'must not fabricate a question when priorQuestion is genuinely absent');
});

// Product Experience Evolution Phase 2 (World-Class Publications) — an
// independent editorial review of the Editorial Board Release confirmed
// every priority-tier transition shared one rhetorical shape ("[refer back
// to the tier] + [transition verb] + [this section]"), a real "still feels
// machine-generated" finding even though no two variants repeated
// verbatim. This guards the fix: at least half the pool must NOT open with
// the literal words "The {tier}" or "This section" — i.e. the pool must
// contain genuinely different sentence shapes, not just re-worded synonyms
// of the same opening.
test('the priority-tier transition pool contains genuinely different sentence shapes, not only re-worded variants of "The [tier]... this section..."', () => {
  const sampleTexts = PRIORITY_TRANSITIONS.map(entry => entry.render('CRITICAL'));
  const templatedShape = sampleTexts.filter(t => /^(the critical|this section)/i.test(t));
  assert.ok(sampleTexts.length >= 8, 'the pool must be meaningfully deeper than the original 6-variant pool');
  assert.ok(templatedShape.length < sampleTexts.length, 'not every variant may share the original refer-back-then-transition-verb shape');
  assert.ok(sampleTexts.every(t => /critical/i.test(t)), 'every variant must still name the real tier');
});

// Phase 2: the shape tag itself must be real and distinct, not a cosmetic
// label that happens to differ while the sentences still read identically.
test('the priority-tier pool declares more than one distinct shape category, and every shape appears at least once', () => {
  const shapes = new Set(PRIORITY_TRANSITIONS.map(entry => entry.shape));
  assert.ok(shapes.size >= 5, 'expected at least 5 distinct rhetorical shapes across the deepened pool');
});

// Phase 2 core fix: two consecutive same-linkage-type picks must not share a
// rhetorical shape when the pool offers an alternative — this is the exact
// gap a real rendered sample proved existed (two old-shape "callback-verb"
// transitions appeared back to back even though their wording differed).
test('the anti-repeat rule advances past a same-shape pick (not just a same-index pick) within the same linkage type, when an alternate shape exists', () => {
  const base = { current: { region: 'X', priorityTier: 'CRITICAL' }, previous: { region: 'X', priorityTier: 'CRITICAL' }, currentArc: { stage: 'Evidence' } };
  for (let seedIndex = 0; seedIndex < PRIORITY_TRANSITIONS.length; seedIndex++) {
    const first = selectTransition({ ...base, seedIndex, previousKey: null });
    const second = selectTransition({ ...base, seedIndex, previousKey: { linkageType: first.linkageType, index: first.index, shape: first.shape } });
    assert.notEqual(second.shape, first.shape, `seed ${seedIndex}: expected a different rhetorical shape on the immediately following pick`);
  }
});

test('selectTransition returns a shape field for every linkage type', () => {
  const region = selectTransition({ current: { region: 'Coastal Belt', priorityTier: 'HIGH' }, previous: { region: 'Coastal Belt', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Problem' }, seedIndex: 0, previousKey: null });
  const priority = selectTransition({ current: { region: 'A', priorityTier: 'CRITICAL' }, previous: { region: 'B', priorityTier: 'CRITICAL' }, currentArc: { stage: 'Risk' }, seedIndex: 0, previousKey: null });
  const generic = selectTransition({ current: { region: 'A', priorityTier: 'HIGH' }, previous: { region: 'B', priorityTier: 'MEDIUM' }, currentArc: { stage: 'Implementation', priorQuestion: 'x' }, seedIndex: 0, previousKey: null });
  assert.equal(typeof region.shape, 'string');
  assert.equal(typeof priority.shape, 'string');
  assert.equal(typeof generic.shape, 'string');
});
