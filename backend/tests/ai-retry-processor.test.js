// Run with: node --test tests/ai-retry-processor.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBackoffMinutes, decideNextState, isStaleProcessingClaim, DEFAULT_MAX_RETRY_ATTEMPTS } from '../src/ai-retry-processor.js';

// ---------- Exponential backoff ----------

test('backoff doubles with each attempt: 2, 4, 8, 16, 32 minutes', () => {
  assert.equal(computeBackoffMinutes(1), 2);
  assert.equal(computeBackoffMinutes(2), 4);
  assert.equal(computeBackoffMinutes(3), 8);
  assert.equal(computeBackoffMinutes(4), 16);
  assert.equal(computeBackoffMinutes(5), 32);
});

test('backoff is capped at maxMinutes and never exceeds it', () => {
  assert.equal(computeBackoffMinutes(10, { maxMinutes: 60 }), 60);
  assert.equal(computeBackoffMinutes(3, { baseMinutes: 30, maxMinutes: 60 }), 60); // 30*4=120, capped to 60
});

test('backoff respects a custom base', () => {
  assert.equal(computeBackoffMinutes(1, { baseMinutes: 5 }), 5);
  assert.equal(computeBackoffMinutes(2, { baseMinutes: 5 }), 10);
});

// ---------- Dead-letter decision ----------

test('decideNextState keeps retrying (pending) while under the max attempt ceiling', () => {
  const decision = decideNextState(1, { maxAttempts: 5 });
  assert.equal(decision.status, 'pending');
  assert.ok(decision.nextRetryAt, 'must schedule a next retry time');
});

test('decideNextState transitions to dead-letter exactly at the max attempt ceiling', () => {
  const decision = decideNextState(5, { maxAttempts: 5 });
  assert.equal(decision.status, 'failed_permanently');
  assert.equal(decision.nextRetryAt, null);
});

test('decideNextState never retries again once already at or past the ceiling', () => {
  assert.equal(decideNextState(6, { maxAttempts: 5 }).status, 'failed_permanently');
  assert.equal(decideNextState(100, { maxAttempts: 5 }).status, 'failed_permanently');
});

test('decideNextState default ceiling matches the documented default (5)', () => {
  assert.equal(DEFAULT_MAX_RETRY_ATTEMPTS, 5);
  assert.equal(decideNextState(4).status, 'pending');
  assert.equal(decideNextState(5).status, 'failed_permanently');
});

test('nextRetryAt is always strictly in the future relative to "now"', () => {
  const now = new Date('2026-07-06T12:00:00Z');
  const decision = decideNextState(1, { now });
  assert.ok(new Date(decision.nextRetryAt).getTime() > now.getTime());
});

test('nextRetryAt reflects the exact configured backoff for a given attempt', () => {
  const now = new Date('2026-07-06T12:00:00Z');
  const decision = decideNextState(2, { now, baseBackoffMinutes: 2 }); // attempt 2 -> 4 min
  const expected = new Date(now.getTime() + 4 * 60 * 1000).toISOString();
  assert.equal(decision.nextRetryAt, expected);
});

// ---------- Stale processing-claim detection (Worker-restart recovery) ----------

test('a "processing" row updated just now is NOT considered stale', () => {
  const now = new Date('2026-07-06T12:00:00Z');
  const updatedAt = new Date(now.getTime() - 30 * 1000).toISOString(); // 30s ago
  assert.equal(isStaleProcessingClaim(updatedAt, { now, staleMinutes: 3 }), false);
});

test('a "processing" row untouched for longer than the threshold IS considered stale (safe to reclaim)', () => {
  const now = new Date('2026-07-06T12:00:00Z');
  const updatedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 min ago, threshold is 3
  assert.equal(isStaleProcessingClaim(updatedAt, { now, staleMinutes: 3 }), true);
});

test('staleness check is exact at the boundary (not stale at exactly the threshold)', () => {
  const now = new Date('2026-07-06T12:03:00Z');
  const updatedAt = new Date('2026-07-06T12:00:00Z').toISOString(); // exactly 3 min ago
  assert.equal(isStaleProcessingClaim(updatedAt, { now, staleMinutes: 3 }), false);
});

test('staleness check handles a timestamp already carrying a Z suffix without double-appending', () => {
  const now = new Date('2026-07-06T12:10:00Z');
  const updatedAtWithZ = '2026-07-06T12:00:00Z';
  assert.equal(isStaleProcessingClaim(updatedAtWithZ, { now, staleMinutes: 3 }), true);
});

// ---------- Idempotency-relevant: repeated calls with identical inputs are deterministic ----------

test('computeBackoffMinutes is a pure function — same input always gives same output', () => {
  const results = Array.from({ length: 5 }, () => computeBackoffMinutes(3));
  assert.ok(results.every(r => r === results[0]), 'must be deterministic across repeated calls');
});

test('decideNextState is deterministic given a fixed "now" (needed for reproducible tests and safe retries)', () => {
  const now = new Date('2026-07-06T12:00:00Z');
  const d1 = decideNextState(2, { now });
  const d2 = decideNextState(2, { now });
  assert.deepEqual(d1, d2);
});
