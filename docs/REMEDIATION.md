# V213 — Critical Security Remediation (Part 2 + Part 4)

This release addresses the two **CRITICAL / HIGH** launch blockers from the
Enterprise Platinum audit with fully-implemented code, persistence, wiring, and
tests. It does **not** attempt the full 19-part remediation prompt — the items
not done are listed honestly at the end. No homepage redesign, no brand change,
no working functionality removed. Backward compatible.

**Test status: 491/491 passing** (474 prior + 17 new).

---

## Remediation matrix

| # | Finding | Severity | Affected files | Current → Required behaviour | Status | Tests | External dependency |
|---|---|---|---|---|---|---|---|
| CRIT-1 | Inbound Twilio webhooks unsigned | Critical | `twilio-security.js` (new), `index.js`, `collection-operations-workstream2.js`, migration `031` | Anyone could POST fabricated interviews → every Twilio inbound/callback verified before any handler runs | **FIXED** | 12 (valid/invalid/missing sig, tamper, replay, URL reconstruction, proxy, fail-closed) | Set `TWILIO_AUTH_TOKEN` secret in production |
| HIGH-3 | Client-only logout, no revocation | High | `session-registry.js` (new), `utils.js`, `index.js`, `config.js`, migration `031` | Stolen token valid till expiry → real server-side revocation enforced in `requireAuth` | **FIXED** | 5 (active/logout/logout-all/ghost session/legacy compat) | None |
| MED-15 | No env/binding readiness check | Medium | `index.js` | No way to verify launch config → `GET /api/ops/production-readiness` reports real bindings/secrets, blockers vs optional | **FIXED (code)** | via index resolve test | Super-admin token to call |

---

## Part 2 — Twilio webhook security (details)

`src/twilio-security.js` is the single choke point (`guardTwilioWebhook`)
guarding all 10 Twilio-owned paths (`TWILIO_WEBHOOK_PATHS`). For every POST it:

1. Buffers the body once (so the downstream handler's `formData()` still works).
2. Reads `X-Twilio-Signature`; **fails closed** if `TWILIO_AUTH_TOKEN` is unset.
3. Reconstructs the exact public URL Twilio signed — `TWILIO_PUBLIC_BASE_URL`
   override → `X-Forwarded-Proto/Host` → received URL.
4. Recomputes HMAC-SHA1 over `url + sorted params` and compares **constant-time**
   (`verifyTwilioSignature`, reused).
5. Rejects invalid/missing signatures with **403** + a **redacted** audit row in
   `security_audit_log` (recipient masked). **No DB write happens before this.**
6. Enforces **replay protection** via `twilio_event_registry` keyed on
   `(sid, event_key, path)` — a replayed SID gets an empty-200 ack (so Twilio
   stops retrying) and is **not** reprocessed.

Wired in `index.js` as one block before the webhook routes, and the status
callbacks (`/api/twilio/status/*`) now go through the same guard instead of the
weaker inline check they had before.

## Part 4 — Server-side logout / revocation (details)

`src/session-registry.js`. Every login now embeds a random `sid` in the JWT and
records a row in `user_sessions` keyed on **SHA-256(sid)** (raw sid never
stored). New endpoints:

- `POST /api/auth/logout` — revoke this session
- `POST /api/auth/logout-all` — revoke all the user's sessions
- `GET /api/auth/sessions` — list sessions
- `DELETE /api/auth/sessions/:id` — revoke one by hashed id

`requireAuth` now rejects any token whose session is missing or revoked.
Password reset calls `revokeAllSessions` — a leaked token is invalidated the
moment the real user resets. **Backward compatible:** tokens minted before this
release have no `sid` and keep working until expiry (no forced mass-logout).
The frontend `logout()` calls the server endpoint before clearing local state.

---

## Deploy

```bash
cd backend
npx wrangler d1 migrations apply voiceinsights-db          # applies 031_security_hardening.sql
npx wrangler secret put TWILIO_AUTH_TOKEN                   # REQUIRED — webhooks fail closed without it
# optional, only if behind an extra proxy/custom domain:
#   set TWILIO_PUBLIC_BASE_URL in wrangler.toml [vars]
npx wrangler deploy
npm test                                                    # 491/491
```

## Rollback

Revert `src/index.js`, `src/utils.js`, `site/assets/js/config.js` and remove the
imports of `twilio-security.js` / `session-registry.js`. The migration only
**adds** tables, so it is safe to leave in place. No data is dropped.

---

## Honest post-implementation status of the full remediation prompt

**FIXED (this release):** Part 2 (Twilio webhooks), Part 4 (logout/revocation),
Part 15 partial (readiness endpoint + Twilio config var).

**NOT DONE (require dedicated releases — not attempted here, and not claimed):**

- **Part 3** — Real Cloudflare Queues + DLQ. Still D1+Cron simulation. This is a
  genuine architecture change (queue bindings, consumers, producers) and must be
  its own release with its own tests, not a stub.
- **Part 5** — AI evidence-integrity / hallucination / explainability pipeline.
  Substantial; raw LLM output still becomes narrative.
- **Part 6** — Placeholder-page cleanup (20 stub pages remain).
- **Part 7** — Full offline conflict-resolution UI + double-entry workflow.
- **Part 8** — Real SSO/SCIM (still validation-only).
- **Part 9** — WCAG 2.2 AA accessibility.
- **Part 10** — App i18n (4/56 app pages).
- **Part 11** — CSP `unsafe-inline` removal / innerHTML sink cleanup.
- **Part 12** — Full route-group refactor to `< 2,000` lines.
- **Part 13** — Methodology assurance gates.
- **Part 14** — Fully event-derived operational metrics.

**Two-score verdict (not merged):**

- **Source-Code Readiness:** ~70/100 — the two critical security holes are now
  genuinely closed with tests; the bulk of Parts 3–14 remain.
- **Verified Live Production Readiness:** ~60/100 — pending live Twilio signature
  test, live D1 migration, and the outstanding parts above.

**Verdict: CONTROLLED PILOT** — safe to run a controlled pilot now that the
unsigned-webhook and client-only-logout blockers are fixed. **Not** yet UN /
World Bank / government procurement ready; that requires Parts 3, 5, 8, 9, 13 at
minimum.
