// Program Beta Sprint 1.5, Part 12 — Reminders and Escalations Foundation.
//
// Scope: a declarative rule MODEL plus a pure evaluator, not a full
// per-organization configurable rules engine. Every rule below is a
// platform-wide default threshold, explicitly labeled as such — the brief
// asks for a foundation to build on, and hardcoding these as universal org
// policy would misrepresent what's actually decided per-tenant today
// (nothing is; there is no settings table for this yet). The extension
// point for later making these configurable per organization is this same
// module's exported shape — a future increment can source RULES from a DB
// table instead of this constant without changing the evaluator's contract.
export const DEFAULT_ESCALATION_RULES = Object.freeze([
  {
    id: 'stalled_under_review',
    appliesToStatus: 'under_review',
    thresholdDays: 5,
    description: 'An Action awaiting review for more than 5 days without a decision.',
  },
  {
    id: 'stalled_completed_unverified',
    appliesToStatus: 'completed',
    thresholdDays: 7,
    description: 'An Action marked complete for more than 7 days without verification.',
  },
]);

// Pure, deterministic: given real Action rows (each with status, updated_at,
// escalated_since) and the rule set, returns which rows currently match an
// escalation condition. Never mutates its inputs; never queries anything —
// callers (the cron sweep) supply already-fetched rows and persist results.
export function findEscalationCandidates(rows, { now = new Date(), rules = DEFAULT_ESCALATION_RULES } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const matches = [];
  for (const row of rows) {
    if (row.escalated_since) continue; // already escalated for this episode
    const rule = rules.find(r => r.appliesToStatus === row.status);
    if (!rule) continue;
    const heldSinceMs = new Date(row.updated_at).getTime();
    if (!Number.isFinite(heldSinceMs)) continue;
    const elapsedDays = (nowMs - heldSinceMs) / (24 * 60 * 60 * 1000);
    if (elapsedDays >= rule.thresholdDays) {
      matches.push({ row, rule, elapsedDays: Math.round(elapsedDays * 10) / 10 });
    }
  }
  return matches;
}
