// Program Beta Sprint 1.5 — Decision Action metrics (Blueprint Part 10).
// Simple counts are read from the incremental decision_action_metrics_daily
// rollup (written by the Metrics Consumer). Duration-based metrics are
// deliberately computed here, on demand, from the real action_history
// timestamps — never pre-aggregated — so they can never silently drift from
// the source of truth, and never return a fabricated value for an Action
// whose history doesn't actually contain the transition pair in question.
const DURATION_PAIRS = Object.freeze([
  { key: 'avg_time_to_review_hours', from: 'draft', to: 'under_review' },
  { key: 'avg_time_to_approve_hours', from: 'under_review', to: 'approved' },
  { key: 'avg_time_assignment_to_start_hours', from: 'assigned', to: 'in_progress' },
  { key: 'avg_time_start_to_completion_hours', from: 'in_progress', to: 'completed' },
  { key: 'avg_time_completion_to_verification_hours', from: 'completed', to: 'verified' },
]);

async function computeTransitionDurations(env, orgId) {
  const out = {};
  for (const pair of DURATION_PAIRS) {
    let row = null;
    try {
      row = await env.DB.prepare(
        `SELECT AVG((julianday(h2.created_at) - julianday(h1.created_at)) * 24) as avg_hours, COUNT(*) as n
         FROM action_history h1 JOIN action_history h2 ON h1.action_id = h2.action_id
         WHERE h1.organization_id = ? AND h2.organization_id = ?
           AND h1.to_value = ? AND h2.from_value = ? AND h2.to_value = ?
           AND h2.created_at > h1.created_at`
      ).bind(orgId, orgId, pair.from, pair.from, pair.to).first();
    } catch (_) { row = null; }
    out[pair.key] = (row && row.n > 0)
      ? { value_hours: Math.round(row.avg_hours * 10) / 10, sample_size: row.n }
      // Never a fabricated zero (Part 17) — an Action created via the
      // legacy route, or one that simply hasn't made this transition yet,
      // honestly has no data point here.
      : { value: 'not_available', reason: 'no matching transition pairs recorded yet' };
  }
  return out;
}

export async function computeActionMetrics(env, { orgId, projectId, from, to }) {
  const range = { from: from || '2000-01-01', to: to || new Date().toISOString().slice(0, 10) };

  let countRows = [];
  try {
    countRows = (await env.DB.prepare(
      `SELECT event_type, SUM(count) as total FROM decision_action_metrics_daily WHERE organization_id=? AND metric_date BETWEEN ? AND ? GROUP BY event_type`
    ).bind(orgId, range.from, range.to).all()).results || [];
  } catch (_) {}
  const counts = Object.fromEntries(countRows.map(r => [r.event_type, r.total]));

  let backlogRows = [];
  try {
    backlogRows = projectId
      ? (await env.DB.prepare(`SELECT status, COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND project_id=? GROUP BY status`).bind(orgId, projectId).all()).results || []
      : (await env.DB.prepare(`SELECT status, COUNT(*) as n FROM management_response_actions WHERE organization_id=? GROUP BY status`).bind(orgId).all()).results || [];
  } catch (_) {}

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM management_response_actions WHERE organization_id=?`).bind(orgId).first().catch(() => null);
  const overdueRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND overdue_since IS NOT NULL`).bind(orgId).first().catch(() => null);
  const total = totalRow?.n || 0;
  const overdueCount = overdueRow?.n || 0;

  const reopenRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM action_history WHERE organization_id=? AND history_type='status' AND from_value='completed' AND to_value='in_progress'`).bind(orgId).first().catch(() => null);
  const verifiedRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND status='verified'`).bind(orgId).first().catch(() => null);
  const completedOrVerifiedRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM management_response_actions WHERE organization_id=? AND status IN ('completed','verified')`).bind(orgId).first().catch(() => null);
  const completedOrVerifiedTotal = completedOrVerifiedRow?.n || 0;

  return {
    ok: true,
    period: range,
    // Part 10: every metric's semantics documented explicitly, not left implicit.
    semantics: {
      numerator_denominator: 'overdue.percentage = overdue.count / total Actions in the organization (all-time, not period-bounded). verification_rate = verified / (completed + verified).',
      excluded_records: 'None excluded from backlog_by_status or counts. Duration metrics and reopen_count exclude any Action lacking the specific action_history transition pair.',
      cancelled_treatment: 'Cancelled Actions are counted in backlog_by_status; excluded from duration and verification_rate metrics (they were never completed).',
      reopened_treatment: 'A reopened Action (completed -> in_progress) counts once in reopen_count; its eventual completion/verification is still counted normally elsewhere.',
      legacy_actions: 'Actions created via the pre-Sprint-1 legacy route have no action_history rows and honestly return "not_available" for every duration metric — never a fabricated zero.',
      tenant_and_project_filters: 'organization_id is always the caller\'s effective organization (getEffectiveOrgId) — never a client-supplied value. project_id filters backlog_by_status only when supplied.',
      timezone: 'All timestamps are stored and compared in UTC (ISO 8601); julianday() arithmetic is timezone-naive but consistent since every timestamp in this table is already UTC.',
    },
    counts: {
      created: counts['decision.action.created'] || 0,
      submitted: counts['decision.action.submitted'] || 0,
      approved: counts['decision.action.approved'] || 0,
      rejected: counts['decision.action.rejected'] || 0,
      assigned: counts['decision.action.assigned'] || 0,
      completed: counts['decision.action.completed'] || 0,
      verified: counts['decision.action.verified'] || 0,
      cancelled: counts['decision.action.cancelled'] || 0,
    },
    backlog_by_status: Object.fromEntries(backlogRows.map(r => [r.status, r.n])),
    overdue: {
      count: overdueCount,
      // Part 10: never show a percentage when the denominator is zero.
      percentage: total > 0 ? Math.round((overdueCount / total) * 1000) / 10 : null,
    },
    reopen_count: reopenRow?.n || 0,
    verification_rate: completedOrVerifiedTotal > 0 ? Math.round(((verifiedRow?.n || 0) / completedOrVerifiedTotal) * 1000) / 10 : null,
    durations: await computeTransitionDurations(env, orgId),
  };
}

// Part 13 — event observability, organization-scoped.
export async function computeDecisionEventObservability(env, { orgId }) {
  const pendingRow = await env.DB.prepare(`SELECT COUNT(*) as n, MIN(created_at) as oldest FROM domain_event_outbox WHERE organization_id=? AND status IN ('pending','failed')`).bind(orgId).first().catch(() => null);
  const publishedRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM domain_event_outbox WHERE organization_id=? AND status='published'`).bind(orgId).first().catch(() => null);
  const deadLetterRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM domain_event_outbox WHERE organization_id=? AND status='dead_letter'`).bind(orgId).first().catch(() => null);
  const failedRow = await env.DB.prepare(`SELECT SUM(attempt_count) as n FROM domain_event_outbox WHERE organization_id=? AND status IN ('failed','dead_letter')`).bind(orgId).first().catch(() => null);
  const consumerRows = await env.DB.prepare(`SELECT result, COUNT(*) as n FROM decision_event_processed WHERE organization_id=? GROUP BY result`).bind(orgId).all().catch(() => ({ results: [] }));
  const consumerOutcomes = Object.fromEntries((consumerRows.results || []).map(r => [r.result, r.n]));
  const oldestPendingAgeSeconds = pendingRow?.oldest ? Math.max(0, Math.round((Date.now() - new Date(pendingRow.oldest).getTime()) / 1000)) : 0;
  return {
    ok: true,
    pending_outbox_count: pendingRow?.n || 0,
    oldest_pending_age_seconds: oldestPendingAgeSeconds,
    events_published: publishedRow?.n || 0,
    dead_letter_count: deadLetterRow?.n || 0,
    retry_attempts_recorded: failedRow?.n || 0,
    consumer_successes: consumerOutcomes.success || 0,
    consumer_failures: consumerOutcomes.failed || 0,
    // Part 13 asks for these two counters explicitly; disclosed as not yet
    // independently tracked rather than fabricated as zero. Deduplication
    // and malformed-event rejection both genuinely happen (composite PK on
    // decision_event_processed; envelope validation in dispatchDecisionEvent)
    // but neither currently persists a queryable counter of how often it
    // fired — a real, disclosed gap for a future increment, not an invented number.
    duplicate_ignored_count: { value: 'not_independently_tracked', reason: 'decision_event_processed enforces dedup via its composite primary key but does not persist a separate counter for redeliveries caught' },
    malformed_rejected_count: { value: 'not_independently_tracked', reason: 'envelope validation happens before any row is written, so a rejected malformed event leaves no queryable record to count' },
  };
}

// Platform-wide variant of the above, restricted at the route layer to
// authorized platform roles (Part 13: "platform-level aggregate metrics
// should be available only to authorized platform roles") — same real
// queries, simply without an organization_id filter.
export async function computePlatformDecisionEventObservability(env) {
  const pendingRow = await env.DB.prepare(`SELECT COUNT(*) as n, MIN(created_at) as oldest FROM domain_event_outbox WHERE status IN ('pending','failed')`).first().catch(() => null);
  const publishedRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM domain_event_outbox WHERE status='published'`).first().catch(() => null);
  const deadLetterRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM domain_event_outbox WHERE status='dead_letter'`).first().catch(() => null);
  const orgRows = await env.DB.prepare(`SELECT COUNT(DISTINCT organization_id) as n FROM domain_event_outbox`).first().catch(() => null);
  const consumerRows = await env.DB.prepare(`SELECT result, COUNT(*) as n FROM decision_event_processed GROUP BY result`).all().catch(() => ({ results: [] }));
  const consumerOutcomes = Object.fromEntries((consumerRows.results || []).map(r => [r.result, r.n]));
  const oldestPendingAgeSeconds = pendingRow?.oldest ? Math.max(0, Math.round((Date.now() - new Date(pendingRow.oldest).getTime()) / 1000)) : 0;
  return {
    ok: true,
    scope: 'platform',
    organizations_with_events: orgRows?.n || 0,
    pending_outbox_count: pendingRow?.n || 0,
    oldest_pending_age_seconds: oldestPendingAgeSeconds,
    events_published: publishedRow?.n || 0,
    dead_letter_count: deadLetterRow?.n || 0,
    consumer_successes: consumerOutcomes.success || 0,
    consumer_failures: consumerOutcomes.failed || 0,
  };
}
