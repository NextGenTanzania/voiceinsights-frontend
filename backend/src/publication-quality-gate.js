// Publication Quality Gate V2 — Publication Experience (PX) Release 4,
// permanent architectural layer 6 of 6 and orchestrator (see the PX
// Release 4 plan).
//
// Deterministic — no LLM/generative judgment anywhere in this file. Same
// (spreads, editorialValidation, context) input always produces the same
// assessment. Composes the other five layers (Intelligence Layer, Director,
// Benchmark Engine, DNA Checklist, Memory) into the 13 requested PX
// categories, five persona-weighted views, a maturity level, and — only
// when explicitly enabled — a real pass/fail gate.
//
// Every category is computed from a real, already-measured signal (the
// editorial validator's issue counts, the composer's own component flags,
// the generated CSS, the Benchmark/DNA checklists below). Categories this
// codebase cannot honestly measure with code (does this genuinely read
// like a McKinsey publication) are explicitly labeled as a proxy, not
// asserted as true editorial judgment — matching the honest-scoring stance
// established at the end of PX Release 3.
import { checkBenchmarkCharacteristics } from './publication-benchmark-engine.js';
import { checkPublicationDNA } from './publication-dna-checklist.js';
import { reviewSpreadComposition } from './publication-director.js';
import { summarizeTrend } from './publication-memory.js';
import { CHART_COMPONENT_CLASS_NAMES } from './editorial-intelligence-validator.js';

export const PUBLICATION_QUALITY_GATE_VERSION = 'publication-quality-gate-v1';

export const PX_CATEGORIES = Object.freeze([
  'editorial_quality', 'publication_architecture', 'visual_storytelling', 'infographic_quality',
  'executive_readability', 'decision_intelligence', 'typography', 'information_hierarchy',
  'geographic_intelligence', 'evidence_transparency', 'visual_consistency', 'international_publication_readiness',
]);

// The single canonical chart-class list lives in
// editorial-intelligence-validator.js (CHART_COMPONENT_CLASS_NAMES) —
// reused here rather than hand-listed a third time.
const CHART_COMPONENT_CLASSES = CHART_COMPONENT_CLASS_NAMES.split('|');
const VISUAL_COMPONENT_CLASSES = [
  'policy-alert', 'risk-card', 'decision-canvas', 'regional-panel', 'scenario-card', 'evidence-spotlight',
  'confidence-meter', 'investment-card', 'equity-lens', 'cost-of-inaction-panel', 'strategic-outlook',
  'roadmap-rail', 'hero-kpi-panel', ...CHART_COMPONENT_CLASSES,
];

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

// ------------------------------------------------------------------
// Per-category scoring — each function documents the exact real signal it
// reads. Category order matches PX_CATEGORIES.
// ------------------------------------------------------------------

function scoreEditorialQuality(editorialValidation) {
  const sev = editorialValidation?.issues_by_severity || {};
  const penalty = (sev.critical || 0) * 15 + (sev.high || 0) * 5 + (sev.medium || 0) * 2 + (sev.low || 0) * 0.5;
  return clampScore(100 - penalty);
}

// Spreads that render a card grid — their real card count is passed to the
// Director so its column-span rhythm check is actually exercised, not a
// permanent no-op.
const CARD_GRID_SPREAD_IDS = new Set(['decisions-a', 'decisions-b', 'risks']);

function scorePublicationArchitecture(spreads) {
  if (!spreads.length) return 0;
  const withComponent = spreads.filter(s => (s.componentCount || 0) >= 1).length;
  const base = (withComponent / spreads.length) * 100;
  const rhythmIssues = spreads.reduce((sum, s) => {
    const cardCount = CARD_GRID_SPREAD_IDS.has(s.id) ? (s.componentCount || 0) : null;
    const review = reviewSpreadComposition(s, cardCount);
    return sum + (review.rhythm.issues?.length || 0);
  }, 0);
  return clampScore(base - rhythmIssues * 5);
}

function scoreVisualStorytelling(spreads) {
  if (!spreads.length) return 0;
  const withVisual = spreads.filter(s => VISUAL_COMPONENT_CLASSES.some(cls => (s.html || '').includes(`class="${cls}`) || (s.html || '').includes(`class='${cls}`))).length;
  return clampScore((withVisual / spreads.length) * 100);
}

function scoreInfographicQuality(spreads) {
  const combinedHtml = spreads.map(s => s.html || '').join(' ');
  const distinctCharts = CHART_COMPONENT_CLASSES.filter(cls => combinedHtml.includes(`class="${cls}`)).length;
  return clampScore((distinctCharts / CHART_COMPONENT_CLASSES.length) * 100);
}

// Reuses the editorial validator's own underfilled/overfilled findings
// (which already account for real structural density — table rows, list
// items, decision fields — not just prose word count) rather than
// recomputing a cruder density estimate that would disagree with the
// authoritative signal and misjudge intentionally terse spreads like
// key-messages or the cover.
function scoreExecutiveReadability(spreads, editorialValidation) {
  const ninetySecondSpreads = spreads.filter(s => (s.layers || []).includes('90s'));
  if (!ninetySecondSpreads.length) return 0;
  const flaggedIds = new Set((editorialValidation?.issues || [])
    .filter(i => i.rule === 'underfilled_spread' || i.rule === 'overfilled_spread')
    .map(i => i.spread));
  const balanced = ninetySecondSpreads.filter(s => !flaggedIds.has(s.id)).length;
  return clampScore((balanced / ninetySecondSpreads.length) * 100);
}

function scoreDecisionIntelligence(spreads, intelligenceChains) {
  const decisionCards = spreads.flatMap(s => (s.components || []).filter(c => c.type === 'decision_card'));
  const fieldScore = decisionCards.length
    ? (decisionCards.filter(c => c.hasOwner && c.hasTimeline && c.hasMonitoringIndicator).length / decisionCards.length) * 100
    : 0;
  if (!intelligenceChains || !intelligenceChains.length) return clampScore(fieldScore);
  const avgCompleteness = intelligenceChains.reduce((sum, c) => sum + c.completeness, 0) / intelligenceChains.length;
  return clampScore((fieldScore + avgCompleteness * 100) / 2);
}

function scoreTypography(cssText) {
  const checks = [
    cssText.includes('fontDisplay') || /h1,h2,h3\{font-family:/.test(cssText),
    /\.pull-quote\{[^}]*break-inside:avoid/.test(cssText),
    /orphans:\d/.test(cssText) && /widows:\d/.test(cssText),
    /--vpds-/.test(cssText),
  ];
  return clampScore((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreInformationHierarchy(spreads) {
  if (!spreads.length) return 0;
  const focused = spreads.filter(s => (s.componentCount || 0) >= 1 && (s.componentCount || 0) <= 5).length;
  return clampScore((focused / spreads.length) * 100);
}

function scoreGeographicIntelligence(spreads) {
  const regional = spreads.find(s => s.id === 'regional-equity');
  if (!regional) return 0;
  const hasDisclosure = /not a geographic map|Geographic Intelligence/i.test(regional.html || '');
  const hasFallback = (regional.html || '').includes('regional-panel');
  return clampScore((hasDisclosure ? 60 : 0) + (hasFallback ? 40 : 0));
}

function scoreEvidenceTransparency(editorialValidation) {
  const relevantRules = new Set(['unsupported_quotation', 'unsupported_statistic', 'missing_evidence_link', 'fabricated_risk_owner', 'fabricated_risk_mitigation', 'quantified_impact_fabrication']);
  const count = (editorialValidation?.issues || []).filter(i => relevantRules.has(i.rule)).length;
  return clampScore(100 - count * 10);
}

function scoreVisualConsistency(spreads, cssText, metadata, dnaResult) {
  const classUsage = new Map();
  for (const s of spreads) {
    for (const cls of VISUAL_COMPONENT_CLASSES) {
      if ((s.html || '').includes(`class="${cls}`)) classUsage.set(cls, (classUsage.get(cls) || 0) + 1);
    }
  }
  const reused = [...classUsage.values()].filter(n => n > 1).length;
  const usedTotal = classUsage.size || 1;
  const reuseRate = (reused / usedTotal) * 100;
  return clampScore((reuseRate + dnaResult.score) / 2);
}

// ------------------------------------------------------------------
// Persona weighting — a deterministic re-weighting of the same 12 real
// category scores, not a simulated free-text read-through. Each weight
// vector sums to 1.0 across PX_CATEGORIES, in the same order.
// ------------------------------------------------------------------
export const PERSONA_WEIGHTS = Object.freeze({
  ceo: { editorial_quality: 0.05, publication_architecture: 0.10, visual_storytelling: 0.08, infographic_quality: 0.05, executive_readability: 0.20, decision_intelligence: 0.25, typography: 0.03, information_hierarchy: 0.10, geographic_intelligence: 0.04, evidence_transparency: 0.05, visual_consistency: 0.03, international_publication_readiness: 0.02 },
  minister: { editorial_quality: 0.05, publication_architecture: 0.08, visual_storytelling: 0.05, infographic_quality: 0.04, executive_readability: 0.12, decision_intelligence: 0.22, typography: 0.02, information_hierarchy: 0.08, geographic_intelligence: 0.15, evidence_transparency: 0.10, visual_consistency: 0.02, international_publication_readiness: 0.07 },
  board_member: { editorial_quality: 0.15, publication_architecture: 0.12, visual_storytelling: 0.08, infographic_quality: 0.05, executive_readability: 0.10, decision_intelligence: 0.12, typography: 0.05, information_hierarchy: 0.08, geographic_intelligence: 0.03, evidence_transparency: 0.07, visual_consistency: 0.10, international_publication_readiness: 0.05 },
  donor: { editorial_quality: 0.08, publication_architecture: 0.05, visual_storytelling: 0.04, infographic_quality: 0.04, executive_readability: 0.08, decision_intelligence: 0.18, typography: 0.02, information_hierarchy: 0.05, geographic_intelligence: 0.08, evidence_transparency: 0.20, visual_consistency: 0.03, international_publication_readiness: 0.15 },
  researcher: { editorial_quality: 0.15, publication_architecture: 0.05, visual_storytelling: 0.03, infographic_quality: 0.05, executive_readability: 0.04, decision_intelligence: 0.05, typography: 0.10, information_hierarchy: 0.05, geographic_intelligence: 0.05, evidence_transparency: 0.30, visual_consistency: 0.03, international_publication_readiness: 0.10 },
});

function computePersonaScores(categories) {
  const personaScores = {};
  for (const [persona, weights] of Object.entries(PERSONA_WEIGHTS)) {
    let total = 0;
    for (const cat of PX_CATEGORIES) total += (categories[cat] || 0) * (weights[cat] || 0);
    personaScores[persona] = clampScore(total);
  }
  return personaScores;
}

function maturityLevelFor(score) {
  if (score >= 90) return 'World-Class';
  if (score >= 75) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

const IMPROVEMENT_RECOMMENDATIONS = {
  editorial_quality: 'Resolve remaining high/critical editorial validator findings before the next render.',
  publication_architecture: 'Ensure every spread carries at least one real component and that card grids follow the governed column-span rules.',
  visual_storytelling: 'Replace remaining plain-text spreads with a real publication component (evidence spotlight, risk card, etc.).',
  infographic_quality: 'Add real chart coverage where the underlying data supports it — see publication-chart-components.js for what is currently unused.',
  executive_readability: 'Rebalance underfilled or overfilled spreads in the 90-second reading layer so each communicates its message at a glance.',
  decision_intelligence: 'Complete missing owner/timeline/monitoring fields on decision cards, or the underlying recommendation data.',
  typography: 'Confirm the display/body font pairing, pull-quote break-inside:avoid, and orphan/widow control are present in the generated stylesheet.',
  information_hierarchy: 'Reduce spreads carrying more than five distinct components to keep one message per spread.',
  geographic_intelligence: 'Ensure the regional spread both discloses the map-data limitation and provides the ranked-panel fallback.',
  evidence_transparency: 'Resolve unsupported quotation/statistic and fabricated-attribution findings from the editorial validator.',
  visual_consistency: 'Reuse the same named components across spreads rather than one-off treatments, and confirm brand DNA elements are present.',
  international_publication_readiness: 'Close gaps in the benchmark characteristics checklist (methodology, risk, monitoring, evidence-register sections).',
};

const FAILING_THRESHOLD = 60;

// ------------------------------------------------------------------
// Top-level orchestrator.
// ------------------------------------------------------------------
export function computePXAssessment(spreads = [], editorialValidation = null, context = {}) {
  const cssText = context.cssText || '';
  const metadata = context.metadata || {};
  const intelligenceChains = context.intelligenceChains || null;

  const benchmark = checkBenchmarkCharacteristics(spreads);
  const dna = checkPublicationDNA(spreads, cssText, metadata);

  const categories = {
    editorial_quality: scoreEditorialQuality(editorialValidation),
    publication_architecture: scorePublicationArchitecture(spreads),
    visual_storytelling: scoreVisualStorytelling(spreads),
    infographic_quality: scoreInfographicQuality(spreads),
    executive_readability: scoreExecutiveReadability(spreads, editorialValidation),
    decision_intelligence: scoreDecisionIntelligence(spreads, intelligenceChains),
    typography: scoreTypography(cssText),
    information_hierarchy: scoreInformationHierarchy(spreads),
    geographic_intelligence: scoreGeographicIntelligence(spreads),
    evidence_transparency: scoreEvidenceTransparency(editorialValidation),
    visual_consistency: scoreVisualConsistency(spreads, cssText, metadata, dna),
    international_publication_readiness: benchmark.score,
  };

  const overallScore = clampScore(PX_CATEGORIES.reduce((sum, cat) => sum + categories[cat], 0) / PX_CATEGORIES.length);
  const personaScores = computePersonaScores(categories);

  const failedCriteria = PX_CATEGORIES
    .filter(cat => categories[cat] < FAILING_THRESHOLD)
    .map(cat => ({ category: cat, score: categories[cat], threshold: FAILING_THRESHOLD }));
  const improvementRecommendations = failedCriteria.map(f => ({ category: f.category, recommendation: IMPROVEMENT_RECOMMENDATIONS[f.category] }));

  const trend = context.history ? summarizeTrend(context.history, { overall_score: overallScore, categories }) : { has_history: false, overall_trend: 'insufficient_history', category_trends: {} };

  return {
    gate_version: PUBLICATION_QUALITY_GATE_VERSION,
    overall_score: overallScore,
    categories,
    persona_scores: personaScores,
    maturity_level: maturityLevelFor(overallScore),
    failed_criteria: failedCriteria,
    improvement_recommendations: improvementRecommendations,
    benchmark_characteristics: benchmark,
    publication_dna: dna,
    trend,
    // International Publication Readiness is explicitly a proxy (a codified
    // characteristics checklist), not true editorial judgment against real
    // McKinsey/World Bank/etc. documents — stated here, not just in code
    // comments, so every consumer of this object sees the caveat.
    note: 'international_publication_readiness and all category scores are deterministic proxies computed from real, measurable signals in this publication — not a simulated human editorial review.',
  };
}

// Enforcement check, kept separate from scoring so callers (the render
// engine) can decide what to do with a block without this module knowing
// anything about HTTP/render internals. Never silently fails: always
// returns a complete structure explaining the decision.
export function evaluateGateEnforcement(assessment, { enforced = false, threshold = 70 } = {}) {
  const passed = assessment.overall_score >= threshold;
  return {
    enforced,
    threshold,
    overall_score: assessment.overall_score,
    passed,
    blocked: enforced && !passed,
    reason: passed
      ? null
      : `Overall PX score ${assessment.overall_score} is below the configured threshold ${threshold}.`,
  };
}
