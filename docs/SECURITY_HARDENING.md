# V212 — Security Hardening & Maintainability Release

No product behavior changed. No page changed visually. All 474 tests pass.

## 1. CORS wildcard removed (was: `Access-Control-Allow-Origin: *`)

Every API response now passes through `src/security-layer.js → applyCorsPolicy()`:

- Allowed origins: `SITE_URL` (+ its `www.` variant) and anything listed in the
  new `ALLOWED_ORIGINS` var (comma-separated exact origins).
- Dev convenience: `localhost`, `127.0.0.1`, `*.pages.dev`, `*.workers.dev`
  stay allowed **until** you set `STRICT_CORS = "true"`.
- Requests with no `Origin` header (Twilio, Stripe, curl, API-key calls) are
  unaffected — CORS only governs browsers.
- All API responses now carry `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: strict-origin-when-cross-origin`, plus `Vary: Origin`.

### Production step (do this at go-live)
```toml
# wrangler.toml [vars]
ALLOWED_ORIGINS = "https://voiceinsightsafrica.com,https://www.voiceinsightsafrica.com"
STRICT_CORS = "true"
```

## 2. Query-string tokens restricted

`?token=` used to be accepted on **every** route — tokens leak into logs,
browser history and Referer headers. It is now accepted **only** on the three
route families that genuinely cannot send an Authorization header
(`<audio src>` / `<img src>` / direct document links):

- `/api/audio/*`
- `/api/photos/*`
- `/api/documents/*`

Everything else must use `Authorization: Bearer …` (which the frontend
already does — no frontend change was needed).

## 3. Site-wide security headers (`site/headers`)

Added for every page, with zero visual change:

- `Content-Security-Policy` — `script-src` locked to `'self'` + the two CDNs
  actually in use (`unpkg.com`, `cdn.jsdelivr.net`). An attacker exploiting an
  `innerHTML` sink can no longer load a script from an arbitrary host.
  (`'unsafe-inline'` remains because pages use inline scripts — removing it is
  the next hardening stage; see Remaining work.)
- `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` (camera off, mic/geo self-only).

## 4. TD-001 closed — operational log retention

`src/ops-cron.js → cleanupOperationalLogs()` runs on every Cron tick and
deletes one bounded batch (500 rows) of `ai_retry_cron_log` /
`ai_processing_attempts_log` rows older than 90 days. It can never run long,
never lock tables, and never break the tick (failures are reported, not thrown).

## 5. Maintainability refactor of the monolith

`index.js`: **7,319 → 5,947 lines**. Extracted into purpose-named modules
(behavior unchanged, verified by the full suite):

| New module | Contents |
|---|---|
| `request-scope.js` | org/campaign scoping, rate limiting, audit log |
| `notifications.js` | web-push + email |
| `channel-pipeline.js` | Voice/WhatsApp/SMS/web session pipeline, Twilio helpers, fraud scoring |
| `billing-export.js` | Stripe checkout/webhook, CSV export |
| `ops-cron.js` | all Cron work + new retention cleanup |
| `security-layer.js` | CORS allowlist + security headers |

Plus `docs/ARCHITECTURE_MAP.md` — module map, request lifecycle, and a full
inventory of all 258 routes with their line numbers in `index.js`.

## 6. Tests

New `tests/security-hardening.test.js` (18 tests): CORS allow/deny/strict
matrix, query-token accept/reject per route family, retention cleanup SQL +
failure isolation, and a module-graph resolution test that imports the entire
`index.js` — any broken import anywhere in the tree now fails CI.

**Suite total: 474 tests, 474 pass, 0 fail.**

## Remaining work (next stage, not blocking)

1. Continue splitting `handleRequest()` route groups out of `index.js`
   (target: < 2,000 lines) — do it one route family at a time, running the
   suite after each move.
2. Move inline `<script>` blocks into `/assets/js/` files so
   `'unsafe-inline'` can be dropped from the CSP.
3. Consider httpOnly cookie sessions to take the JWT out of `localStorage`
   (requires coordinated frontend + backend change — a system change, so
   deliberately excluded from V212).
