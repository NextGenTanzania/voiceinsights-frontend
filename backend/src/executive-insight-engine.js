// Program Beta Sprint 3 — Executive Insight Rules Engine.
// Deterministic, rules-based, fully explainable. No generative AI, no
// fabricated conclusions: every insight is produced by a named rule with a
// fixed trigger condition evaluated directly against governed projection
// data (action_summary_projection, organization_decision_portfolio,
// owner_workload_projection, review_queue_projection, action_history) —
// never recomputed a second, divergent way, and never invented when the
// underlying data is absent (see EXEC-010 / getProjectionHealth reuse).
//
// Each rule's `evaluate()` returns zero or more insight objects. Dedup is by
// (rule_id, subject_id): a rule may legitimately fire once per affected
// Action/owner, but never twice for the same subject in one evaluation.

const DEFAULT_THRESHOLDS = Object.freeze({
  REVIEW_BACKLOG_AGE_DAYS: 5,        // EXEC-003
  VERIFICATION_BACKLOG_AGE_DAYS: 7,  // EXEC-004
  OWNER_OVERDUE_THRESHOLD: 5,        // EXEC-005
  ESCALATION_UNRESOLVED_DAYS: 3,     // EXEC-007
  PORTFOLIO_OVERDUE_CRITICAL_MIN: 2, // EXEC-008
  REOPEN_COUNT_THRESHOLD: 2,         // EXEC-009
  PROJECTION_LAG_SECONDS: 900,       // EXEC-010 (matches decision-projection-queries.js LAG_THRESHOLD_SECONDS)
});

function daysSince(isoDate) {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function actionLink(actionId) { return `/app/decision-detail.html?id=${encodeURIComponent(actionId)}`; }

export const EXEC_RULES = Object.freeze([
  {
    id: 'EXEC-001', name: 'Critical Action overdue', severity: 'critical',
    purpose: 'Surfaces committed critical-priority work that has missed its due date — the single clearest signal that an institutional commitment is failing.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'project_manager', 'operations_manager'],
  },
  {
    id: 'EXEC-002', name: 'High-risk Action has no verified evidence', severity: 'high',
    purpose: 'A completed high-risk commitment without verified evidence is an unassured claim of delivery, not a confirmed one.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'me_officer', 'data_analyst'],
  },
  {
    id: 'EXEC-003', name: 'Review queue item exceeds threshold', severity: 'medium',
    purpose: 'An Action sitting in Under Review or Needs Clarification beyond the age threshold indicates a stalled decision, not merely a busy queue.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'project_manager', 'operations_manager'],
  },
  {
    id: 'EXEC-004', name: 'Verification backlog exceeds threshold', severity: 'medium',
    purpose: 'Completed work waiting too long for verification means leadership cannot yet trust that the commitment was actually delivered.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'me_officer', 'data_analyst'],
  },
  {
    id: 'EXEC-005', name: 'Owner workload concentration exceeds threshold', severity: 'medium',
    purpose: 'One person carrying an outsized share of overdue work is an institutional capacity risk, independent of any judgement about that person.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'project_manager', 'operations_manager'],
  },
  {
    id: 'EXEC-006', name: 'Strategic priority has deteriorating delivery', severity: 'high',
    purpose: 'A strategic priority whose linked commitments are overdue or escalated more than the organization average is losing execution momentum.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs'],
  },
  {
    id: 'EXEC-007', name: 'Escalated Action remains unresolved', severity: 'high',
    purpose: 'An escalation that has sat unresolved past the threshold has effectively gone unanswered by whoever it was escalated to.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'project_manager', 'operations_manager'],
  },
  {
    id: 'EXEC-008', name: 'Portfolio contains multiple overdue critical commitments', severity: 'critical',
    purpose: 'A project with several overdue critical Actions at once is a portfolio-level delivery failure, not an isolated incident.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs'],
  },
  {
    id: 'EXEC-009', name: 'Action repeatedly reopened', severity: 'medium',
    purpose: 'An Action reopened more than once after being marked complete signals either an unstable delivery or an unresolved underlying problem.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'me_officer', 'data_analyst'],
  },
  {
    id: 'EXEC-010', name: 'Projection data is stale or unhealthy', severity: 'high',
    purpose: 'Every other insight on this page depends on projection data — if it is stale, every downstream conclusion must be treated as unconfirmed.',
    applicable_roles: ['founder_executive', 'super_admin', 'org_admin', 'head_of_programs', 'project_manager', 'operations_manager', 'me_officer', 'data_analyst'],
  },
]);

const RULE_BY_ID = Object.fromEntries(EXEC_RULES.map(r => [r.id, r]));

function insight(ruleId, { subjectId, message, why, severity, scope, owner, ageDays, evidenceLink, recommendedAction, actionLinkUrl }) {
  const rule = RULE_BY_ID[ruleId];
  return {
    rule_id: ruleId, rule_name: rule.name, severity: severity || rule.severity,
    subject_id: subjectId, message, why_it_matters: why,
    affected_scope: scope || null, responsible_owner: owner || null,
    age_days: ageDays ?? null, evidence: evidenceLink || null,
    recommended_next_step: recommendedAction, link: actionLinkUrl || null,
  };
}

// Every query below is bound and organization_id stays inline in the same
// template literal as its table name (tenant-isolation source-scanner
// convention already established in decision-action-lifecycle.test.js).
export async function evaluateExecutiveInsights(env, organizationId, { thresholds = {}, role } = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const insights = [];

  // EXEC-001 — critical Actions overdue.
  const overdueCritical = (await env.DB.prepare(
    `SELECT action_id, recommendation, owner_display_name, project_id, overdue_since FROM action_summary_projection WHERE organization_id=? AND priority='critical' AND overdue_since IS NOT NULL ORDER BY overdue_since ASC LIMIT 25`
  ).bind(organizationId).all()).results || [];
  overdueCritical.forEach(a => insights.push(insight('EXEC-001', {
    subjectId: a.action_id, scope: a.project_id,
    message: `"${a.recommendation || a.action_id}" is a critical-priority commitment overdue since ${a.overdue_since?.slice(0, 10)}.`,
    why: 'Critical commitments overdue represent the clearest failing institutional obligations.',
    owner: a.owner_display_name || null, ageDays: daysSince(a.overdue_since),
    recommendedAction: 'Confirm owner capacity and either accelerate delivery or formally re-baseline the due date with a documented reason.',
    actionLinkUrl: actionLink(a.action_id),
  })));

  // EXEC-002 — completed/verified high-risk Actions with no attached evidence.
  const unassuredHighRisk = (await env.DB.prepare(
    `SELECT m.id as action_id, m.recommendation, m.owner as owner_id, m.project_id, m.completion_date
     FROM management_response_actions m
     WHERE m.organization_id=? AND m.risk_level='high' AND m.status IN ('completed','verified')
       AND (m.attachments_count = 0) AND (m.evidence_after_json IS NULL OR m.evidence_after_json = '[]')
     ORDER BY m.completion_date DESC LIMIT 25`
  ).bind(organizationId).all()).results || [];
  unassuredHighRisk.forEach(a => insights.push(insight('EXEC-002', {
    subjectId: a.action_id, scope: a.project_id,
    message: `"${a.recommendation || a.action_id}" is marked complete with high risk but has no attached evidence.`,
    why: 'A completed high-risk commitment without evidence is an unconfirmed claim of delivery.',
    owner: a.owner_id || null,
    recommendedAction: 'Require evidence before treating this commitment as delivered; do not report it as resolved without it.',
    actionLinkUrl: actionLink(a.action_id),
  })));

  // EXEC-003 — review-queue aging beyond threshold.
  const reviewAging = (await env.DB.prepare(
    `SELECT action_id, recommendation, owner_display_name, project_id, last_activity_at FROM action_summary_projection
     WHERE organization_id=? AND status IN ('under_review','needs_clarification') AND last_activity_at IS NOT NULL
       AND last_activity_at <= datetime('now', ?) ORDER BY last_activity_at ASC LIMIT 25`
  ).bind(organizationId, `-${t.REVIEW_BACKLOG_AGE_DAYS} days`).all()).results || [];
  reviewAging.forEach(a => insights.push(insight('EXEC-003', {
    subjectId: a.action_id, scope: a.project_id,
    message: `"${a.recommendation || a.action_id}" has been awaiting review for more than ${t.REVIEW_BACKLOG_AGE_DAYS} days.`,
    why: 'A stalled review is a stalled decision — the organization has not yet decided whether to accept this commitment.',
    owner: a.owner_display_name || null, ageDays: daysSince(a.last_activity_at),
    recommendedAction: 'Assign a reviewer or set a decision deadline for this item.',
    actionLinkUrl: actionLink(a.action_id),
  })));

  // EXEC-004 — verification backlog aging beyond threshold.
  const verificationAging = (await env.DB.prepare(
    `SELECT action_id, recommendation, owner_display_name, project_id, completion_date FROM action_summary_projection
     WHERE organization_id=? AND status='completed' AND completion_date IS NOT NULL
       AND completion_date <= datetime('now', ?) ORDER BY completion_date ASC LIMIT 25`
  ).bind(organizationId, `-${t.VERIFICATION_BACKLOG_AGE_DAYS} days`).all()).results || [];
  verificationAging.forEach(a => insights.push(insight('EXEC-004', {
    subjectId: a.action_id, scope: a.project_id,
    message: `"${a.recommendation || a.action_id}" completed ${daysSince(a.completion_date)} days ago and is still unverified.`,
    why: 'Leadership cannot count delivery as confirmed until it is verified.',
    owner: a.owner_display_name || null, ageDays: daysSince(a.completion_date),
    recommendedAction: 'Assign this item for verification.',
    actionLinkUrl: actionLink(a.action_id),
  })));

  // EXEC-005 — owner workload concentration.
  const overloadedOwners = (await env.DB.prepare(
    `SELECT owner, owner_display_name, overdue_count, assigned_count FROM owner_workload_projection WHERE organization_id=? AND overdue_count >= ? ORDER BY overdue_count DESC LIMIT 15`
  ).bind(organizationId, t.OWNER_OVERDUE_THRESHOLD).all()).results || [];
  overloadedOwners.forEach(o => insights.push(insight('EXEC-005', {
    subjectId: o.owner,
    message: `${o.owner_display_name || o.owner} is carrying ${o.overdue_count} overdue Actions out of ${o.assigned_count} assigned.`,
    why: 'Workload concentration is an institutional capacity risk, not a judgement on the individual — the organization should consider redistribution or support.',
    owner: o.owner_display_name || o.owner,
    recommendedAction: 'Review this owner\'s assignment load with their manager and consider reassigning lower-priority items.',
    actionLinkUrl: `/app/decisions.html?tab=all&owner=${encodeURIComponent(o.owner)}`,
  })));

  // EXEC-007 — unresolved escalations beyond threshold.
  const staleEscalations = (await env.DB.prepare(
    `SELECT action_id, recommendation, owner_display_name, project_id, escalated_since FROM action_summary_projection
     WHERE organization_id=? AND escalated_since IS NOT NULL AND escalated_since <= datetime('now', ?) ORDER BY escalated_since ASC LIMIT 25`
  ).bind(organizationId, `-${t.ESCALATION_UNRESOLVED_DAYS} days`).all()).results || [];
  staleEscalations.forEach(a => insights.push(insight('EXEC-007', {
    subjectId: a.action_id, scope: a.project_id,
    message: `"${a.recommendation || a.action_id}" has been escalated for more than ${t.ESCALATION_UNRESOLVED_DAYS} days without resolution.`,
    why: 'An escalation left unresolved past a reasonable threshold has, in effect, gone unanswered.',
    owner: a.owner_display_name || null, ageDays: daysSince(a.escalated_since),
    recommendedAction: 'A named leader must review and resolve this escalation directly.',
    actionLinkUrl: actionLink(a.action_id),
  })));

  // EXEC-008 — portfolios (projects) with multiple overdue critical Actions.
  const riskyPortfolios = (await env.DB.prepare(
    `SELECT project_id, COUNT(*) as n FROM action_summary_projection WHERE organization_id=? AND priority='critical' AND overdue_since IS NOT NULL AND project_id IS NOT NULL GROUP BY project_id HAVING COUNT(*) >= ? ORDER BY n DESC LIMIT 10`
  ).bind(organizationId, t.PORTFOLIO_OVERDUE_CRITICAL_MIN).all()).results || [];
  riskyPortfolios.forEach(p => insights.push(insight('EXEC-008', {
    subjectId: p.project_id, scope: p.project_id,
    message: `Project ${p.project_id} has ${p.n} overdue critical-priority commitments at once.`,
    why: 'Multiple simultaneous overdue critical commitments in one portfolio indicate a systemic delivery problem in that project, not an isolated Action.',
    recommendedAction: 'This project needs direct leadership review, not item-by-item follow-up.',
    actionLinkUrl: `/app/decisions.html?tab=all&project=${encodeURIComponent(p.project_id)}&priority=critical`,
  })));

  // EXEC-009 — repeatedly reopened Actions.
  const reopened = (await env.DB.prepare(
    `SELECT h.action_id, COUNT(*) as reopen_count, p.recommendation, p.owner_display_name, p.project_id
     FROM action_history h
     LEFT JOIN action_summary_projection p ON p.action_id = h.action_id
     WHERE h.organization_id=? AND h.history_type='status' AND h.from_value='completed' AND h.to_value='in_progress'
     GROUP BY h.action_id HAVING COUNT(*) >= ? ORDER BY reopen_count DESC LIMIT 15`
  ).bind(organizationId, t.REOPEN_COUNT_THRESHOLD).all()).results || [];
  reopened.forEach(a => insights.push(insight('EXEC-009', {
    subjectId: a.action_id, scope: a.project_id,
    message: `"${a.recommendation || a.action_id}" has been reopened ${a.reopen_count} times after being marked complete.`,
    why: 'Repeated reopening suggests either unstable delivery quality or an unresolved root cause that keeps resurfacing.',
    owner: a.owner_display_name || null,
    recommendedAction: 'Review why this Action keeps failing to stay complete before accepting the next completion claim.',
    actionLinkUrl: actionLink(a.action_id),
  })));

  // EXEC-006 — strategic priorities with worse-than-average overdue rate.
  const priorityRows = (await env.DB.prepare(
    `SELECT strategic_priority, COUNT(*) as total, SUM(CASE WHEN overdue_since IS NOT NULL THEN 1 ELSE 0 END) as overdue_n
     FROM action_summary_projection WHERE organization_id=? AND strategic_priority IS NOT NULL AND strategic_priority != ''
     GROUP BY strategic_priority HAVING COUNT(*) >= 3`
  ).bind(organizationId).all()).results || [];
  if (priorityRows.length) {
    const orgOverdueRate = priorityRows.reduce((s, r) => s + r.overdue_n, 0) / Math.max(1, priorityRows.reduce((s, r) => s + r.total, 0));
    priorityRows.forEach(p => {
      const rate = p.overdue_n / p.total;
      if (rate > orgOverdueRate * 1.5 && p.overdue_n >= 2) {
        insights.push(insight('EXEC-006', {
          subjectId: p.strategic_priority,
          message: `Strategic priority "${p.strategic_priority}" has ${p.overdue_n} of ${p.total} commitments overdue (${Math.round(rate * 100)}%), well above the organization average (${Math.round(orgOverdueRate * 100)}%).`,
          why: 'A strategic priority executing well below the organization\'s own average is losing delivery momentum relative to everything else leadership has committed to.',
          recommendedAction: 'Review resourcing and blockers specific to this strategic priority.',
          actionLinkUrl: `/app/decisions.html?tab=all&strategic_priority=${encodeURIComponent(p.strategic_priority)}`,
        }));
      }
    });
  }

  // EXEC-010 — projection staleness/health (reuses the same lag threshold
  // and freshness definition as getProjectionHealth — never a second,
  // divergent staleness computation).
  const healthRow = await env.DB.prepare(
    `SELECT MAX(projected_at) as latest FROM action_summary_projection WHERE organization_id=?`
  ).bind(organizationId).first();
  if (healthRow?.latest) {
    const lagSeconds = Math.max(0, Math.round((Date.now() - new Date(healthRow.latest).getTime()) / 1000));
    if (lagSeconds > t.PROJECTION_LAG_SECONDS) {
      insights.push(insight('EXEC-010', {
        subjectId: 'projection-health',
        message: `Projection data was last refreshed ${Math.round(lagSeconds / 60)} minutes ago, beyond the ${Math.round(t.PROJECTION_LAG_SECONDS / 60)}-minute freshness threshold.`,
        why: 'Every insight on this page is computed from this projection — if it is stale, treat all of them as unconfirmed until it catches up.',
        recommendedAction: 'Check the projection sweep / cron health before acting on any insight above.',
        actionLinkUrl: '/app/executive-intelligence.html',
      }));
    }
  }

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  insights.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  const roleFiltered = role ? insights.filter(i => RULE_BY_ID[i.rule_id].applicable_roles.includes(role)) : insights;
  return { ok: true, generated_at: new Date().toISOString(), thresholds: t, insights: roleFiltered, rule_catalog: EXEC_RULES };
}

// Part 5 — Decisions Required: a leadership-authority subset of the same
// insight evaluation, reshaped into the decision/deadline/consequence shape.
// Deliberately excludes EXEC-005 (workload) and EXEC-010 (health) — those
// are operational/technical signals, not items requiring a leadership
// decision — and is restricted to the roles the brief names as holding
// decision authority.
const DECISION_REQUIRED_RULES = new Set(['EXEC-001', 'EXEC-002', 'EXEC-003', 'EXEC-004', 'EXEC-006', 'EXEC-007', 'EXEC-008', 'EXEC-009']);
const DECISION_DEADLINE_DAYS = Object.freeze({ critical: 2, high: 5, medium: 10, low: 14 });

export function buildDecisionsRequired(evaluation) {
  const items = evaluation.insights
    .filter(i => DECISION_REQUIRED_RULES.has(i.rule_id))
    .map(i => {
      const deadlineDays = DECISION_DEADLINE_DAYS[i.severity] ?? 10;
      const deadline = new Date(Date.now() + deadlineDays * 86400000).toISOString().slice(0, 10);
      return {
        decision_required: i.message,
        decision_deadline: deadline,
        consequence_of_inaction: i.why_it_matters,
        responsible_authority: i.responsible_owner || 'Organization leadership',
        supporting_evidence: i.evidence || `Derived from live projection data (rule ${i.rule_id}).`,
        link: i.link,
        severity: i.severity,
        rule_id: i.rule_id,
      };
    });
  return { ok: true, generated_at: evaluation.generated_at, decisions: items };
}

export { DEFAULT_THRESHOLDS };
