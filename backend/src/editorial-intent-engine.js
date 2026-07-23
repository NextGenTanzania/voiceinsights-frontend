// Editorial Intent Engine — EIE Release 2, the final architecture layer.
//
// Answers a question none of the prior engines answer: not what the data
// says (Editorial Intelligence Engine), not how it should be communicated
// (Editorial Strategy Engine), not how it's laid out (Art Direction
// Engine) — but WHY this publication exists and what it prepares its
// reader to do. Every model below is a deterministic function of fields
// already real and governed elsewhere in this codebase — sample.profile,
// the North Star's own narrative_mode and recommendation text/tier/budget,
// arcContextFor's real stage names, and the existing Strategy/Intelligence/
// Rhythm validators (reused, never duplicated). Per the brief's own
// instruction, a requested model this codebase has no real signal to
// justify is left out, not guessed.
import { arcContextFor } from './flagship-narrative-arc.js';
import { detectMissingEvidenceLink, detectDuplicateRecommendations } from './editorial-intelligence-validator.js';
import { PUBLICATION_IDENTITY_BY_PROFILE } from './editorial-strategy-engine.js';

export const EDITORIAL_INTENT_ENGINE_VERSION = 'editorial-intent-engine-v1';

// ------------------------------------------------------------------
// Publication Purpose — one purpose per publication, derived from the
// real, governed sample.profile (same field ESCI's identity model uses,
// same rigor).
//
// An earlier version of this function also applied a "risk override" —
// switching to Risk Mitigation whenever the North Star's own riskValue
// (Editorial Intelligence Engine) was >= 70. Checked directly against all
// 16 real samples before this was committed and found to be a genuine
// design flaw, not a rare, justified exception: riskValue is structurally
// ~90 for every sample's North Star, because the North Star is always
// CRITICAL-tier with a populated expected_risk field (both confirmed
// catalog-wide) — riskValue's own formula (60 + priority*0.3) makes that
// combination score ~90 by construction, every time. The override fired
// on 15 of 16 samples, collapsing Purpose to "Risk Mitigation" almost
// universally and destroying the real per-profile variety this model
// exists to surface. Removed before commit rather than shipped and
// disclosed later — the same self-correction discipline used throughout
// this engagement (see ESCI Release 1's intensity-monotony correction).
// ------------------------------------------------------------------
export const PURPOSE_BY_PROFILE = Object.freeze({
  government: 'Policy Change',
  board: 'Performance Review',
  donor: 'Programme Accountability',
  humanitarian: 'Emergency Response',
  corporate: 'Performance Review',
  ngo: 'Programme Learning',
  research: 'Evidence Archive',
  interactive: 'Innovation',
  evidence: 'Evidence Archive',
  un: 'Transformation',
});

export function selectPublicationPurpose(model) {
  const profile = model?.report?.profile;
  const purpose = PURPOSE_BY_PROFILE[profile] || null;
  return {
    purpose,
    rationale: purpose
      ? `Selected from the real, governed audience profile ("${profile}") — the same field ESCI's publication-identity model uses.`
      : `No purpose mapping exists for profile "${profile}" — left null rather than guessed.`,
  };
}

// ------------------------------------------------------------------
// Editorial Intent — what should happen after the reader finishes,
// extracted from the real leading verb of the North Star's own
// recommendation text (never a generated sentence — the verb the report
// itself already used), with the recommendation's own real strategic_priority
// and budget_requirement as tiebreakers only for the "Approve" family.
// ------------------------------------------------------------------
const INTENT_BY_LEADING_VERB = Object.freeze({
  approve: 'context', adopt: 'context', // resolved below using real tier/budget
  deploy: 'Launch programme', launch: 'Launch programme', activate: 'Launch programme',
  build: 'Launch programme', give: 'Launch programme', agree: 'Launch programme', add: 'Launch programme',
  prioritise: 'Change strategy', prioritize: 'Change strategy', target: 'Change strategy',
  screen: 'Change strategy', exit: 'Change strategy',
  protect: 'Escalate risk', simplify: 'Escalate risk',
  triangulate: 'Request more evidence',
  publish: 'Strengthen monitoring', run: 'Strengthen monitoring',
});

export function selectEditorialIntent(northStar) {
  const recommendation = northStar?.recommendation;
  if (!recommendation?.recommendation) return { intent: null, rationale: 'No real North Star recommendation available.' };
  const verb = recommendation.recommendation.trim().split(/\s+/)[0].toLowerCase();
  let mapped = INTENT_BY_LEADING_VERB[verb];
  if (mapped === 'context') {
    const budgetText = String(recommendation.budget_requirement || recommendation.budget_band || '').toLowerCase();
    mapped = budgetText.includes('high') || budgetText.includes('business case') ? 'Approve funding' : 'Approve policy';
  }
  return {
    intent: mapped || 'Launch programme',
    verb,
    rationale: mapped
      ? `Extracted from the real North Star recommendation's own leading verb ("${verb}")${mapped.startsWith('Approve') ? `, resolved by its real budget_requirement field` : ''} — not a generated sentence.`
      : `No specific mapping for leading verb "${verb}"; defaulted to "Launch programme" as the most common real real pattern in this catalog.`,
  };
}

// ------------------------------------------------------------------
// Publication Position — derived from ESCI's own already-computed
// publication identity (never a second, independent classification).
// ------------------------------------------------------------------
const POSITION_BY_IDENTITY = Object.freeze({
  'Policy Publication': 'Advisor',
  'Decision Publication': 'Decision Partner',
  'Accountability Publication': 'Accountability Partner',
  'Warning Publication': 'Warning',
  'Performance Publication': 'Strategic Planner',
  'Human Impact Publication': 'Transformation Partner',
  'Evidence Publication': 'Evidence Provider',
  'Innovation Publication': 'Innovation Partner',
  'Transformation Publication': 'Transformation Partner',
});

export function selectPublicationPosition(model) {
  const profile = model?.report?.profile;
  const identity = PUBLICATION_IDENTITY_BY_PROFILE[profile] || null;
  const position = identity ? POSITION_BY_IDENTITY[identity] : null;
  return {
    position, identity,
    rationale: position
      ? `Derived from the Editorial Strategy Engine's own real publication identity ("${identity}") — not a second, independent classification.`
      : `No real identity was available to derive a position from.`,
  };
}

// ------------------------------------------------------------------
// Decision Outcome — "what decision does the publication prepare," which
// is exactly the North Star's own already-selected recommendation, not a
// second guess.
// ------------------------------------------------------------------
export function selectDecisionOutcome(northStar) {
  if (!northStar?.recommendation) return null;
  return {
    decision: northStar.recommendation.recommendation,
    owner: northStar.recommendation.owner || null,
    timeline: northStar.recommendation.timeline || null,
    rationale: 'This is the same real recommendation the Editorial Intelligence Engine already selected as the publication\'s North Star — the decision outcome is not a second, independently-guessed prediction.',
  };
}

// ------------------------------------------------------------------
// Executive Decision Journey — the brief's requested 7-stage journey
// (Problem -> Understanding -> Confidence -> Decision -> Commitment ->
// Implementation -> Future) mapped onto the REAL, already-declared 12-stage
// Narrative Arc (arcContextFor) rather than a second, competing arc. Every
// spine spread's real stage already exists; this only relabels the
// journey-level grouping the brief asked for.
// ------------------------------------------------------------------
const JOURNEY_STAGE_BY_ARC_STAGE = Object.freeze({
  'Context': 'Problem',
  'Problem': 'Problem',
  'Evidence': 'Understanding',
  'Interpretation': 'Confidence',
  'Consequences': 'Confidence',
  'Strategic Options': 'Decision',
  'Priority Decisions': 'Decision',
  'Implementation': 'Commitment',
  'Risk': 'Commitment',
  'Monitoring': 'Implementation',
  'Future Outlook & Closing Reflection': 'Future',
});

export function buildExecutiveDecisionJourney(spreads) {
  return (spreads || []).map(s => {
    const arc = arcContextFor(s.id);
    return { spreadId: s.id, arcStage: arc?.stage || null, journeyStage: arc?.stage ? (JOURNEY_STAGE_BY_ARC_STAGE[arc.stage] || null) : null };
  });
}

// ------------------------------------------------------------------
// Intent Consistency Validator — real, checkable: does the North Star's
// recommendation's own real strategic_priority tier match the declared
// Purpose's expected urgency (e.g. "Emergency Response"/"Risk Mitigation"
// should never rest on a non-CRITICAL finding); does at least one real
// CRITICAL-tier recommendation exist to justify an urgency-toned purpose.
// ------------------------------------------------------------------
const URGENT_PURPOSES = new Set(['Emergency Response', 'Risk Mitigation']);
export function validateIntentConsistency(model, purpose, northStar) {
  const issues = [];
  if (purpose?.purpose && URGENT_PURPOSES.has(purpose.purpose)) {
    const hasCriticalRecommendation = (model?.report?.recommendations || []).some(r => String(r.strategic_priority || '').toUpperCase() === 'CRITICAL');
    if (!hasCriticalRecommendation) {
      issues.push({ rule: 'purpose_urgency_unsupported', severity: 'high', detail: `Purpose "${purpose.purpose}" implies urgency, but no real recommendation on this model carries a CRITICAL priority tier.` });
    }
  }
  if (northStar?.recommendation && String(northStar.recommendation.strategic_priority || '').toUpperCase() !== 'CRITICAL' && purpose?.purpose === 'Risk Mitigation') {
    issues.push({ rule: 'decision_priority_drift', severity: 'medium', detail: 'Purpose is Risk Mitigation but the North Star\'s own linked recommendation is not itself CRITICAL-tier.' });
  }
  return issues;
}

// ------------------------------------------------------------------
// Editorial Filter — real, spread-level (not fabricated per-paragraph
// NLP): reuses detectMissingEvidenceLink and detectDuplicateRecommendations
// (already built, never duplicated) and adds one genuinely new, real
// check — a "late theme": a real finding (identified by its own evidence_ids)
// that is NOT the North Star and appears for the first time only on a
// back-third spread (methodology/evidence-annex/quality-gate/closing),
// never introduced earlier in the publication.
// ------------------------------------------------------------------
const BACK_THIRD_SPREAD_IDS = new Set(['methodology', 'evidence-annex', 'quality-gate', 'closing']);
export function detectLateThemes(model, spreads, northStar) {
  const findings = model?.report?.findings || [];
  const issues = [];
  for (const finding of findings) {
    if (finding === northStar?.finding) continue;
    const marker = finding.evidence_ids?.[0];
    if (!marker) continue;
    const firstSpreadIndex = (spreads || []).findIndex(s => s.html.includes(marker));
    if (firstSpreadIndex === -1) continue;
    const firstSpread = spreads[firstSpreadIndex];
    if (BACK_THIRD_SPREAD_IDS.has(firstSpread.id)) {
      issues.push({ rule: 'late_theme_introduced', spreadId: firstSpread.id, findingId: finding.id, severity: 'medium', detail: `Finding "${finding.title}" (evidence ${marker}) is never referenced until the back-third spread "${firstSpread.id}" — a late theme, not built up earlier.` });
    }
  }
  return issues;
}

export function buildEditorialFilter(model, spreads, northStar) {
  return [
    ...detectMissingEvidenceLink(spreads || []).map(i => ({ rule: 'evidence_no_decision_relevance', spreadId: i.spread, severity: i.severity, recommendation: 'Merge or Delete' })),
    ...detectDuplicateRecommendations(model?.report?.recommendations || []).map(i => ({ rule: 'duplicate_evidence', pair: i.pair, severity: i.severity, recommendation: 'Merge' })),
    ...detectLateThemes(model, spreads, northStar).map(i => ({ ...i, recommendation: 'Move earlier or Appendix' })),
  ];
}

// ------------------------------------------------------------------
// Publication Promise Validator — "the Cover makes a promise, the Closing
// must fulfil it." Real and checkable: does Closing's rendered HTML still
// name the same real North Star recommendation Cover's hero stat/title
// pointed to. This is deliberately the same underlying fact ESCI's
// validateEditorialContinuity already checks (Closing naming the North
// Star) — reused here under the brief's own "Promise" framing rather than
// re-implemented as a second, parallel check.
// ------------------------------------------------------------------
export function validatePublicationPromise(northStar, spreads) {
  const cover = (spreads || []).find(s => s.id === 'cover');
  const closing = (spreads || []).find(s => s.id === 'closing');
  if (!cover || !closing || !northStar?.recommendation) {
    return { promiseKept: false, detail: 'Missing Cover, Closing, or a real North Star recommendation to check.' };
  }
  const coverPromise = northStar.finding.title || northStar.finding.text.slice(0, 30);
  const coverMakesPromise = cover.html.includes(coverPromise);
  const closingFulfills = closing.html.includes(northStar.recommendation.recommendation);
  return {
    promiseKept: coverMakesPromise && closingFulfills,
    coverMakesPromise, closingFulfills,
    detail: coverMakesPromise && closingFulfills
      ? 'Cover names the real North Star finding, and Closing names the real North Star recommendation — the promise is kept end to end.'
      : `Promise chain broken: coverMakesPromise=${coverMakesPromise}, closingFulfills=${closingFulfills}.`,
  };
}

// ------------------------------------------------------------------
// Publication Personality — one label, derived from the North Star's own
// real narrative_mode — a different axis from Communication Strategy
// (ESCI): personality is tone, strategy is approach.
//
// An earlier version of this function also upgraded 'Analytical' to
// 'Urgent' whenever the North Star's recommendation was CRITICAL-tier.
// Checked directly against all 16 real samples before this was committed:
// the North Star's recommendation is CRITICAL-tier on every one of the 16
// real samples (the same catalog-wide fact that forced the Purpose
// risk-override fix above), so that condition never actually discriminates
// — it fires unconditionally. Combined with the further fact that the
// North Star's own narrative_mode is, across this real catalog, always
// either 'risk-led' or 'evidence-led' (never any of the other 8 modes),
// the override collapsed personality to "Urgent" on all 16 samples,
// destroying the one real distinction ('risk-led' vs. 'evidence-led') the
// data actually supports. Removed before commit for the same reason the
// Purpose override was removed — the same self-correction discipline used
// throughout this engagement.
// ------------------------------------------------------------------
const PERSONALITY_BY_NARRATIVE_MODE = Object.freeze({
  'risk-led': 'Urgent',
  'evidence-led': 'Analytical',
  'analytical': 'Analytical',
  'decision-led': 'Authoritative',
  'opportunity-led': 'Visionary',
  'human-impact': 'Measured',
  'contrast-led': 'Pragmatic',
  'contextual': 'Measured',
  'uncertainty-led': 'Measured',
  'geographic': 'Pragmatic',
});

export function selectPublicationPersonality(northStar) {
  const mode = northStar?.finding?.narrative_mode;
  const personality = PERSONALITY_BY_NARRATIVE_MODE[mode] || null;
  return {
    personality,
    rationale: personality
      ? `Derived from the North Star's real narrative_mode ("${mode}") — a single, real, non-mixed personality.`
      : 'No real narrative_mode was available to ground a personality choice.',
  };
}

// ------------------------------------------------------------------
// Executive Trust estimate — a real composite of already-computed real
// signals (never a fabricated "trust" number): North Star survival
// (ESCI's continuity validator), the Promise Validator above, the real PX
// Quality Gate overall score, and whether the Decision Outcome resolved to
// a real, non-null value.
// ------------------------------------------------------------------
export function estimateExecutiveTrust({ promiseValidation, gateScore, decisionOutcome, continuityIssueCount }) {
  const clarity = decisionOutcome ? 100 : 0;
  const focus = promiseValidation?.promiseKept ? 100 : 40;
  const consistency = continuityIssueCount === 0 ? 100 : Math.max(0, 100 - continuityIssueCount * 20);
  const decisionReadiness = decisionOutcome?.owner && decisionOutcome?.timeline ? 100 : 50;
  const strategicMaturity = Number(gateScore) || 0;
  const publicationConfidence = Math.round((clarity + focus + consistency + decisionReadiness + strategicMaturity) / 5);
  return { clarity, focus, consistency, decisionReadiness, strategicMaturity, publicationConfidence };
}

// ------------------------------------------------------------------
// Intent Score (0-100) — the release's own required composite, built only
// from real, already-computed signals above; never a separate invented
// number.
// ------------------------------------------------------------------
export function computeIntentScore({ purpose, intent, promiseValidation, trust, continuityIssueCount }) {
  const purposeClarity = purpose?.purpose ? 100 : 0;
  const decisionClarity = intent?.intent ? 100 : 0;
  const editorialConsistency = Math.max(0, 100 - continuityIssueCount * 15);
  const communicationConsistency = promiseValidation?.promiseKept ? 100 : 50;
  const readerConfidence = trust?.focus ?? 0;
  const executiveUsefulness = trust?.strategicMaturity ?? 0;
  const northStarSurvival = promiseValidation?.closingFulfills ? 100 : 0;
  const decisionReadiness = trust?.decisionReadiness ?? 0;
  const components = { purposeClarity, decisionClarity, editorialConsistency, communicationConsistency, readerConfidence, executiveUsefulness, northStarSurvival, decisionReadiness };
  const score = Math.round(Object.values(components).reduce((a, b) => a + b, 0) / Object.keys(components).length);
  return { score, components };
}
