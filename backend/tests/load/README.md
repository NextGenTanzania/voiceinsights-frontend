# Load Testing — VoiceInsights Africa

## Scripts

| Script | Tests |
|---|---|
| `tests/load/sms-webhook.js` | SMS webhook (inbound survey response) |
| `tests/load/public-api.js` | Public External Ingestion API |
| `tests/load/web-submit.js` | Web survey submission (routing/auth/D1 path — not real transcription) |
| `tests/load/dashboard-stats.js` | Admin Dashboard Stats (read-heavy) |
| `tests/load/ai-retry-backlog.js` | AI Retry Queue backlog-drain throughput |

## How to Run

Against **local wrangler dev** (code-correctness / local-process baseline only — see caveat below):
```bash
wrangler d1 execute voiceinsights-db --local --file=./schema.sql
wrangler d1 execute voiceinsights-db --local --file=./tests/e2e-seed.sql
wrangler dev --local --port 8799 &

node tests/load/sms-webhook.js 50 5 http://localhost:8799
node tests/load/dashboard-stats.js 50 5 http://localhost:8799 <admin_jwt>
node tests/load/public-api.js 50 5 http://localhost:8799 <api_key>
```
Arguments are always: `<concurrency> <duration_seconds> <base_url> [extra]`.

Against **real staging** (the numbers that actually matter for a capacity claim): identical commands, just point `base_url` at your staging Workers URL, using real seeded staging data and a real staging JWT/API key.

## ⚠️ Critical Caveat — Read Before Trusting Any Number Below

**Local `wrangler dev --local` runs as a single Node process against a single local SQLite file.** It is fundamentally *not* the same system as production Cloudflare Workers (globally distributed edge compute) + production D1 (Cloudflare's distributed SQLite). Numbers measured here tell you the code has no concurrency bugs and behaves predictably under load — they do **not** tell you real production throughput or latency. **Re-run these exact scripts against a real staging deployment before making any capacity claim to a client.**

## Measured Baseline (Local Only)

| Test | Concurrency | Requests (5s) | Median Latency | p97.5 | Errors |
|---|---|---|---|---|---|
| SMS webhook | 50 | 274 | 1046ms | 1650ms | 0 |
| SMS webhook | 100 | 385 (302 sampled) | 1386ms | 2538ms | 0 |
| Dashboard stats | 50 | 507 | 532ms | 725ms | 0 |

**0% error rate at every tier tested.** Latency degrades under concurrency (expected for a single local process) but the system never failed, timed out, or returned an error — it simply got slower, which is the correct, safe failure mode.

## Why 500 / 1000 Concurrency Were Not Run Locally
A single local Node process handling 500-1000 concurrent connections against one SQLite file would primarily measure Node's/SQLite's single-machine ceiling — not anything about the real platform's distributed production capacity. Running it here would produce a number that looks alarming but means nothing real. These tiers should be run directly against staging.
