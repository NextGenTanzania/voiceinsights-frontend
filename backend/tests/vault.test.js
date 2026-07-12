// Run with: node --test tests/vault.test.js
// Exercises the actual secret-vault.js module directly (no mocking of the
// crypto itself) — only env.DB (audit logging) is mocked, since audit
// failures are deliberately non-fatal to the crypto operations themselves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, rotateSecret, validateSecret, reEncryptSecret, VaultError } from '../src/secret-vault.js';

// Minimal in-memory "DB" so audit() calls don't throw — real D1 isn't
// available outside the Workers runtime, and audit logging is intentionally
// best-effort (see secret-vault.js), so a no-op stub is a faithful test double.
function fakeEnv(overrides = {}) {
  return {
    VAULT_MASTER_KEY_V1: 'test-master-key-do-not-use-in-production-aaaa1111',
    DB: { prepare: () => ({ bind: () => ({ run: async () => {}, first: async () => null, all: async () => ({ results: [] }) }) }) },
    ...overrides,
  };
}

test('round-trip: encrypt then decrypt returns the original plaintext', async () => {
  const env = fakeEnv();
  const envelope = await encryptSecret(env, { organizationId: 'org_a', secretType: 'dhis2_api_token', plaintext: 'super-secret-token-123' });
  assert.equal(envelope.v, 1);
  assert.equal(envelope.alg, 'AES-GCM-256');
  assert.equal(envelope.org, 'org_a');
  assert.ok(envelope.iv && envelope.ct, 'envelope must contain iv and ct');

  const plaintext = await decryptSecret(env, { organizationId: 'org_a', secretType: 'dhis2_api_token', envelope });
  assert.equal(plaintext, 'super-secret-token-123');
});

test('two encryptions of the same plaintext never produce the same ciphertext (random IV)', async () => {
  const env = fakeEnv();
  const e1 = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'same-value' });
  const e2 = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'same-value' });
  assert.notEqual(e1.iv, e2.iv, 'IV must be fresh every call');
  assert.notEqual(e1.ct, e2.ct, 'ciphertext must differ due to distinct IVs');
});

test('tamper detection: a flipped ciphertext byte fails to decrypt', async () => {
  const env = fakeEnv();
  const envelope = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'do-not-corrupt-me' });
  // Flip a character in the ciphertext to simulate corruption/tampering.
  const corrupted = { ...envelope, ct: envelope.ct.slice(0, -4) + (envelope.ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA') };
  await assert.rejects(
    () => decryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: corrupted }),
    (e) => e instanceof VaultError && e.code === 'TAMPERED'
  );
});

test('cross-tenant isolation: an envelope encrypted for org_a is rejected when read as org_b', async () => {
  const env = fakeEnv();
  const envelope = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'org-a-only' });
  await assert.rejects(
    () => decryptSecret(env, { organizationId: 'org_b', secretType: 'x', envelope }),
    (e) => e instanceof VaultError && e.code === 'TENANT_MISMATCH'
  );
});

test('cross-tenant isolation holds even if org_b is given a hand-edited envelope claiming to be org_b', async () => {
  // This proves isolation comes from the KEY DERIVATION (org_a's derived key
  // cannot produce a validly-authenticated ciphertext for org_b's context),
  // not merely from the org-field label being trusted at face value.
  const env = fakeEnv();
  const envelope = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'org-a-only' });
  const spoofed = { ...envelope, org: 'org_b' }; // attacker relabels the org field
  await assert.rejects(
    () => decryptSecret(env, { organizationId: 'org_b', secretType: 'x', envelope: spoofed }),
    (e) => e instanceof VaultError && e.code === 'TAMPERED' // auth tag fails: org_b's derived key ≠ org_a's derived key
  );
});

test('missing master key version throws KEY_VERSION_UNAVAILABLE, not a generic crash', async () => {
  const env = fakeEnv({ VAULT_MASTER_KEY_V1: undefined });
  await assert.rejects(
    () => encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'x' }),
    (e) => e instanceof VaultError && e.code === 'KEY_VERSION_UNAVAILABLE'
  );
});

test('validateSecret returns true for a healthy envelope and false for a broken one', async () => {
  const env = fakeEnv();
  const good = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'ok' });
  assert.equal(await validateSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: good }), true);

  const broken = { ...good, ct: 'not-valid-base64-ciphertext!!' };
  assert.equal(await validateSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: broken }), false);
});

test('rotateSecret re-wraps the same plaintext under the current version', async () => {
  const env = fakeEnv();
  const original = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'rotate-me' });
  const rotated = await rotateSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: original });
  assert.notEqual(rotated.iv, original.iv, 'rotation must produce a fresh IV');
  const plaintext = await decryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: rotated });
  assert.equal(plaintext, 'rotate-me');
});

test('rotateSecret can also change the underlying credential value', async () => {
  const env = fakeEnv();
  const original = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'old-value' });
  const rotated = await rotateSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: original, newPlaintext: 'new-value' });
  const plaintext = await decryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: rotated });
  assert.equal(plaintext, 'new-value');
});

test('reEncryptSecret (the migration primitive) preserves plaintext across versions', async () => {
  const env = fakeEnv();
  const v1 = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'migrate-me', version: 1 });
  // Simulate a v2 key existing for this test only.
  env.VAULT_MASTER_KEY_V2 = 'a-different-test-key-for-version-2-bbbb2222';
  const v2 = await reEncryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: v1, toVersion: 2 });
  assert.equal(v2.v, 2);
  const plaintext = await decryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: v2 });
  assert.equal(plaintext, 'migrate-me');
});

test('concurrent encrypt/decrypt calls for the same organization do not interfere with each other', async () => {
  const env = fakeEnv();
  const plaintexts = Array.from({ length: 10 }, (_, i) => `secret-${i}`);
  const envelopes = await Promise.all(plaintexts.map(p => encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: p })));
  const decrypted = await Promise.all(envelopes.map(e => decryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: e })));
  assert.deepEqual(decrypted, plaintexts);
});

// ---------- Tests specifically covering the batched-rotation consumption
// pattern added when the single-request rotation was replaced with a
// Cron-driven batch processor (see index.js processNextRotationBatch). ----------

test('reEncryptSecret is safe to call on an envelope already at the target version (rotation batch idempotency)', async () => {
  const env = fakeEnv();
  const envelope = await encryptSecret(env, { organizationId: 'org_a', secretType: 'x', plaintext: 'already-current', version: 1 });
  // The batch processor checks `envelope.v !== job.to_version` before calling
  // reEncryptSecret at all — this test proves that even if it were called
  // anyway, the operation is safe and non-destructive (same plaintext, valid new envelope).
  const reEncrypted = await reEncryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope, toVersion: 1 });
  const plaintext = await decryptSecret(env, { organizationId: 'org_a', secretType: 'x', envelope: reEncrypted });
  assert.equal(plaintext, 'already-current');
});

test('a batch of many different organizations can each be independently re-encrypted without cross-contamination', async () => {
  // Simulates what one rotation batch actually does: many rows, many
  // different organization_ids, processed in a loop — proves no shared
  // mutable state between iterations causes org A's key material to ever
  // leak into org B's re-encryption.
  const env = fakeEnv();
  const orgs = ['org_1', 'org_2', 'org_3', 'org_4', 'org_5'];
  const originals = await Promise.all(orgs.map(org => encryptSecret(env, { organizationId: org, secretType: 'dhis2_api_token', plaintext: `token-for-${org}` })));

  const rotated = [];
  for (let i = 0; i < orgs.length; i++) {
    rotated.push(await reEncryptSecret(env, { organizationId: orgs[i], secretType: 'dhis2_api_token', envelope: originals[i], toVersion: 1 }));
  }

  for (let i = 0; i < orgs.length; i++) {
    const plaintext = await decryptSecret(env, { organizationId: orgs[i], secretType: 'dhis2_api_token', envelope: rotated[i] });
    assert.equal(plaintext, `token-for-${orgs[i]}`, `org ${orgs[i]} must get back exactly its own token, not another org's`);
  }
});
