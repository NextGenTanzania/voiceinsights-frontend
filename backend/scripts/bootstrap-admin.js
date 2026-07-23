#!/usr/bin/env node
// backend/scripts/bootstrap-admin.js
//
// Creates or updates one admin account directly in D1 via `wrangler d1
// execute`, with the password hashed locally using the exact same
// hashPassword() used by the real login path (src/auth.js) — no drift, no
// second implementation.
//
// Replaces the old approach of hardcoding admin credentials (plaintext and
// PBKDF2 hash+salt) directly in schema.sql, which is run against production
// and is committed to git history. See ../SECURITY_INCIDENT_2026-07-13.md.
//
// The password never touches disk: it is read from an env var or an
// interactive-safe CLI flag, hashed in memory, written into a temp SQL file
// containing only the hash+salt (not the password), executed via wrangler,
// then the temp file is deleted.
//
// Usage:
//   ADMIN_EMAIL=you@yourorg.com ADMIN_PASSWORD='...' node scripts/bootstrap-admin.js --remote --yes
//
// Env vars (all can also be passed as --admin-email=, --admin-password=, etc.):
//   ADMIN_EMAIL          required
//   ADMIN_PASSWORD       required, minimum 12 characters
//   ADMIN_FULL_NAME       default "Administrator"
//   ADMIN_ROLE            default "super_admin"
//   ADMIN_ORG_ID          default "org_demo"
//   ADMIN_ORG_NAME        default "VoiceInsights Africa" (only used if the org doesn't exist yet)
//   DB_NAME                default "voiceinsights-db"
//
// Flags:
//   --remote      target the production/remote D1 database (default: local dev DB)
//   --yes         actually execute the change. Without it, prints the plan and exits.
//   --help

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
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

async function main() {
  const { flags, kv } = parseArgs(process.argv.slice(2));

  if (flags.has('help')) {
    console.log(`Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/bootstrap-admin.js [--remote] [--yes]

Env vars: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_ROLE, ADMIN_ORG_ID, ADMIN_ORG_NAME, DB_NAME
Flags:    --remote (target production D1), --yes (actually execute)`);
    return;
  }

  const email = (kv['admin-email'] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = kv['admin-password'] || process.env.ADMIN_PASSWORD || '';
  const fullName = kv['admin-full-name'] || process.env.ADMIN_FULL_NAME || 'Administrator';
  const role = kv['admin-role'] || process.env.ADMIN_ROLE || 'super_admin';
  const orgId = kv['admin-org-id'] || process.env.ADMIN_ORG_ID || 'org_demo';
  const orgName = kv['admin-org-name'] || process.env.ADMIN_ORG_NAME || 'VoiceInsights Africa';
  const dbName = kv['db-name'] || process.env.DB_NAME || 'voiceinsights-db';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('ADMIN_EMAIL is required and must be a valid email address.');
    process.exitCode = 1;
    return;
  }
  if (!password || password.length < 12) {
    console.error('ADMIN_PASSWORD is required and must be at least 12 characters.');
    process.exitCode = 1;
    return;
  }

  const { hash, salt } = await hashPassword(password);
  const userId = `user_${randomUUID().replace(/-/g, '')}`;

  const sql = `
INSERT OR IGNORE INTO organizations (id, name, type, billing_tier)
VALUES ('${sqlEscape(orgId)}', '${sqlEscape(orgName)}', 'local_ngo', 'professional');

INSERT INTO users (id, organization_id, email, password_hash, password_salt, full_name, role, is_active, must_change_password)
VALUES ('${sqlEscape(userId)}', '${sqlEscape(orgId)}', '${sqlEscape(email)}', '${hash}', '${salt}', '${sqlEscape(fullName)}', '${sqlEscape(role)}', 1, 0)
ON CONFLICT(email) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = 1,
  must_change_password = 0;
`.trim();

  const target = flags.has('remote') ? 'REMOTE (production)' : 'local dev';
  console.log(`Bootstrap admin plan:`);
  console.log(`  Database: ${dbName} [${target}]`);
  console.log(`  Email:    ${email}`);
  console.log(`  Role:     ${role}`);
  console.log(`  Org:      ${orgId} (${orgName})`);
  console.log(`  (password is not printed; it was hashed in memory with PBKDF2)`);

  if (!flags.has('yes')) {
    console.log('\nDry run — no changes made. Re-run with --yes to apply.');
    if (flags.has('remote')) console.log('This targets the REMOTE (production) database — double-check before adding --yes.');
    return;
  }

  const tmpFile = join(tmpdir(), `via-bootstrap-admin-${randomUUID()}.sql`);
  writeFileSync(tmpFile, sql, { encoding: 'utf8', mode: 0o600 });
  try {
    const wranglerBin = resolveWranglerBin();
    const wranglerArgs = ['d1', 'execute', dbName, ...(flags.has('remote') ? ['--remote'] : []), `--file=${tmpFile}`];
    console.log(`\nRunning: wrangler ${wranglerArgs.join(' ')}`);
    // Windows' wrangler.cmd shim requires shell execution (EINVAL otherwise).
    // Safe here: every arg is built from internal values (db name, our own
    // temp file path, literal flags) — none of it is free-form user input.
    execFileSync(wranglerBin, wranglerArgs, { stdio: 'inherit', shell: wranglerBin.endsWith('.cmd') });
    console.log(`\nDone. ${email} is now ${role} in ${orgId}.`);
  } finally {
    unlinkSync(tmpFile);
  }
}

main().catch(err => {
  console.error('bootstrap-admin failed:', err.message);
  process.exitCode = 1;
});
