// Flagship Editorial Engine — PX Release 5, Part 2 (revised).
import { audienceThinkingProfile } from './flagship-editorial-brain.js';
//
// The problem this exists to fix is not "not enough sentence templates."
// flagship-sample-library.js already has 10 distinct FINDING_FRAMES, 11
// INTERPRETATION_FRAMES, and 6-variant pools for every recommendation and
// executive-book field. What was still wrong is the SELECTION mechanism on
// top of them: every one of those pools was picked by a raw
// seeded(sample.key, offset+i, 0, length-1) hash with no semantic
// relationship to the finding or recommendation it dresses. This module
// replaces that hash with a small set of deterministic decisions grounded
// in real fields already on the governed model — it does not write, own,
// or duplicate any sentence text; every array it selects from already
// exists in flagship-sample-library.js.
//
// Pure functions only: same input -> same output, no Math.random, no I/O,
// no knowledge of HTML/rendering. Every decision traces to a real field:
// a recommendation's own strategic_priority tier, or a report's own mix of
// priority tiers. No LLM call, no fabrication, fully deterministic.
//
// PX Release 8 (Editorial Brain, Part 2): planReportEditorialProfile always
// accepted an `audience` parameter but never used it in computing
// reportTone — audience was a label carried through, not a decision. The
// Editorial Brain's per-profile urgency bias (flagship-editorial-brain.js)
// closes that: the same real regional-score evidence now reads more or
// less urgently depending on the real audience this report is for, the
// same way a real editorial desk treats a humanitarian audience's
// tolerance for "measured" framing differently from a research audience's.
export const FLAGSHIP_EDITORIAL_ENGINE_VERSION = 'flagship-editorial-engine-v2';

// ------------------------------------------------------------------
// Narrative-mode eligibility by priority tier. Confirmed by audit
// (PX Release 5 plan) that finding.confidence_score has almost no real
// spread in this dataset (89.5-96.5 across all 80 findings in the
// 16-sample library — always "strong" or "excellent" via
// classifyVRDSConfidence, never moderate/low/insufficient), so it cannot
// serve as a meaningful differentiator here. The linked recommendation's
// strategic_priority DOES have real, meaningful spread (CRITICAL/HIGH/
// MEDIUM) and is already a real, governed field — findings and
// recommendations share the same index i (both built from
// BLUEPRINTS[key].subjects[i] / .actions[i]), so finding i can honestly
// borrow recommendation i's priority tier.
// ------------------------------------------------------------------
const ELIGIBLE_MODES_BY_TIER = {
  CRITICAL: ['analytical', 'risk-led', 'decision-led', 'evidence-led'],
  HIGH: ['evidence-led', 'geographic', 'contrast-led', 'human-impact'],
  MEDIUM: ['contextual', 'opportunity-led', 'uncertainty-led'],
};
const ALL_MODES = ['analytical', 'contrast-led', 'evidence-led', 'human-impact', 'risk-led', 'opportunity-led', 'geographic', 'contextual', 'decision-led', 'uncertainty-led'];

// CRITICAL findings should read decisively; MEDIUM findings are the ones
// honestly served by a hedge, since they carry the least organizational
// urgency, not because any evidence field says they are less certain.
const UNCERTAINTY_STYLE_BY_TIER = { CRITICAL: 'confident', HIGH: 'measured', MEDIUM: 'hedged' };
const PARAGRAPH_RHYTHM_BY_TIER = { CRITICAL: 'full', HIGH: 'full', MEDIUM: 'condensed' };

// ------------------------------------------------------------------
// Per-finding editorial decision. `seedIndex` is supplied by the caller
// (flagship-sample-library.js already owns the seeded() hash used
// elsewhere in that file) so this module stays a pure decision function
// with no knowledge of hashing strategy. `previousMode` is the mode
// chosen for the previous finding in the SAME report — the anti-repeat
// check below is the "transition strategy" axis: a bounded, real rule
// (never render the same rhetorical mode twice in a row) rather than a
// full rhetorical-connective-tissue rewrite.
// ------------------------------------------------------------------
export function planFindingEditorial({ priorityTier, seedIndex, previousMode }) {
  const eligible = ELIGIBLE_MODES_BY_TIER[priorityTier] || ALL_MODES;
  const base = ((seedIndex % eligible.length) + eligible.length) % eligible.length;
  let narrativeMode = eligible[base];
  if (narrativeMode === previousMode && eligible.length > 1) {
    narrativeMode = eligible[(base + 1) % eligible.length];
  }
  return {
    narrativeMode,
    uncertaintyStyle: UNCERTAINTY_STYLE_BY_TIER[priorityTier] || 'measured',
    paragraphRhythm: PARAGRAPH_RHYTHM_BY_TIER[priorityTier] || 'full',
  };
}

// ------------------------------------------------------------------
// Report-level editorial profile — one decision per report (not per
// finding), used to pick among EXECUTIVE_BRIEF_FRAMES/
// STRATEGIC_OUTLOOK_FRAMES/COST_OF_INACTION_FRAMES by a real report-level
// signal instead of an unrelated country hash.
//
// NOTE: recommendations[].strategic_priority was tried first and rejected —
// every one of the 16 samples has exactly 5 recommendations with the tier
// assigned purely by position (i<2 CRITICAL), so the CRITICAL count is
// always exactly 2 across all 16 samples (confirmed by direct computation).
// Using it here would repeat the same non-differentiating-signal mistake
// already caught and rejected for finding.confidence_score. The regional
// primary_score average genuinely varies per report (confirmed 55-82 across
// the 16 samples, real spread) and is already the real, governed field
// driving the Regional & Equity spread — reused here, not invented.
// ------------------------------------------------------------------
export function planReportEditorialProfile({ audience, regionalScores = [] }) {
  const avgRegionalScore = regionalScores.length ? regionalScores.reduce((a, b) => a + b, 0) / regionalScores.length : 70;
  // The real regional-score evidence is never altered — only the THRESHOLD
  // at which it reads as urgent shifts, and only by a real, named,
  // audience-specific bias (flagship-editorial-brain.js's
  // AUDIENCE_THINKING_PROFILES). A humanitarian audience reads the same
  // 68% average regional score more urgently than a research audience
  // would; this is the "different thinking, not different wording" the
  // Editorial Brain exists to encode.
  const { urgencyBias } = audienceThinkingProfile(audience);
  const adjustedScore = avgRegionalScore - urgencyBias;
  const dominantPriorityMix = adjustedScore < 65 ? 'CONCENTRATED_RISK' : adjustedScore < 74 ? 'MIXED' : 'STANDARD';
  const reportTone = dominantPriorityMix === 'CONCENTRATED_RISK' ? 'urgent' : dominantPriorityMix === 'MIXED' ? 'balanced' : 'measured';
  return { audience, dominantPriorityMix, reportTone };
}
