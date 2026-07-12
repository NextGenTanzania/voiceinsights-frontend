// ============================================================
// PLATFORM SECRET VAULT
// ------------------------------------------------------------
// The single, mandatory path for encrypting/decrypting ANY sensitive
// credential platform-wide (DHIS2, Twilio, SMTP, OAuth tokens, org API
// keys, and anything added later). Feature code must never implement
// its own encryption — it calls encryptSecret/decryptSecret here and
// stores the resulting envelope in platform_secrets.
//
// Architecture (frozen scope — see approved design):
//   Master Secret (Workers Secret, versioned: VAULT_MASTER_KEY_V{n})
//     -> HKDF-SHA256(salt = organization_id, info = "org-key:v{n}:{secretType}")
//     -> per-organization, per-secret-type AES-256-GCM key (derived fresh
//        every call, never stored)
//     -> encrypts/decrypts one secret's envelope
//
// Explicitly OUT of scope for this version (deferred to v2.0, per the
// accepted architecture freeze): BYOK/HYOK, external KMS/HSM, FIPS
// validation, SIEM export, hash-chained audit logs, JIT access,
// multi-party authorization, sovereign-cloud pinning, offline escrow.
// ============================================================

export class VaultError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VaultError';
    this.code = code; // KEY_VERSION_UNAVAILABLE | TENANT_MISMATCH | TAMPERED | INVALID_ENVELOPE
  }
}

const ALG = 'AES-GCM-256';
const CURRENT_KEY_VERSION = 1; // bump when introducing VAULT_MASTER_KEY_V2, etc.

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// Derives a per-organization, per-secret-type AES-256-GCM key from the
// versioned Master Secret via HKDF-SHA256 (RFC 5869) — never SHA-256 alone.
// The derived key is computed fresh on every call and never persisted or
// cached in shared state, so there is nothing to leak from memory reuse.
async function deriveOrgKey(env, { organizationId, secretType, version }) {
  const masterSecretName = `VAULT_MASTER_KEY_V${version}`;
  const masterSecret = env[masterSecretName];
  if (!masterSecret) {
    throw new VaultError('KEY_VERSION_UNAVAILABLE', `Master key version ${version} is not configured (${masterSecretName} missing)`);
  }
  const ikm = await crypto.subtle.importKey('raw', new TextEncoder().encode(masterSecret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(organizationId),
      info: new TextEncoder().encode(`org-key:v${version}:${secretType}`),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function audit(env, { organizationId, secretType, operation, outcome, errorCode }) {
  try {
    await env.DB.prepare(
      `INSERT INTO vault_audit_log (id, organization_id, secret_type, operation, outcome, error_code) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), organizationId || null, secretType || null, operation, outcome, errorCode || null).run();
  } catch (e) { /* audit logging must never block the actual crypto operation */ }
}

// ---------- PUBLIC API ----------

export async function encryptSecret(env, { organizationId, secretType, plaintext, version = CURRENT_KEY_VERSION }) {
  try {
    const key = await deriveOrgKey(env, { organizationId, secretType, version });
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    const envelope = {
      v: version,
      alg: ALG,
      org: organizationId,
      iv: bufToBase64(iv),
      ct: bufToBase64(ciphertext),
      created_at: new Date().toISOString(),
    };
    await audit(env, { organizationId, secretType, operation: 'encrypt', outcome: 'success' });
    return envelope;
  } catch (e) {
    await audit(env, { organizationId, secretType, operation: 'encrypt', outcome: 'failure', errorCode: e.code || 'UNKNOWN' });
    throw e;
  }
}

export async function decryptSecret(env, { organizationId, secretType, envelope }) {
  try {
    if (!envelope || typeof envelope !== 'object' || !envelope.iv || !envelope.ct || !envelope.v) {
      throw new VaultError('INVALID_ENVELOPE', 'Envelope is missing required fields');
    }
    // Defense-in-depth: the envelope itself records which org it was
    // encrypted for. Even if a query-layer bug ever fetched the wrong row,
    // this check fails closed before any decryption is attempted.
    if (envelope.org !== organizationId) {
      throw new VaultError('TENANT_MISMATCH', 'Envelope organization does not match the requesting organization');
    }
    const key = await deriveOrgKey(env, { organizationId, secretType, version: envelope.v });
    let plainBuf;
    try {
      plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBuf(envelope.iv) }, key, base64ToBuf(envelope.ct));
    } catch (e) {
      // AES-GCM auth-tag verification failed — either corruption or tampering.
      throw new VaultError('TAMPERED', 'Ciphertext failed authentication — possible corruption or tampering');
    }
    await audit(env, { organizationId, secretType, operation: 'decrypt', outcome: 'success' });
    return new TextDecoder().decode(plainBuf);
  } catch (e) {
    await audit(env, { organizationId, secretType, operation: 'decrypt', outcome: 'failure', errorCode: e.code || 'UNKNOWN' });
    throw e;
  }
}

// Re-wraps a secret under the CURRENT key version. If newPlaintext is
// provided, this also rotates to a genuinely new credential value; if
// omitted, it re-wraps the SAME plaintext under the newer key only.
export async function rotateSecret(env, { organizationId, secretType, envelope, newPlaintext }) {
  const plaintext = newPlaintext ?? await decryptSecret(env, { organizationId, secretType, envelope });
  const newEnvelope = await encryptSecret(env, { organizationId, secretType, plaintext, version: CURRENT_KEY_VERSION });
  await audit(env, { organizationId, secretType, operation: 'rotate', outcome: 'success' });
  return newEnvelope;
}

// Lightweight check: can this envelope currently be decrypted? Used by
// health sweeps — does NOT return the plaintext.
export async function validateSecret(env, { organizationId, secretType, envelope }) {
  try {
    await decryptSecret(env, { organizationId, secretType, envelope });
    await audit(env, { organizationId, secretType, operation: 'validate', outcome: 'success' });
    return true;
  } catch (e) {
    await audit(env, { organizationId, secretType, operation: 'validate', outcome: 'failure', errorCode: e.code || 'UNKNOWN' });
    return false;
  }
}

// The actual migration primitive — moves one envelope from an older key
// version to a newer one. Used by the batch rotation job, never called
// directly from feature endpoints.
export async function reEncryptSecret(env, { organizationId, secretType, envelope, toVersion = CURRENT_KEY_VERSION }) {
  const plaintext = await decryptSecret(env, { organizationId, secretType, envelope });
  return encryptSecret(env, { organizationId, secretType, plaintext, version: toVersion });
}

// ---------- LEGACY MIGRATION ONLY ----------
// Decrypts a Sprint-1 era DHIS2 token (single shared key, raw SHA-256 "KDF",
// format "iv:ciphertext", NOT an envelope). Used exactly once by the
// migration script in index.js to move existing tokens into the real vault.
// Never call this for anything else — it deliberately has none of the
// per-org isolation or tamper-typing the real vault provides.
export async function legacySprintOneDecrypt(env, stored) {
  if (!env.DHIS2_ENCRYPTION_KEY) throw new Error('DHIS2_ENCRYPTION_KEY (legacy) is not configured — cannot migrate old tokens');
  if (!stored || !stored.includes(':')) throw new Error('Not in the legacy encrypted format');
  const [ivB64, ctB64] = stored.split(':');
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.DHIS2_ENCRYPTION_KEY));
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBuf(ivB64) }, key, base64ToBuf(ctB64));
  return new TextDecoder().decode(plainBuf);
}
