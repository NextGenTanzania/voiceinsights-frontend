// Editorial Division Release — Publication Diversity + Sector Identity
// (Editorial Constitution, Article V).
//
// Pure deterministic classifier, same non-rendering pattern as
// flagship-narrative-arc.js and flagship-knowledge-router.js: it decides,
// it never calls build*Spread() or renders anything itself.
// composePublicationSpreads() keeps building every spread with the exact
// same real content it always has; this module only decides which of 3
// named middle segments leads, which dashboard-tile emphasis composes the
// Executive Dashboard spread, and which of 3 real formats the decision
// spreads render in.
//
// Sector-anchored, not per-publication-random: every real knowledge-router
// domain (flagship-knowledge-router.js's DOMAIN_BY_SECTOR) is assigned to
// exactly one of 5 editorial families below, so "Health feels different
// from Agriculture, Governance from Humanitarian" is a real, bounded,
// testable property (flagship-catalog-anti-repetition.test.js), not an
// unbounded per-publication shuffle. Publications that share a domain
// family are expected to share a fingerprint — that is correct, not a
// diversity failure, since they genuinely serve the same kind of executive
// question.
export const PUBLICATION_EDITORIAL_IDENTITY_VERSION = 'publication-editorial-identity-v1';

// Every domain flagship-knowledge-router.js's DOMAIN_BY_SECTOR currently
// resolves to (existing + the Editorial Division release's 8 new sectors),
// assigned to one family. Adding a genuinely new sector later only needs
// one row here, matching the same low-friction discipline
// flagship-knowledge-router.js's own header comment already establishes.
const FAMILY_BY_DOMAIN = Object.freeze({
  // Health family — clinical/patient-safety framing leads.
  'Health Intelligence': 'health',
  'Hospital Performance Intelligence': 'health',
  'Maternal & Child Health Intelligence': 'health',
  'Disease Surveillance Intelligence': 'health',
  'Nutrition Intelligence': 'health',
  'UHC and Health Financing Intelligence': 'health',
  // Governance family — accountability/compliance leads.
  'Governance Intelligence': 'governance',
  'Digital Government Intelligence': 'governance',
  'Social Protection Intelligence': 'governance',
  'WASH Access Intelligence': 'governance',
  'Justice and Legal Services Intelligence': 'governance',
  'Public Financial Management Intelligence': 'governance',
  // Humanitarian & Resilience family — severity/needs evidence leads.
  'Humanitarian Intelligence': 'humanitarian',
  'Climate Intelligence': 'humanitarian',
  'Food Security Intelligence': 'humanitarian',
  'Displacement and Durable Solutions Intelligence': 'humanitarian',
  // Livelihoods & Development family — outcome pathways lead.
  'Agriculture Intelligence': 'livelihoods',
  'Livelihood Intelligence': 'livelihoods',
  'Economic Development Intelligence': 'livelihoods',
  'Sustainable Development Intelligence': 'livelihoods',
  'Education Intelligence': 'livelihoods',
  'Energy Access Intelligence': 'livelihoods',
  'Youth Skills and Employability Intelligence': 'livelihoods',
  // Corporate & Market family — decision options/ROI lead.
  'Private Sector Intelligence': 'corporate',
  'Customer Experience Intelligence': 'corporate',
  'Employee Experience Intelligence': 'corporate',
  'Market Research Intelligence': 'corporate',
  'Financial Inclusion Intelligence': 'corporate',
});
const DEFAULT_FAMILY = 'livelihoods';

// Three real spine orders, built from the same 5 segments
// composePublicationSpreads() always builds (front/evidence/decision/
// governance/close) — front and close are always pinned; these only
// reorder the 3 middle segments, they never add, remove, or duplicate a
// spread. 'evidence-led' is the existing, original order (the baseline
// every publication used before this release), so publications in
// families not listed keep today's exact behaviour.
const SPINE_ORDER = Object.freeze({
  'evidence-led': ['evidence', 'decision', 'governance'],
  'governance-led': ['governance', 'evidence', 'decision'],
  'decision-led': ['decision', 'evidence', 'governance'],
});

// Which real KPI figures lead the Executive Dashboard spread — a
// selection/ordering choice among figures every publication already
// computes (recommendation counts by priority, evidence confidence,
// regional spread, budget bands), never a fabricated metric.
const DASHBOARD_EMPHASIS = Object.freeze({
  'clinical-safety': ['critical_findings', 'evidence_confidence', 'regional_spread', 'recommendation_urgency'],
  'delivery-accountability': ['recommendation_urgency', 'critical_findings', 'budget_commitment', 'regional_spread'],
  'resilience-continuity': ['critical_findings', 'regional_spread', 'evidence_confidence', 'recommendation_urgency'],
  'outcome-pathways': ['evidence_confidence', 'recommendation_urgency', 'regional_spread', 'budget_commitment'],
  'performance-growth': ['budget_commitment', 'recommendation_urgency', 'evidence_confidence', 'critical_findings'],
});

const FAMILY_IDENTITY = Object.freeze({
  health: { spine: 'evidence-led', dashboard: 'clinical-safety', recommendationFormat: 'matrix-table' },
  governance: { spine: 'governance-led', dashboard: 'delivery-accountability', recommendationFormat: 'ranked-list' },
  humanitarian: { spine: 'evidence-led', dashboard: 'resilience-continuity', recommendationFormat: 'narrative-block' },
  livelihoods: { spine: 'evidence-led', dashboard: 'outcome-pathways', recommendationFormat: 'ranked-list' },
  corporate: { spine: 'decision-led', dashboard: 'performance-growth', recommendationFormat: 'matrix-table' },
});

// familyFor(domain): the one lookup every other function in this module
// builds on. Unknown domains (a sector added without updating the table
// above) fall back to the same default family flagship-knowledge-router.js
// uses for unmapped sectors — never a crash, never a silently invented one.
export function familyFor(domain) {
  return FAMILY_BY_DOMAIN[domain] || DEFAULT_FAMILY;
}

// resolveEditorialIdentity(domain): the single exported entry point
// composePublicationSpreads() calls. Returns the real, bounded combination
// for this publication's real knowledge-router domain — spine segment
// order, dashboard tile emphasis, and recommendation presentation format.
export function resolveEditorialIdentity(domain) {
  const family = familyFor(domain);
  const identity = FAMILY_IDENTITY[family];
  return {
    family,
    spine: identity.spine,
    middleSegmentOrder: SPINE_ORDER[identity.spine],
    dashboardEmphasis: identity.dashboard,
    dashboardTileOrder: DASHBOARD_EMPHASIS[identity.dashboard],
    recommendationFormat: identity.recommendationFormat,
  };
}

// identityFingerprint(identity): the literal, testable form of "two
// publications should never feel like copies of each other" — a compact
// string encoding all 3 real dimensions, so
// flagship-catalog-anti-repetition.test.js can assert every family present
// in the catalog produces a fingerprint no other family shares, and that
// publications within one family are internally consistent.
export function identityFingerprint(identity) {
  return `${identity.spine}|${identity.dashboardEmphasis}|${identity.recommendationFormat}`;
}

export function allFamilies() {
  return Object.keys(FAMILY_IDENTITY);
}
