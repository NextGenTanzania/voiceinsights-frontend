// Publication Intelligence Layer — Publication Experience (PX) Release 4,
// permanent architectural layer 1 of 6 (see the PX Release 4 plan).
//
// Formalizes the traceability chain already implicit across the Browser
// Rendering V2 composer's spreads — a reader already moves through
// Finding -> Evidence -> Interpretation -> ... across hero-insight,
// evidence-story, root-cause, and the decision spreads today, just without
// one explicit, queryable structure joining the steps. This module is that
// structure: Finding -> Evidence -> Interpretation -> Implication ->
// Uncertainty -> Alternative Explanation -> Policy Meaning -> Investment
// Meaning -> Risk -> Decision -> Cost of Delay -> Expected Outcome ->
// Monitoring — thirteen real fields, never one invented.
//
// PX Release 5, Task #51 added 3 steps to the original 10:
//   - `uncertainty` (finding.uncertainty_style — a real field only since
//     the editorial engine, flagship-editorial-engine.js, made it one).
//   - `cost_of_delay` (executive_book.cost_of_inaction — real, report-level,
//     threaded in as an explicit parameter since it isn't per-recommendation).
//   - `alternative_explanation` — deliberately, permanently unavailable.
//     No field on this model captures a competing causal explanation (the
//     Root-Cause spread's own footnote already discloses that structural-
//     cause entries are inference, not measurement); rather than silently
//     drop the step the request asked for, it stays in the chain and in
//     `missing_steps` so completeness honestly reflects a real gap instead
//     of a fabricated 100%.
//
// Deterministic and pure: same (recommendation, finding, evidence,
// costOfInaction) input always produces the same chain. Every step is
// either a real field (or an honest extractive reframing of one, e.g.
// "implication" below is evidence.respondent_group/region reframed as "who
// is affected" — the SAME real fields, not new ones) or explicitly marked
// unavailable. Never fabricates a step it has no real field for.
import { firstSentences } from './publication-render-utils.js';

export const PUBLICATION_INTELLIGENCE_LAYER_VERSION = 'publication-intelligence-layer-v2';

export const INTELLIGENCE_CHAIN_STEPS = Object.freeze([
  'finding', 'evidence', 'interpretation', 'implication', 'uncertainty', 'alternative_explanation',
  'policy_meaning', 'investment_meaning', 'risk', 'decision', 'cost_of_delay', 'expected_outcome', 'monitoring',
]);

function step(value, sourceField) {
  const available = value !== null && value !== undefined && value !== '';
  return { value: available ? value : null, source_field: sourceField, available };
}

// Builds one full chain for one recommendation, optionally linked to the
// finding/evidence it traces from. `costOfInaction` is the report-level
// executive_book.cost_of_inaction string — the same value for every
// recommendation in one report, so it's a separate parameter rather than
// something read off `recommendation`. All arguments are the same real
// model objects already used elsewhere in the composer
// (report.recommendations[i], report.findings[i], report.evidence[i],
// report.executive_book.cost_of_inaction) — this function does not fetch
// or invent anything new.
export function buildIntelligenceChain(recommendation = {}, finding = null, evidence = null, costOfInaction = null) {
  const affectedWho = evidence?.respondent_group && evidence?.region
    ? `${evidence.respondent_group} in ${evidence.region}`
    : (evidence?.respondent_group || evidence?.region || null);

  const chain = {
    finding: step(finding?.text || null, 'findings[].text'),
    evidence: step(
      evidence ? { quote: evidence.quote || null, id: evidence.id || null, confidence_score: evidence.confidence_score ?? null } : null,
      'evidence[].{quote,id,confidence_score}',
    ),
    interpretation: step(finding?.interpretation || null, 'findings[].interpretation'),
    implication: step(affectedWho, 'evidence[].{respondent_group,region}'),
    uncertainty: step(finding?.uncertainty_style || null, 'findings[].uncertainty_style'),
    // Permanently unavailable by design — see the module header note. Kept
    // in the chain (not silently dropped) so completeness stays honest.
    alternative_explanation: step(null, 'not available on this model — no field captures a competing causal explanation'),
    policy_meaning: step(
      recommendation.why_this_recommendation_exists ? firstSentences(recommendation.why_this_recommendation_exists, 1) : null,
      'recommendations[].why_this_recommendation_exists',
    ),
    investment_meaning: step(recommendation.budget_requirement || recommendation.budget_band || null, 'recommendations[].{budget_requirement,budget_band}'),
    risk: step(recommendation.expected_risk || null, 'recommendations[].expected_risk'),
    decision: step(
      recommendation.recommendation ? { action: recommendation.recommendation, owner: recommendation.owner || null, timeline: recommendation.timeline || null } : null,
      'recommendations[].{recommendation,owner,timeline}',
    ),
    cost_of_delay: step(costOfInaction || null, 'executive_book.cost_of_inaction'),
    expected_outcome: step(recommendation.expected_benefit || null, 'recommendations[].expected_benefit'),
    monitoring: step(recommendation.monitoring_indicator || null, 'recommendations[].monitoring_indicator'),
  };

  const availableSteps = INTELLIGENCE_CHAIN_STEPS.filter(s => chain[s].available);
  return {
    recommendation_id: recommendation.id || recommendation.decision_id || null,
    chain,
    completeness: Math.round((availableSteps.length / INTELLIGENCE_CHAIN_STEPS.length) * 100) / 100,
    complete_steps: availableSteps,
    missing_steps: INTELLIGENCE_CHAIN_STEPS.filter(s => !chain[s].available),
  };
}

// Builds one chain per recommendation, resolving each one's linked finding
// (via evidence_used / evidence_ids overlap where present, otherwise the
// same hero/first finding already used elsewhere) and its first linked
// evidence record. Pure convenience wrapper — buildIntelligenceChain
// remains the single source of truth for chain construction.
export function buildIntelligenceChains(recommendations = [], findings = [], evidenceById = new Map(), costOfInaction = null) {
  return recommendations.map(r => {
    const linkedEvidenceId = (r.evidence_used || [])[0];
    const evidence = linkedEvidenceId ? evidenceById.get(linkedEvidenceId) : null;
    const linkedFinding = findings.find(f => (f.evidence_ids || []).includes(linkedEvidenceId)) || findings[0] || null;
    return buildIntelligenceChain(r, linkedFinding, evidence || null, costOfInaction);
  });
}
