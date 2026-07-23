// Publication Director — Publication Experience (PX) Release 4, permanent
// architectural layer 2 of 6 (see the PX Release 4 plan).
//
// A deterministic layout/composition policy engine, generalizing the one
// real precedent for this in the codebase — decisionCardColumnSpans in
// publication-spread-composer.js — into a reusable module any card grid
// (decisions, risks, opportunities, chart panels) can call. This is a rules
// engine over measurable structure (item counts, word counts, component
// counts), not a subjective "does this look balanced" judgment — nothing
// here calls a generative model, and the same input always produces the
// same layout decision.
import { densityMaxWordsFor } from './editorial-intelligence-validator.js';

export const PUBLICATION_DIRECTOR_VERSION = 'publication-director-v1';

// Deterministic column-span policy for a card grid of `count` items, on a
// 12-column grid. Same rule decisionCardColumnSpans already established for
// decision cards (Release 2.1, Part 5), generalized so risk cards,
// opportunity cards, and chart panels share one column-span policy instead
// of each spread reinventing its own.
export function columnSpansFor(count) {
  if (count <= 1) return Array(count).fill(12);
  if (count === 2) return [6, 6];
  if (count === 3) return [12, 6, 6];
  if (count === 4) return [6, 6, 6, 6];
  if (count === 6) return [4, 4, 4, 4, 4, 4];
  // Any other count not covered by a named layout still gets a valid,
  // evenly-divided grid rather than throwing or leaving a gap.
  const perRow = count <= 8 ? 4 : 3;
  const span = 12 / perRow;
  return Array.from({ length: count }, () => span);
}

// Sanity-checks a set of column spans: every row must sum to exactly 12 (a
// valid CSS grid), and no card may be given a span narrow enough to look
// cramped (below 3 columns, a quarter of the row) — a structural rhythm
// check, not a stylistic opinion.
export function checkWhitespaceRhythm(spans = []) {
  const issues = [];
  let rowTotal = 0;
  for (const span of spans) {
    if (span < 3) issues.push({ rule: 'span_too_narrow', span });
    rowTotal += span;
    if (rowTotal === 12) rowTotal = 0;
    else if (rowTotal > 12) { issues.push({ rule: 'row_overflow', rowTotal }); rowTotal = 0; }
  }
  if (rowTotal !== 0) issues.push({ rule: 'row_incomplete', rowTotal });
  return { balanced: issues.length === 0, issues };
}

// Component-density assessment for one spread — reuses the same signals
// the composer and editorial validator already compute per spread
// (estimatedWords, componentCount) rather than re-deriving structural
// density from raw HTML a second time. Classifies a spread's real,
// already-measured richness into a plain density label so the Quality Gate
// and future composition decisions have one shared vocabulary for it.
const DENSITY_MIN_WORDS = 90;   // matches editorial-intelligence-validator's MIN_PAGE_FILL_WORDS
const DENSITY_MAX_WORDS = 420;  // matches editorial-intelligence-validator's MAX_SPREAD_WORDS

// EAD Release 1: signature unchanged for the first two (positional)
// parameters — every existing caller passing bare (estimatedWords,
// componentCount) numbers gets byte-identical behavior. The new 3rd
// parameter is additive: a caller that has the real rendered visibleWords
// (see publication-render-utils.js) and/or a per-spread-type max can now
// pass them, which is what publication-benchmark-engine.js's
// whitespace_within_bounds check does below — two independent reviews
// confirmed the old estimatedWords-only signal was disconnected from what
// a reader actually sees on several real pages.
export function assessComponentDensity(estimatedWords = 0, componentCount = 0, { visibleWords = null, maxWords = DENSITY_MAX_WORDS } = {}) {
  const trueWords = visibleWords ?? estimatedWords;
  const richness = trueWords + componentCount * 15;
  if (richness < DENSITY_MIN_WORDS) return { density: 'underfilled', richness };
  if (trueWords > maxWords) return { density: 'overfilled', richness };
  return { density: 'balanced', richness };
}

// EAD Release 1: the real-content-aware entry point — prefers
// spread.visibleWords and a per-spread-type ceiling (densityMaxWordsFor)
// over the bare positional call above, so callers that already have a full
// spread object (not just two numbers) get the corrected signal without
// needing to know the override table themselves.
export function assessSpreadDensity(spread) {
  return assessComponentDensity(spread?.estimatedWords, spread?.componentCount, {
    visibleWords: spread?.visibleWords,
    maxWords: densityMaxWordsFor(spread?.id),
  });
}

// Top-level per-spread review: column-span validity (if the spread has a
// card grid), whitespace rhythm, and density — one deterministic verdict a
// caller (Quality Gate, future composer logic) can act on.
export function reviewSpreadComposition(spread, cardCount = null) {
  const density = assessSpreadDensity(spread);
  const spans = cardCount != null ? columnSpansFor(cardCount) : null;
  const rhythm = spans ? checkWhitespaceRhythm(spans) : { balanced: true, issues: [] };
  return { spread_id: spread?.id || null, density: density.density, richness: density.richness, spans, rhythm };
}
