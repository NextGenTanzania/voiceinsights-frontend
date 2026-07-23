// Decision, Policy, Donor and Government Intelligence — PX Release 9
// (Global Knowledge Intelligence System), Parts 4-8.
//
// Every function here is a deterministic classifier or checklist reading
// ONLY fields already real on the governed model (owner, timeline,
// budget_requirement, expected_risk, standards, statistical_intelligence,
// regional breakdown). None of it invents a number, a claim, or a piece
// of evidence — a classification's "rationale" always names the real
// field or keyword match that produced it, so every decision is
// explainable and auditable, per this release's own implementation rules.
import { AUDIENCE_THINKING_PROFILES } from './flagship-editorial-brain.js';
import { frameworksForDomain } from './flagship-knowledge-router.js';
import { sectorKnowledgeFor } from './flagship-sector-knowledge.js';

export const FLAGSHIP_DECISION_INTELLIGENCE_VERSION = 'flagship-decision-intelligence-v1';

// ------------------------------------------------------------------
// Part 4: Policy Intelligence — which real policy lever a recommendation
// actually pulls, read from its own text and budget field.
// ------------------------------------------------------------------
const POLICY_LEVER_RULES = Object.freeze([
  { lever: 'Budgeting', pattern: /budget|financ|fund|resourc/i, field: 'budget_requirement/recommendation text' },
  { lever: 'Regulation', pattern: /directive|compact|mandate|polic|regulat/i, field: 'recommendation text' },
  { lever: 'Accountability', pattern: /scorecard|dashboard|review|monitor|accountab/i, field: 'recommendation text' },
  { lever: 'Institutional Behaviour', pattern: /office|unit|team|coordinat/i, field: 'recommendation text' },
]);

export function classifyPolicyLever(recommendation = {}) {
  const haystack = `${recommendation.recommendation || ''} ${recommendation.budget_requirement || ''}`;
  for (const rule of POLICY_LEVER_RULES) {
    if (rule.pattern.test(haystack)) {
      return { lever: rule.lever, rationale: `Matched against ${rule.field}.` };
    }
  }
  return { lever: 'Implementation Guidance', rationale: 'No stronger policy-lever signal matched; defaults to operational implementation guidance.' };
}

// ------------------------------------------------------------------
// Part 5: Decision Intelligence — a recommendation may genuinely pull
// more than one lever (e.g. both Financial and Political), so this
// returns every real, keyword- or field-grounded match rather than
// forcing one label. Owner-derived fields (approvalLevel,
// politicalSensitivity) are a real lookup over the already-governed
// `owner` field, not a new fabricated attribute.
// ------------------------------------------------------------------
const DECISION_TYPE_RULES = Object.freeze([
  { type: 'Financial', test: r => /budget line|multi-year|dedicated/i.test(r.budget_requirement || '') },
  { type: 'Regulatory', test: r => /directive|regulat|mandate/i.test(r.recommendation || '') },
  { type: 'Technology', test: r => /technology|digital|system/i.test(r.recommendation || '') },
  { type: 'Capacity Building', test: r => /capacity|training|skills/i.test(r.recommendation || '') },
  { type: 'Monitoring', test: r => /scorecard|monitor|review|evidence/i.test(r.recommendation || '') },
  { type: 'Immediate', test: r => /0.?90 days/.test(r.timeline || '') },
  { type: 'Strategic', test: r => /6.?18 months/.test(r.timeline || '') },
]);
const APPROVAL_LEVEL_BY_OWNER_PATTERN = Object.freeze([
  { pattern: /permanent secretary|minister/i, level: 'Cabinet-level approval' },
  { pattern: /chief executive|board sponsor/i, level: 'Board-level approval' },
  { pattern: /humanitarian coordinator|cluster lead/i, level: 'Cluster-level approval' },
  { pattern: /principal investigator/i, level: 'Institutional review approval' },
  { pattern: /country director|programme executive/i, level: 'Country-office approval' },
]);
const POLITICAL_SENSITIVITY_BY_OWNER_PATTERN = Object.freeze([
  { pattern: /permanent secretary|minister|chief executive|board sponsor/i, sensitivity: 'High' },
  { pattern: /country director|programme executive|humanitarian coordinator/i, sensitivity: 'Medium' },
  { pattern: /principal investigator/i, sensitivity: 'Low' },
]);
function lookupByOwner(owner, table, fallback) {
  const match = table.find(entry => entry.pattern.test(owner || ''));
  return match ? (match.level || match.sensitivity) : fallback;
}

// PX Release 10, Part 9 (Executive Decision Layer): classifies a
// recommendation into the named decision categories the brief requests
// (Strategic/Policy/Investment/Operational/Board/Cabinet/Donor/
// Institutional/Community). Reuses classifyPolicyLever (above) rather
// than re-deriving a second, parallel lever signal, and reuses the same
// owner-pattern approach already established for approvalLevel/
// politicalSensitivity — a recommendation may genuinely belong to more
// than one category (a CRITICAL, Ministry-owned, budget-heavy decision is
// honestly both Strategic and Cabinet and Investment at once).
const DECISION_CATEGORY_RULES = Object.freeze([
  { category: 'Cabinet Decision', test: r => /permanent secretary|minister/i.test(r.owner || '') },
  { category: 'Board Decision', test: r => /chief executive|board sponsor/i.test(r.owner || '') },
  { category: 'Donor Decision', test: r => /donor|financing partner/i.test(r.recommendation || '') },
  { category: 'Community Decision', test: r => /communit/i.test(r.recommendation || '') },
  { category: 'Investment Decision', test: r => classifyPolicyLever(r).lever === 'Budgeting' },
  { category: 'Institutional Decision', test: r => /humanitarian coordinator|cluster lead|principal investigator|office|unit|team|coordinat/i.test(`${r.owner || ''} ${r.recommendation || ''}`) },
  { category: 'Policy Decision', test: r => classifyPolicyLever(r).lever === 'Regulation' },
  { category: 'Strategic Decision', test: r => String(r.priority || r.strategic_priority || '').toUpperCase() === 'CRITICAL' },
]);
function classifyDecisionCategory(recommendation) {
  const matched = DECISION_CATEGORY_RULES.filter(rule => rule.test(recommendation)).map(rule => rule.category);
  return matched.length ? matched : ['Operational Decision'];
}

export function buildDecisionIntelligence(recommendation = {}) {
  const decisionTypes = DECISION_TYPE_RULES.filter(rule => rule.test(recommendation)).map(rule => rule.type);
  if (!decisionTypes.length) decisionTypes.push('Operational');
  const priority = String(recommendation.priority || recommendation.strategic_priority || '').toUpperCase();
  const budgetTier = /high/i.test(recommendation.budget_requirement || '') ? 'High' : /medium/i.test(recommendation.budget_requirement || '') ? 'Medium' : 'Low';
  const implementationDifficulty = priority === 'CRITICAL' && budgetTier !== 'Low' ? 'High' : priority === 'MEDIUM' && budgetTier === 'Low' ? 'Low' : 'Medium';
  return {
    decisionTypes,
    decisionCategory: classifyDecisionCategory(recommendation),
    policyLever: classifyPolicyLever(recommendation).lever,
    approvalLevel: lookupByOwner(recommendation.owner, APPROVAL_LEVEL_BY_OWNER_PATTERN, 'Institutional approval'),
    politicalSensitivity: lookupByOwner(recommendation.owner, POLITICAL_SENSITIVITY_BY_OWNER_PATTERN, 'Medium'),
    implementationDifficulty,
    // Every remaining field is a direct pointer to a real field already on
    // the recommendation — not recomputed, so it can never drift from it.
    owner: recommendation.owner || null,
    timeHorizon: recommendation.timeline || null,
    financialFeasibility: recommendation.budget_requirement || null,
    expectedImpact: recommendation.expected_benefit || null,
    dependencies: recommendation.dependencies || [],
    risks: recommendation.expected_risk || null,
    successMetric: recommendation.monitoring_indicator || null,
  };
}

// ------------------------------------------------------------------
// Part 6: Donor Intelligence — real, checkable dimensions donors
// evaluate, each grounded in a field already on the report (never a new
// donor-specific data point).
// ------------------------------------------------------------------
export function checkDonorIntelligence(report = {}) {
  const standards = (report.international_standards || []).map(s => s.framework || '');
  const timelines = (report.recommendations || []).map(r => r.timeline || '');
  return [
    { dimension: 'Value for Money', present: Boolean(report.executive_book?.budget_implications), rationale: 'executive_book.budget_implications' },
    { dimension: 'Sustainability', present: timelines.some(t => /6.?18 months/.test(t)), rationale: 'At least one recommendation carries a 6-18 month horizon, not only immediate action.' },
    { dimension: 'Leave No One Behind', present: standards.some(s => /leave no one behind/i.test(s)), rationale: 'international_standards' },
    { dimension: 'Gender', present: standards.some(s => /gender/i.test(s)), rationale: 'international_standards' },
    { dimension: 'Disability Inclusion', present: standards.some(s => /disability/i.test(s)), rationale: 'international_standards' },
    { dimension: 'Safeguarding', present: standards.some(s => /safeguard|protection|chs/i.test(s)), rationale: 'international_standards' },
    { dimension: 'Evidence Quality', present: Boolean(report.statistical_intelligence?.confidence_intervals), rationale: 'statistical_intelligence.confidence_intervals' },
    { dimension: 'Risk Disclosure', present: (report.executive_book?.critical_risks || []).length > 0, rationale: 'executive_book.critical_risks' },
  ];
}

// ------------------------------------------------------------------
// Part 7: Government Intelligence — real readiness checks for the
// specific institutional uses a government reader named in the brief.
// ------------------------------------------------------------------
// `regional` is accepted explicitly (defaulting to report.full_publication?.
// regional for any caller that already has full_publication assembled) —
// flagship-sample-library.js computes government_intelligence before
// report.full_publication is set later in the same function, so relying on
// the field alone silently produced `ready:false` for every one of the 16
// real samples until this was caught by the Part 13 Prestige Review this
// same release adds (its "UN Country Representative" verdict is the check
// that actually surfaced this).
export function checkGovernmentIntelligence(report = {}, regional = report.full_publication?.regional) {
  const recs = report.recommendations || [];
  const allHave = field => recs.length > 0 && recs.every(r => Boolean(r[field]));
  return [
    { use: 'Cabinet paper', ready: allHave('owner') && allHave('timeline'), rationale: 'Every recommendation has a named owner and a due window.' },
    { use: 'Budget guidance', ready: allHave('budget_requirement'), rationale: 'Every recommendation carries a real budget band.' },
    { use: 'Implementation guidance', ready: allHave('monitoring_indicator'), rationale: 'Every recommendation carries a real monitoring indicator.' },
    { use: 'Parliament', ready: (report.international_standards || []).some(s => /sdg/i.test(s.framework || '')), rationale: 'A named SDG or statutory framework is referenced.' },
    { use: 'Ministries', ready: recs.some(r => /permanent secretary|minister/i.test(r.owner || '')), rationale: 'A recommendation names a Ministry-level owner.' },
    { use: 'Regional / local government', ready: Boolean((regional || []).length), rationale: 'A real regional breakdown exists to localize the recommendation.' },
  ];
}

// ------------------------------------------------------------------
// Part 8: Knowledge Validation — a pre-write self-check. Returns
// weaknesses BEFORE any generation-dependent text exists, exactly as
// this release's brief asks: "if weaknesses exist, return them before
// writing begins."
// ------------------------------------------------------------------
export function validateKnowledgeFit(routing) {
  const checks = [
    { check: 'Sector routed to a real domain', pass: Boolean(routing?.domain), rationale: 'routeKnowledge(sample).domain' },
    { check: 'International frameworks resolved for this domain', pass: frameworksForDomain(routing?.domain).length > 0, rationale: 'frameworksForDomain(domain)' },
    { check: 'Sector knowledge engine available for this domain', pass: Boolean(sectorKnowledgeFor(routing?.domain)), rationale: 'sectorKnowledgeFor(domain)' },
    { check: 'Audience recognized by the Editorial Brain', pass: Boolean(AUDIENCE_THINKING_PROFILES[routing?.audience]), rationale: 'AUDIENCE_THINKING_PROFILES[audience]' },
  ];
  return { valid: checks.every(c => c.pass), checks };
}
