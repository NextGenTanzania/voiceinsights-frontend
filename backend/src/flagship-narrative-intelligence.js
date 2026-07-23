// Publication Intelligence Layer — PX Release 10, Parts 1, 2, 3, 5, 6, 7.
//
// Deterministic COMMENTARY generation, distinct from both the Editorial
// Brain (PX Release 8, which plans but never writes) and the existing
// FINDING_FRAMES/EDITORIAL_LENSES/QUOTE_FRAMES pools in
// flagship-sample-library.js (which this release does not touch, per its
// own "do not redesign existing components" rule). Every function here
// DOES write real sentences — that is the point of this release — but
// every sentence is built from fields already real on the governed model
// (owner, timeline, priority, expected_benefit, expected_risk,
// dependencies, confidence_score, region), never a new invented claim,
// number, or benchmark. No LLM call anywhere in this file.
//
// This module is independent from rendering: it is imported and called
// only from flagship-sample-library.js, and its output is attached to the
// model for inspection (report.executive_commentary, etc.) — it does not
// import from, or get consumed by, publication-spread-composer.js or any
// other rendering file. Whether/how a future release chooses to surface
// this commentary in the rendered publication is explicitly out of scope
// here, matching this release's "do not redesign existing pages" rule.
import { classifyPolicyLever } from './flagship-decision-intelligence.js';

export const FLAGSHIP_NARRATIVE_INTELLIGENCE_VERSION = 'flagship-narrative-intelligence-v1';

const lowerFirst = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const wrap = (n, len) => ((n % len) + len) % len;

// ------------------------------------------------------------------
// Part 1: Executive Commentary — answers "why leadership should care"
// without repeating the finding or recommendation sentence itself. Five
// genuinely distinct sentence architectures (owner-led, benefit-led,
// risk-led, budget/accountability-led, tier-led), matching the same
// "different opening, different clause order" discipline FINDING_FRAMES
// already established elsewhere in this codebase.
// ------------------------------------------------------------------
const EXECUTIVE_COMMENTARY_FRAMES = [
  rec => `For ${rec.owner || 'the accountable owner'}, this is not a monitoring item — it is a ${String(rec.priority || rec.strategic_priority || '').toLowerCase()}-tier decision due within ${rec.timeline || 'the agreed window'}.`,
  rec => `The organisational implication is concrete: ${lowerFirst(rec.expected_benefit) || 'a measurable operational gain is available if this proceeds on schedule.'}`,
  rec => `Left to routine channels, the exposure is real — ${lowerFirst(rec.expected_risk) || 'delay carries its own cost'} — which is why this sits above a standing agenda item.`,
  rec => `What makes this an executive matter rather than an operational one is ownership: ${rec.owner || 'a named lead'} answers for the outcome, not only the process.`,
  rec => `The wider implication follows directly from the tier: a ${String(rec.priority || rec.strategic_priority || '').toLowerCase()}-priority decision now shapes what is realistically possible next reporting cycle.`,
];

export function buildExecutiveCommentary(recommendation = {}, seedIndex = 0, previousIndex = null) {
  let index = wrap(seedIndex, EXECUTIVE_COMMENTARY_FRAMES.length);
  if (previousIndex !== null && index === previousIndex && EXECUTIVE_COMMENTARY_FRAMES.length > 1) {
    index = wrap(index + 1, EXECUTIVE_COMMENTARY_FRAMES.length);
  }
  return { text: EXECUTIVE_COMMENTARY_FRAMES[index](recommendation), frameIndex: index };
}

// ------------------------------------------------------------------
// Part 2: Strategic Interpretation — a reusable block for "after every
// chart/table/comparison." Takes real numeric values as parameters (the
// caller supplies them from a real dataset — regional scores, evidence
// confidence, an indicator series); this function never invents the
// numbers, only frames what they mean.
// ------------------------------------------------------------------
export function buildStrategicInterpretation({ label, currentValue, priorValue = null, unit = '%', uncertaintyNote = null } = {}) {
  const changed = priorValue != null && Number.isFinite(currentValue) && Number.isFinite(priorValue) ? currentValue - priorValue : null;
  return {
    whatChanged: changed != null
      ? `${label} moved ${changed >= 0 ? 'up' : 'down'} by ${Math.abs(changed)}${unit} against the prior comparison point.`
      : `${label} is measured at ${currentValue}${unit}, with no prior comparison point available in this dataset.`,
    whyItMatters: 'This is the specific signal a decision-maker should weight — not the aggregate figure alone.',
    decisionEnabled: 'Confirms whether the linked recommendation should proceed as prioritised or be re-sequenced.',
    uncertaintyRemaining: uncertaintyNote || 'Sampling variation across groups has not been formally tested for statistical significance in this synthetic demonstration.',
    furtherEvidenceNeeded: 'A follow-up measurement in the next reporting cycle would confirm whether this is a sustained trend or a single-period reading.',
  };
}

// ------------------------------------------------------------------
// Part 3: "So What?" — every conditional consequence is grounded in a
// real field on the same recommendation (expected_risk, expected_benefit,
// timeline, dependencies) — never a new invented outcome.
// ------------------------------------------------------------------
export function buildSoWhat(recommendation = {}) {
  const dependency = (recommendation.dependencies || [])[0];
  return {
    ifIgnored: `${lowerFirst(recommendation.expected_risk) || 'The identified risk'} is likely to compound rather than stay static.`,
    ifAddressed: recommendation.expected_benefit || 'The evidence-linked benefit named for this decision becomes realistic.',
    ifAccelerated: `Compressing the ${recommendation.timeline || 'planned'} window brings the expected benefit forward, at the cost of less time to confirm ${dependency ? lowerFirst(dependency) : 'the operational baseline'}.`,
    ifDelayed: `Delay past ${recommendation.timeline || 'the planned window'} risks the same consequence named above compounding further before the next reporting cycle.`,
    ifScaled: dependency ? `Scaling this beyond its current scope would need the same dependency confirmed first: ${dependency}.` : 'Scaling this beyond its current scope has not been costed in this publication.',
    ifReplicated: 'Replication elsewhere would need the same real evidence base this decision relies on here, not an assumption that the pattern holds.',
  };
}

// ------------------------------------------------------------------
// Part 5: Policy Implications — separate from the recommendation itself;
// answers "what changes because of this finding," categorized. Every
// implication either reuses classifyPolicyLever (PX Release 9) or is
// derived from a directly-checkable real field (monitoring_indicator
// always exists, so "Monitoring implication" always appears — never a
// fabricated category with nothing behind it).
// ------------------------------------------------------------------
const POLICY_IMPLICATION_RULES = Object.freeze([
  { key: 'Budget implication', test: r => /budget|financ|fund/i.test(`${r.recommendation || ''} ${r.budget_requirement || ''}`), describe: r => `Budget described as "${r.budget_requirement}" would need to be reprioritised or newly allocated.` },
  { key: 'Institutional implication', test: r => /office|unit|team|coordinat/i.test(r.recommendation || ''), describe: () => 'Responsibility now sits with a named institutional function rather than an informal arrangement.' },
  { key: 'Governance implication', test: r => /accountab|oversight|govern|scorecard|dashboard/i.test(r.recommendation || ''), describe: () => 'An accountability mechanism is created where the evidence previously showed none.' },
  { key: 'Service delivery implication', test: r => /deliver|service|access|care/i.test(r.recommendation || ''), describe: () => 'Frontline delivery changes as a direct result, not only head-office practice.' },
  { key: 'Legislative implication', test: r => /directive|mandate|regulat|statut/i.test(r.recommendation || ''), describe: () => 'This is grounded in a directive-level decision, the kind that typically requires formal instruction to take effect.' },
]);

export function buildPolicyImplications(recommendation = {}) {
  const implications = POLICY_IMPLICATION_RULES
    .filter(rule => rule.test(recommendation))
    .map(rule => ({ implication: rule.key, description: rule.describe(recommendation) }));
  const { lever } = classifyPolicyLever(recommendation);
  implications.push({ implication: 'Policy implication', description: `This recommendation's primary policy lever is ${lever.toLowerCase()}.` });
  if (recommendation.monitoring_indicator) {
    implications.push({ implication: 'Monitoring implication', description: `A named monitoring indicator (${recommendation.monitoring_indicator}) now exists to verify whether this decision is actually being delivered.` });
  }
  return implications;
}

// ------------------------------------------------------------------
// Part 6: Evidence Commentary — real statistics about the evidence
// itself (count, confidence spread, regional diversity), never a claim
// about the underlying finding beyond what those statistics support.
// ------------------------------------------------------------------
export function buildEvidenceCommentary(linkedEvidence = []) {
  const scores = linkedEvidence.map(e => e?.confidence_score).filter(Number.isFinite);
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const regions = new Set(linkedEvidence.map(e => e?.region).filter(Boolean));
  return {
    strength: avg != null ? (avg >= 94 ? 'Strong' : avg >= 88 ? 'Moderate-to-strong' : 'Moderate') : 'Not assessed — no linked evidence carries a confidence score.',
    consistency: regions.size > 1 ? `Consistent across ${regions.size} distinct regions.` : regions.size === 1 ? 'Drawn from a single region — not yet cross-regionally validated.' : 'No region recorded for the linked evidence.',
    completeness: `${linkedEvidence.length} linked evidence record${linkedEvidence.length === 1 ? '' : 's'}.`,
    reliability: avg != null ? `Average confidence score of ${avg}% across linked records.` : 'No confidence score recorded.',
    limitations: 'Synthetic demonstration evidence; not valid for real-world decision use.',
    gaps: linkedEvidence.length < 2 ? 'Only one evidence record supports this finding — a second independent source would strengthen it.' : 'No gap beyond the standard synthetic-demonstration limitation.',
  };
}

// ------------------------------------------------------------------
// Part 7: Editorial transition phrases — short lead-ins a caller can
// prepend to commentary text, distinct from flagship-transition-engine.js
// (PX Release 5.1, which bridges consecutive SPINE SPREADS specifically
// and is not touched here). This pool serves the more general "every
// section should begin with an editorial transition" request. Same
// anti-repeat discipline as every other pool in this codebase.
// ------------------------------------------------------------------
export const EDITORIAL_TRANSITION_PHRASES = Object.freeze([
  'Building on the previous findings, ',
  'The evidence becomes clearer when read alongside what came before: ',
  'A deeper examination reveals that ',
  'Taken together, these patterns matter more than any one figure alone: ',
  'Viewed collectively, ',
  'From an implementation perspective, ',
]);

export function pickEditorialTransition(seedIndex, previousIndex = null) {
  let index = wrap(seedIndex, EDITORIAL_TRANSITION_PHRASES.length);
  if (previousIndex !== null && index === previousIndex && EDITORIAL_TRANSITION_PHRASES.length > 1) {
    index = wrap(index + 1, EDITORIAL_TRANSITION_PHRASES.length);
  }
  return { text: EDITORIAL_TRANSITION_PHRASES[index], index };
}
