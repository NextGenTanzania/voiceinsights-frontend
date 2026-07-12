// src/ops-cron.js — Everything the 5-minute Cron tick runs: scheduled report
// generation, project schedule checks, health snapshots, vault key-rotation
// batches, and (V212, closes TD-001) operational-log retention cleanup.
// Extracted from index.js (V212 refactor). Behavior unchanged except the new cleanup.
import { newId } from './auth.js';
import { reEncryptSecret } from './secret-vault.js';
import { buildDocumentModel, getEditorialGuideline } from './report-generator.js';
import { writeNarrative } from './ai-narrative-engine.js';
import { sendEmail, pushToOrgAdmins } from './notifications.js';
import { logAudit } from './request-scope.js';

export async function processReportSchedules(env) {
  try {
    const { results: due } = await env.DB.prepare(
      `SELECT id, organization_id, template_id, campaign_id, frequency, recipient_emails FROM report_schedules
       WHERE is_active = 1 AND next_run_at <= datetime('now') LIMIT 20`
    ).all();

    for (const schedule of due) {
      try {
        const documentModel = await buildDocumentModel(env, { templateId: schedule.template_id, organizationId: schedule.organization_id, campaignId: schedule.campaign_id });
        const reportId = newId('report');
        await env.DB.prepare(
          `INSERT INTO generated_reports (id, template_id, organization_id, campaign_id, status, version, document_model_json)
           VALUES (?, ?, ?, ?, 'draft', 1, ?)`
        ).bind(reportId, schedule.template_id, schedule.organization_id, schedule.campaign_id, JSON.stringify(documentModel)).run();

        // AI narrative is best-effort here — a Claude failure must not stop
        // the schedule from advancing or the email from going out with the
        // real data that WAS successfully assembled.
        try {
          const editorialGuideline = await getEditorialGuideline(env, schedule.template_id);
          const narrative = await writeNarrative(env, { aiReadyPackage: documentModel.ai_ready_package, metadata: documentModel.metadata, editorialGuideline });
          documentModel.recommendations = narrative.recommendations;
          documentModel.narrative = { executive_summary: narrative.executive_summary, key_findings: narrative.key_findings, discussion: narrative.discussion, conclusions: narrative.conclusions, risks: narrative.risks, opportunities: narrative.opportunities, lessons_learned: narrative.lessons_learned };
          await env.DB.prepare('UPDATE generated_reports SET document_model_json = ? WHERE id = ?').bind(JSON.stringify(documentModel), reportId).run();
        } catch (narrativeError) {
          console.error('Scheduled report narrative failed (report still saved with data):', narrativeError.message);
        }

        const recipients = schedule.recipient_emails.split(',').map(e => e.trim()).filter(Boolean);
        for (const recipient of recipients) {
          await sendEmail(env, {
            to: recipient,
            subject: `📊 Your scheduled report: ${documentModel.metadata.template_name}`,
            html: `<p>Your ${schedule.frequency} report for <b>${documentModel.metadata.campaign_name || documentModel.metadata.organization_name}</b> is ready.</p>
                   <p>${documentModel.kpis.total_responses} responses · ${documentModel.kpis.response_rate_pct}% response rate.</p>
                   <p><a href="https://voiceinsightsafrica.com/app/report-viewer.html?report_id=${reportId}">View the full report</a></p>`,
          });
        }

        const intervalDays = { weekly: 7, monthly: 30, quarterly: 90 }[schedule.frequency];
        await env.DB.prepare(`UPDATE report_schedules SET next_run_at = datetime('now', '+${intervalDays} days') WHERE id = ?`).bind(schedule.id).run();
      } catch (scheduleError) {
        console.error('Scheduled report generation failed for schedule', schedule.id, ':', scheduleError.message);
        await logAudit(env, { org: schedule.organization_id, userId: null, action: 'report_schedule_failed', resourceType: 'report_schedules', resourceId: schedule.id, request: null }).catch(() => {});
        // Push the schedule forward by 1 day so a persistent failure doesn't
        // spin retrying every 5 minutes forever — it gets one more full
        // attempt tomorrow instead.
        await env.DB.prepare(`UPDATE report_schedules SET next_run_at = datetime('now', '+1 day') WHERE id = ?`).bind(schedule.id).run().catch(() => {});
      }
    }
  } catch (e) { console.error('processReportSchedules failed entirely:', e.message); }
}

// Task 6.4: "project behind schedule" — a simple, defensible heuristic
// (active >7 days AND <50% of target respondents reached), checked every
// Cron tick but de-duplicated via audit_logs so the SAME campaign doesn't
// re-notify more than once per 24h. No new table needed for the dedup.

export async function checkProjectsBehindSchedule(env) {
  try {
    const { results: candidates } = await env.DB.prepare(
      `SELECT c.id, c.name, c.organization_id, c.target_respondents,
              (SELECT COUNT(*) FROM responses WHERE campaign_id = c.id) as response_count
       FROM campaigns c
       WHERE c.status = 'active' AND c.target_respondents > 0 AND c.created_at <= datetime('now', '-7 days')`
    ).all();

    for (const c of candidates) {
      const progressRatio = c.response_count / c.target_respondents;
      if (progressRatio >= 0.5) continue; // on track — nothing to flag

      const alreadyNotified = await env.DB.prepare(
        `SELECT 1 FROM audit_logs WHERE action = 'project_behind_schedule_notified' AND resource_id = ? AND created_at >= datetime('now', '-24 hours')`
      ).bind(c.id).first();
      if (alreadyNotified) continue; // don't repeat within 24h

      await pushToOrgAdmins(env, c.organization_id, {
        title: '📉 Project Behind Schedule',
        body: `"${c.name}" has only ${c.response_count}/${c.target_respondents} respondents after a week.`,
        link: `/app/project.html?id=${c.id}`,
      });
      await logAudit(env, { org: c.organization_id, userId: null, action: 'project_behind_schedule_notified', resourceType: 'campaign', resourceId: c.id, request: null });
    }
  } catch (e) { console.error('checkProjectsBehindSchedule failed:', e.message); }
}

// Runs the exact same checks /api/health uses, but records each one to
// status_check_history independently of visitor traffic — so the public
// status page's "recent history" strip reflects reality even if nobody
// happened to load the page during an outage. Timed so latency_ms is a
// real, meaningful number, not a guess.

export async function recordHealthSnapshot(env) {
  const services = [
    { name: 'database', check: async () => { await env.DB.prepare('SELECT 1').first(); } },
    { name: 'storage', check: async () => { await env.AUDIO_BUCKET.head('__healthcheck__').catch(() => {}); } }, // a 404 still proves reachability
  ];
  for (const svc of services) {
    const startedAt = Date.now();
    let status = 'operational', errorMessage = null;
    try {
      await svc.check();
    } catch (e) {
      status = 'degraded';
      errorMessage = e.message || 'Unknown error';
    }
    try {
      await env.DB.prepare(
        `INSERT INTO status_check_history (id, service, status, latency_ms, error_message) VALUES (?, ?, ?, ?, ?)`
      ).bind(newId('check'), svc.name, status, Date.now() - startedAt, errorMessage).run();
    } catch (e) { /* never let history-writing itself break anything */ }
  }
}

// Processes ONE batch (default 50) of the oldest still-running rotation job,
// resuming from its cursor_id. Shared by both the Cron trigger and the
// manual "process batch now" endpoint used for testing, so there is exactly
// one code path for this logic, not two that could drift apart.
const ROTATION_BATCH_SIZE = 50;

export async function processNextRotationBatch(env) {
  const job = await env.DB.prepare(`SELECT * FROM secret_rotation_jobs WHERE status = 'running' ORDER BY started_at ASC LIMIT 1`).first();
  if (!job) return { processed: false, reason: 'no_running_job' };

  const { results: batch } = await env.DB.prepare(
    job.cursor_id
      ? `SELECT id, organization_id, secret_type, envelope_json FROM platform_secrets WHERE status = 'active' AND id > ? ORDER BY id ASC LIMIT ?`
      : `SELECT id, organization_id, secret_type, envelope_json FROM platform_secrets WHERE status = 'active' ORDER BY id ASC LIMIT ?`
  ).bind(...(job.cursor_id ? [job.cursor_id, ROTATION_BATCH_SIZE] : [ROTATION_BATCH_SIZE])).all();

  let rotated = 0, failed = 0, lastId = job.cursor_id;
  for (const s of batch) {
    lastId = s.id;
    try {
      const envelope = JSON.parse(s.envelope_json);
      if (envelope.v !== job.to_version) {
        const newEnvelope = await reEncryptSecret(env, { organizationId: s.organization_id, secretType: s.secret_type, envelope, toVersion: job.to_version });
        await env.DB.prepare(`UPDATE platform_secrets SET envelope_json = ?, updated_at = datetime('now') WHERE id = ?`).bind(JSON.stringify(newEnvelope), s.id).run();
      }
      rotated++;
    } catch (e) {
      failed++;
    }
  }

  const isLastBatch = batch.length < ROTATION_BATCH_SIZE;
  await env.DB.prepare(
    `UPDATE secret_rotation_jobs SET rotated_count = rotated_count + ?, failed_count = failed_count + ?, cursor_id = ?, status = ?, finished_at = ?
     WHERE id = ?`
  ).bind(
    rotated, failed, lastId,
    isLastBatch ? 'complete' : 'running',
    isLastBatch ? new Date().toISOString() : null,
    job.id
  ).run();

  return { processed: true, job_id: job.id, batch_size: batch.length, rotated, failed, complete: isLastBatch };
}


// ============================================================
// SESSIONS — one survey walk-through per respondent, shared by every channel.
// ============================================================

// ============================================================
// TD-001 FIX (V212): retention cleanup for operational log tables.
// ai_retry_cron_log gains ~288 rows/day and ai_processing_attempts_log one
// row per retry attempt — with no retention they slowly degrade the D1
// aggregate queries behind the Vault/AI-Retry Health dashboards. Each Cron
// tick deletes at most one small batch of rows older than the retention
// window, so the cleanup itself can never run long or lock the tables.
// ============================================================
export async function cleanupOperationalLogs(env, { retentionDays = 90, batchLimit = 500 } = {}) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19); // matches SQLite datetime('now') format
  const deleted = {};
  const targets = [
    { table: 'ai_retry_cron_log', column: 'started_at' },
    { table: 'ai_processing_attempts_log', column: 'attempted_at' },
  ];
  for (const { table, column } of targets) {
    try {
      const res = await env.DB.prepare(
        `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${column} < ? LIMIT ?)`
      ).bind(cutoff, batchLimit).run();
      deleted[table] = res?.meta?.changes ?? 0;
    } catch (e) {
      deleted[table] = `skipped: ${e.message}`; // never let cleanup break the Cron tick
    }
  }
  return deleted;
}
