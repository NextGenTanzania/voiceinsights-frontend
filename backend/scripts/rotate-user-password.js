#!/usr/bin/env node
// backend/scripts/rotate-user-password.js
//
// Incident-response tool: rotates one existing user's password to a
// cryptographically random one-time temporary password, forces a password
// change on next login (must_change_password = 1, enforced server-side in
// src/utils.js requireAuth — see migration 041), and revokes all of that
// user's currently-active sessions so any token issued under the old
// password stops working immediately.
//
// Built for the two admin accounts (kitentya.luth@voiceinsightsafrica.com,
// info@voiceinsightsafrica.com) whose real passwords were committed in
// plaintext to backend/schema.sql — see ../SECURITY_INCIDENT_2026-07-13.md.
// Reusable for any future rotation (compromised account, offboarding, etc).
//
// The generated password is shown ONCE in this terminal and nowhere else —
// not logged, not written to any file, not included in the SQL sent to
// wrangler (the SQL only ever contains the PBKDF2 hash+salt).
//
// Usage:
//   node scripts/rotate-user-password.js --email you@yourorg.com --remote --yes
//
// Without --yes this only prints the plan (no password is generated or
// shown, since none would be applied). Without --remote it targets your
// local dev D1 database instead of production.

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '../src/auth.js';

// Resolve the local devDependency binary directly rather than shelling out
// through npx — avoids Node's shell-argument-escaping footgun entirely.
function resolveWranglerBin() {
  const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const candidate = join(backendRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
  return existsSync(candidate) ? candidate : 'wrangler';
}

function parseArgs(argv) {
  const flags = new Set();
  const kv = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--remote' || arg === '--yes' || arg === '--help') { flags.add(arg.slice(2)); continue; }
    const eq = arg.match(/^--([a-z-]+)=(.*)$/);
    if (eq) { kv[eq[1]] = eq[2]; continue; }
    const bare = arg.match(/^--([a-z-]+)$/);
    if (bare && i + 1 < argv.length) { kv[bare[1]] = argv[++i]; }
  }
  return { flags, kv };
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

// 24 chars drawn from a charset with no ambiguous look-alikes, guaranteed to
// contain at least one lower/upper/digit/symbol by construction.
function generateTemporaryPassword() {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#%^&*-_=+';
  const all = lower + upper + digits + symbols;
  const pick = (charset) => charset[randomBytes(1)[0] % charset.length];
  const required = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 20 }, () => pick(all));
  const chars = [...required, ...rest];
  // shuffle so the required chars aren't always in the first 4 positions
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const { flags, kv } = parseArgs(process.argv.slice(2));

  if (flags.has('help')) {
    console.log(`Usage: node scripts/rotate-user-password.js --email you@yourorg.com [--remote] [--yes]

Rotates the target user's password to a fresh random temporary password,
forces a password change on next login, and revokes their active sessions.
Without --yes: prints the plan only, generates nothing.`);
    return;
  }

  const email = (kv.email || '').trim().toLowerCase();
  const dbName = kv['db-name'] || process.env.DB_NAME || 'voiceinsights-db';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('--email is required and must be a valid email address.');
    process.exitCode = 1;
    return;
  }

  const target = flags.has('remote') ? 'REMOTE (production)' : 'local dev';
  console.log(`Rotate-password plan:`);
  console.log(`  Database: ${dbName} [${target}]`);
  console.log(`  Account:  ${email}`);
  console.log(`  Effect:   new random password, must_change_password = 1, all active sessions revoked`);

  if (!flags.has('yes')) {
    console.log('\nDry run — no password generated, no changes made. Re-run with --yes to apply.');
    if (flags.has('remote')) console.log('This targets the REMOTE (production) database — double-check before adding --yes.');
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const { hash, salt } = await hashPassword(temporaryPassword);

  const sql = `
UPDATE users
SET password_hash = '${hash}', password_salt = '${salt}', must_change_password = 1
WHERE email = '${sqlEscape(email)}';

UPDATE user_sessions
SET status = 'revoked', revoked_at = datetime('now'), revoke_reason = 'credential_rotation'
WHERE status = 'active' AND user_id = (SELECT id FROM users WHERE email = '${sqlEscape(email)}');
`.trim();

  const tmpFile = join(tmpdir(), `via-rotate-password-${randomUUID()}.sql`);
  writeFileSync(tmpFile, sql, { encoding: 'utf8', mode: 0o600 });
  try {
    const wranglerBin = resolveWranglerBin();
    const wranglerArgs = ['d1', 'execute', dbName, ...(flags.has('remote') ? ['--remote'] : []), `--file=${tmpFile}`];
    console.log(`\nRunning: wrangler ${wranglerArgs.join(' ')}`);
    // Windows' wrangler.cmd shim requires shell execution (EINVAL otherwise).
    // Safe here: every arg is built from internal values (db name, our own
    // temp file path, literal flags) — none of it is free-form user input.
    execFileSync(wranglerBin, wranglerArgs, { stdio: 'inherit', shell: wranglerBin.endsWith('.cmd') });
    console.log(`\nDone. ${email}'s password has been rotated and their active sessions revoked.`);
    console.log('\n================ TEMPORARY PASSWORD (shown once) ================');
    console.log(`  ${temporaryPassword}`);
    console.log('===================================================================');
    console.log('Relay this to the account owner through a secure channel now — it will');
    console.log('not be shown again and is not stored anywhere. They must change it via');
    console.log('POST /api/auth/change-password on next login (enforced server-side).');
  } finally {
    unlinkSync(tmpFile);
  }
}

main().catch(err => {
  console.error('rotate-user-password failed:', err.message);
  process.exitCode = 1;
});
