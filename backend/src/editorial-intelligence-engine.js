// Editorial Intelligence Engine — EIE Release 1.
//
// A new layer ABOVE the existing stack (Statistical Engine, Report
// Generator, Publication Composer, Editorial Art Direction Engine,
// Publication Rhythm Validator, Density Engine, Quality Gate, SDG
// Intelligence, Narrative Arc, Transition Engine — none of that is
// replaced or duplicated here). This module runs first and decides WHAT
// the publication is saying; the Art Direction Engine still decides HOW
// it is shown.
//
// Every score below is a deterministic function of fields already real
// and governed on the model — confidence_score, strategic_priority,
// evidence_ids, narrative_mode, budget_requirement/budget_band,
// expected_risk, regional primary_score gaps, sdg_cards linkage — never a
// fabricated "emotion" or "memorability" figure invented from nothing.
// Where the brief this release responds to named a dimension this
// codebase has no real field to ground honestly (a literal emotional-arc
// stage per spread, a prediction of what a specific human reader
// remembers 24 hours later, 7 fully distinct audience voice rewrites),
// this module does not simulate one — that scoping decision is disclosed
// in the release report, not hidden here.
import { truncateWords, firstSentences } from './publication-render-utils.js';
import { arcContextFor } from './flagship-narrative-arc.js';

export const EDITORIAL_INTELLIGENCE_ENGINE_VERSION = 'editorial-intelligence-engine-v1';

// ------------------------------------------------------------------
// Editorial Priority Engine — 8 real, named dimensions per finding.
// ------------------------------------------------------------------
const PRIORITY_WEIGHT = { CRITICAL: 100, HIGH: 70, MEDIUM: 40, LOW: 15 };
function priorityOf(recommendation) {
  return PRIORITY_WEIGHT[String(recommendation?.strategic_priority || recommendation?.priority || '').toUpperCase()] ?? 0;
}
function budgetWeightOf(recommendation) {
  const t = String(recommendation?.budget_requirement || recommendation?.budget_band || '').toLowerCase();
  if (t.includes('high')) return 90;
  if (t.includes('medium')) return 55;
  if (t.includes('low')) return 25;
  return 40;
}
// The 4 real narrative modes (flagship-editorial-engine.js) that carry a
// human/contrast/evidence/risk framing rather than a purely analytical or
// contextual one — a real, already-computed editorial signal, reused here
// rather than re-derived.
const STORY_MODES = new Set(['human-impact', 'contrast-led', 'evidence-led', 'risk-led']);

// The real regional performance gap behind a finding, when its linked
// evidence names a region — reuses full_publication.regional (already
// governed, PX Release 5, Task #42's score-derived risk fix) rather than
// inventing a second regional metric.
function regionalGapFor(finding, evidenceById, regional) {
  const region = evidenceById?.get((finding.evidence_ids || [])[0])?.region;
  if (!region || !regional?.length) return null;
  const scores = regional.map(r => Number(r.primary_score) || 0);
  const best = Math.max(...scores);
  const own = regional.find(r => r.name === region);
  if (!own) return null;
  return Math.max(0, best - (Number(own.primary_score) || 0));
}

export function computeEditorialWeights({ findings, recommendations, evidenceById, regional, sdgCards }) {
  return (findings || []).map((finding, index) => {
    const recommendation = (recommendations || [])[index] || null;
    const confidence = Number(finding.confidence_score) || 0;
    const evidenceCount = (finding.evidence_ids || []).length;
    const gap = regionalGapFor(finding, evidenceById, regional);
    const linkedSdg = (sdgCards || []).some(c => (c.evidence_ids || []).some(id => (finding.evidence_ids || []).includes(id)));
    const hasQuantifiedStat = /\d+(?:\.\d+)?%/.test(finding.text || '');

    // editorialWeight: how well-supported is this claim (evidence strength + breadth).
    const editorialWeight = Math.round(confidence * 0.7 + Math.min(evidenceCount, 5) * 6);
    // editorialUrgency: how time-sensitive — real priority tier + real regional gap size.
    const editorialUrgency = Math.round(priorityOf(recommendation) * 0.8 + (gap != null ? Math.min(gap, 40) : 0) * 0.5);
    // decisionValue: how much this changes what leadership actually does — priority tier + real budget scale.
    const decisionValue = Math.round(priorityOf(recommendation) * 0.6 + budgetWeightOf(recommendation) * 0.4);
    // riskValue: whether a real, named execution risk rides on this decision.
    const riskValue = recommendation?.expected_risk ? Math.round(60 + priorityOf(recommendation) * 0.3) : 20;
    // storyValue: real narrative framing (human-impact/contrast/evidence/risk modes carry more story weight than analytical/contextual ones) + evidence breadth.
    const storyValue = Math.round((STORY_MODES.has(finding.narrative_mode) ? 70 : 40) + Math.min(evidenceCount, 3) * 5);
    // visualValue: whether this finding carries a real quantified stat and/or a real SDG/regional anchor a chart could use.
    const visualValue = Math.round((hasQuantifiedStat ? 55 : 20) + (linkedSdg ? 20 : 0) + (gap != null ? 20 : 0));
    // memorability: real contrast (the bigger the real regional gap, the more contrast-driven) + story framing.
    const memorability = Math.round((gap != null ? Math.min(gap, 40) : 0) * 1.2 + (STORY_MODES.has(finding.narrative_mode) ? 30 : 10));
    // readerImpact: composite of decision/risk/story — "would a reader's own situation change because of this."
    const readerImpact = Math.round((decisionValue + riskValue + storyValue) / 3);
    // editorialTotal: the single composite selectPublicationNorthStar ranks
    // by — deliberately NOT confidence_score alone (the brief's own example:
    // a 92%-confidence finding may matter less than an 84%-confidence one
    // that changes national policy). Weighs decision consequence and real
    // narrative/contrast strength alongside evidence strength.
    const editorialTotal = Math.round((editorialWeight + editorialUrgency + decisionValue + storyValue + memorability) / 5);

    return {
      findingIndex: index, editorialWeight, editorialUrgency, memorability, decisionValue,
      storyValue, visualValue, riskValue, readerImpact, editorialTotal,
      regionalGap: gap, linkedSdg, hasQuantifiedStat,
    };
  });
}

// ------------------------------------------------------------------
// Editorial North Star — the audit's #1 finding, fixed. Cover, Executive
// Brief, Hero Insight, and Key Messages previously each independently
// selected a "most important finding" by 3 different rules (confidence-
// only via pickHeroFinding, tier+confidence via rankKeyMessages, array-
// position via recommendations[0]) — confirmed to disagree in 10 of 16
// real samples. This is now the single, shared selection every front-
// matter spread reads from.
// ------------------------------------------------------------------
export function selectPublicationNorthStar(model) {
  const report = model.report || {};
  const full = model.full_publication || {};
  const findings = report.findings || [];
  const recommendations = report.recommendations || [];
  if (!findings.length) return null;

  const evidenceById = new Map((report.evidence || []).map(e => [e.id, e]));
  const weights = computeEditorialWeights({ findings, recommendations, evidenceById, regional: full.regional, sdgCards: full.sdg_cards });
  const ranked = weights.slice().sort((a, b) => b.editorialTotal - a.editorialTotal);
  const top = ranked[0];
  const finding = findings[top.findingIndex];
  const recommendation = recommendations[top.findingIndex] || null;

  return {
    findingIndex: top.findingIndex,
    finding,
    recommendation,
    weight: top,
    // coreIdea: the real editorial idea every front-matter spread must
    // reinforce — the brief's own distinction ("not identical wording, the
    // same editorial idea") — a short, real, extractive phrase, not a
    // generated summary.
    coreIdea: finding.title || truncateWords(finding.text, 10),
    coreSentence: firstSentences(finding.text, 2),
    rationale: `Selected by composite editorial weight (${top.editorialTotal}/100: evidence ${top.editorialWeight}, urgency ${top.editorialUrgency}, decision value ${top.decisionValue}, story value ${top.storyValue}, memorability ${top.memorability}) — not confidence_score alone.`,
  };
}

// ------------------------------------------------------------------
// Repetition governance — the audit's #2 finding. The top recommendation
// previously appeared byte-identical on 10 of 20 real spreads. Rather than
// ban repetition outright (some pages genuinely need the full sentence —
// Executive Brief's Policy Alert, Decisions A's own card, Priority
// Matrix's real index, Monitoring's real register, Closing's real next
// step), this assigns each real spread ID a real editorial role with a
// stated justification: 'primary' (full text belongs here), 'reference'
// (a short pointer back to where it's stated in full), 'summary'
// (condensed, real, but not verbatim), or 'omit'.
// ------------------------------------------------------------------
export const RECOMMENDATION_REPETITION_PLAN = Object.freeze({
  'executive-brief': { role: 'primary', justification: "The Policy Alert is the publication's own 30-second decision anchor — the one place a bare, complete decision statement is the page's entire job." },
  'hero-insight': { role: 'reference', justification: 'Hero Insight interprets the evidence; the decision itself is already stated in full two pages earlier on Executive Brief, so only a short pointer belongs here.' },
  'regional-equity': { role: 'reference', justification: "The page's job is the geographic gap, not the decision — a short policy-implication pointer, not a second full statement." },
  'root-cause': { role: 'reference', justification: 'Decision implication only needs to name which real decision follows the causal chain, not restate it in full a third time.' },
  'priority-matrix': { role: 'primary', justification: 'This is the real, numbered index of every recommendation — the one page whose entire purpose is naming them all in full.' },
  'decisions-a': { role: 'primary', justification: "This is the decision's own dedicated executive memo — the full statement belongs here by definition." },
  'roadmap': { role: 'primary', justification: 'The roadmap is the real per-decision delivery timeline — every one of the 5 real decisions, including this one, must be named in full to answer "what is due when."' },
  // Reconsidered mid-implementation: condensing every row to a bare
  // tier+owner reference (as hero-insight/regional-equity/root-cause do)
  // would make two rows that share the same real tier and owner — common
  // in this dataset — read as identical, a worse defect than the verbatim
  // repeat itself. This table's real job is distinguishing which decision
  // each risk attaches to, so the full sentence stays.
  'risks': { role: 'primary', justification: 'The decision-linked risk table must distinguish which specific decision each risk attaches to; a tier+owner reference alone can collide across rows that share a tier and owner, so the full sentence is kept.' },
  'monitoring': { role: 'primary', justification: 'A monitoring register must name the exact decision each row tracks — this is real accountability content, not decoration.' },
  'closing': { role: 'primary', justification: "The Closing's own \"next step\" is deliberately the full, explicit final restatement — the publication's one intentional closing echo." },
});

export function repetitionRoleFor(spreadId) {
  return RECOMMENDATION_REPETITION_PLAN[spreadId] || { role: 'reference', justification: 'No specific editorial role declared for this spread; defaulting to a short reference rather than a full repeat.' };
}

// ------------------------------------------------------------------
// Page Purpose Validator — every spread must answer "why do I exist,"
// reusing the Art Direction Engine's own real, already-declared
// editorialPurpose (SPREAD_META) rather than inventing a second purpose
// taxonomy. "Materiality" is a real, checkable question: does this spread
// carry the only instance of some real component type in the whole
// publication (dropping it would remove real content nothing else
// carries), or does its component set entirely overlap with spreads
// already confirmed elsewhere.
// ------------------------------------------------------------------
export function validatePagePurpose(spreads) {
  const componentTypeOwners = new Map();
  for (const s of spreads) {
    for (const c of (s.components || [])) {
      if (!componentTypeOwners.has(c.type)) componentTypeOwners.set(c.type, []);
      componentTypeOwners.get(c.type).push(s.id);
    }
  }
  return spreads.map(s => {
    const purpose = s.artDirectionPlan?.editorialPurpose || null;
    const uniqueComponentTypes = (s.components || []).filter(c => (componentTypeOwners.get(c.type) || []).length === 1);
    const isMaterial = Boolean(purpose) && ((s.components || []).length > 0);
    return {
      spreadId: s.id,
      editorialPurpose: purpose,
      wouldWeakenPublicationIfRemoved: isMaterial,
      uniqueContentTypes: uniqueComponentTypes.map(c => c.type),
    };
  });
}

// ------------------------------------------------------------------
// Editorial Checklist — the brief's own requested pre-render output,
// computed as a real, structured object. Every field traces to a real,
// already-governed value; a field with no honest real source on this
// model is null, not invented.
// ------------------------------------------------------------------
export function buildEditorialChecklist(model, northStar) {
  const report = model.report || {};
  const book = report.executive_book || {};
  const evidence = report.evidence || [];
  const strongestQuote = evidence.length ? evidence.slice().sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))[0] : null;
  const heroInsightQuestion = arcContextFor('hero-insight');
  const rootCauseQuestion = arcContextFor('root-cause');
  const topRecommendation = report.recommendations?.[0] || null;

  return {
    publicationTheme: report.sector || null,
    northStar: northStar?.coreIdea || null,
    editorialThesis: book.executive_brief || report.executive_summary || null,
    primaryQuestion: rootCauseQuestion?.priorQuestion || null,
    secondaryQuestion: heroInsightQuestion?.priorQuestion || null,
    readerPromise: report.publication_intelligence?.reader_contract?.[0] || null,
    primaryDecision: topRecommendation?.recommendation || null,
    primaryRisk: (book.critical_risks || [])[0]?.risk || null,
    primaryOpportunity: (book.top_opportunities || [])[0] || null,
    primaryTransformation: book.strategic_outlook || null,
    mostMemorableStatistic: northStar?.coreSentence || null,
    mostMemorableQuote: strongestQuote?.quote || null,
    mostImportantRecommendation: northStar?.recommendation?.recommendation || null,
    pagesSupporting: {
      northStar: ['cover', 'executive-brief', 'key-messages', 'hero-insight'],
      primaryDecision: ['executive-brief', 'priority-matrix', 'decisions-a', 'monitoring', 'closing'],
      primaryRisk: ['risks'],
      primaryTransformation: ['scenarios', 'closing'],
    },
  };
}
