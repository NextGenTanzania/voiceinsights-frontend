// Editorial Brain — PX Release 8, Part 1.
//
// A deterministic PLANNING layer that runs BEFORE any finding or
// recommendation sentence is generated. It does not write prose — every
// exported function here returns a decision (a rank, a tier, a weight, a
// pass/fail), never a sentence. The sentences it informs still live where
// they always have: flagship-sample-library.js's frame pools. This module
// answers "what should this report argue, and to whom" before
// flagship-sample-library.js answers "how should that be phrased."
//
// Same governing rules as every other file in this family: pure functions,
// no Math.random, no I/O, no LLM call, no fabricated data. Every decision
// traces to a real field already on the governed model (evidence
// statistics, regional scores, a sample's real profile) — this module
// never invents a number or a claim, it only decides which real number or
// claim deserves priority, and how a named audience should weigh it.
//
// Zero-dependency leaf, like flagship-grammar-utils.js and
// flagship-personality-lexicon.js — consumed by flagship-sample-library.js
// and flagship-editorial-engine.js, imports from neither, so no circular
// dependency is possible.
export const FLAGSHIP_EDITORIAL_BRAIN_VERSION = 'flagship-editorial-brain-v1';

// ------------------------------------------------------------------
// Part 1: severity ranking — "which finding deserves page one" decided
// BEFORE any finding text exists, from evidence[].statistic.value (the
// real, per-record numeric signal already used throughout this
// publication family — confirmed to carry genuine 54-86 spread, unlike
// confidence_score, which was already audited and rejected for this role
// in flagship-editorial-engine.js: it clusters 89.5-96.5 across the whole
// 16-sample library and cannot differentiate anything).
//
// Previously, priority tier (CRITICAL/HIGH/MEDIUM) was assigned purely by
// a subject's position in the blueprint's declared array — subjects 0-1
// were always CRITICAL regardless of what the evidence actually showed,
// confirmed identical across all 16 samples. Ranking by real evidence
// values instead means the finding the evidence actually says is worst
// off is the one that gets treated as most urgent — reasoning before
// writing, not writing then labeling.
// ------------------------------------------------------------------
const PRIORITY_TIER_BY_RANK = Object.freeze(['CRITICAL', 'CRITICAL', 'HIGH', 'HIGH', 'MEDIUM']);
const TIMELINE_BY_RANK = Object.freeze(['0–90 days', '3–12 months', '3–12 months', '3–12 months', '6–18 months']);

function severityScoreForIndex(evidence, i) {
  const linked = [evidence[i % evidence.length], evidence[(i + 3) % evidence.length]];
  const values = linked.map(e => e?.statistic?.value).filter(Number.isFinite);
  if (!values.length) return 100; // never observed in practice; worst-case (lowest priority), never fabricated
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// `subjectCount` is always 5 in the real blueprint library (confirmed:
// every one of the 16 BLUEPRINTS entries carries exactly 5 subjects/
// actions), so PRIORITY_TIER_BY_RANK/TIMELINE_BY_RANK matching that length
// is not a coincidence to work around — it is the real, existing shape
// this replaces reasoning about, not a new constraint being imposed.
export function planEditorialStrategy({ evidence = [], subjectCount = 5 }) {
  const ranked = Array.from({ length: subjectCount }, (_, i) => i)
    .map(i => ({ i, score: severityScoreForIndex(evidence, i) }))
    // Ties broken by original index — keeps the ranking fully
    // deterministic even on a hypothetical tie, never by insertion order
    // of object keys or any other non-reproducible mechanism.
    .sort((a, b) => a.score - b.score || a.i - b.i);
  const rankOfIndex = new Array(subjectCount);
  ranked.forEach((entry, rank) => { rankOfIndex[entry.i] = rank; });
  const clampedRank = i => Math.min(rankOfIndex[i], PRIORITY_TIER_BY_RANK.length - 1);
  return {
    rankOfIndex,
    heroIndex: ranked[0].i,
    priorityTierForIndex: i => PRIORITY_TIER_BY_RANK[clampedRank(i)],
    timelineForIndex: i => TIMELINE_BY_RANK[clampedRank(i)],
  };
}

// ------------------------------------------------------------------
// Part 2: audience thinking profiles — real, named, distinct weights per
// the 10 real sample.profile values (government, donor, humanitarian,
// board, corporate, ngo, research, interactive, evidence, un). This is
// editorial POLICY encoded as an inspectable, testable table — the same
// kind of judgment call flagship-personality-lexicon.js already makes for
// address terms — not a fabricated data field on any report.
//
// urgencyBias shifts how urgently the SAME real regional-score evidence
// reads for this audience (consumed by flagship-editorial-engine.js's
// planReportEditorialProfile, which previously accepted an `audience`
// parameter but never actually used it — audience existed as a label,
// not a decision). feasibilityWeight/financialRealismWeight/
// evidenceRigorWeight are exposed for callers that need to decide which
// of two equally-true real facts an audience would weigh first (e.g. a
// donor audience's financial realism vs. a humanitarian audience's
// urgency) — Part 2 of the PX Release 8 brief asks for different
// thinking, not different wording; these weights are the "different
// thinking" a caller can act on without inventing new sentence pools.
// ------------------------------------------------------------------
export const AUDIENCE_THINKING_PROFILES = Object.freeze({
  government: { urgencyBias: 4, feasibilityWeight: 0.9, financialRealismWeight: 0.5, evidenceRigorWeight: 0.6 },
  donor: { urgencyBias: 2, feasibilityWeight: 0.5, financialRealismWeight: 0.9, evidenceRigorWeight: 0.8 },
  humanitarian: { urgencyBias: 8, feasibilityWeight: 0.6, financialRealismWeight: 0.5, evidenceRigorWeight: 0.5 },
  board: { urgencyBias: 0, feasibilityWeight: 0.6, financialRealismWeight: 0.9, evidenceRigorWeight: 0.6 },
  corporate: { urgencyBias: 0, feasibilityWeight: 0.6, financialRealismWeight: 0.8, evidenceRigorWeight: 0.6 },
  ngo: { urgencyBias: 3, feasibilityWeight: 0.6, financialRealismWeight: 0.6, evidenceRigorWeight: 0.6 },
  research: { urgencyBias: -6, feasibilityWeight: 0.4, financialRealismWeight: 0.4, evidenceRigorWeight: 1.0 },
  interactive: { urgencyBias: -2, feasibilityWeight: 0.5, financialRealismWeight: 0.5, evidenceRigorWeight: 0.8 },
  evidence: { urgencyBias: -6, feasibilityWeight: 0.4, financialRealismWeight: 0.4, evidenceRigorWeight: 1.0 },
  un: { urgencyBias: 3, feasibilityWeight: 0.7, financialRealismWeight: 0.6, evidenceRigorWeight: 0.7 },
});
const DEFAULT_AUDIENCE_PROFILE = Object.freeze({ urgencyBias: 0, feasibilityWeight: 0.6, financialRealismWeight: 0.6, evidenceRigorWeight: 0.6 });

export function audienceThinkingProfile(profile) {
  return AUDIENCE_THINKING_PROFILES[profile] || DEFAULT_AUDIENCE_PROFILE;
}

// ------------------------------------------------------------------
// Part 4: narrative role mapping — declares which of the 8 dramatic roles
// the PX Release 8 brief names (Opening thesis / Central argument /
// Evidence progression / Counterpoint / Decision tension / Strategic
// turning point / Resolution / Executive conclusion) each of the 12 real
// spine spreads (flagship-narrative-arc.js) actually serves. This does
// NOT reorder the spine — the physical spread sequence is untouched, per
// this release's explicit "do not redesign architecture" constraint — it
// names the dramatic function of an order that already exists, so a
// caller (or a future test) can reason about "does the book have a
// counterpoint" without re-deriving it from spread IDs each time.
// ------------------------------------------------------------------
export const NARRATIVE_ROLE_BY_SPREAD_ID = Object.freeze({
  'national-context': 'Opening thesis',
  'root-cause': 'Central argument',
  'evidence-story': 'Evidence progression',
  'regional-equity': 'Evidence progression',
  'hero-insight': 'Central argument',
  'scenarios': 'Counterpoint',
  'priority-matrix': 'Decision tension',
  'decisions-a': 'Strategic turning point',
  'decisions-b': 'Strategic turning point',
  'roadmap': 'Resolution',
  'risks': 'Counterpoint',
  'monitoring': 'Resolution',
  'closing': 'Executive conclusion',
});
export const NARRATIVE_ROLES = Object.freeze([
  'Opening thesis', 'Central argument', 'Evidence progression', 'Counterpoint',
  'Decision tension', 'Strategic turning point', 'Resolution', 'Executive conclusion',
]);

// ------------------------------------------------------------------
// Part 5: eight-editor consensus — deterministic, rule-based stand-ins
// for "Policy Editor", "Research Editor", "Economist", "Statistician",
// "Government Advisor", "Executive Editor", "Communications Director"
// and "Cabinet Advisor". Each is a pure function reading only real,
// already-governed fields on the built report — none of them judge
// prose style with a model; each checks one concrete, auditable property
// a real editor in that role would actually check. This is the same
// "compute and disclose" pattern publication-quality-gate.js already
// uses — consensus is exposed on the model for inspection; nothing here
// blocks generation (enforcement, if wanted, is a caller's decision).
// ------------------------------------------------------------------
export const EDITORIAL_CONSENSUS_EDITORS = Object.freeze([
  {
    editor: 'Policy Editor',
    check: report => {
      const linked = (report.recommendations || []).every(r => Array.isArray(r.evidence_used) && r.evidence_used.length > 0);
      return { pass: linked, reason: linked ? 'Every recommendation traces to real evidence.' : 'A recommendation has no linked evidence.' };
    },
  },
  {
    editor: 'Research Editor',
    check: report => {
      const linked = (report.findings || []).every(f => Array.isArray(f.evidence_ids) && f.evidence_ids.length > 0);
      return { pass: linked, reason: linked ? 'Every finding traces to real evidence.' : 'A finding has no linked evidence.' };
    },
  },
  {
    editor: 'Economist',
    check: report => {
      const priced = (report.recommendations || []).every(r => Boolean(r.budget_requirement) && Boolean(r.timeline));
      return { pass: priced, reason: priced ? 'Every recommendation carries a real budget band and timeline.' : 'A recommendation is missing a budget band or timeline.' };
    },
  },
  {
    editor: 'Statistician',
    check: report => {
      const disclosed = Boolean(report.statistical_intelligence?.confidence_intervals) && Boolean(report.statistical_intelligence?.design_effect);
      return { pass: disclosed, reason: disclosed ? 'Confidence intervals and design effect are disclosed.' : 'Confidence intervals or design effect are not disclosed.' };
    },
  },
  {
    editor: 'Government Advisor',
    check: report => {
      const owned = (report.recommendations || []).every(r => Boolean(r.owner));
      return { pass: owned, reason: owned ? 'Every recommendation has a named accountable owner.' : 'A recommendation has no named owner.' };
    },
  },
  {
    editor: 'Executive Editor',
    check: report => {
      const brief = report.executive_book?.executive_brief || '';
      const words = brief.trim().split(/\s+/).filter(Boolean).length;
      const pass = words > 0 && words <= 60;
      return { pass, reason: pass ? 'Executive brief thesis is a single scannable statement.' : `Executive brief thesis is ${words} words — too long to scan in the 15-second executive read.` };
    },
  },
  {
    editor: 'Communications Director',
    check: report => {
      // The exact class of defect found and closed in the PX Release 6.5
      // review: a recommendation sentence that pads a generic verb phrase
      // with a redundant trailing "for {sector}" clause.
      const sector = String(report.sector || '');
      const padded = sector && (report.recommendations || []).some(r => new RegExp(`for ${sector.toLowerCase()}\\.?$`, 'i').test(r.recommendation || ''));
      return { pass: !padded, reason: !padded ? 'No recommendation carries a redundant trailing sector clause.' : 'A recommendation still repeats the sector name as a trailing clause.' };
    },
  },
  {
    editor: 'Cabinet Advisor',
    check: report => {
      const critical = (report.recommendations || []).find(r => String(r.priority || r.strategic_priority).toUpperCase() === 'CRITICAL');
      const pass = Boolean(critical?.timeline) && Boolean(critical?.owner);
      return { pass, reason: pass ? 'The highest-priority decision has a named owner and a due window a Cabinet paper can cite.' : 'The highest-priority decision is missing an owner or a due window.' };
    },
  },
]);

export function runEditorialConsensus(report) {
  const editors = EDITORIAL_CONSENSUS_EDITORS.map(({ editor, check }) => {
    const { pass, reason } = check(report || {});
    return { editor, pass, reason };
  });
  return { consensus: editors.every(e => e.pass), editors };
}

// ------------------------------------------------------------------
// Part 8 (anti-AI detection, catalog-wide): the exact class of defect
// this review's own PX Release 6.5/7 passes found by hand — a
// report-level field byte-identical (or near-identical after normalizing
// the sector name) across multiple samples in the 16-report catalog.
// `fields` maps a human label to an accessor function so this stays
// data-model-agnostic; callers decide which fields to check. Returns one
// entry per checked field naming exactly which sample keys collide, so a
// caller can act on specifics rather than a single pass/fail bit.
// ------------------------------------------------------------------
export function checkCatalogConsistency(builtReports, fields) {
  return Object.entries(fields).map(([label, accessor]) => {
    const bySample = builtReports.map(({ key, model }) => ({ key, value: accessor(model) }));
    const groups = new Map();
    for (const { key, value } of bySample) {
      const norm = JSON.stringify(value);
      if (!groups.has(norm)) groups.set(norm, []);
      groups.get(norm).push(key);
    }
    const collisions = [...groups.values()].filter(keys => keys.length > 1);
    return {
      field: label,
      distinctCount: groups.size,
      sampleCount: bySample.length,
      collisions,
      consistent: collisions.length === 0,
    };
  });
}
