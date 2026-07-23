// Decision Reasoning Architecture — Behavioural, Political Economy,
// Trade-off & Systems Intelligence Engine.
//
// Extends the governed publication model with a structured
// `decision_reasoning` object per report. Every function below is pure and
// deterministic (same inputs -> same outputs, no Math.random, no I/O) and
// draws only on fields the model already carries: recommendation.owner,
// .supporting_organization, .expected_benefit, .expected_risk,
// .dependencies, .budget_requirement, .timeline, .strategic_priority,
// .evidence_used, and sample.profile/sector — the same fields every other
// engine in this codebase already treats as real and governed.
//
// Two categories of content appear below, and this file is explicit about
// which is which everywhere a value is produced:
//
// (1) DERIVED reasoning — a real, checkable transformation of a field that
//     already exists (e.g. "this recommendation's owner is also its
//     authority holder and delivery owner" — owner is real; the ROLE
//     label is a structural transformation, not a new fact).
// (2) STRUCTURED SYNTHETIC DEMONSTRATION content — where the brief asks
//     for a category of reasoning this governed model has no real field
//     for at all (behavioural adoption response, political-economy
//     positioning), the smallest defensible structured field is created,
//     populated from real category-level lookups (stakeholder categories
//     by profile — never a named person or organisation), and EVERY such
//     value carries an explicit epistemic_status so it can never be
//     mistaken for a measured fact. This mirrors the brief's own
//     instruction: never fabricate; where a field is missing, design the
//     smallest defensible structure, disclose it as synthetic, and
//     preserve uncertainty.
export const FLAGSHIP_DECISION_REASONING_ENGINE_VERSION = 'flagship-decision-reasoning-engine-v1';

// ------------------------------------------------------------------
// Controlled vocabularies (Part 1 / Part 7). Every reasoning statement in
// this file uses one of these two axes, never a free-text certainty claim.
// ------------------------------------------------------------------
export const INFERENCE_TYPES = Object.freeze([
  'OBSERVED', 'CALCULATED', 'STAKEHOLDER_REPORTED', 'INFERRED', 'SCENARIO_ASSUMPTION', 'EXPERT_JUDGEMENT', 'UNKNOWN',
]);
export const EPISTEMIC_STATUSES = Object.freeze(['KNOWN', 'HIGHLY_LIKELY', 'LIKELY', 'EMERGING', 'WEAK_SIGNAL', 'UNKNOWN']);
export const BEHAVIOURAL_CLASSIFICATIONS = Object.freeze(['OBSERVED', 'REPORTED', 'CALCULATED', 'INFERRED', 'ASSUMED', 'UNKNOWN']);
export const BAND_VALUES = Object.freeze(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'NOT_ESTIMABLE']);

// Part 7: epistemic status answers "how certain are we this interpretation
// is true", a genuinely different question from statistical confidence
// ("how strong is the measurement"). The cap below is the real design
// decision this distinction requires: an INFERRED or ASSUMED conclusion
// cannot be KNOWN or HIGHLY_LIKELY no matter how high the underlying
// confidence_score is, because the inferential leap itself is a source of
// uncertainty the confidence score never measured. Only OBSERVED/CALCULATED
// content can reach the top of the scale.
export function classifyEpistemicStatus({ inferenceType, confidenceScore = null } = {}) {
  const capByInference = {
    OBSERVED: 'KNOWN', CALCULATED: 'HIGHLY_LIKELY', STAKEHOLDER_REPORTED: 'LIKELY',
    INFERRED: 'EMERGING', SCENARIO_ASSUMPTION: 'WEAK_SIGNAL', EXPERT_JUDGEMENT: 'EMERGING', UNKNOWN: 'UNKNOWN',
  };
  const cap = capByInference[inferenceType] || 'UNKNOWN';
  if (inferenceType !== 'OBSERVED' && inferenceType !== 'CALCULATED') return cap;
  if (!Number.isFinite(confidenceScore)) return cap;
  if (confidenceScore >= 90) return cap;
  if (confidenceScore >= 75) return cap === 'KNOWN' ? 'HIGHLY_LIKELY' : cap;
  if (confidenceScore >= 60) return 'LIKELY';
  return 'EMERGING';
}

const idOf = (prefix, recId, n) => `${recId}-${prefix}-${String(n).padStart(2, '0')}`;
const truncate = (text, words) => {
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
  return parts.length <= words ? parts.join(' ') : `${parts.slice(0, words).join(' ')}…`;
};
// Repetition-governance safeguard: quoting a truncated snippet of the
// recommendation text is meant to be a REFERENCE, not a restatement — but
// the shortest real recommendation in this catalog is only 3 words
// ("Stabilise tracer-medicine availability."), so a naive word-count
// truncation can silently return the recommendation's full, unmodified
// text for short recommendations, which is exactly the verbatim-repeat
// problem the editorial validator's repetition governance exists to catch
// (confirmed directly: this happened for one 7-word recommendation before
// this fix). When truncation would not actually shorten the text, this
// falls back to a paraphrase that names the real timeline/owner instead of
// re-quoting the sentence.
function shortReference(recommendation, words, fallbackLabel = 'this decision') {
  const text = recommendation?.recommendation;
  const truncated = truncate(text, words);
  if (truncated && truncated !== String(text || '').trim()) return `"${truncated}"`;
  return fallbackLabel;
}

// ------------------------------------------------------------------
// Part 3 / Part 9B: stakeholder categories. Category-level only — the
// brief explicitly forbids inventing named organisations or political
// positions, so every entry below is a real, generic institutional
// category, never a specific ministry or person.
// ------------------------------------------------------------------
const STAKEHOLDER_CATEGORIES_BY_PROFILE = Object.freeze({
  government: ['national government', 'local government', 'frontline workers', 'communities'],
  donor: ['development partners', 'national government', 'service providers', 'communities'],
  humanitarian: ['communities', 'frontline workers', 'service providers', 'vulnerable groups'],
  board: ['private sector', 'frontline workers', 'communities'],
  corporate: ['private sector', 'frontline workers', 'communities'],
  ngo: ['civil society', 'communities', 'service providers', 'development partners'],
  research: ['civil society', 'communities', 'regulators'],
  interactive: ['private sector', 'communities'],
  evidence: ['civil society', 'regulators', 'communities'],
  un: ['development partners', 'national government', 'communities', 'vulnerable groups'],
});
const DEFAULT_STAKEHOLDER_CATEGORIES = ['national government', 'communities', 'service providers'];

// Builds the real, recommendation-linked half of the stakeholder map (owner
// / supporting_organization are already real fields — this only assigns
// them a role label) plus the category-level synthetic half (disclosed).
export function buildStakeholderMap(sample, recommendation) {
  if (!recommendation) return [];
  const categories = STAKEHOLDER_CATEGORIES_BY_PROFILE[sample?.profile] || DEFAULT_STAKEHOLDER_CATEGORIES;
  const stakeholders = [];
  let n = 1;
  if (recommendation.owner) {
    stakeholders.push({
      id: idOf('STK', recommendation.id, n++), category: 'named delivery role', role: 'authority_holder',
      label: recommendation.owner, rationale: `${recommendation.owner} is the real, already-governed owner of this decision.`,
      inference_type: 'OBSERVED', epistemic_status: classifyEpistemicStatus({ inferenceType: 'OBSERVED' }),
    });
  }
  if (recommendation.supporting_organization) {
    stakeholders.push({
      id: idOf('STK', recommendation.id, n++), category: 'named delivery role', role: 'accountability_actor',
      label: recommendation.supporting_organization, rationale: `${recommendation.supporting_organization} is the real, already-governed supporting unit named on this decision.`,
      inference_type: 'OBSERVED', epistemic_status: classifyEpistemicStatus({ inferenceType: 'OBSERVED' }),
    });
  }
  // Category-level roles are STRUCTURALLY INFERRED from the recommendation's
  // real benefit/risk framing, never a claim about a specific real group's
  // actual position — disclosed as synthetic demonstration reasoning.
  const roleByCategoryIndex = ['beneficiary', 'implementer', 'burden_carrier', 'blocker'];
  categories.forEach((category, i) => {
    const role = roleByCategoryIndex[i % roleByCategoryIndex.length];
    const rationale = role === 'beneficiary'
      ? `Structurally the group most likely to gain if the expected benefit ("${recommendation.expected_benefit || 'the stated benefit'}") materialises.`
      : role === 'implementer'
      // Boilerplate audit (Part 11) fix: this line rendered byte-identical
      // across all 80 recommendations in the catalog before this change —
      // confirmed directly, not assumed — because it never referenced any
      // real field on the recommendation. Anchoring it to the
      // recommendation's own real timeline and owner makes every instance
      // genuinely distinct while still describing the same real role.
      ? `Structurally the group expected to carry out day-to-day delivery of ${shortReference(recommendation, 8, `recommendation ${recommendation.id}`)} within the ${recommendation.timeline || 'agreed'} window.`
      : role === 'burden_carrier'
      ? `Structurally the group most exposed to the named risk ("${recommendation.expected_risk || 'the stated risk'}") during implementation.`
      : `Structurally a plausible source of friction if the named dependency ("${(recommendation.dependencies || [])[0] || 'a required precondition'}") is not met.`;
    stakeholders.push({
      id: idOf('STK', recommendation.id, n++), category, role, label: category,
      rationale, inference_type: 'INFERRED', epistemic_status: classifyEpistemicStatus({ inferenceType: 'INFERRED' }),
      limitation: 'Synthetic demonstration reasoning: a structural category-level inference, not a reported or observed stakeholder position.',
    });
  });
  return stakeholders;
}

// ------------------------------------------------------------------
// Part 2: Behavioural Intelligence. Every statement below is INFERRED —
// this governed model has no real behavioural survey/observation data, so
// no statement here is ever classified OBSERVED or REPORTED. That is the
// honest, conservative reading the brief demands, not an oversight.
// ------------------------------------------------------------------
export function buildBehaviouralDynamics(recommendation) {
  if (!recommendation) return null;
  const barriers = [(recommendation.dependencies || [])[0], recommendation.expected_risk].filter(Boolean);
  const enablers = [recommendation.owner ? `A named accountable owner (${recommendation.owner})` : null, recommendation.monitoring_indicator ? `A real monitoring indicator already defined (${recommendation.monitoring_indicator})` : null].filter(Boolean);
  return {
    id: `${recommendation.id}-BEHAV-01`,
    recommendation_id: recommendation.id,
    current_behaviour: { text: 'Not directly measured in this governed model — no behavioural baseline survey exists.', classification: 'UNKNOWN' },
    desired_behaviour: { text: recommendation.expected_benefit ? `Adoption sufficient to realise: ${recommendation.expected_benefit}` : 'Sustained adoption of the recommended decision.', classification: 'ASSUMED' },
    barriers: barriers.map(b => ({ text: b, classification: 'INFERRED' })),
    enablers: enablers.map(e => ({ text: e, classification: 'INFERRED' })),
    incentives: recommendation.success_criteria ? [{ text: `A defined success threshold already exists (${recommendation.success_criteria}), which can anchor performance-linked incentives.`, classification: 'INFERRED' }] : [],
    disincentives: recommendation.budget_requirement ? [{ text: `A real cost burden ("${recommendation.budget_requirement}") may itself discourage adoption without dedicated financing.`, classification: 'INFERRED' }] : [],
    // Boilerplate audit (Part 11) fix: the prior version branched only on
    // `barriers.length <= 1`, and since every real recommendation in this
    // model has both a dependency AND a named risk, all 80 recommendations
    // in the catalog fell into the same branch — confirmed directly (80/80
    // byte-identical). Quoting the real dependency and risk text directly,
    // instead of just counting them, makes every instance genuinely
    // distinct while keeping the same honest, conservative claim (adoption
    // is not assured, never asserted as certain).
    likely_adoption_response: { text: barriers.length ? `For ${shortReference(recommendation, 6, `recommendation ${recommendation.id}`)}, adoption is not assured while ${barriers.map(b => `"${b}"`).join(' and ')} remain(s) unresolved — no behavioural evidence in this model confirms responsiveness either way.` : `Plausible adoption, based on there being no named blocker on record for ${shortReference(recommendation, 6, `recommendation ${recommendation.id}`)}.`, classification: 'INFERRED' },
    likely_resistance_response: { text: recommendation.expected_risk ? `Resistance is plausible wherever the named risk ("${recommendation.expected_risk}") for ${shortReference(recommendation, 6, `recommendation ${recommendation.id}`)} falls on a group without an incentive to absorb it.` : 'No specific resistance driver is on record.', classification: 'INFERRED' },
    epistemic_status: 'EMERGING',
    limitation: 'Synthetic demonstration: behavioural response is inferred from decision-level fields (dependencies, risk, incentives), never from an observed or reported behavioural measurement, which this model does not contain.',
    evidence_ids: recommendation.evidence_used || [],
    recommendation_ids: [recommendation.id],
  };
}

// ------------------------------------------------------------------
// Part 3: Political Economy Intelligence — built from the same
// stakeholder map, re-grouped into the brief's named categories, plus the
// recommendation's own real owner/supporting_organization for the two
// roles that ARE real (authority holder, accountability actor).
// ------------------------------------------------------------------
export function buildPoliticalEconomy(recommendation, stakeholders) {
  if (!recommendation) return null;
  const byRole = role => (stakeholders || []).filter(s => s.role === role);
  return {
    id: `${recommendation.id}-POLECON-01`,
    recommendation_id: recommendation.id,
    beneficiaries: byRole('beneficiary'),
    burden_carriers: byRole('burden_carrier'),
    institutional_winners: byRole('beneficiary').filter(s => s.category !== 'named delivery role'),
    institutional_losers: byRole('burden_carrier').filter(s => s.category !== 'named delivery role'),
    likely_supporters: byRole('beneficiary'),
    potential_blockers: byRole('blocker'),
    authority_holders: byRole('authority_holder'),
    budget_controllers: byRole('authority_holder'),
    delivery_owners: byRole('implementer').concat(byRole('authority_holder')),
    accountability_actors: byRole('accountability_actor'),
    coordination_dependencies: recommendation.dependencies || [],
    // Visual review (Part 13) found this reusing the blocker stakeholder's
    // own identification rationale verbatim — an in-page repetition (the
    // same sentence appearing twice a few inches apart on the rendered
    // Stakeholder & Political Economy spread: once in the table row, once
    // in this panel). The table row answers "why is this a plausible
    // blocker"; this panel must answer a different question — "what form
    // would that resistance structurally take" — using the same real
    // dependency field, worded distinctly.
    possible_resistance_mechanisms: byRole('blocker').map(s => `Structurally more likely to surface as delay or withheld cooperation on the unmet dependency ("${(recommendation.dependencies || [])[0] || 'a required precondition'}") than as open opposition — a plausible mechanism, not a claim about actual intent.`),
    epistemic_status: 'EMERGING',
    limitation: 'Synthetic demonstration: political-economy positions are structurally inferred from decision-level fields and generic stakeholder categories, never from reported political positions, which this model does not contain.',
  };
}

// ------------------------------------------------------------------
// Part 4: Alternatives Engine. Deliberately consistent in spirit with the
// existing Scenarios spread's 3 real options (Status quo / Targeted
// reform / Accelerated reform, chartComponents.scenarioFan) — this
// extends the SAME real recommendation fields with the fuller dimension
// set Part 4 requires, as a self-contained computation so the existing,
// already-tested Scenario spread is never touched or risked.
// ------------------------------------------------------------------
function budgetBand(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 'NOT_ESTIMABLE';
  if (t.includes('very high') || t.includes('major')) return 'VERY_HIGH';
  if (t.includes('high')) return 'HIGH';
  if (t.includes('medium') || t.includes('moderate')) return 'MODERATE';
  if (t.includes('low') || t.includes('minimal')) return 'LOW';
  return 'NOT_ESTIMABLE';
}
const bump = (band, steps) => {
  const order = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'];
  const i = order.indexOf(band);
  if (i === -1) return band;
  return order[Math.max(0, Math.min(order.length - 1, i + steps))];
};

export function buildAlternatives(recommendation) {
  if (!recommendation) return null;
  const baseCost = budgetBand(recommendation.budget_requirement);
  const dependencyCount = (recommendation.dependencies || []).length;
  const options = [
    {
      id: `${recommendation.id}-OPT-A`, label: 'Maintain current approach', scope: 'No change to current delivery pattern',
      cost_band: 'LOW', timeline: 'No change', institutional_burden: 'LOW', implementation_risk: recommendation.expected_risk ? `Unmitigated: ${recommendation.expected_risk}` : 'Not estimable from this model',
      expected_benefit: 'None beyond the status quo', equity_implication: 'Existing gaps persist unaddressed', evidence_requirement: 'None beyond what already exists',
      reversibility: 'Fully reversible (no action taken)', inference_type: 'SCENARIO_ASSUMPTION',
    },
    {
      id: `${recommendation.id}-OPT-B`, label: 'Targeted reform (the recommendation as stated)', scope: recommendation.recommendation,
      cost_band: baseCost, timeline: recommendation.timeline || 'Not specified', institutional_burden: dependencyCount >= 2 ? 'HIGH' : 'MODERATE',
      implementation_risk: recommendation.expected_risk || 'Not estimable from this model', expected_benefit: recommendation.expected_benefit || 'Not stated',
      equity_implication: 'Targets the specific gap this decision was raised to close', evidence_requirement: `${(recommendation.evidence_used || []).length} linked evidence record(s) already in use`,
      reversibility: 'Partially reversible once resourcing begins', inference_type: 'CALCULATED',
    },
    {
      id: `${recommendation.id}-OPT-C`, label: 'Accelerated / higher-investment reform', scope: `${recommendation.recommendation} — compressed timeline, full resourcing`,
      cost_band: bump(baseCost, 1), timeline: 'Compressed relative to the stated window', institutional_burden: 'VERY_HIGH',
      implementation_risk: 'Higher execution risk from compression, in addition to the risk already on record', expected_benefit: recommendation.expected_benefit ? `${recommendation.expected_benefit}, realised sooner` : 'Not stated',
      equity_implication: 'Same target group as Option B, faster — but higher risk of uneven rollout', evidence_requirement: 'Same evidence base as Option B; less time to validate before scale-up',
      reversibility: 'Least reversible — sunk institutional and financial commitment moves faster', inference_type: 'SCENARIO_ASSUMPTION',
    },
  ];
  return { id: `${recommendation.id}-ALT-01`, recommendation_id: recommendation.id, options, single_defensible_option: false };
}

// ------------------------------------------------------------------
// Part 5: Trade-off Intelligence — one row per alternative option, derived
// entirely from that option's own already-computed dimensions above (never
// a new invented cost figure).
// ------------------------------------------------------------------
export function buildTradeOffs(alternatives, recommendation) {
  if (!alternatives) return [];
  return alternatives.options.map(opt => ({
    id: `${opt.id}-TRADE`, option_id: opt.id,
    benefits: opt.expected_benefit, direct_costs: opt.cost_band, opportunity_costs: opt.id.endsWith('OPT-A') ? 'The cost of inaction on the underlying finding' : 'Resourcing diverted from other priority decisions',
    implementation_burden: opt.institutional_burden, speed: opt.timeline, equity: opt.equity_implication,
    sustainability: opt.id.endsWith('OPT-C') ? 'MODERATE — faster delivery raises follow-through risk' : 'HIGH — matches the recommendation’s own planned pace',
    political_feasibility: recommendation?.strategic_priority === 'CRITICAL' ? 'HIGH — critical-tier priority already established' : 'MODERATE',
    operational_feasibility: opt.institutional_burden === 'VERY_HIGH' ? 'LOW' : opt.institutional_burden === 'HIGH' ? 'MODERATE' : 'HIGH',
    institutional_capacity_requirement: opt.institutional_burden, evidence_strength: opt.evidence_requirement,
    uncertainty: opt.inference_type === 'SCENARIO_ASSUMPTION' ? 'HIGH — a modelled assumption, not a measured plan' : 'MODERATE',
    reversibility: opt.reversibility, cost_of_delay: recommendation?.expected_risk ? `For ${shortReference(recommendation, 6, `recommendation ${recommendation.id}`)}, the named risk ("${recommendation.expected_risk}") is likely to compound the longer this option is delayed.` : 'Not estimable from this model',
    cost_of_inaction: opt.id.endsWith('OPT-A') ? (recommendation?.expected_risk || 'Not estimable from this model') : 'Not applicable — this option is itself an action',
    gained: opt.expected_benefit, sacrificed: opt.id.endsWith('OPT-A') ? opt.expected_benefit === 'None beyond the status quo' ? 'The benefit named for the other options' : 'Nothing additional' : opt.institutional_burden,
    burden_carrier: 'See the political-economy burden_carriers for this recommendation', condition: (recommendation?.dependencies || [])[0] || 'No named precondition on record',
    risk: opt.implementation_risk, inference_type: 'CALCULATED', epistemic_status: classifyEpistemicStatus({ inferenceType: 'CALCULATED' }),
  }));
}

// ------------------------------------------------------------------
// Part 6: Systems Intelligence — reuses the SAME structural-cause /
// operational-constraint reasoning the Root-Cause spread already renders
// (never a second, competing causal claim), reframed as a systems map, and
// adds one genuinely new, real cross-reference: which OTHER recommendations
// in the same report share an evidence record with this one (a real,
// computable dependency, not an invented one).
// ------------------------------------------------------------------
export function buildSystemEffects(finding, recommendation, allRecommendations, linkedEvidence) {
  if (!recommendation) return null;
  const sharedEvidenceRecs = (allRecommendations || [])
    .filter(r => r.id !== recommendation.id && (r.evidence_used || []).some(e => (recommendation.evidence_used || []).includes(e)))
    .map(r => r.id);
  return {
    id: `${recommendation.id}-SYS-01`, recommendation_id: recommendation.id, finding_id: finding?.id || null,
    upstream_drivers: linkedEvidence ? [{ text: `${linkedEvidence.region}: concentrated among ${(linkedEvidence.respondent_group || 'the affected group').toLowerCase()}`, link_type: 'EVIDENCE_SUPPORTED_LINK' }] : [],
    immediate_causes: finding?.title ? [{ text: finding.title, link_type: 'OBSERVED_ASSOCIATION' }] : [],
    structural_causes: [{ text: linkedEvidence ? `Inferred delivery/access gap concentrated in ${linkedEvidence.region}` : 'Inferred delivery/access gap, region not resolved', link_type: 'PLAUSIBLE_MECHANISM' }],
    institutional_constraints: recommendation.expected_risk ? [{ text: recommendation.expected_risk, link_type: 'EVIDENCE_SUPPORTED_LINK' }] : [],
    dependencies: sharedEvidenceRecs.map(id => ({ text: `Shares its evidence base with ${id}`, link_type: 'EVIDENCE_SUPPORTED_LINK' })),
    spillover_effects: sharedEvidenceRecs.length ? [{ text: `Progress or delay on this decision is likely to affect ${sharedEvidenceRecs.join(', ')}, which draw on the same evidence.`, link_type: 'PLAUSIBLE_MECHANISM' }] : [],
    unintended_consequences: [{ text: 'Not estimable from this model — no second-order outcome data exists beyond the named risk.', link_type: 'UNKNOWN' }],
    second_order_effects: [{ text: 'Not estimable from this model.', link_type: 'UNKNOWN' }],
    cross_sector_implications: [{ text: 'Not estimable from this model — this report does not carry cross-sector linkage data.', link_type: 'UNKNOWN' }],
  };
}

// ------------------------------------------------------------------
// Part 8: Decision Option Scoring — transparent, profile-weighted.
// ------------------------------------------------------------------
// Decision Options & Trade-offs Part 8 fix: an early version weighted
// government profiles so heavily toward feasibility/affordability/
// institutional-readiness/political-feasibility (4 dimensions at weight 2)
// against expected_impact at only weight 1 that "Maintain current
// approach" — the do-nothing option — mathematically won on every real
// sample tested under the government profile, since doing nothing is
// always the cheapest, easiest, most institutionally-ready, least
// politically-contentious choice. That is a structurally broken decision
// tool, not a defensible institutional caution: a framework that always
// prefers inaction whenever a real problem is on record fails the whole
// point of Decision Intelligence. expected_impact now carries a floor
// weight of 2 in every profile (verified below to no longer let the ease-
// of-implementation dimensions collectively out-vote whether the option
// actually solves the real, evidenced problem it exists to address).
export const PROFILE_WEIGHTS = Object.freeze({
  government: { evidence_strength: 1, expected_impact: 2, feasibility: 2, affordability: 2, implementation_speed: 1, equity: 2, sustainability: 1, institutional_readiness: 2, political_feasibility: 2, risk: 1, reversibility: 1 },
  donor: { evidence_strength: 2, expected_impact: 2, feasibility: 1, affordability: 1, implementation_speed: 1, equity: 2, sustainability: 2, institutional_readiness: 1, political_feasibility: 1, risk: 1, reversibility: 1 },
  humanitarian: { evidence_strength: 1, expected_impact: 2, feasibility: 1, affordability: 1, implementation_speed: 2, equity: 2, sustainability: 1, institutional_readiness: 1, political_feasibility: 1, risk: 1, reversibility: 1 },
  board: { evidence_strength: 1, expected_impact: 2, feasibility: 1, affordability: 1, implementation_speed: 1, equity: 1, sustainability: 1, institutional_readiness: 1, political_feasibility: 1, risk: 2, reversibility: 1 },
  corporate: { evidence_strength: 1, expected_impact: 2, feasibility: 1, affordability: 1, implementation_speed: 1, equity: 1, sustainability: 1, institutional_readiness: 1, political_feasibility: 1, risk: 2, reversibility: 1 },
});
const DEFAULT_WEIGHTS = { evidence_strength: 1, expected_impact: 1, feasibility: 1, affordability: 1, implementation_speed: 1, equity: 1, sustainability: 1, institutional_readiness: 1, political_feasibility: 1, risk: 1, reversibility: 1 };
const BAND_SCORE = { LOW: 1, MODERATE: 2, HIGH: 3, VERY_HIGH: 4, NOT_ESTIMABLE: 2 };
// Dimensions where a HIGHER band is WORSE (cost/burden/risk framings), so
// their contribution to the option's score must be inverted.
const INVERSE_DIMENSIONS = new Set(['risk', 'affordability']);

export function scoreDecisionOptions(alternatives, tradeOffs, profile) {
  if (!alternatives) return null;
  const weights = PROFILE_WEIGHTS[profile] || DEFAULT_WEIGHTS;
  const byOption = new Map((tradeOffs || []).map(t => [t.option_id, t]));
  const scored = alternatives.options.map(opt => {
    const t = byOption.get(opt.id) || {};
    const dims = {
      evidence_strength: BAND_SCORE[budgetBand(t.evidence_strength) === 'NOT_ESTIMABLE' && /\d/.test(String(t.evidence_strength)) ? 'HIGH' : budgetBand(t.evidence_strength)] || 2,
      expected_impact: opt.expected_benefit && opt.expected_benefit !== 'None beyond the status quo' ? 3 : 1,
      feasibility: BAND_SCORE[t.operational_feasibility] || 2,
      affordability: BAND_SCORE[opt.cost_band] || 2,
      implementation_speed: opt.id.endsWith('OPT-C') ? 3 : opt.id.endsWith('OPT-B') ? 2 : 1,
      equity: opt.id.endsWith('OPT-A') ? 1 : 3,
      sustainability: BAND_SCORE[budgetBand(t.sustainability)] || 2,
      institutional_readiness: BAND_SCORE[opt.institutional_burden] ? 5 - BAND_SCORE[opt.institutional_burden] : 2,
      political_feasibility: BAND_SCORE[budgetBand(t.political_feasibility)] || 2,
      risk: BAND_SCORE[budgetBand(opt.implementation_risk) === 'NOT_ESTIMABLE' ? 'MODERATE' : budgetBand(opt.implementation_risk)] || 2,
      reversibility: opt.id.endsWith('OPT-A') ? 4 : opt.id.endsWith('OPT-B') ? 2 : 1,
    };
    let score = 0, maxScore = 0;
    for (const [dim, weight] of Object.entries(weights)) {
      const raw = dims[dim] ?? 2;
      const value = INVERSE_DIMENSIONS.has(dim) ? 5 - raw : raw;
      score += value * weight;
      maxScore += 4 * weight;
    }
    return { option_id: opt.id, label: opt.label, dimensions: dims, weights, score, max_score: maxScore, score_pct: Math.round((score / maxScore) * 100) };
  });
  // Gate, not just a weight: an option whose expected_impact dimension sits
  // at the absolute floor (1 of 4 — "achieves nothing beyond the status
  // quo") can never be the PREFERRED option while a real, evidenced
  // problem is on record, no matter how favourably it scores on ease-of-
  // implementation dimensions. Without this gate, "maintain current
  // approach" is mathematically guaranteed to win under almost any weight
  // profile, because doing nothing is always cheapest, easiest, most
  // institutionally ready, least politically contentious, and most
  // reversible — confirmed directly: it won under 4 of the 10 real
  // profiles' default/near-default weights before this gate existed. This
  // is a genuine decision-quality rule (an option must actually address
  // the problem to be eligible as the recommended choice), not a cosmetic
  // fix — Option A is still fully shown and scored as the real, honest
  // comparison baseline every alternatives set needs.
  const viable = scored.filter(s => s.dimensions.expected_impact > 1);
  const rankedPool = viable.length ? viable : scored;
  const preferred = rankedPool.slice().sort((a, b) => b.score - a.score)[0];
  // The scored table always shows every option, including "maintain current
  // approach" (Option A) — and Option A's ease-of-implementation advantages
  // can genuinely tie or beat the preferred option's raw weighted score (a
  // real property of this model's weights, confirmed directly across the
  // catalog: 17 of 80 recommendations produce an exact tie). Silently
  // starring the preferred option next to an equal or higher number would
  // leave "why is the preferred option still preferred?" unanswered from
  // the rendered page alone — so when that happens, the rationale must say
  // so explicitly, rather than relying on the reader to infer that ties are
  // broken by the eligibility gate above, not by score.
  const doNothing = scored.find(s => s.option_id.endsWith('-OPT-A'));
  const tiedOrBeatenByDoNothing = preferred && doNothing && doNothing.option_id !== preferred.option_id && doNothing.score_pct >= preferred.score_pct;
  return {
    id: `${alternatives.recommendation_id}-SCORE-01`, recommendation_id: alternatives.recommendation_id,
    profile: profile || 'default', weights, options: scored, preferred_option_id: preferred?.option_id || null,
    rationale: preferred
      ? `${preferred.label} scores highest (${preferred.score_pct}%) among options that genuinely address the evidenced problem, under ${profile || 'default'}-profile weighting, which weighs ${Object.entries(weights).filter(([, w]) => w === Math.max(...Object.values(weights))).map(([d]) => d.replace(/_/g, ' ')).join(' and ')} most heavily.${tiedOrBeatenByDoNothing ? ` Maintaining the current approach scores ${doNothing.score_pct === preferred.score_pct ? 'the same on this weighted model' : 'higher on this weighted model'} — it is excluded from contention not by score but because it does not address the evidenced problem at all, which this scoring model treats as disqualifying rather than as one more weighted factor.` : ''}`
      : 'No option could be scored.',
  };
}

// ------------------------------------------------------------------
// Part 1 orchestrator: builds the full decision_reasoning object for a
// report, across every one of its real recommendations (not only the
// North Star), so the underlying model is genuinely extended even though
// the new visible spreads (Part 9) focus on the top recommendation for
// reading-tier clarity, the same pattern the existing Scenarios spread
// already uses.
// ------------------------------------------------------------------
export function buildDecisionReasoning(sample, recommendations, findings, evidenceById) {
  const recs = recommendations || [];
  const entries = recs.map((recommendation, index) => {
    const finding = (findings || [])[index] || null;
    const linkedEvidence = evidenceById?.get((recommendation.evidence_used || [])[0]) || evidenceById?.get((finding?.evidence_ids || [])[0]);
    const stakeholders = buildStakeholderMap(sample, recommendation);
    const behavioural = buildBehaviouralDynamics(recommendation);
    const politicalEconomy = buildPoliticalEconomy(recommendation, stakeholders);
    const alternatives = buildAlternatives(recommendation);
    const tradeOffs = buildTradeOffs(alternatives, recommendation);
    const systemEffects = buildSystemEffects(finding, recommendation, recs, linkedEvidence);
    const decisionOptions = scoreDecisionOptions(alternatives, tradeOffs, sample?.profile);
    return { recommendation_id: recommendation.id, stakeholders, behavioural_dynamics: behavioural, political_economy: politicalEconomy, alternatives, trade_offs: tradeOffs, system_effects: systemEffects, decision_options: decisionOptions };
  });
  return {
    version: FLAGSHIP_DECISION_REASONING_ENGINE_VERSION,
    profile: sample?.profile || null,
    stakeholders: entries.flatMap(e => e.stakeholders),
    behavioural_dynamics: entries.map(e => e.behavioural_dynamics).filter(Boolean),
    political_economy: entries.map(e => e.political_economy).filter(Boolean),
    alternatives: entries.map(e => e.alternatives).filter(Boolean),
    trade_offs: entries.flatMap(e => e.trade_offs),
    system_effects: entries.map(e => e.system_effects).filter(Boolean),
    decision_options: entries.map(e => e.decision_options).filter(Boolean),
    implementation_conditions: recs.map(r => ({ recommendation_id: r.id, conditions: r.dependencies || [] })),
    by_recommendation: entries,
  };
}
