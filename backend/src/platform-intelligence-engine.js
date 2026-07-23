// VoiceInsights Africa — Product Experience Evolution, Phase 1: Platform
// Intelligence™. Every function below is deterministic: no generative AI,
// no invented conclusions. The "Executive Copilot" is a curated intent
// matcher over real queries, not a chatbot — a question that doesn't match
// a known, evidence-backed intent gets an honest "not answerable yet"
// response, never a fabricated one. Every other capability (Root Cause,
// Simulator, Forecasting, Memory, Knowledge Graph, Recommendations,
// Narrative) composes the SAME governed projection/source tables Sprint 3
// already established — nothing here recomputes an authoritative number a
// second, divergent way.
import { getOrganizationPortfolio, getExecutiveIntelligence, listProjectPortfolios, getStrategicPriorityBreakdown, getPortfolioTrend, getEvidenceAssurance, getExecutiveTimeline, listOwnerWorkloads } from './decision-projection-queries.js';
import { evaluateExecutiveInsights, buildDecisionsRequired } from './executive-insight-engine.js';

// ============================================================
// Part 2 — Root Cause Intelligence
// Every candidate cause is grounded in a REAL, checkable correlation
// already present in the projection/source data — never a psychological,
// political, or environmental guess with no supporting field (this data
// model has no "weather" or "political event" field, so those brief
// examples are honestly not diagnosable here; only causes with a real
// backing signal are ever surfaced). Each candidate is explicitly labeled
// a possible contributing factor, not proven causation.
// ============================================================
const ROOT_CAUSE_RULES = Object.freeze([
  {
    id: 'CAUSE-OWNER-OVERLOAD', label: 'Owner capacity constraint',
    check: (ctx) => ctx.ownerWorkload && ctx.ownerWorkload.overdue_count >= 5,
    evidence: (ctx) => `${ctx.ownerWorkload.owner_display_name || ctx.ownerWorkload.owner} is carrying ${ctx.ownerWorkload.overdue_count} overdue Actions out of ${ctx.ownerWorkload.assigned_count} assigned.`,
  },
  {
    id: 'CAUSE-REVIEW-BOTTLENECK', label: 'Review/approval bottleneck',
    check: (ctx) => ctx.action && ['under_review', 'needs_clarification'].includes(ctx.action.status) && ctx.action.last_activity_at && daysSince(ctx.action.last_activity_at) > 5,
    evidence: (ctx) => `This Action has been in "${ctx.action.status}" for ${daysSince(ctx.action.last_activity_at)} days without a decision.`,
  },
  {
    id: 'CAUSE-REOPENED', label: 'Unstable delivery / unresolved underlying problem',
    check: (ctx) => ctx.reopenCount >= 2,
    evidence: (ctx) => `This Action has been reopened ${ctx.reopenCount} times after being marked complete.`,
  },
  {
    id: 'CAUSE-NO-EVIDENCE', label: 'Weak monitoring / insufficient evidence discipline',
    check: (ctx) => ctx.action && ['completed', 'verified'].includes(ctx.action.status) && !ctx.hasEvidence,
    evidence: () => `This Action is marked complete but has no attached evidence — completion cannot be independently confirmed.`,
  },
  {
    id: 'CAUSE-LATE-START', label: 'Delayed start relative to assignment',
    check: (ctx) => ctx.action && ctx.action.start_date && ctx.action.created_at && daysBetween(ctx.action.created_at, ctx.action.start_date) > 14,
    evidence: (ctx) => `${daysBetween(ctx.action.created_at, ctx.action.start_date)} days elapsed between creation and the recorded start date.`,
  },
  {
    id: 'CAUSE-PORTFOLIO-CONCENTRATION', label: 'Portfolio-wide delivery pressure, not an isolated case',
    check: (ctx) => ctx.projectPortfolio && ctx.projectPortfolio.overdue_count >= 2 && ctx.projectPortfolio.total_actions > 0 && (ctx.projectPortfolio.overdue_count / ctx.projectPortfolio.total_actions) > 0.3,
    evidence: (ctx) => `${ctx.projectPortfolio.overdue_count} of ${ctx.projectPortfolio.total_actions} Actions in this same project (${Math.round((ctx.projectPortfolio.overdue_count / ctx.projectPortfolio.total_actions) * 100)}%) are also overdue.`,
  },
]);

function daysSince(iso) { return iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null; }
function daysBetween(a, b) { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000); }

export async function diagnoseLikelyCauses(env, organizationId, actionId) {
  const action = await env.DB.prepare('SELECT * FROM action_summary_projection WHERE action_id=? AND organization_id=?').bind(actionId, organizationId).first();
  if (!action) return { ok: false, error: 'not_found' };

  const raw = await env.DB.prepare('SELECT attachments_count, evidence_after_json FROM management_response_actions WHERE id=? AND organization_id=?').bind(actionId, organizationId).first();
  const hasEvidence = Boolean(raw && (raw.attachments_count > 0 || (raw.evidence_after_json && raw.evidence_after_json !== '[]')));

  const reopenRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM action_history WHERE organization_id=? AND action_id=? AND history_type='status' AND from_value='completed' AND to_value='in_progress'`).bind(organizationId, actionId).first();

  const ownerWorkload = action.owner ? await env.DB.prepare('SELECT * FROM owner_workload_projection WHERE organization_id=? AND owner=?').bind(organizationId, action.owner).first() : null;
  const projectPortfolio = action.project_id ? await env.DB.prepare('SELECT * FROM project_decision_portfolio WHERE organization_id=? AND project_id=?').bind(organizationId, action.project_id).first() : null;

  const ctx = { action, hasEvidence, reopenCount: reopenRow?.n || 0, ownerWorkload, projectPortfolio };
  const causes = ROOT_CAUSE_RULES.filter(r => r.check(ctx)).map(r => ({ id: r.id, label: r.label, evidence: r.evidence(ctx) }));

  return {
    ok: true, action_id: actionId, recommendation: action.recommendation,
    likely_causes: causes,
    disclosure: causes.length
      ? 'Each factor above is a possible contributor supported by a real, checkable data point — not a proven single root cause. Causes this platform cannot observe (e.g. weather, political events, funding delays outside the governed record) are not diagnosable from available data and are never guessed.'
      : 'No correlating factor from the available governed data matched this Action. This does not mean there is no cause — only that none of the checkable signals in this platform explain it.',
  };
}

// ============================================================
// Part 3 — Decision Simulator
// Pure arithmetic re-projection of the CURRENT real portfolio under a
// hypothetical parameter change. Every output field is explicitly tagged
// Measured (unchanged real figures) vs Estimated (recomputed under the
// hypothesis) — never blended or presented as a forecast of the future.
// ============================================================
export async function simulateScenario(env, organizationId, params = {}) {
  const portfolio = await getOrganizationPortfolio(env, organizationId);
  if (!portfolio.available) return { ok: true, available: false, reason: portfolio.reason };

  const overdueReductionPct = clamp(Number(params.overdue_reduction_pct) || 0, 0, 100);
  const verificationRateTarget = params.verification_rate_target != null ? clamp(Number(params.verification_rate_target), 0, 100) / 100 : null;
  const responseRateChangePct = clamp(Number(params.response_rate_change_pct) || 0, -100, 100);

  const measured = {
    overdue_count: portfolio.overdue_count,
    verification_rate: portfolio.verification_rate,
    total_actions: portfolio.total_actions,
  };

  const estimatedOverdue = Math.round(portfolio.overdue_count * (1 - overdueReductionPct / 100));
  const verifiedPlusCompleted = (portfolio.backlog_by_status?.completed || 0) + (portfolio.backlog_by_status?.verified || 0);
  const estimatedVerificationRate = verificationRateTarget != null ? verificationRateTarget
    : portfolio.verification_rate;

  const estimated = {
    overdue_count: estimatedOverdue,
    overdue_reduction_applied_pct: overdueReductionPct,
    verification_rate: estimatedVerificationRate,
    verification_rate_target_applied: verificationRateTarget,
    escalation_risk_note: estimatedOverdue < portfolio.overdue_count
      ? `Reducing overdue Actions by ${overdueReductionPct}% would move ${portfolio.overdue_count - estimatedOverdue} Action(s) out of the overdue count, all else equal.`
      : 'No overdue reduction applied.',
  };

  return {
    ok: true, available: true, organization_id: organizationId,
    inputs: { overdue_reduction_pct: overdueReductionPct, verification_rate_target: params.verification_rate_target ?? null, response_rate_change_pct: responseRateChangePct },
    measured, estimated,
    disclosure: 'This is a simple, transparent recalculation of the current real portfolio under the hypothesis supplied — it does not model second-order effects (e.g. how reducing overdue Actions might change owner workload elsewhere) and is not a prediction of what will actually happen. All-else-equal assumption stated explicitly.',
  };
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ============================================================
// Part 4 — Impact Forecasting
// Reuses getPortfolioTrend's real snapshot history and its existing
// insufficient-data honesty threshold — never a second, divergent
// staleness/sufficiency rule. Only ever projects forward when the
// underlying trend itself was already judged sufficient; the forecast
// itself is a simple, disclosed linear extrapolation of the real
// measured points, not a model.
// ============================================================
export async function forecastImpact(env, organizationId, { days = 30, forecastDays = 14 } = {}) {
  const trend = await getPortfolioTrend(env, organizationId, days);
  if (!trend.available) return { ok: true, available: false, reason: trend.reason };

  const points = trend.points;
  const first = points[0], last = points[points.length - 1];
  const spanDays = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  const overdueSlopePerDay = (last.overdue_count - first.overdue_count) / spanDays;
  const completionSlopePerDay = ((last.completion_rate || 0) - (first.completion_rate || 0)) / spanDays;

  const projectedOverdue = Math.max(0, Math.round(last.overdue_count + overdueSlopePerDay * forecastDays));
  const projectedCompletionRate = clamp((last.completion_rate || 0) + completionSlopePerDay * forecastDays, 0, 1);

  return {
    ok: true, available: true, organization_id: organizationId,
    measured: { as_of: last.date, overdue_count: last.overdue_count, completion_rate: last.completion_rate },
    projected: { in_days: forecastDays, overdue_count: projectedOverdue, completion_rate: Math.round(projectedCompletionRate * 1000) / 1000 },
    assumptions: `Projected values assume the ${points.length}-day trend observed between ${first.date} and ${last.date} continues linearly for ${forecastDays} more days — a disclosed, simple extrapolation, not a statistical model. Real-world change (interventions, seasonality, new commitments) can and will diverge from this.`,
  };
}

// ============================================================
// Part 7 — Institutional Memory
// Similarity is a real, checkable match on governed fields (department,
// priority, risk_level, strategic_priority) against RESOLVED Actions only
// (verified/cancelled) — never a semantic/AI similarity, so the match
// reason is always exactly statable.
// ============================================================
export async function findSimilarActions(env, organizationId, actionId, { limit = 5 } = {}) {
  const action = await env.DB.prepare('SELECT * FROM action_summary_projection WHERE action_id=? AND organization_id=?').bind(actionId, organizationId).first();
  if (!action) return { ok: false, error: 'not_found' };

  const rows = (await env.DB.prepare(`
    SELECT action_id, recommendation, department, priority, risk_level, strategic_priority, status, completion_date, verification_status
    FROM action_summary_projection
    WHERE organization_id=? AND action_id != ? AND status IN ('verified','cancelled')
      AND (department=? OR priority=? OR risk_level=? OR (strategic_priority IS NOT NULL AND strategic_priority=?))
    ORDER BY completion_date DESC LIMIT 25
  `).bind(organizationId, actionId, action.department, action.priority, action.risk_level, action.strategic_priority || '__none__').all()).results || [];

  const scored = rows.map(r => {
    const matchedOn = [];
    if (r.department && r.department === action.department) matchedOn.push('department');
    if (r.priority === action.priority) matchedOn.push('priority');
    if (r.risk_level && r.risk_level === action.risk_level) matchedOn.push('risk level');
    if (r.strategic_priority && r.strategic_priority === action.strategic_priority) matchedOn.push('strategic priority');
    return { action_id: r.action_id, recommendation: r.recommendation, status: r.status, completion_date: r.completion_date, verification_status: r.verification_status, matched_on: matchedOn, match_strength: matchedOn.length };
  }).sort((a, b) => b.match_strength - a.match_strength).slice(0, limit);

  return {
    ok: true, action_id: actionId, similar_actions: scored,
    disclosure: 'Similarity is based on real, shared governed fields (department, priority, risk level, strategic priority) against resolved Actions only — not a semantic or AI-judged similarity.',
  };
}

// ============================================================
// Part 8 — Knowledge Graph
// Assembles real nodes/edges from actual linked records — no invented
// relationship. Bounded (single focus Action plus its direct neighbors)
// so the graph stays a real, inspectable local view, not a fabricated
// whole-organization web.
// ============================================================
export async function buildKnowledgeGraph(env, organizationId, focusActionId) {
  const action = await env.DB.prepare('SELECT * FROM action_summary_projection WHERE action_id=? AND organization_id=?').bind(focusActionId, organizationId).first();
  if (!action) return { ok: false, error: 'not_found' };

  const nodes = [];
  const edges = [];
  const addNode = (id, type, label) => { if (!nodes.find(n => n.id === id)) nodes.push({ id, type, label }); };
  const addEdge = (from, to, label) => edges.push({ from, to, label });

  addNode(`action:${action.action_id}`, 'action', action.recommendation || action.action_id);
  if (action.project_id) { addNode(`project:${action.project_id}`, 'project', action.project_id); addEdge(`action:${action.action_id}`, `project:${action.project_id}`, 'belongs to'); }
  if (action.owner) { addNode(`owner:${action.owner}`, 'person', action.owner_display_name || action.owner); addEdge(`action:${action.action_id}`, `owner:${action.owner}`, 'owned by'); }
  if (action.strategic_priority) { addNode(`priority:${action.strategic_priority}`, 'strategic_priority', action.strategic_priority); addEdge(`action:${action.action_id}`, `priority:${action.strategic_priority}`, 'advances'); }
  if (action.report_id) { addNode(`report:${action.report_id}`, 'report', action.report_id); addEdge(`action:${action.action_id}`, `report:${action.report_id}`, 'originated from'); }

  const history = (await env.DB.prepare('SELECT id, history_type, actor_id, actor_role, created_at FROM action_history WHERE action_id=? AND organization_id=? ORDER BY created_at DESC LIMIT 8').bind(focusActionId, organizationId).all()).results || [];
  history.forEach(h => {
    addNode(`event:${h.id}`, 'event', `${h.history_type} (${h.created_at?.slice(0, 10)})`);
    addEdge(`action:${action.action_id}`, `event:${h.id}`, 'has event');
    if (h.actor_id) { addNode(`actor:${h.actor_id}`, 'person', h.actor_role || h.actor_id); addEdge(`event:${h.id}`, `actor:${h.actor_id}`, 'performed by'); }
  });

  const raw = await env.DB.prepare('SELECT evidence_after_json FROM management_response_actions WHERE id=? AND organization_id=?').bind(focusActionId, organizationId).first();
  try {
    const evidenceList = JSON.parse(raw?.evidence_after_json || '[]');
    evidenceList.forEach((e, i) => { addNode(`evidence:${focusActionId}:${i}`, 'evidence', e.description || e.url || `Evidence ${i + 1}`); addEdge(`action:${action.action_id}`, `evidence:${focusActionId}:${i}`, 'supported by'); });
  } catch (_) {}

  return { ok: true, focus_action_id: focusActionId, nodes, edges };
}

// ============================================================
// Part 6 — Recommendation Engine (extends Sprint 3's Decisions Required)
// Adds explicit priority/urgency/dependencies fields the brief asks for
// by name. Dependencies are only ever real, checkable relationships
// (same-project other overdue Actions) — "none identified" when there
// genuinely are none, never a fabricated dependency chain.
// ============================================================
export async function buildRecommendations(env, organizationId, role) {
  const evaluation = await evaluateExecutiveInsights(env, organizationId, { role });
  const decisions = buildDecisionsRequired(evaluation);
  const withDependencies = await Promise.all(decisions.decisions.map(async (d) => {
    const insight = evaluation.insights.find(i => i.rule_id === d.rule_id && d.decision_required.includes(i.message.slice(0, 30)));
    let dependencies = 'none identified';
    if (insight?.affected_scope) {
      const siblingRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM action_summary_projection WHERE organization_id=? AND project_id=? AND overdue_since IS NOT NULL`).bind(organizationId, insight.affected_scope).first();
      if ((siblingRow?.n || 0) > 1) dependencies = `${siblingRow.n - 1} other overdue Action(s) in the same project (${insight.affected_scope}) may share the same blocker.`;
    }
    const urgency = d.severity === 'critical' ? 'immediate' : d.severity === 'high' ? 'this week' : 'this reporting period';
    return { ...d, priority: d.severity, urgency, dependencies };
  }));
  return { ok: true, generated_at: evaluation.generated_at, recommendations: withDependencies };
}

// ============================================================
// Part 9 — Executive Narrative Generator
// Deterministic per-audience framing over the SAME real numbers already
// verified in Sprint 3 (portfolio, insights, decisions required) — never
// the unrelated synthetic-publication engine (different product,
// different data model). Every sentence below embeds a real figure.
// ============================================================
const AUDIENCE_FRAMING = Object.freeze({
  board: { label: 'Board Brief', tone: 'governance and fiduciary oversight', closing: 'The Board is asked to note the items above and confirm leadership has the mandate needed to act.' },
  donor: { label: 'Donor Brief', tone: 'accountability and results against commitments', closing: 'This brief reflects the governed record only; every figure is independently traceable to source Actions and evidence.' },
  government: { label: 'Government Brief', tone: 'public accountability and service delivery', closing: 'Prepared for government stakeholder review; figures reflect the organization\'s own governed decision record.' },
  cabinet: { label: 'Cabinet Brief', tone: 'strategic decision-making at the highest level', closing: 'Cabinet is asked to weigh in on the Decisions Required section before the next reporting cycle.' },
  partner: { label: 'Partner Brief', tone: 'shared delivery and joint accountability', closing: 'Shared for partner coordination; see the Evidence Explorer for full traceability.' },
  management: { label: 'Management Brief', tone: 'operational execution', closing: 'Operational teams should treat the Decisions Required section as the current action list.' },
});

export async function buildNarrativeBrief(env, organizationId, audience, role) {
  const framing = AUDIENCE_FRAMING[audience];
  if (!framing) return { ok: false, error: `Unknown audience "${audience}". Valid: ${Object.keys(AUDIENCE_FRAMING).join(', ')}` };

  const portfolio = await getOrganizationPortfolio(env, organizationId);
  const evaluation = await evaluateExecutiveInsights(env, organizationId, { role });
  const decisionsRequired = buildDecisionsRequired(evaluation);
  const topInsights = evaluation.insights.slice(0, 3);

  if (!portfolio.available) return { ok: true, available: false, reason: portfolio.reason };

  const paragraphs = [
    `This ${framing.label} covers ${portfolio.total_actions} governed institutional commitment(s), framed for ${framing.tone}.`,
    `${portfolio.completion_rate != null ? Math.round(portfolio.completion_rate * 100) : '—'}% of commitments are complete or verified; ${portfolio.verification_rate != null ? Math.round(portfolio.verification_rate * 100) : '—'}% of completed work has been independently verified.`,
    `${portfolio.overdue_count} commitment(s) are currently overdue and ${portfolio.escalated_count} are escalated and unresolved.`,
    topInsights.length ? `The most urgent issue right now: ${topInsights[0].message}` : 'No urgent issue is currently flagged by the insight engine.',
    decisionsRequired.decisions.length ? `${decisionsRequired.decisions.length} decision(s) currently require leadership authority — see the Decisions Required section.` : 'No decision currently requires leadership intervention.',
    framing.closing,
  ];

  return {
    ok: true, available: true, audience, label: framing.label, organization_id: organizationId,
    generated_at: evaluation.generated_at, paragraphs,
    evidence_refs: topInsights.map(i => ({ rule_id: i.rule_id, message: i.message, link: i.link })),
    disclosure: 'Every figure above is read directly from the governed Decision Platform at generation time — no figure is estimated, generated, or paraphrased from a prior report.',
  };
}

// ============================================================
// Part 1 — Executive Copilot
// A curated intent matcher, NOT a chatbot. Each intent has a fixed
// trigger pattern and a handler that runs a real query and returns a
// fully evidenced answer. An unmatched question gets an honest refusal
// listing what CAN be asked — never a best-effort guess.
// ============================================================
async function answerCompareDepartments(env, organizationId) {
  const rows = (await env.DB.prepare(`
    SELECT department, COUNT(*) as total, SUM(CASE WHEN overdue_since IS NOT NULL THEN 1 ELSE 0 END) as overdue_n,
      SUM(CASE WHEN status IN ('completed','verified') THEN 1 ELSE 0 END) as completed_n
    FROM action_summary_projection WHERE organization_id=? AND department IS NOT NULL AND department != '' GROUP BY department ORDER BY total DESC
  `).bind(organizationId).all()).results || [];
  if (!rows.length) return { answer_text: 'No Action in this organization has a department recorded yet, so a department comparison is not possible.', evidence: [], confidence: 'none', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  const lines = rows.map(r => `${r.department}: ${r.total} Actions, ${r.overdue_n} overdue (${Math.round((r.overdue_n / r.total) * 100)}%), ${r.completed_n} completed/verified.`);
  return {
    answer_text: `Comparing ${rows.length} departments by real Action counts:\n${lines.join('\n')}`,
    evidence: rows.map(r => ({ department: r.department, total: r.total, overdue: r.overdue_n, completed: r.completed_n })),
    confidence: 'high (direct count over governed records)', affected_projects: [], affected_indicators: ['overdue_count', 'completed_count'],
    recommended_actions: rows.filter(r => r.total > 0 && r.overdue_n / r.total > 0.3).map(r => `Review ${r.department}'s workload — over 30% of its Actions are overdue.`),
  };
}

async function answerCompareProjects(env, organizationId) {
  const result = await listProjectPortfolios(env, organizationId);
  if (!result.projects.length) return { answer_text: 'No project has governed Actions yet.', evidence: [], confidence: 'none', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  const strongest = [...result.projects].sort((a, b) => (b.completion_rate || 0) - (a.completion_rate || 0))[0];
  const weakest = [...result.projects].sort((a, b) => (a.completion_rate || 0) - (b.completion_rate || 0))[0];
  return {
    answer_text: `Comparing ${result.projects.length} projects: strongest by completion rate is ${strongest.project_id} (${Math.round((strongest.completion_rate || 0) * 100)}%); weakest is ${weakest.project_id} (${Math.round((weakest.completion_rate || 0) * 100)}%).`,
    evidence: result.projects.map(p => ({ project_id: p.project_id, completion_rate: p.completion_rate, overdue_count: p.overdue_count, total_actions: p.total_actions })),
    confidence: 'high (direct portfolio projection)', affected_projects: result.projects.map(p => p.project_id), affected_indicators: ['completion_rate', 'overdue_count'],
    recommended_actions: weakest.overdue_count > 0 ? [`Review ${weakest.project_id} directly — it has the weakest completion rate in the portfolio.`] : [],
  };
}

async function answerCompareRegions(env, organizationId) {
  const rows = (await env.DB.prepare(`
    SELECT r.region, COUNT(*) as total, SUM(CASE WHEN resp.status='completed' THEN 1 ELSE 0 END) as completed_n,
      SUM(CASE WHEN resp.overall_sentiment='positive' THEN 1 ELSE 0 END) as positive_n
    FROM responses resp JOIN respondents r ON r.id = resp.respondent_id
    JOIN campaigns c ON c.id = resp.campaign_id
    WHERE c.organization_id=? AND r.region IS NOT NULL AND r.region != '' GROUP BY r.region ORDER BY total DESC LIMIT 20
  `).bind(organizationId).all()).results || [];
  if (!rows.length) return { answer_text: 'No survey response in this organization has a respondent region recorded yet, so a regional comparison is not possible.', evidence: [], confidence: 'none', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  const lines = rows.map(r => `${r.region}: ${r.total} responses, ${Math.round((r.completed_n / r.total) * 100)}% completed, ${Math.round((r.positive_n / r.total) * 100)}% positive sentiment.`);
  return {
    answer_text: `Comparing ${rows.length} regions by real survey response data (voice/survey data, not the Decision Action model):\n${lines.join('\n')}`,
    evidence: rows.map(r => ({ region: r.region, total_responses: r.total, completion_rate: Math.round((r.completed_n / r.total) * 1000) / 1000, positive_sentiment_rate: Math.round((r.positive_n / r.total) * 1000) / 1000 })),
    confidence: 'high (direct count over governed response records)', affected_projects: [], affected_indicators: ['response_completion_rate', 'sentiment'],
    recommended_actions: [],
  };
}

async function answerCompareSurveys(env, organizationId) {
  const rows = (await env.DB.prepare(`
    SELECT s.title, COUNT(resp.id) as total, SUM(CASE WHEN resp.status='completed' THEN 1 ELSE 0 END) as completed_n
    FROM responses resp JOIN campaigns c ON c.id = resp.campaign_id JOIN surveys s ON s.id = c.survey_id
    WHERE c.organization_id=? GROUP BY s.id ORDER BY total DESC LIMIT 20
  `).bind(organizationId).all()).results || [];
  if (!rows.length) return { answer_text: 'No survey in this organization has responses yet, so a survey comparison is not possible.', evidence: [], confidence: 'none', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  const lines = rows.map(r => `"${r.title}": ${r.total} responses, ${Math.round((r.completed_n / r.total) * 100)}% completion rate.`);
  return {
    answer_text: `Comparing ${rows.length} surveys:\n${lines.join('\n')}`,
    evidence: rows.map(r => ({ survey: r.title, total_responses: r.total, completion_rate: Math.round((r.completed_n / r.total) * 1000) / 1000 })),
    confidence: 'high (direct count over governed response records)', affected_projects: [], affected_indicators: ['response_completion_rate'],
    recommended_actions: rows.filter(r => r.completed_n / r.total < 0.5).map(r => `"${r.title}" has a completion rate under 50% — review its instrument length or delivery channel.`),
  };
}

async function answerSummarizeRisks(env, organizationId, role) {
  const evaluation = await evaluateExecutiveInsights(env, organizationId, { role });
  const critHigh = evaluation.insights.filter(i => i.severity === 'critical' || i.severity === 'high');
  if (!critHigh.length) return { answer_text: 'No critical or high-severity risk is currently flagged by the insight engine.', evidence: [], confidence: 'high', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  return {
    answer_text: `${critHigh.length} critical/high-severity risk(s) are currently open:\n${critHigh.slice(0, 10).map(i => `[${i.severity.toUpperCase()}] ${i.message}`).join('\n')}`,
    evidence: critHigh.map(i => ({ rule_id: i.rule_id, severity: i.severity, message: i.message, link: i.link })),
    confidence: 'high (direct rule evaluation over governed data)',
    affected_projects: [...new Set(critHigh.map(i => i.affected_scope).filter(Boolean))],
    affected_indicators: [...new Set(critHigh.map(i => i.rule_id))],
    recommended_actions: critHigh.slice(0, 5).map(i => i.recommended_next_step),
  };
}

async function answerExplainOverdue(env, organizationId) {
  const rows = (await env.DB.prepare(`SELECT action_id, recommendation, owner_display_name, overdue_since FROM action_summary_projection WHERE organization_id=? AND overdue_since IS NOT NULL ORDER BY overdue_since ASC LIMIT 10`).bind(organizationId).all()).results || [];
  if (!rows.length) return { answer_text: 'No Action is currently overdue.', evidence: [], confidence: 'high', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  return {
    answer_text: `${rows.length} overdue Action(s) shown (oldest first):\n${rows.map(r => `"${r.recommendation}" — overdue since ${r.overdue_since?.slice(0, 10)}, owner ${r.owner_display_name || 'unassigned'}.`).join('\n')}`,
    evidence: rows.map(r => ({ action_id: r.action_id, recommendation: r.recommendation, overdue_since: r.overdue_since, owner: r.owner_display_name })),
    confidence: 'high (direct governed record)', affected_projects: [], affected_indicators: ['overdue_since'],
    recommended_actions: ['Use Root Cause Intelligence on any of these Actions for possible contributing factors.'],
  };
}

async function answerIdentifyBottlenecks(env, organizationId) {
  const reviewQueue = await env.DB.prepare(`SELECT * FROM review_queue_projection WHERE organization_id=? AND project_id='__all__'`).bind(organizationId).first();
  const stages = [
    { name: 'Review queue', n: reviewQueue?.under_review_count || 0 },
    { name: 'Needs clarification', n: reviewQueue?.needs_clarification_count || 0 },
    { name: 'Verification queue', n: reviewQueue?.awaiting_verification_count || 0 },
  ].sort((a, b) => b.n - a.n);
  const bottleneck = stages[0];
  if (!bottleneck || bottleneck.n === 0) return { answer_text: 'No pipeline stage currently shows a meaningful backlog.', evidence: [], confidence: 'medium', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  return {
    answer_text: `The largest current bottleneck is the ${bottleneck.name} (${bottleneck.n} Actions waiting). Full breakdown: ${stages.map(s => `${s.name}: ${s.n}`).join(', ')}.`,
    evidence: stages, confidence: 'high (direct governed queue depth)', affected_projects: [], affected_indicators: ['review_backlog', 'verification_backlog'],
    recommended_actions: [`Prioritize clearing the ${bottleneck.name}.`],
  };
}

async function answerStrongestWeakestProgrammes(env, organizationId, wantStrongest) {
  const result = await listProjectPortfolios(env, organizationId);
  if (!result.projects.length) return { answer_text: 'No project has governed Actions yet.', evidence: [], confidence: 'none', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  const sorted = [...result.projects].sort((a, b) => wantStrongest ? (b.completion_rate || 0) - (a.completion_rate || 0) : (a.completion_rate || 0) - (b.completion_rate || 0));
  const top3 = sorted.slice(0, 3);
  return {
    answer_text: `${wantStrongest ? 'Strongest' : 'Weakest'} programme(s) by completion rate: ${top3.map(p => `${p.project_id} (${Math.round((p.completion_rate || 0) * 100)}%)`).join(', ')}.`,
    evidence: top3, confidence: 'high (direct portfolio projection)', affected_projects: top3.map(p => p.project_id), affected_indicators: ['completion_rate'],
    recommended_actions: wantStrongest ? [] : [`Review ${top3[0]?.project_id} directly for possible causes.`],
  };
}

async function answerLeadershipIntervention(env, organizationId, role) {
  const evaluation = await evaluateExecutiveInsights(env, organizationId, { role });
  const decisionsRequired = buildDecisionsRequired(evaluation);
  if (!decisionsRequired.decisions.length) return { answer_text: 'No item currently requires leadership intervention.', evidence: [], confidence: 'high', affected_projects: [], affected_indicators: [], recommended_actions: [] };
  return {
    answer_text: `${decisionsRequired.decisions.length} item(s) require leadership intervention:\n${decisionsRequired.decisions.slice(0, 10).map(d => `[${d.severity.toUpperCase()}] ${d.decision_required} — deadline ${d.decision_deadline}`).join('\n')}`,
    evidence: decisionsRequired.decisions, confidence: 'high (direct rule evaluation)', affected_projects: [], affected_indicators: [...new Set(decisionsRequired.decisions.map(d => d.rule_id))],
    recommended_actions: decisionsRequired.decisions.slice(0, 5).map(d => d.consequence_of_inaction),
  };
}

const COPILOT_INTENTS = Object.freeze([
  { id: 'compare-departments', pattern: /compar.*department/i, handler: (env, org) => answerCompareDepartments(env, org) },
  { id: 'compare-projects', pattern: /compar.*(project|programme)/i, handler: (env, org) => answerCompareProjects(env, org) },
  { id: 'compare-regions', pattern: /compar.*region/i, handler: (env, org) => answerCompareRegions(env, org) },
  { id: 'compare-surveys', pattern: /compar.*survey/i, handler: (env, org) => answerCompareSurveys(env, org) },
  { id: 'summarize-risks', pattern: /(summar|major).*risk/i, handler: (env, org, role) => answerSummarizeRisks(env, org, role) },
  { id: 'explain-overdue', pattern: /overdue/i, handler: (env, org) => answerExplainOverdue(env, org) },
  { id: 'identify-bottlenecks', pattern: /bottleneck/i, handler: (env, org) => answerIdentifyBottlenecks(env, org) },
  { id: 'strongest-programmes', pattern: /strongest/i, handler: (env, org) => answerStrongestWeakestProgrammes(env, org, true) },
  { id: 'weakest-programmes', pattern: /weakest|declin/i, handler: (env, org) => answerStrongestWeakestProgrammes(env, org, false) },
  { id: 'leadership-intervention', pattern: /intervention|leadership.*(need|requir)/i, handler: (env, org, role) => answerLeadershipIntervention(env, org, role) },
  { id: 'why-delayed', pattern: /why.*(delay|late|behind)/i, handler: (env, org) => answerExplainOverdue(env, org) },
]);

export async function askCopilot(env, organizationId, role, question) {
  const q = String(question || '').trim();
  if (!q) return { ok: false, error: 'A question is required.' };

  const intent = COPILOT_INTENTS.find(i => i.pattern.test(q));
  if (!intent) {
    return {
      ok: true, matched: false, question: q,
      answer_text: `This Copilot only answers questions it can back with real evidence — it does not guess. It doesn't recognize this specific question yet. Things it can answer: ${COPILOT_INTENTS.map(i => i.id.replace(/-/g, ' ')).join('; ')}.`,
      evidence: [], confidence: 'none', source: null, affected_projects: [], affected_indicators: [], recommended_actions: [],
    };
  }

  const result = await intent.handler(env, organizationId, role);
  return {
    ok: true, matched: true, intent: intent.id, question: q,
    answer_text: result.answer_text, evidence: result.evidence, confidence: result.confidence,
    source: 'governed Decision Platform / survey response records (live query, not cached)',
    affected_projects: result.affected_projects, affected_indicators: result.affected_indicators,
    recommended_actions: result.recommended_actions,
  };
}

export { COPILOT_INTENTS, ROOT_CAUSE_RULES, AUDIENCE_FRAMING };
