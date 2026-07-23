# Security Incident — Plaintext Admin Credentials in schema.sql

**Status:** source cleaned up on `main`; credential rotation NOT yet executed (requires your explicit go-ahead — see "Rotation" below).
**Discovered:** 2026-07-13/14, during the Production Security Hotfix continuation session.
**Severity:** Critical. Real, currently-valid credentials for two super_admin accounts.

## What was exposed

`backend/schema.sql` — a file executed directly against **production** D1
(`wrangler d1 execute voiceinsights-db --remote --file=./schema.sql`, per the
former `README.md` step 3) — contained, in plaintext SQL comments directly
above matching PBKDF2 hash+salt `INSERT`/`UPDATE` statements:

| Account | Role | Exposure |
|---|---|---|
| `kitentya.luth@voiceinsightsafrica.com` | super_admin | Plaintext password in comment + hash/salt in an `INSERT` **and** a forced `UPDATE ... WHERE id = 'user_demo_admin'` that re-applied this exact password on every schema.sql run |
| `info@voiceinsightsafrica.com` | super_admin | Same pattern (`user_demo_admin_2`) |
| `meofficer@nextgentanzania.com` | me_officer | Plaintext password in comment + hash/salt |

A fourth, unrelated set of stale credentials (`admin@nextgentanzania.com` /
`VoiceInsights2026!`) was found in `README.md`'s old "Load the schema"
section — these don't match any account actually created by schema.sql, so
they appear to be leftover documentation from an earlier version of the seed
block, not a currently-valid account. Removed regardless, out of caution.

No other hardcoded credentials, API keys, or private keys were found anywhere
else in the repository (`wrangler.toml`, `env.preview`, and all other
`.js`/`.sql`/`.toml`/`.md` files were scanned — see "Scan performed" below).

## Exposure window and scope

- This repository's entire history is 20 commits, starting with `4ec63e0`
  ("Initial import: VoiceInsights-Flagship-Publication-Intelligence-v3") at
  **2026-07-13 05:15:40 +0300**. The credential block was present in that
  very first commit — it did not leak later, it was there from the start.
- `git log --oneline -- backend/schema.sql` shows only 3 commits ever touched
  this file: `4ec63e0` (initial import — introduced the block), `fb1f79d`,
  and `f75c1bd` (both unrelated schema additions that didn't touch the
  credential lines — confirmed via `git blame`).
- Exposure window: **2026-07-13 05:15 to present**, all on `main`, pushed to
  `github.com/NextGenTanzania/voiceinsights-app`.
- The repository currently returns `404` from the public (unauthenticated)
  GitHub API, consistent with a **private** repo — this is not a public
  leak, but private-repo access (any collaborator, any leaked PAT/deploy key,
  any compromised CI credential) is still a full compromise of these two
  admin accounts.
- Affected commits (still in history, unchanged — no history rewrite was
  performed, per your instruction): `4ec63e0`, and every commit since, since
  git history is cumulative. `git log --oneline | wc -l` = 20 total commits,
  all of which contain this blob in `backend/schema.sql`'s history.

## What was fixed on `main` (this session)

1. **`backend/schema.sql`** — the entire credential block (plaintext
   comments, hash/salt `INSERT`s, the forced `UPDATE`s) was deleted. Fresh
   installs now create only the demo organization and a default survey — no
   user accounts, no credentials of any kind, ever again in this file.
2. **`backend/README.md`** — step 3 rewritten to point at
   `scripts/bootstrap-admin.js` instead of documenting a hardcoded login.
3. **`backend/scripts/bootstrap-admin.js`** (new) — creates/updates one admin
   account by hashing a password supplied via `ADMIN_EMAIL`/`ADMIN_PASSWORD`
   env vars locally, then applying it via `wrangler d1 execute`. The
   plaintext password never touches disk or git.
4. **`backend/scripts/rotate-user-password.js`** (new) — the actual
   incident-response tool for the two exposed accounts (see "Rotation"
   below): generates a random temporary password, sets
   `must_change_password = 1`, revokes all of that user's active sessions,
   and shows the password exactly once in the terminal.
5. **`backend/migrations/041_must_change_password.sql`** (new) + backend
   enforcement (`src/utils.js` `requireAuth`, `src/application.js` login /
   verify-2fa / change-password) so a temporary rotation password can only be
   used to call `POST /api/auth/change-password` — nothing else — until
   changed.

None of this required rewriting git history, per your instruction. The old
credentials remain visible in past commits.

## Scan performed

Repo-wide grep for common secret shapes (AWS keys, Stripe live/test/webhook
keys, GitHub PATs, Slack tokens, PEM private key headers) and for
`password`/`secret`/`api_key` assigned to a non-placeholder literal, across
`*.js`, `*.sql`, `*.toml`, `*.md`, `*.html`, excluding `node_modules`.

**Result: clean.** The only matches were the now-removed `schema.sql` block
(fixed above) and two categories of false positives, left as-is:
- `tests/security-hardening.test.js`, `tests/publication-gate-route-pilot.test.js`
  — literal `'test-secret'` used as an HMAC key in unit test fixtures. Not a
  real secret, never used outside the test process.
- `site/assets/js/i18n.js` — the translated UI label `"API Key"` in four
  languages (English/French/Portuguese/Swahili). Just a string for a
  settings-page label, not a credential.

`wrangler.toml` and `env.preview` were checked separately and correctly use
`wrangler secret put` for `JWT_SECRET` and friends — no secrets committed
there.

## Rotation plan — action required from you

Both accounts must be treated as fully compromised and rotated. I have not
executed this — you asked for a final explicit confirmation immediately
before the production-changing command, and I have not received one in this
session. When you're ready:

```bash
cd backend
node scripts/rotate-user-password.js --email kitentya.luth@voiceinsightsafrica.com --remote --yes
node scripts/rotate-user-password.js --email info@voiceinsightsafrica.com --remote --yes
node scripts/rotate-user-password.js --email meofficer@nextgentanzania.com --remote --yes
```

Each run:
1. Generates a fresh 24-character random password locally (never logged,
   never written to any file).
2. Hashes it with the same PBKDF2 path the real login uses (`src/auth.js
   hashPassword`) — verified by direct test in this session (`verifyPassword`
   round-trip against a freshly generated hash returned `true`).
3. Applies the new hash + `must_change_password = 1` via `wrangler d1
   execute ... --remote`, and revokes every currently-active session for
   that user (`user_sessions.status = 'revoked'`, `revoke_reason =
   'credential_rotation'`) — any token issued under the old password stops
   working immediately, not just at its natural 7-day expiry.
4. Prints the new temporary password to your terminal **once**. Relay it to
   the account owner over a secure channel (not email/Slack in plaintext,
   not this chat). They must change it via the normal login flow — the
   server now rejects every other request from that account until they do
   (`src/utils.js requireAuth`, enforced from the `mustChangePassword` JWT
   claim, tested in `tests/security-remediation.test.js`).
5. **Before running this**, run without `--yes` first (`node
   scripts/rotate-user-password.js --email ... --remote`) to see the dry-run
   plan with no changes made.

Run these against production only when you're ready to hand the account
owners their new passwords right after.

## Not done, and why

- **Git history rewrite** — explicitly deferred per your instruction. The
  old plaintext/hash values remain recoverable from `git log -p` /
  `git show 4ec63e0` by anyone with repo access, permanently, until history
  is rewritten (`git filter-repo` + force-push) or the repo is recreated.
  Rotating the credentials (above) neutralizes the practical risk even
  though the old values stay visible in history.
- **Actually running the rotation** — needs your `--yes --remote`
  confirmation per account, as above.
