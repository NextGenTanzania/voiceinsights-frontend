# Production Security Incident Response + Auth Hotfix — Deployment

Continues from commit `bf1e778`. Scope: the two production issues in the
handover only (plaintext credentials in `schema.sql`; missing
`user_sessions.expires_at`). No Report Engine, AI, or UI work included.

## Execution record (2026-07-14, production)

Deployed commit: `5ad0cfb`.

- **Backup**: full D1 export (`wrangler d1 export --remote`) taken before any
  write, plus a Time Travel bookmark as the durable restore point:
  `000007f2-0000000c-000050a8-927275b7a7a9507b6c6209c4ebc3ea85`
  (pre-migration bookmark was `000007f1-00000008-000050a8-554fb1569d8aabca9cb1edb6ee5c0259`
  — use that one to restore to the exact instant before migrations 040/041).
- **Migrations 040 + 041**: applied via `wrangler d1 execute --remote --file=...`,
  in that order. Verified post-apply: `user_sessions.expires_at` and
  `users.must_change_password` both present; the 1 pre-existing session row
  kept `status='active'`/`expires_at=NULL` (safe default, not force-logged-out);
  all 4 existing users kept `must_change_password=0` at this point; table
  count unaffected (the raw +2 vs. `wrangler d1 info`'s reported count is
  `d1_migrations` + `sqlite_sequence`, both pre-existing internal tables, not
  new).
- **Worker deploy**: `wrangler deploy` at 2026-07-14T08:13:58Z UTC. **Version
  ID `03a515e6-cd61-47a1-89b2-f5222417b16c`**, previous version was
  `db368863-4c2e-44d7-945b-0e4300b0b0bf` (2026-07-13T00:01:58Z) — that's the
  rollback target.
- **Credential rotation**: executed by the operator directly (not through
  this session, by design — see "Credential rotation execution" below) for
  all 3 incident accounts (`kitentya.luth@voiceinsightsafrica.com`,
  `info@voiceinsightsafrica.com`, `meofficer@nextgentanzania.com`). Verified
  read-only afterward: all 3 now have `must_change_password=1`; all 3
  password hashes no longer match their old (git-history-exposed) values;
  the 2 old plaintext passwords documented in the incident report (for
  `kitentya.luth` and `meofficer` — `info@`'s plaintext was never in a
  comment, only its hash) both now return `401` on login; the one active
  session that existed was revoked (`reason=credential_rotation`) — 0 active
  sessions remain anywhere in production.
- **Smoke tests actually run**: `/api/health` → 200 operational; both known
  old passwords → 401; the exact query that used to throw
  `no such column: expires_at` now returns a clean empty result set; live
  `wrangler tail` during a real request showed no errors/exceptions.
- **Smoke tests NOT run, and why**: login-as-rotated-admin,
  forced-password-change, report generation by role, and Enterprise Report
  Studio's authenticated calls all need a valid session — deliberately not
  something this session ever holds (the whole point of routing rotation
  through the operator's own terminal). These need the account owner to log
  in once with their new temporary password; state can then be verified
  read-only afterward (`must_change_password` clearing, a fresh session row
  with real `expires_at`, etc.).
- **Audit log gap found**: neither the rotation script (raw SQL, bypasses
  the Worker) nor the app's own existing `/api/auth/logout-all` path calls
  `logAudit()` — there is no `audit_logs` row for password rotation or
  session revocation today, only for `login`/`report_generated`-style
  events. Not fixed in this hotfix (out of the stated scope); flagged as a
  follow-up.

## Credential rotation execution

`scripts/rotate-user-password.js` prints its one-time temporary password to
stdout by design, for a human running it in their own terminal. Executing it
through an AI coding session's tool output would put that password into the
session transcript — exactly the exposure this hotfix exists to prevent. For
that reason, the actual `--yes --remote` rotation commands were run by the
operator directly, outside this session; only read-only verification queries
were run here afterward.

## Files changed

- `backend/schema.sql` — removed the plaintext-credential seed block;
  added `users.must_change_password` and `user_sessions.expires_at` columns
  so a fresh install matches a fully-migrated database.
- `backend/README.md` — step 3 now points at `bootstrap-admin.js` instead of
  documenting a hardcoded login.
- `backend/migrations/040_user_sessions_expires_at.sql` (new)
- `backend/migrations/041_must_change_password.sql` (new)
- `backend/src/auth.js` — exported `SESSION_TOKEN_TTL_SECONDS` (was an
  inline default-parameter magic number) so the token's real expiry and the
  session row's `expires_at` can never drift apart.
- `backend/src/session-registry.js` — `registerSession()` now writes
  `expires_at` (previously never written, even before the column existed).
- `backend/src/application.js` — login and verify-2fa now compute and pass
  `expiresAt`, embed a `mustChangePassword` JWT claim, and return
  `must_change_password` in the response body; `change-password` now clears
  the flag.
- `backend/src/utils.js` — `requireAuth()` now rejects (403) any request
  from a `mustChangePassword` token except `change-password`, `me`, and
  `logout`.
- `backend/scripts/bootstrap-admin.js` (new) — env-var-driven admin
  creation, no credentials ever written to a file.
- `backend/scripts/rotate-user-password.js` (new) — incident-response
  rotation tool (random temp password, forced change, session revocation).
- `backend/tests/security-remediation.test.js` — 5 new regression tests
  (expiry-based revocation, `mustChangePassword` gate).
- `backend/SECURITY_INCIDENT_2026-07-13.md` (new) — exposure report +
  rotation plan.

## Root cause summary

**Plaintext credentials:** `schema.sql` is executed directly against
production (`wrangler d1 execute --remote`). Whoever wrote the initial seed
data put real admin plaintext passwords in comments next to the matching
hash, and a forced `UPDATE` that re-applied them on every re-run. Present
since the repository's first commit (`4ec63e0`, 2026-07-13). Full detail and
rotation steps: `SECURITY_INCIDENT_2026-07-13.md`.

**Missing `expires_at`:** migration `031_security_hardening.sql` created
`user_sessions` without it; `session-registry.js`'s `isSessionRevoked()` —
called from `requireAuth()` on every authenticated request — has always
selected it anyway. On real D1 this is a hard SQL error, caught in
`utils.js` and turned into a `503 Authentication service is temporarily
unavailable` for **every** request bearing a session-id token (i.e. anyone
who has logged in since session revocation shipped). Masked in tests because
`security-remediation.test.js`'s mock DB matched queries by regex, not real
schema — new tests close that gap.

## Schema.sql vs. migrations audit (requested, objective 7)

- 27 tables are defined in **both** `schema.sql` and at least one migration
  file (all via `CREATE TABLE IF NOT EXISTS`, so no runtime conflict — the
  first one to run wins, the second is a no-op). Checked every one of these
  for a migration that `ALTER TABLE`s a column onto a table schema.sql also
  defines: only `user_sessions.expires_at` (this hotfix) was actually
  drifted. `generated_reports` and `publication_gate_evaluations` (migration
  039's `ALTER TABLE`s) were already correctly reflected in `schema.sql` —
  no action needed there.
- **47 tables exist only in migrations, not in `schema.sql`** (e.g.
  `executive_approval_requests`, `queue_jobs`, `evidence_registry`,
  `ai_model_registry`, and 43 others — full list generated via `comm -23` on
  this session's scratch output, not repeated here). `schema.sql` is a
  point-in-time base snapshot, not a live-regenerated full schema.
  **`README.md` never told a fresh deployer to run the migration files at
  all** — only `schema.sql`. A deploy that followed the README literally
  would be missing all 47 tables' worth of functionality. Added to the
  deployment checklist below as an explicit step. Did **not** attempt to
  consolidate `schema.sql` into a single complete snapshot — that's a larger
  restructuring effort, out of scope for this hotfix, and risks its own
  drift bugs if done under time pressure. Flagged here as a real follow-up
  item, not fixed.

## Tests executed

```
cd backend
node --test tests/*.test.js
```
Result: **643/643 passing** (638 pre-existing + 5 new in
`security-remediation.test.js`). No existing test needed a behavior change —
all new coverage is additive.

Also manually verified (this sandbox's local `workerd` runtime crashes on
nested `Node → wrangler → workerd` spawns — see "Known limitation" below, so
this was done by generating the exact SQL each script produces and running
it through `wrangler d1 execute` directly against a local dev D1):
- `bootstrap-admin.js`'s generated hash round-trips correctly through the
  real `verifyPassword()` used by `/api/auth/login`.
- `rotate-user-password.js`'s generated `UPDATE` sets `must_change_password
  = 1` and correctly revokes a seeded active session
  (`status='revoked'`, `revoke_reason='credential_rotation'`).

### Known limitation of this verification

`bootstrap-admin.js` / `rotate-user-password.js` invoke `wrangler d1
execute` via `child_process.execFileSync`. In this sandboxed session, that
specific nesting (this agent's shell → Node → wrangler → workerd) crashes
the local `workerd` binary (`std::terminate() called with no exception`) —
the *same* `wrangler d1 execute` command run directly in the shell works
fine, and the SQL both scripts generate was verified correct that way (see
above). This looks like a sandbox process-nesting limit, not a script bug,
but **run one dry-run and one real `--yes` invocation of each script
yourself, against your local dev DB, before relying on them against
production** — I could not fully exercise the actual subprocess path
end-to-end here.

## Production impact of NOT deploying this

- Every authenticated API request currently 503s for any user whose session
  carries a `sid` claim (i.e. everyone who has logged in since server-side
  session revocation shipped), because of the missing `expires_at` column.
  This is very likely already visibly broken in production right now.
- Two real super_admin accounts' passwords remain exposed in git history
  until you run the rotation commands in `SECURITY_INCIDENT_2026-07-13.md`.

## Deployment checklist

1. `cd backend && node --test tests/*.test.js` — confirm 643/643.
2. `wrangler deploy --dry-run --outdir .wrangler-dry-run` (existing
   `npm run check:deploy`) — confirm the Worker still builds/binds cleanly
   with the new imports (`SESSION_TOKEN_TTL_SECONDS`, updated
   `session-registry.js` signature).
3. Apply the two new migrations to production, **in order**, before
   deploying the Worker code that depends on them:
   ```bash
   wrangler d1 execute voiceinsights-db --remote --file=./migrations/040_user_sessions_expires_at.sql
   wrangler d1 execute voiceinsights-db --remote --file=./migrations/041_must_change_password.sql
   ```
   (If any earlier migrations, 021–039, were never applied to this
   production database, apply those first, in order, or the app will be
   missing the 47 tables noted above.)
4. `wrangler deploy` — ships the `application.js`/`utils.js`/
   `session-registry.js`/`auth.js` changes. Existing active sessions are
   unaffected (their `expires_at` will be `NULL` until they next log in;
   `isSessionRevoked()` only enforces `expires_at` when it's set, so this is
   backward compatible, not a mass logout).
5. Smoke-test immediately: log in as a real (non-rotated) account, confirm
   `GET /api/dashboard/stats` (or any authenticated route) returns 200, not
   503. This is the single most important check — it's the exact failure
   mode being fixed.
6. Only after step 5 passes: run the credential rotation from
   `SECURITY_INCIDENT_2026-07-13.md` for the three exposed accounts, with
   your explicit `--yes --remote` confirmation for each.
7. Confirm each rotated account can no longer use its old password, and that
   the new temporary password works but is restricted to
   `POST /api/auth/change-password` until changed (try `GET /api/auth/me`
   before changing — should also work per the allowlist; try
   `GET /api/dashboard/stats` before changing — should 403).

## Rollback procedure

The Worker code and the migrations are independently revertible; do the
Worker first if you need to roll back quickly.

**Worker code only** (keeps the new columns, just stops using them):
```bash
git revert <hotfix-merge-commit>   # or: wrangler rollback (previous deployment)
wrangler deploy
```
Safe at any time — `expires_at`/`must_change_password` being present but
unused by older code is harmless (older code never selected them).

**Migrations** (only if the new columns themselves are suspected of causing
harm, which is unlikely — `ALTER TABLE ADD COLUMN` is additive and
non-destructive in SQLite/D1):
```sql
-- D1/SQLite has no DROP COLUMN before recent versions; if needed, this is a
-- table rebuild, not a single statement. Do not do this reactively — file
-- format compatibility and any code still reading the old shape must be
-- checked first. Prefer rolling back the Worker code instead.
```
In practice: rolling back the Worker deployment (previous step) is the real
rollback lever. The schema changes are additive and were designed to be
backward compatible with the pre-hotfix Worker code (a session row with
`expires_at IS NULL` behaves exactly as it did before this column existed —
see `isSessionRevoked()`'s `if (row.expires_at && ...)` guard).

**schema.sql credential removal** — not revertible by design, and should
never be reverted: it removed a live production security hole. If a fresh
install needs a bootstrap account, use `scripts/bootstrap-admin.js`.
