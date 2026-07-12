# Technical Debt Log

Tracked issues that are non-blocking today but must be addressed before they
become correctness or performance problems. Reviewed at the start of each
Sprint's planning.

---

## TD-001: No retention policy on AI retry logging tables — ✅ FIXED in V212

**Resolution (V212):** `src/ops-cron.js → cleanupOperationalLogs()` now runs on
every Cron tick, deleting a bounded batch (500 rows) older than 90 days from
both tables. Covered by `tests/security-hardening.test.js`.

<details><summary>Original entry</summary>

**Found during:** Task 1.2.2 verification (Q6)
**Tables affected:** `ai_retry_cron_log`, `ai_processing_attempts_log`
**Severity:** Low today, will become Medium as data accumulates

**Detail:** `ai_retry_cron_log` gains one row every Cron tick (currently every
5 minutes — ~288 rows/day, ~105,000/year) regardless of whether there was
anything to process. `ai_processing_attempts_log` gains one row per retry
attempt. Neither table has a DELETE/archival job.

**Not a correctness issue** — the retry processor itself functions
correctly regardless of table size. This is purely an operational/storage
concern that will eventually affect D1 query performance on these tables
(e.g., the Vault/AI Retry Health dashboards' aggregate queries) and storage
cost.

**Recommended fix (deferred to Sprint 1.4 / Operations Hardening):** A
scheduled job that deletes `ai_retry_cron_log` rows older than N days (e.g.,
90) and `ai_processing_attempts_log` rows older than N days, OR archives
them to R2 first if long-term audit retention is required for compliance.

**Action:** Do not fix now. Revisit if these tables are observed to affect
query performance, or by Sprint 1.4 at the latest.

</details>
