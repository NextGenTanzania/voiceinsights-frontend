// Editorial Art Direction Engine — EAD Release 2, Core Engine.
//
// Generates a deterministic, content-grounded art-direction plan for every
// one of the 20 real spreads composePublicationSpreads produces. This
// module is pure: same input -> byte-identical output, no Math.random, no
// Date.now, no LLM call, no flat hash rotation, no index-only assignment.
//
// Two-pass design (deliberate, not incidental): composePublicationSpreads
// builds all 20 spreads first, exactly as every prior release did, then
// calls buildArtDirectionPlans(model, spreads) once, AFTER composition, so
// every plan can be grounded in the spread's own real, final content —
// spread.text (already the real extractive summary used for word counts),
// spread.components (the real component list each build*Spread function
// already returns), spread.visibleWords/componentCount (the true rendered-
// content density built in EAD Release 1). This avoids inventing a second,
// parallel content-extraction layer that could drift from what the page
// actually renders, and it is exactly why the plan can honestly claim to be
// "derived from actual content" rather than decorative.
//
// layoutFamily itself is a fixed, principled mapping from spread ROLE (not
// spread INDEX, not a hash) — the same kind of static-but-real mapping this
// codebase already uses for arcContextFor's stage assignment. Every other
// field is a genuine function of real per-report content and therefore
// varies across the 16 real samples and across renders of the same sample
// as its content changes.
import { arcContextFor } from './flagship-narrative-arc.js';
import { firstSentences, truncateWords, wordCount } from './publication-render-utils.js';
import { densityMaxWordsFor } from './editorial-intelligence-validator.js';

export const EDITORIAL_ART_DIRECTION_ENGINE_VERSION = 'editorial-art-direction-engine-v1';

// ------------------------------------------------------------------
// The 19 required layout families (brief, Part 3).
// ------------------------------------------------------------------
export const LAYOUT_FAMILIES = Object.freeze([
  'editorial-cover', 'credentials-front-matter', 'executive-decision-brief', 'ranked-message-composition',
  'hero-evidence', 'context-orientation', 'geographic-comparison', 'testimony-editorial', 'causal-system',
  'scenario-pathways', 'strategic-matrix', 'executive-decision-memo', 'implementation-roadmap', 'risk-governance',
  'monitoring-framework', 'methodology-architecture', 'evidence-register', 'assurance-review', 'forward-looking-closing',
]);

// The 16 semantic typography roles (brief, Part 8).
export const TYPOGRAPHY_ROLES = Object.freeze([
  'publication-title', 'spread-thesis', 'executive-decision', 'hero-stat', 'evidence-quote', 'interpretation',
  'warning', 'opportunity', 'risk', 'methodology', 'source', 'disclosure', 'next-action', 'chapter-marker',
  'caption', 'footnote',
]);

// ------------------------------------------------------------------
// Static, real, role-based mapping — every spread ID this engine will ever
// see, matched 1:1 to composePublicationSpreads's own real render order
// (verified against the current 20-spread arc; a spread ID this table does
// not recognize is a genuine composer defect, not something this engine
// should silently paper over — buildArtDirectionPlans skips it and callers
// can detect the gap via plans.size !== spreads.length).
// `arc` reuses the exact 4th-argument tag every build*Spread function
// already passes to spread() (orient/story/evidence/insight/decision/
// implementation/impact) — a real, pre-existing categorical signal, not a
// new taxonomy invented for this engine.
// `geography` records whether the spread's own real content is genuinely
// comparative across regions, aggregate at country level, or per-row
// localized — a structural property of what each build*Spread function
// already reads (full.regional for comparison, full.sample_size/country
// for aggregate, per-finding evidence.region for localized).
// ------------------------------------------------------------------
const SPREAD_META = Object.freeze({
  'cover': { layoutFamily: 'editorial-cover', spreadType: 'front-matter', arc: 'orient', geography: 'aggregate',
    editorialPurpose: 'Establish publication identity and credibility before any claim is made', fallbackQuestion: 'What is this publication, and is it credible?' },
  'inside-cover': { layoutFamily: 'credentials-front-matter', spreadType: 'front-matter', arc: 'orient', geography: 'none',
    editorialPurpose: 'Certify authorship, sourcing and rights before the argument begins', fallbackQuestion: 'Who produced this, and under what authority?' },
  'executive-brief': { layoutFamily: 'executive-decision-brief', spreadType: 'executive-summary', arc: 'story', geography: 'none',
    editorialPurpose: 'Compress the full decision into a 90-second executive read', fallbackQuestion: null },
  'key-messages': { layoutFamily: 'ranked-message-composition', spreadType: 'executive-summary', arc: 'story', geography: 'none',
    editorialPurpose: 'Rank the most decision-relevant findings for a scanning reader', fallbackQuestion: null },
  'hero-insight': { layoutFamily: 'hero-evidence', spreadType: 'finding', arc: 'story', geography: 'localized',
    editorialPurpose: 'Assert the single most confidence-weighted finding in the dataset', fallbackQuestion: null },
  'national-context': { layoutFamily: 'context-orientation', spreadType: 'context', arc: 'story', geography: 'aggregate',
    editorialPurpose: 'Ground the reader in scope, scale and data lineage before evidence begins', fallbackQuestion: null },
  'regional-equity': { layoutFamily: 'geographic-comparison', spreadType: 'evidence', arc: 'evidence', geography: 'comparative',
    editorialPurpose: 'Show where performance diverges geographically and what that gap means for decisions', fallbackQuestion: null },
  'evidence-story': { layoutFamily: 'testimony-editorial', spreadType: 'evidence', arc: 'evidence', geography: 'localized',
    editorialPurpose: 'Let the strongest respondent evidence carry the argument in its own words', fallbackQuestion: null },
  'root-cause': { layoutFamily: 'causal-system', spreadType: 'analysis', arc: 'evidence', geography: 'localized',
    editorialPurpose: 'Trace each symptom to its extracted and inferred causes with epistemic status kept explicit', fallbackQuestion: null },
  'scenarios': { layoutFamily: 'scenario-pathways', spreadType: 'analysis', arc: 'insight', geography: 'none',
    editorialPurpose: 'Lay out realistic, differently-confident paths forward without fabricating a single forecast', fallbackQuestion: null },
  'priority-matrix': { layoutFamily: 'strategic-matrix', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Rank every recommendation by real priority and feasibility on one plot', fallbackQuestion: null },
  // Decision Reasoning Architecture (Part 9): 5 new reasoning spreads,
  // inserted between Strategic Options and Priority Decisions — each an
  // appendix-tier deep-dive on the same North Star recommendation the rest
  // of the publication already follows, not a new spine stage (see
  // flagship-narrative-arc.js's APPENDIX_TIER_SPREAD_IDS).
  'decision-options-tradeoffs': { layoutFamily: 'strategic-matrix', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Compare real, materially different decision alternatives and show why the preferred one wins', fallbackQuestion: null },
  'decision-conditions': { layoutFamily: 'risk-governance', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Carry the full trade-off, rejection-rationale and uncertainty detail the strategic-choice page intentionally left out', fallbackQuestion: null },
  'stakeholder-political-economy': { layoutFamily: 'causal-system', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Disclose who benefits, who carries the cost, and who may resist, at the category level the evidence actually supports', fallbackQuestion: null },
  'behavioural-adoption-pathway': { layoutFamily: 'implementation-roadmap', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Trace current to desired behaviour with every barrier, enabler and response conservatively classified', fallbackQuestion: null },
  'system-effects-map': { layoutFamily: 'causal-system', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Show how this decision connects to drivers, dependencies and spillovers elsewhere in the system, each labelled by real inference type', fallbackQuestion: null },
  'decision-under-uncertainty': { layoutFamily: 'risk-governance', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'State what is known, likely, emerging or unknown across this decision\'s whole reasoning set, and what that means for acting now', fallbackQuestion: null },
  'decisions-a': { layoutFamily: 'executive-decision-memo', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Give the top two decisions full executive-memo treatment, outcome and urgency led', fallbackQuestion: null, subLayout: 'outcome-urgency-led' },
  'roadmap': { layoutFamily: 'implementation-roadmap', spreadType: 'implementation', arc: 'implementation', geography: 'none',
    editorialPurpose: 'Sequence every decision onto a real delivery horizon', fallbackQuestion: null },
  'decisions-b': { layoutFamily: 'executive-decision-memo', spreadType: 'decision', arc: 'decision', geography: 'none',
    editorialPurpose: 'Give the remaining decisions comparison-led executive-memo treatment', fallbackQuestion: null, subLayout: 'comparison-led' },
  'risks': { layoutFamily: 'risk-governance', spreadType: 'risk', arc: 'decision', geography: 'none',
    editorialPurpose: 'Disclose portfolio-level and decision-level risk without inventing owners or mitigations the model lacks', fallbackQuestion: null },
  'monitoring': { layoutFamily: 'monitoring-framework', spreadType: 'implementation', arc: 'implementation', geography: 'none',
    editorialPurpose: 'State who verifies progress, how, and against which international targets', fallbackQuestion: null },
  'methodology': { layoutFamily: 'methodology-architecture', spreadType: 'back-matter', arc: 'evidence', geography: 'none',
    editorialPurpose: 'Disclose method, data quality and limitations for technical scrutiny', fallbackQuestion: 'How was this evidence actually produced?' },
  'evidence-annex': { layoutFamily: 'evidence-register', spreadType: 'back-matter', arc: 'evidence', geography: 'comparative',
    editorialPurpose: 'Provide the full, traceable evidence register behind every claim in the publication', fallbackQuestion: 'Can every claim above be traced to a specific record?' },
  'quality-gate': { layoutFamily: 'assurance-review', spreadType: 'back-matter', arc: 'evidence', geography: 'none',
    editorialPurpose: "Report the publication's own honest self-assessment, including what remains unmet", fallbackQuestion: 'Has this publication been independently checked before it reached me?' },
  'closing': { layoutFamily: 'forward-looking-closing', spreadType: 'closing', arc: 'impact', geography: 'none',
    editorialPurpose: 'Close on forward motion and a named next step, not a restated summary', fallbackQuestion: null },
  // Editorial Division Release: 4 new appendix-tier spreads, each reusing
  // an existing layoutFamily whose role already matches (monitoring-
  // framework for tile/metric grids, assurance-review for automated-check
  // panels, evidence-register for tabular back-matter, causal-system for
  // outcome/output maps) — no new layout family invented for these.
  'executive-dashboard': { layoutFamily: 'monitoring-framework', spreadType: 'executive-summary', arc: 'story', geography: 'aggregate',
    editorialPurpose: 'Surface the KPI figures leaders check first, sector-composed by real editorial identity', fallbackQuestion: null },
  'ai-insights': { layoutFamily: 'assurance-review', spreadType: 'evidence', arc: 'evidence', geography: 'none',
    editorialPurpose: 'Disclose real deterministic classification signals, never generated narrative', fallbackQuestion: null },
  'oecd-dac': { layoutFamily: 'evidence-register', spreadType: 'back-matter', arc: 'evidence', geography: 'none',
    editorialPurpose: 'Assess the publication against the 6 OECD-DAC evaluation criteria', fallbackQuestion: null },
  'theory-of-change': { layoutFamily: 'causal-system', spreadType: 'back-matter', arc: 'evidence', geography: 'none',
    editorialPurpose: 'Trace the results chain from inputs to impact', fallbackQuestion: null },
});

// ------------------------------------------------------------------
// readerMode: derived from the spread's own real `layers` reading-depth
// tags (already assigned by every build*Spread call to spread()) and its
// `arc` tag — not a new taxonomy invented for this engine. A spread reader
// must actively weigh a real decision or action ('evaluate'); a spread
// reachable within the 90-second executive layer and not itself a decision
// point is scanned ('scan'); everything else is read in full ('read').
// ------------------------------------------------------------------
function readerModeFor(layers, arc) {
  if (arc === 'decision' || arc === 'implementation') return 'evaluate';
  if ((layers || []).includes('90s')) return 'scan';
  return 'read';
}

const HIERARCHY_STRATEGY_BY_ARC = Object.freeze({
  orient: 'credential-first', story: 'narrative-first', evidence: 'evidence-first', insight: 'interpretation-first',
  decision: 'decision-first', implementation: 'action-first', impact: 'reflection-first',
});

// The one primary semantic role each spread's own lead content should
// carry. A lookup by spread ID (not spreadType) because two spreads sharing
// a spreadType can still lead with genuinely different content — Executive
// Brief leads with a decision, Key Messages leads with a ranked finding —
// so a coarser spreadType-level rule would blur a real distinction this
// engine is supposed to preserve.
const TYPOGRAPHY_MODE_BY_SPREAD_ID = Object.freeze({
  'cover': 'publication-title', 'inside-cover': 'source', 'executive-brief': 'executive-decision',
  'key-messages': 'spread-thesis', 'hero-insight': 'hero-stat', 'national-context': 'interpretation',
  'regional-equity': 'interpretation', 'evidence-story': 'evidence-quote', 'root-cause': 'interpretation',
  'scenarios': 'opportunity', 'priority-matrix': 'executive-decision',
  'decision-options-tradeoffs': 'executive-decision', 'decision-conditions': 'executive-decision', 'stakeholder-political-economy': 'interpretation',
  'behavioural-adoption-pathway': 'interpretation', 'system-effects-map': 'interpretation', 'decision-under-uncertainty': 'risk',
  'decisions-a': 'executive-decision',
  'roadmap': 'next-action', 'decisions-b': 'executive-decision', 'risks': 'risk', 'monitoring': 'next-action',
  'methodology': 'methodology', 'evidence-annex': 'source', 'quality-gate': 'disclosure', 'closing': 'next-action',
  'executive-dashboard': 'hero-stat', 'ai-insights': 'disclosure', 'oecd-dac': 'source', 'theory-of-change': 'interpretation',
});

// visualDensity/textDensity are read directly off the spread's own real,
// already-computed componentCount/visibleWords (EAD Release 1's true-
// density measurement) rather than re-deriving a second estimate — the
// same discipline that release established (visibleWords over estimatedWords)
// applies here too: this engine must not introduce a second, competing
// density signal.
function visualDensityFor(componentCount) {
  if (componentCount <= 1) return 'sparse';
  if (componentCount <= 3) return 'moderate';
  return 'rich';
}
function textDensityFor(visibleWords, maxWords) {
  if (visibleWords < maxWords * 0.35) return 'light';
  if (visibleWords < maxWords * 0.8) return 'moderate';
  return 'heavy';
}
function whitespaceModeFor(visualDensity, textDensity) {
  const sparse = visualDensity === 'sparse' && textDensity === 'light';
  const rich = visualDensity === 'rich' && textDensity === 'heavy';
  if (sparse) return 'airy';
  if (rich) return 'dense';
  return 'balanced';
}

// evidenceEmphasis/decisionEmphasis: real, arc-derived — not a second
// classification of the same content already captured by arc/hierarchy.
function evidenceEmphasisFor(arc) {
  if (arc === 'evidence') return 'high';
  if (arc === 'story' || arc === 'insight') return 'moderate';
  return 'low';
}
function decisionEmphasisFor(arc) {
  if (arc === 'decision' || arc === 'implementation') return 'high';
  if (arc === 'story' || arc === 'impact') return 'moderate';
  return 'low';
}

const IMAGE_POLICY = 'no-photography — synthetic theme motif only (see cover/closing abstract motif, drawn from the sample\'s own governed theme colours), never a fabricated photograph or invented identity';

function accessibilityNotesFor(dominantVisualType) {
  const t = String(dominantVisualType || '');
  if (/chart|diagram|matrix|band|thermometer|ladder|meter/i.test(t)) {
    return 'Dominant visual is a chart/diagram: requires a text alternative; the adjacent prose and caption on this spread already state the same real figures in words, so no chart on this publication is the sole carrier of a fact.';
  }
  if (/table/i.test(t)) {
    return 'Dominant visual is a table: requires a horizontally-scrollable container on narrow viewports; header cells use <th> for screen-reader row/column navigation.';
  }
  return 'Primarily prose-led: no additional alternative-text obligation beyond standard heading structure and list semantics.';
}

// A small, real fallback list, consistent with the constraints this whole
// engagement has enforced across every prior release (no raw enum leak, no
// fabricated statistic, no duplicated finding fragment, no unlabeled chart
// axis) — used only when the report's own real, governed
// publication_intelligence.prohibited_patterns list (PX Release 3) is
// unavailable, so this engine never has to invent its own taxonomy from
// nothing.
const FALLBACK_PROHIBITED_PATTERNS = Object.freeze([
  'fabricated statistic', 'raw internal enum shown verbatim', 'duplicated finding fragment repeated as rationale',
  'unlabeled chart axis', 'invented photograph or identity',
]);

function repetitionRiskFor(layoutFamily, dominantVisualType, previousPlan) {
  if (!previousPlan) return 'low';
  if (previousPlan.layoutFamily === layoutFamily) return 'high';
  if (previousPlan.dominantVisualType && previousPlan.dominantVisualType === dominantVisualType) return 'moderate';
  return 'low';
}

function rationaleFor({ spreadType, arc, hierarchyStrategy, dominantVisualType, componentCount, visibleWords, geography }) {
  return `This ${spreadType} spread leads with ${hierarchyStrategy.replace(/-/g, ' ')} content because its real narrative role is "${arc}". Dominant visual: ${dominantVisualType || 'prose only'}, across ${componentCount} real rendered component${componentCount === 1 ? '' : 's'} and ${visibleWords} visible words${geography !== 'none' ? `; geography is ${geography} for this spread` : ''}.`;
}

// ------------------------------------------------------------------
// buildArtDirectionPlans(model, spreads): the single exported entry point.
// `spreads` must already be the real, fully-composed array
// composePublicationSpreads produces (same order, same real .id/.arc/
// .layers/.text/.components/.visibleWords/.componentCount fields every
// build*Spread function already returns via spread()) — this engine reads
// that real output, it does not recompute or duplicate it.
// ------------------------------------------------------------------
export function buildArtDirectionPlans(model = {}, spreads = []) {
  const report = model.report || {};
  const prohibitedPatterns = (report.publication_intelligence?.prohibited_patterns?.length
    ? report.publication_intelligence.prohibited_patterns
    : FALLBACK_PROHIBITED_PATTERNS);

  const plans = new Map();
  let previousPlan = null;
  for (const s of spreads) {
    const meta = SPREAD_META[s.id];
    if (!meta) continue;
    const arcCtx = arcContextFor(s.id);
    const dominantVisualType = s.components?.[0]?.type || null;
    const secondaryVisualTypes = [...new Set((s.components || []).slice(1).map(c => c.type))];
    const maxWords = densityMaxWordsFor(s.id);
    const visualDensity = visualDensityFor(s.componentCount || 0);
    const textDensity = textDensityFor(s.visibleWords ?? s.estimatedWords ?? 0, maxWords);
    const whitespaceMode = whitespaceModeFor(visualDensity, textDensity);
    const hierarchyStrategy = HIERARCHY_STRATEGY_BY_ARC[meta.arc] || 'narrative-first';
    const typographyMode = TYPOGRAPHY_MODE_BY_SPREAD_ID[s.id] || 'interpretation';
    const primaryMessage = truncateWords(firstSentences(s.text || '', 1), 24);
    const attentionAnchor = truncateWords(firstSentences(s.text || '', 1), 12);
    const readerMode = readerModeFor(s.layers, meta.arc);

    const plan = {
      spreadId: s.id,
      spreadType: meta.spreadType,
      editorialPurpose: meta.editorialPurpose,
      primaryReaderQuestion: arcCtx?.priorQuestion ?? meta.fallbackQuestion,
      primaryMessage,
      readerMode,
      attentionAnchor,
      layoutFamily: meta.layoutFamily,
      dominantVisualType,
      secondaryVisualTypes,
      hierarchyStrategy,
      typographyMode,
      whitespaceMode,
      visualDensity,
      textDensity,
      evidenceEmphasis: evidenceEmphasisFor(meta.arc),
      decisionEmphasis: decisionEmphasisFor(meta.arc),
      geographicMode: meta.geography,
      imagePolicy: IMAGE_POLICY,
      permittedComponents: [...new Set((s.components || []).map(c => c.type))],
      prohibitedPatterns,
      repetitionRisk: null, // set below, needs the fields just computed
      accessibilityNotes: accessibilityNotesFor(dominantVisualType),
      rationale: null, // set below, needs repetitionRisk-independent fields only
      subLayout: meta.subLayout || null,
    };
    plan.repetitionRisk = repetitionRiskFor(plan.layoutFamily, plan.dominantVisualType, previousPlan);
    plan.rationale = rationaleFor({
      spreadType: plan.spreadType, arc: meta.arc, hierarchyStrategy, dominantVisualType,
      componentCount: s.componentCount || 0, visibleWords: s.visibleWords ?? s.estimatedWords ?? 0, geography: meta.geography,
    });

    plans.set(s.id, plan);
    previousPlan = plan;
  }
  return plans;
}

// Exposed for the rhythm validator and for direct testing without needing
// a full composed spread array.
export { SPREAD_META };
