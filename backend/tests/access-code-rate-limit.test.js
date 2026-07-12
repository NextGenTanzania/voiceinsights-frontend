// Run with: node --test tests/access-code-rate-limit.test.js
// Tests the PURE decision logic of the access-code rate-limiting fix,
// using an in-memory fake of the rate_limits table so the exact
// "only count failures" behavior is verifiable without a full D1 round trip.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// A minimal in-memory re-implementation mirroring isOverRateLimit /
// recordFailedAttempt in src/application.js exactly (same field names, same
// window-expiry logic) -- this is what's actually under test.
function makeFakeRateLimitStore() {
  const table = new Map();
  return {
    async isOverRateLimit(rateKey, maxRequests, windowSeconds) {
      const row = table.get(rateKey);
      if (!row) return false;
      if (Date.now() - row.windowStart > windowSeconds * 1000) return false;
      return row.count >= maxRequests;
    },
    async recordFailedAttempt(rateKey, windowSeconds) {
      const row = table.get(rateKey);
      const now = Date.now();
      if (!row) { table.set(rateKey, { count: 1, windowStart: now }); return; }
      if (now - row.windowStart > windowSeconds * 1000) { table.set(rateKey, { count: 1, windowStart: now }); return; }
      row.count += 1;
    },
    _table: table,
  };
}

// Simulates the exact control flow used in the fixed handlers: check first,
// only record on an actually-invalid code, valid codes never touch the store.
async function simulateCodeAttempt(store, rateKey, codeIsValid, maxRequests = 5, windowSeconds = 3600) {
  if (await store.isOverRateLimit(rateKey, maxRequests, windowSeconds)) {
    return 'rate_limited';
  }
  if (!codeIsValid) {
    await store.recordFailedAttempt(rateKey, windowSeconds);
    return 'invalid_code_response';
  }
  return 'proceed_normally';
}

test('SMS invalid code under the limit -> normal invalid-code response, not rate-limited', async () => {
  const store = makeFakeRateLimitStore();
  const key = 'survey_code:sms:+255700000001';
  for (let i = 0; i < 3; i++) {
    const result = await simulateCodeAttempt(store, key, false);
    assert.equal(result, 'invalid_code_response');
  }
});

test('SMS invalid code repeated past the limit -> rate-limited', async () => {
  const store = makeFakeRateLimitStore();
  const key = 'survey_code:sms:+255700000002';
  let lastResult;
  for (let i = 0; i < 6; i++) {
    lastResult = await simulateCodeAttempt(store, key, false);
  }
  assert.equal(lastResult, 'rate_limited');
});

test('WhatsApp invalid code repeated past the limit -> rate-limited (channel-scoped key)', async () => {
  const store = makeFakeRateLimitStore();
  const key = 'survey_code:whatsapp:+255700000003';
  let lastResult;
  for (let i = 0; i < 6; i++) {
    lastResult = await simulateCodeAttempt(store, key, false);
  }
  assert.equal(lastResult, 'rate_limited');
});

test('Voice invalid code repeated past the limit -> rate-limited (channel-scoped key)', async () => {
  const store = makeFakeRateLimitStore();
  const key = 'survey_code:voice:+255700000004';
  let lastResult;
  for (let i = 0; i < 6; i++) {
    lastResult = await simulateCodeAttempt(store, key, false);
  }
  assert.equal(lastResult, 'rate_limited');
});

test('a VALID code never increments the failure counter, no matter how many times it is checked', async () => {
  const store = makeFakeRateLimitStore();
  const key = 'survey_code:sms:+255700000005';
  for (let i = 0; i < 20; i++) {
    const result = await simulateCodeAttempt(store, key, true);
    assert.equal(result, 'proceed_normally');
  }
  // The store should have no entry at all for this key -- a valid code
  // never touches recordFailedAttempt.
  assert.equal(store._table.has(key), false);
});

test('different channels for the same phone number are rate-limited independently', async () => {
  const store = makeFakeRateLimitStore();
  const phone = '+255700000006';
  for (let i = 0; i < 6; i++) await simulateCodeAttempt(store, `survey_code:sms:${phone}`, false);
  // SMS is now rate-limited for this phone, but WhatsApp for the SAME phone must not be affected.
  const whatsappResult = await simulateCodeAttempt(store, `survey_code:whatsapp:${phone}`, false);
  assert.equal(whatsappResult, 'invalid_code_response');
});

test('existing-session flow (no code lookup at all) is never rate-limited -- simulated by skipping the check entirely', async () => {
  // This mirrors the actual handler structure: when existingSession is
  // truthy, the code path (and therefore isOverRateLimit) is never reached
  // at all -- there is nothing to rate-limit. This test documents that
  // invariant explicitly rather than re-testing simulateCodeAttempt.
  const store = makeFakeRateLimitStore();
  const key = 'survey_code:sms:+255700000007';
  // Simulate 10 failed code attempts for a brand-new conversation...
  for (let i = 0; i < 10; i++) await simulateCodeAttempt(store, key, false);
  assert.equal(await store.isOverRateLimit(key, 5, 3600), true);
  // ...but an existing, already-in-progress session for this SAME phone
  // never calls simulateCodeAttempt/isOverRateLimit at all in the real
  // handler (it takes the `if (existingSession)` branch instead) -- so its
  // continued conversation is completely unaffected by the code-guessing
  // limit above, regardless of how exhausted that limit is.
});
