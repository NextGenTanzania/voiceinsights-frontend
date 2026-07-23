// Publication Experience (PX) Release 4: Publication Director tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLICATION_DIRECTOR_VERSION, columnSpansFor, checkWhitespaceRhythm, assessComponentDensity, assessSpreadDensity, reviewSpreadComposition } from '../src/publication-director.js';

test('the module exports a version constant', () => {
  assert.equal(PUBLICATION_DIRECTOR_VERSION, 'publication-director-v1');
});

test('columnSpansFor generalizes the exact decisionCardColumnSpans rule for 1-4 items', () => {
  assert.deepEqual(columnSpansFor(1), [12]);
  assert.deepEqual(columnSpansFor(2), [6, 6]);
  assert.deepEqual(columnSpansFor(3), [12, 6, 6]);
  assert.deepEqual(columnSpansFor(4), [6, 6, 6, 6]);
});

test('columnSpansFor always returns a valid, evenly-divided grid for uncommon counts, never throwing or leaving a gap', () => {
  for (const count of [0, 5, 6, 7, 8, 9, 12]) {
    const spans = columnSpansFor(count);
    assert.equal(spans.length, count);
    for (const span of spans) assert.ok(span > 0 && span <= 12);
  }
});

test('checkWhitespaceRhythm passes a valid 12-column row and flags a span that is too narrow', () => {
  assert.deepEqual(checkWhitespaceRhythm([6, 6]), { balanced: true, issues: [] });
  const result = checkWhitespaceRhythm([2, 10]);
  assert.equal(result.balanced, false);
  assert.ok(result.issues.some(i => i.rule === 'span_too_narrow'));
});

test('checkWhitespaceRhythm flags a row that does not sum to 12', () => {
  const result = checkWhitespaceRhythm([5, 5]);
  assert.equal(result.balanced, false);
  assert.ok(result.issues.some(i => i.rule === 'row_incomplete'));
});

test('assessComponentDensity classifies underfilled, balanced and overfilled using the same thresholds as the editorial validator', () => {
  assert.equal(assessComponentDensity(10, 1).density, 'underfilled');
  assert.equal(assessComponentDensity(200, 2).density, 'balanced');
  assert.equal(assessComponentDensity(500, 1).density, 'overfilled');
});

// EAD Release 1: two independent reviews confirmed estimatedWords is
// frequently disconnected from what a reader actually sees on a rendered
// page — assessComponentDensity's new 3rd parameter lets a caller supply
// the real visibleWords count instead, without breaking the two-number
// call above (still tested unchanged just above this test).
test('assessComponentDensity prefers the real visibleWords over estimatedWords when supplied', () => {
  // estimatedWords alone (12) would read as underfilled; the true rendered
  // content (visibleWords: 346) is comfortably balanced — this is exactly
  // the confirmed Methodology-page gap from the prior review.
  const withTrueWords = assessComponentDensity(12, 2, { visibleWords: 346 });
  assert.equal(withTrueWords.density, 'balanced');
  assert.equal(assessComponentDensity(12, 2).density, 'underfilled', 'without the 3rd argument, behavior must stay exactly as before');
});

test('assessComponentDensity honors a per-spread-type maxWords override', () => {
  // 500 true words would overflow the global 420-word ceiling, but is
  // within Methodology's real, wider allowance.
  const result = assessComponentDensity(0, 2, { visibleWords: 500, maxWords: 700 });
  assert.equal(result.density, 'balanced');
});

test('assessSpreadDensity reads visibleWords and the real per-spread-type ceiling directly off a spread object', () => {
  const thinSpread = { id: 'national-context', estimatedWords: 57, visibleWords: 134, componentCount: 2 };
  assert.equal(assessSpreadDensity(thinSpread).density, 'balanced');
  // Methodology's real override (700) accepts content that would overflow
  // the 420-word global ceiling.
  const denseSpread = { id: 'methodology', estimatedWords: 107, visibleWords: 550, componentCount: 2 };
  assert.equal(assessSpreadDensity(denseSpread).density, 'balanced');
  // The same 550 words on a page with no override still overflows.
  const denseUnknownSpread = { id: 'some-other-page', estimatedWords: 107, visibleWords: 550, componentCount: 2 };
  assert.equal(assessSpreadDensity(denseUnknownSpread).density, 'overfilled');
});

test('reviewSpreadComposition returns a complete, deterministic verdict for a spread with a card grid', () => {
  const spread = { id: 'decisions-a', estimatedWords: 200, componentCount: 2 };
  const review = reviewSpreadComposition(spread, 2);
  assert.equal(review.spread_id, 'decisions-a');
  assert.equal(review.density, 'balanced');
  assert.deepEqual(review.spans, [6, 6]);
  assert.equal(review.rhythm.balanced, true);
});

test('reviewSpreadComposition skips the rhythm check entirely when no card count is given, rather than fabricating one', () => {
  const review = reviewSpreadComposition({ id: 'closing', estimatedWords: 50, componentCount: 1 }, null);
  assert.equal(review.spans, null);
  assert.equal(review.rhythm.balanced, true);
});
