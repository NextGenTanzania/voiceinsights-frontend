// Publication Experience (PX) Release 4: Publication Memory tests.
// Scoped deliberately narrow: advisory trend analytics only, no persistent
// storage — these tests verify the analytics are honest and never feed
// back into anything on their own (there is nothing here for them to
// mutate; summarizeTrend never alters its inputs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLICATION_MEMORY_VERSION, summarizeTrend, recordAssessment } from '../src/publication-memory.js';

test('the module exports a version constant', () => {
  assert.equal(PUBLICATION_MEMORY_VERSION, 'publication-memory-v1');
});

test('summarizeTrend reports insufficient_history when there is no prior history, rather than fabricating a trend', () => {
  const result = summarizeTrend([], { overall_score: 80, categories: { editorial_quality: 90 } });
  assert.equal(result.has_history, false);
  assert.equal(result.overall_trend, 'insufficient_history');
  assert.deepEqual(result.category_trends, {});
});

test('summarizeTrend classifies improving, declining and stable from real deltas against the most recent prior assessment', () => {
  const history = [{ overall_score: 60, categories: { editorial_quality: 50, typography: 80 } }];
  const improving = summarizeTrend(history, { overall_score: 70, categories: { editorial_quality: 65, typography: 80 } });
  assert.equal(improving.overall_trend, 'improving');
  assert.equal(improving.category_trends.editorial_quality.trend, 'improving');
  assert.equal(improving.category_trends.typography.trend, 'stable');

  const declining = summarizeTrend(history, { overall_score: 40, categories: { editorial_quality: 30, typography: 80 } });
  assert.equal(declining.overall_trend, 'declining');
});

test('summarizeTrend does not mutate its inputs (pure, advisory-only)', () => {
  const history = [{ overall_score: 60, categories: { editorial_quality: 50 } }];
  const newAssessment = { overall_score: 70, categories: { editorial_quality: 60 } };
  const historyCopy = JSON.parse(JSON.stringify(history));
  const assessmentCopy = JSON.parse(JSON.stringify(newAssessment));
  summarizeTrend(history, newAssessment);
  assert.deepEqual(history, historyCopy);
  assert.deepEqual(newAssessment, assessmentCopy);
});

test('recordAssessment appends without mutating the original array and caps at maxHistory', () => {
  const history = [{ overall_score: 1, categories: {} }];
  const next = recordAssessment(history, { overall_score: 2, categories: {} });
  assert.equal(history.length, 1, 'original array must not be mutated');
  assert.equal(next.length, 2);

  let long = [];
  for (let i = 0; i < 60; i++) long = recordAssessment(long, { overall_score: i, categories: {} }, 50);
  assert.equal(long.length, 50);
  assert.equal(long[long.length - 1].overall_score, 59, 'must keep the most recent entries when capping');
});

test('recordAssessment returns the same history unchanged for a null assessment, never fabricating an entry', () => {
  const history = [{ overall_score: 1, categories: {} }];
  assert.equal(recordAssessment(history, null), history);
});
