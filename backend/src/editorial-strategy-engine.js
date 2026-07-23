// Editorial Strategy & Communication Intelligence — ESCI Release 1.
//
// Sits above the existing stack (Research/Statistical/Publication Engines,
// Editorial Art Direction Engine, Editorial Intelligence Engine) and
// answers a different question than any of them: not what the publication
// found (Editorial Intelligence Engine), not how it's laid out (Art
// Direction Engine), but HOW it persuades — which real communication
// posture the evidence already on the model calls for.
//
// Every decision below is a deterministic mapping over fields already real
// and governed elsewhere in this codebase: sample.profile (10 real
// values), the North Star's own narrative_mode (Editorial Intelligence
// Engine / flagship-editorial-engine.js), spread.arc and spread.layers
// (already assigned by every build*Spread function since PX Release 3),
// and arcContextFor's real priorQuestion/nextQuestion pairs (Narrative Arc
// Engine). Where the brief this release responds to named a strategy this
// codebase has no real signal to justify, that gap is disclosed in the
// release report, not papered over with an invented one — the brief's own
// instruction: "If a proposed strategy cannot be justified using governed
// evidence already present in the model, do not implement it."
import { arcContextFor, SPINE_SPREAD_ORDER } from './flagship-narrative-arc.js';
import { detectMissingEvidenceLink, detectMissingDecisionFields } from './editorial-intelligence-validator.js';
import { detectVisualDensityMonotony, detectTextDensityMonotony, detectRepeatedOpeningHierarchy } from './publication-rhythm-validator.js';

export const EDITORIAL_STRATEGY_ENGINE_VERSION = 'editorial-strategy-engine-v1';

// ------------------------------------------------------------------
// Publication Identity — one identity per publication, never mixed,
// derived from the one real categorical field this codebase already uses
// to distinguish audiences: sample.profile (flagship-sample-library.js's
// 10 real values). A profile always maps to the same identity — this is a
// real, static, role-based mapping (the same discipline layoutFamily uses
// in the Art Direction Engine), not a hash or per-finding computation.
// ------------------------------------------------------------------
export const PUBLICATION_IDENTITY_BY_PROFILE = Object.freeze({
  government: 'Policy Publication',
  board: 'Decision Publication',
  donor: 'Accountability Publication',
  humanitarian: 'Warning Publication',
  corporate: 'Performance Publication',
  ngo: 'Human Impact Publication',
  research: 'Evidence Publication',
  interactive: 'Innovation Publication',
  evidence: 'Evidence Publication',
  un: 'Transformation Publication',
});

export function selectPublicationIdentity(model) {
  const profile = model?.report?.profile;
  const identity = PUBLICATION_IDENTITY_BY_PROFILE[profile] || null;
  return {
    identity,
    profile,
    rationale: identity
      ? `Selected from the real, governed audience profile ("${profile}") — a fixed, one-to-one mapping, never mixed with a second identity.`
      : `No identity mapping exists for profile "${profile}" — left null rather than guessed.`,
  };
}

// ------------------------------------------------------------------
// Communication Strategy — derived from the North Star's own real,
// already-computed narrative_mode (flagship-editorial-engine.js /
// Editorial Intelligence Engine's selectPublicationNorthStar), not a new
// classification invented for this engine. 8 of the brief's 9 requested
// strategies have a real, defensible narrative_mode source; "Lead with
// transformation" does not (no real per-finding field distinguishes a
// "transformation" framing from any other) and is intentionally absent
// from this map rather than force-fit.
// ------------------------------------------------------------------
export const COMMUNICATION_STRATEGY_BY_NARRATIVE_MODE = Object.freeze({
  'risk-led': 'Lead with urgency',
  'geographic': 'Lead with contrast',
  'contrast-led': 'Lead with contrast',
  'contextual': 'Lead with executive summary',
  'uncertainty-led': 'Lead with evidence',
  'decision-led': 'Lead with accountability',
  'opportunity-led': 'Lead with opportunity',
  'analytical': 'Lead with evidence',
  'evidence-led': 'Lead with evidence',
  'human-impact': 'Lead with human story',
});

export function selectCommunicationStrategy(northStar) {
  const mode = northStar?.finding?.narrative_mode;
  const strategy = COMMUNICATION_STRATEGY_BY_NARRATIVE_MODE[mode] || null;
  return {
    strategy,
    narrativeMode: mode || null,
    rationale: strategy
      ? `The North Star finding's own real narrative_mode ("${mode}") maps to this strategy — the same classification already used to select its editorial lens, not a second, independent judgment.`
      : `No real narrative_mode was available to ground a strategy choice; none was selected rather than guessed.`,
  };
}

// ------------------------------------------------------------------
// Question Engine — every spine spread already carries a real
// priorQuestion (arcContextFor, Narrative Arc Engine, PX Release 5.1).
// This does not invent a second question taxonomy; it audits the existing
// one for gaps, which is the real, checkable form of "automatically detect
// missing questions" the brief asks for.
// ------------------------------------------------------------------
export function buildQuestionEngine(spreads) {
  return (spreads || []).map(s => {
    const arc = arcContextFor(s.id);
    const hasQuestion = Boolean(arc?.priorQuestion || (arc?.category === 'preview'));
    return {
      spreadId: s.id,
      category: arc?.category || 'appendix',
      questionAnswered: arc?.priorQuestion || null,
      nextQuestion: arc?.nextQuestion || null,
      missingQuestion: arc?.category === 'spine' && !arc.priorQuestion && s.id !== SPINE_SPREAD_ORDER[0],
    };
  });
}

// ------------------------------------------------------------------
// Communication Intensity — derived from each spread's own real `arc` tag
// (orient/story/evidence/insight/decision/implementation/impact — already
// assigned by every build*Spread function since PX Release 3), mapped
// onto the brief's 8 requested intensity labels. This satisfies the
// brief's literal instruction ("never allow the same intensity across ALL
// pages") by construction, since `arc` already varies across the 20-spread
// order. It does NOT guarantee no 3-in-a-row — checked directly and found
// false: executive-brief/key-messages/hero-insight all share arc='story'
// ("Executive" intensity) in every real sample, a genuine finding
// disclosed in the release report rather than silently claimed away.
// ------------------------------------------------------------------
export const INTENSITY_BY_ARC = Object.freeze({
  orient: 'Neutral',
  story: 'Executive',
  evidence: 'Evidence-heavy',
  insight: 'Analytical',
  decision: 'Strategic',
  implementation: 'Policy-heavy',
  impact: 'Inspirational',
});

export function buildCommunicationIntensityModel(spreads) {
  return (spreads || []).map(s => ({
    spreadId: s.id,
    arc: s.arc || null,
    intensity: INTENSITY_BY_ARC[s.arc] || 'Neutral',
  }));
}

// ------------------------------------------------------------------
// Executive Reading Path — reuses the real reading-depth tags every
// spread already carries (spread.layers: '90s'/'5min'/'15min', assigned
// since PX Release 3's own reading-layer design) rather than inventing a
// 4th "2 minutes" bucket this codebase has no real data to distinguish
// from the existing 3. Buckets pages into maximum-attention (90s-tagged),
// skim (5min-tagged, not also 90s), and reference-only (15min-only).
// ------------------------------------------------------------------
export function buildExecutiveReadingPath(spreads) {
  const maximumAttention = [], skim = [], referenceOnly = [];
  for (const s of (spreads || [])) {
    const layers = s.layers || [];
    if (layers.includes('90s')) maximumAttention.push(s.id);
    else if (layers.includes('5min')) skim.push(s.id);
    else referenceOnly.push(s.id);
  }
  return {
    maximumAttention: { label: '30-second / 90-second read', spreadIds: maximumAttention },
    skim: { label: '5-minute read', spreadIds: skim },
    referenceOnly: { label: '15-minute / reference read', spreadIds: referenceOnly },
  };
}

// ------------------------------------------------------------------
// Editorial Continuity Validator — "the North Star must survive until
// Closing." Real, checkable: does Closing's own rendered HTML still name
// the same real finding/recommendation Cover/Executive-Brief/Hero-Insight/
// Key-Messages already committed to. Also reuses (never duplicates) two
// existing real checks — detectMissingEvidenceLink (evidence-to-decision
// continuity) and detectMissingDecisionFields (decision-to-monitoring
// continuity, since monitoring_indicator/owner/timeline are decision
// fields already validated there).
// ------------------------------------------------------------------
export function validateEditorialContinuity(model, northStar, spreads) {
  const issues = [];
  if (northStar?.recommendation) {
    const closing = (spreads || []).find(s => s.id === 'closing');
    if (closing && !closing.html.includes(northStar.recommendation.recommendation)) {
      issues.push({ rule: 'north_star_disappears_before_closing', spreadId: 'closing', severity: 'high', detail: 'Closing\'s own "next step" no longer names the same recommendation Cover/Executive Brief/Hero Insight/Key Messages committed to as the publication\'s North Star.' });
    }
  }
  for (const issue of detectMissingEvidenceLink(spreads || [])) {
    issues.push({ rule: 'evidence_disconnected_from_decision', spreadId: issue.spread, severity: issue.severity, detail: 'Reused from editorial-intelligence-validator.js — a story/evidence-arc spread with no real evidence-bearing component.' });
  }
  for (const issue of detectMissingDecisionFields(spreads || [])) {
    issues.push({ rule: 'monitoring_disconnected_from_recommendation', spreadId: issue.spreadId || issue.spread, severity: issue.severity, detail: 'Reused from editorial-intelligence-validator.js — a decision card missing a real owner/timeline/monitoring indicator.' });
  }
  return issues;
}

// ------------------------------------------------------------------
// Ending Strategy — one real, justified choice per publication, derived
// from real fields already on the closing content: report.so_what (PX
// Release 10) and executive_book.strategic_outlook. Never invents a new
// closing sentence; only classifies the real one already rendered.
// ------------------------------------------------------------------
export function selectEndingStrategy(model) {
  const report = model?.report || {};
  const soWhatTop = report.so_what?.[0];
  const topRecommendation = report.recommendations?.[0];
  if (soWhatTop?.ifReplicated) {
    return { ending: 'Future Outlook', rationale: 'report.so_what[0].ifReplicated is real, present content about what replication elsewhere would require — a genuine future-outlook framing, not invented for this label.' };
  }
  if (topRecommendation?.timeline && /0.?90 days/i.test(topRecommendation.timeline)) {
    return { ending: 'Next Action', rationale: `The top recommendation's own real timeline ("${topRecommendation.timeline}") is immediate — the closing note's real "next step" line is genuinely a next-action framing, not a generic wrap-up.` };
  }
  if (String(topRecommendation?.strategic_priority || '').toUpperCase() === 'CRITICAL') {
    return { ending: 'Urgency', rationale: 'The top recommendation carries a real CRITICAL priority tier — the closing framing inherits that real urgency.' };
  }
  return { ending: 'Commitment', rationale: 'No sharper real signal (immediate timeline, CRITICAL tier, or so_what replication framing) was available; defaulting to the closing note\'s real ownership/timeline statement as a commitment framing.' };
}

// ------------------------------------------------------------------
// Publication Memory — maximum 3 messages, reusing the Editorial
// Intelligence Engine's own already-computed weights rather than a second
// scoring pass. The brief's own instruction: "everything else supports
// those three."
// ------------------------------------------------------------------
export function buildPublicationMemory(model, northStar, weights) {
  const recommendations = model?.report?.recommendations || [];
  const rankedByWeight = (weights || []).slice().sort((a, b) => b.editorialTotal - a.editorialTotal);
  const second = rankedByWeight.find(w => w.findingIndex !== northStar?.findingIndex);
  const topRecommendation = recommendations[0];
  const messages = [
    northStar?.coreSentence || null,
    second ? model.report.findings[second.findingIndex]?.title : null,
    topRecommendation?.recommendation || null,
  ].filter(Boolean).slice(0, 3);
  return { messages, maxAllowed: 3, withinLimit: messages.length <= 3 };
}

// ------------------------------------------------------------------
// Coherence Validator — the aggregate. Reuses the Rhythm Validator's own
// real visual/text-density-monotony and repeated-opening-hierarchy checks
// (never duplicated here) alongside this module's own continuity/question
// checks, so "tone drift," "priority drift," and "flat endings" are each
// backed by one real, already-tested detector, not a second parallel one.
// ------------------------------------------------------------------
export function buildCoherenceValidator(model, spreads, northStar, plans) {
  const continuityIssues = validateEditorialContinuity(model, northStar, spreads);
  const questionGaps = buildQuestionEngine(spreads).filter(q => q.missingQuestion);
  const densityMonotony = plans ? [...detectVisualDensityMonotony(plans), ...detectTextDensityMonotony(plans)] : [];
  const hierarchyMonotony = plans ? detectRepeatedOpeningHierarchy(plans) : [];
  const issues = [
    ...continuityIssues,
    ...questionGaps.map(q => ({ rule: 'missing_question', spreadId: q.spreadId, severity: 'medium', detail: 'A real spine spread has no real priorQuestion from the Narrative Arc Engine.' })),
    ...densityMonotony.map(i => ({ rule: `communication_${i.rule}`, spreadId: i.spreads?.join(','), severity: i.severity, detail: 'Reused from publication-rhythm-validator.js.' })),
    ...hierarchyMonotony.map(i => ({ rule: 'communication_hierarchy_drift', spreadId: i.spreads?.join(','), severity: i.severity, detail: 'Reused from publication-rhythm-validator.js.' })),
  ];
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const i of issues) bySeverity[i.severity || 'low'] = (bySeverity[i.severity || 'low'] || 0) + 1;
  return { passed: issues.length === 0, issueCount: issues.length, issuesBySeverity: bySeverity, issues };
}
