// ============================================================
// AI RETRY PROCESSOR — Sprint 1.2, Task 1.2.2
// ------------------------------------------------------------
// Drains ai_processing_queue reliably: exponential backoff, a configurable
// max-retry ceiling before dead-lettering, atomic claiming so overlapping
// Cron executions can never double-process the same row, and stale-claim
// reclaim so a Worker that died mid-processing doesn't strand a row forever.
//
// Pure decision logic (backoff timing, dead-letter threshold, staleness
// check) lives here with NO D1 dependency, specifically so it can be unit
// tested directly — the D1-dependent orchestration wraps these.
// ============================================================

export const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
export const DEFAULT_BASE_BACKOFF_MINUTES = 2;
export const DEFAULT_MAX_BACKOFF_MINUTES = 60;
export const STALE_PROCESSING_MINUTES = 3; // a row "processing" longer than this is assumed abandoned (Worker died mid-attempt)

// Exponential backoff: 2, 4, 8, 16, 32... minutes, capped. Pure function —
// no I/O, fully deterministic, directly unit-testable.
export function computeBackoffMinutes(attemptNumber, { baseMinutes = DEFAULT_BASE_BACKOFF_MINUTES, maxMinutes = DEFAULT_MAX_BACKOFF_MINUTES } = {}) {
  const minutes = baseMinutes * Math.pow(2, Math.max(0, attemptNumber - 1));
  return Math.min(minutes, maxMinutes);
}

// Decides the next state for a queue row after a failed attempt. Pure
// function — given the same inputs, always the same decision, independent
// of wall-clock time (the caller supplies "now").
export function decideNextState(attempts, { maxAttempts = DEFAULT_MAX_RETRY_ATTEMPTS, baseBackoffMinutes = DEFAULT_BASE_BACKOFF_MINUTES, maxBackoffMinutes = DEFAULT_MAX_BACKOFF_MINUTES, now = new Date() } = {}) {
  if (attempts >= maxAttempts) {
    return { status: 'failed_permanently', nextRetryAt: null };
  }
  const backoffMinutes = computeBackoffMinutes(attempts, { baseMinutes: baseBackoffMinutes, maxMinutes: maxBackoffMinutes });
  const nextRetryAt = new Date(now.getTime() + backoffMinutes * 60 * 1000);
  return { status: 'pending', nextRetryAt: nextRetryAt.toISOString() };
}

// True if a "processing" row has been stuck long enough to be considered
// abandoned (the Worker that claimed it likely hit a CPU/time limit and
// died before marking it complete or failed) — safe to reclaim.
export function isStaleProcessingClaim(updatedAtIso, { now = new Date(), staleMinutes = STALE_PROCESSING_MINUTES } = {}) {
  const updatedAt = new Date(updatedAtIso.endsWith('Z') ? updatedAtIso : updatedAtIso + 'Z');
  const ageMinutes = (now.getTime() - updatedAt.getTime()) / 60000;
  return ageMinutes > staleMinutes;
}

// ---------- D1-DEPENDENT ORCHESTRATION ----------
// Everything below touches env.DB and cannot be unit-tested without a full
// D1 mock — kept deliberately thin, delegating all actual decisions to the
// pure functions above so those decisions ARE covered by real tests.

const BATCH_SIZE = 20;

export async function processRetryQueueBatch(env, { analyzeText, runFraudChecks, sendEmail, newId, pushToAllSuperAdmins }) {
  const cronLogId = newId('cronlog');
  await env.DB.prepare(`INSERT INTO ai_retry_cron_log (id, status) VALUES (?, 'running')`).bind(cronLogId).run();

  let succeeded = 0, failed = 0, processed = 0;
  try {
    // Eligible = due for retry, OR stuck in 'processing' long enough to be
    // considered an abandoned claim from a Worker that died mid-attempt.
    const { results: candidates } = await env.DB.prepare(
      `SELECT * FROM ai_processing_queue
       WHERE (status = 'pending' AND next_retry_at <= datetime('now'))
          OR (status = 'processing' AND updated_at <= datetime('now', '-${STALE_PROCESSING_MINUTES} minutes'))
       ORDER BY created_at ASC LIMIT ?`
    ).bind(BATCH_SIZE).all();

    for (const row of candidates) {
      // Atomic claim: this UPDATE only succeeds (changes=1) if the row is
      // STILL in the state we read it in. If another overlapping Cron
      // execution claimed it first, this affects 0 rows and we skip it —
      // this is what prevents duplicate processing under concurrency.
      const claim = await env.DB.prepare(
        `UPDATE ai_processing_queue SET status = 'processing', updated_at = datetime('now')
         WHERE id = ? AND (
           status = 'pending'
           OR (status = 'processing' AND updated_at <= datetime('now', '-${STALE_PROCESSING_MINUTES} minutes'))
         )`
      ).bind(row.id).run();
      if (!claim.meta || claim.meta.changes !== 1) continue; // lost the race to another worker — safe to skip

      processed++;
      const startedAt = Date.now();
      try {
        const answerRow = await env.DB.prepare(
          `SELECT t.raw_text as transcript, r.campaign_id, r.respondent_id, r.id as response_id
           FROM answers a JOIN transcripts t ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id
           WHERE a.id = ?`
        ).bind(row.answer_id).first();
        if (!answerRow) throw new Error('Answer or transcript no longer exists — cannot retry');

        const analysis = await analyzeText(env, answerRow.transcript);
        const fraudResult = await runFraudChecks(env, answerRow.campaign_id, answerRow.transcript, answerRow.respondent_id, answerRow.response_id);

        // Idempotency guard: if a previous attempt somehow already wrote a
        // 'summary' insight for this response (e.g., a stale-claim race that
        // slipped through), don't create a duplicate — just finish cleanly.
        const alreadyInsighted = await env.DB.prepare(
          `SELECT 1 FROM ai_insights WHERE response_id = ? AND insight_type = 'summary'`
        ).bind(row.response_id).first();

        if (!alreadyInsighted) {
          await env.DB.prepare(
            `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'summary', ?, 'claude-sonnet-5')`
          ).bind(newId('ai'), row.response_id, JSON.stringify(analysis)).run();

          if (fraudResult.score >= 0.5) {
            await env.DB.prepare(
              `INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'fraud_flag', ?, 'fraud-engine')`
            ).bind(newId('ai'), row.response_id, JSON.stringify(fraudResult)).run();
            if (fraudResult.score >= 0.7 && env.NOTIFY_TO_EMAIL) {
              await sendEmail(env, {
                to: env.NOTIFY_TO_EMAIL,
                subject: `⚠️ High fraud score detected on retry (${fraudResult.score.toFixed(2)})`,
                html: `<p>A response scored <b>${fraudResult.score.toFixed(2)}</b> on the fraud engine (via retry processor).</p><p>Review it in Admin → Fraud Alerts.</p>`,
              }).catch(() => {});
            }
          }
          await env.DB.prepare(
            `UPDATE responses SET fraud_score = MAX(COALESCE(fraud_score, 0), ?), overall_sentiment = ? WHERE id = ?`
          ).bind(fraudResult.score, analysis.sentiment, row.response_id).run();
        }

        await env.DB.prepare(`UPDATE ai_processing_queue SET status = 'complete', updated_at = datetime('now') WHERE id = ?`).bind(row.id).run();
        await env.DB.prepare(
          `INSERT INTO ai_processing_attempts_log (id, queue_id, attempt_number, outcome, duration_ms) VALUES (?, ?, ?, 'success', ?)`
        ).bind(newId('attempt'), row.id, row.attempts + 1, Date.now() - startedAt).run();
        succeeded++;
      } catch (retryError) {
        const newAttempts = row.attempts + 1;
        const decision = decideNextState(newAttempts, {
          maxAttempts: parseInt(env.AI_RETRY_MAX_ATTEMPTS) || DEFAULT_MAX_RETRY_ATTEMPTS,
          baseBackoffMinutes: parseInt(env.AI_RETRY_BASE_BACKOFF_MINUTES) || DEFAULT_BASE_BACKOFF_MINUTES,
          maxBackoffMinutes: parseInt(env.AI_RETRY_MAX_BACKOFF_MINUTES) || DEFAULT_MAX_BACKOFF_MINUTES,
        });
        console.error(`AI retry attempt ${newAttempts} failed for queue item ${row.id}:`, retryError.message, '-> next state:', decision.status);
        await env.DB.prepare(
          `UPDATE ai_processing_queue SET status = ?, attempts = ?, last_error = ?, next_retry_at = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(decision.status, newAttempts, retryError.message || 'Unknown error', decision.nextRetryAt || new Date().toISOString(), row.id).run();
        await env.DB.prepare(
          `INSERT INTO ai_processing_attempts_log (id, queue_id, attempt_number, outcome, error, duration_ms) VALUES (?, ?, ?, 'failure', ?, ?)`
        ).bind(newId('attempt'), row.id, newAttempts, retryError.message || 'Unknown error', Date.now() - startedAt).run();
        failed++;
        // Task 6.4: notify Super Admin the moment an item reaches dead-letter
        // — never blocks the retry loop if push fails.
        if (decision.status === 'failed_permanently' && pushToAllSuperAdmins) {
          pushToAllSuperAdmins(env, {
            title: '🔴 AI Enrichment Dead-Letter',
            body: `An answer's AI analysis permanently failed after ${newAttempts} attempts.`,
            link: '/admin/ai-center.html',
          }).catch(e => console.error('push (dead-letter) failed:', e.message));
        }
      }
    }

    await env.DB.prepare(
      `UPDATE ai_retry_cron_log SET status = 'success', items_processed = ?, items_succeeded = ?, items_failed = ?, finished_at = datetime('now') WHERE id = ?`
    ).bind(processed, succeeded, failed, cronLogId).run();
    return { processed, succeeded, failed };
  } catch (fatalError) {
    console.error('AI retry Cron execution failed entirely:', fatalError.message);
    await env.DB.prepare(
      `UPDATE ai_retry_cron_log SET status = 'failed', items_processed = ?, items_succeeded = ?, items_failed = ?, error = ?, finished_at = datetime('now') WHERE id = ?`
    ).bind(processed, succeeded, failed, fatalError.message, cronLogId).run();
    // Task 6.4: notify Super Admin — a Cron EXECUTION failing entirely is a
    // distinct, more severe signal than one item going to dead-letter.
    if (pushToAllSuperAdmins) {
      pushToAllSuperAdmins(env, {
        title: '🔴 AI Retry Cron Execution Failed',
        body: fatalError.message || 'The AI retry Cron run failed entirely — check AI Retry Health.',
        link: '/admin/ai-retry-health.html',
      }).catch(e => console.error('push (cron failure) failed:', e.message));
    }
    throw fatalError;
  }
}
