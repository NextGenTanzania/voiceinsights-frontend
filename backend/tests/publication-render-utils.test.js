// Publication Render Utils — direct unit tests.
// These primitives were previously only exercised indirectly through
// composer/visual-component tests; PX Release 6 found and fixed a real bug
// in firstSentences (a double space between joined sentences) that no
// existing test caught, so it gets direct coverage here going forward.
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSentences, lastSentence, truncateWords, robustTakeaway, wordCount } from '../src/publication-render-utils.js';

test('firstSentences never inserts a double space when joining 2+ sentences', () => {
  const text = '67%. That is the multidimensional poverty transitions signal recorded in Lake Zone, and the headline figure understates the problem: disaggregated by group, rural women sit well below it.';
  const result = firstSentences(text, 2);
  assert.ok(!result.includes('  '), `expected no double space, got: "${result}"`);
  assert.equal(result, '67%. That is the multidimensional poverty transitions signal recorded in Lake Zone, and the headline figure understates the problem: disaggregated by group, rural women sit well below it.');
});

test('firstSentences returns the trimmed source when there is no sentence-ending punctuation', () => {
  assert.equal(firstSentences('no punctuation here', 1), 'no punctuation here');
});

test('lastSentence returns the final sentence, trimmed', () => {
  const text = 'First sentence. Second sentence. Third and final sentence.';
  assert.equal(lastSentence(text), 'Third and final sentence.');
});

test('truncateWords caps at maxWords with an ellipsis, and passes shorter text through unchanged', () => {
  assert.equal(truncateWords('one two three four five', 3), 'one two three…');
  assert.equal(truncateWords('one two', 5), 'one two');
});

test('robustTakeaway grows past a bare stat fragment like "67%." until it has a real sentence', () => {
  const text = '67%. That is the signal recorded in Lake Zone, and the headline figure understates the problem.';
  const result = robustTakeaway(text, 1);
  assert.ok(result.replace(/[^a-zA-Z]/g, '').length >= 12);
  assert.ok(result.startsWith('67%.'));
  assert.ok(!result.includes('  '), 'robustTakeaway must not reintroduce the double-space defect while growing');
});

test('robustTakeaway leaves an already-substantial first sentence alone', () => {
  const text = 'This is already a perfectly substantial opening sentence. A second sentence follows.';
  assert.equal(robustTakeaway(text, 1), 'This is already a perfectly substantial opening sentence.');
});

test('wordCount counts real words, ignoring extra whitespace', () => {
  assert.equal(wordCount('  one   two three  '), 3);
  assert.equal(wordCount(''), 0);
});
