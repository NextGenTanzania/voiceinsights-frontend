// Publication Memory — Publication Experience (PX) Release 4, permanent
// architectural layer 5 of 6 (see the PX Release 4 plan).
//
// Deliberately scoped narrow this release: a pure, in-memory analytics
// shell over a sequence of PAST PX assessments, if a caller supplies one.
// No persistent storage here — no D1 table, no migration, no KV. Two
// reasons: (1) this engagement has been consistently conservative about
// touching D1/migrations, and adding real persistence is a separate,
// higher-risk decision deserving its own explicit authorization, not
// something to bundle into a code-only pass; (2) true adaptive learning
// that changes future rendering based on accumulated history would
// conflict with "deterministic rendering" (same input must always produce
// the same output) unless kept strictly advisory. This module is exactly
// that: advisory trend analytics only. It never feeds back into
// composition decisions on its own, and callers must not treat trend
// output as anything more than a descriptive signal.
export const PUBLICATION_MEMORY_VERSION = 'publication-memory-v1';

function classifyDelta(delta) {
  if (delta > 2) return 'improving';
  if (delta < -2) return 'declining';
  return 'stable';
}

// `history` is an array of past assessments, oldest first, each shaped
// like { overall_score, categories: { [name]: score, ... } } — the same
// shape computePXAssessment (publication-quality-gate.js) produces.
// `newAssessment` is the current one. Returns per-category and overall
// trend classifications plus the raw deltas they're based on. Purely
// descriptive — does not alter newAssessment and is never required for a
// render to succeed.
export function summarizeTrend(history = [], newAssessment = null) {
  if (!newAssessment || !history.length) {
    return { has_history: false, overall_trend: 'insufficient_history', category_trends: {}, sample_size: history.length };
  }
  const previous = history[history.length - 1];
  const overallDelta = Math.round(((newAssessment.overall_score ?? 0) - (previous.overall_score ?? 0)) * 10) / 10;
  const categoryTrends = {};
  const categoryNames = new Set([...Object.keys(newAssessment.categories || {}), ...Object.keys(previous.categories || {})]);
  for (const name of categoryNames) {
    const prevScore = previous.categories?.[name];
    const newScore = newAssessment.categories?.[name];
    if (prevScore == null || newScore == null) continue;
    const delta = Math.round((newScore - prevScore) * 10) / 10;
    categoryTrends[name] = { delta, trend: classifyDelta(delta) };
  }
  return {
    has_history: true,
    sample_size: history.length,
    overall_delta: overallDelta,
    overall_trend: classifyDelta(overallDelta),
    category_trends: categoryTrends,
  };
}

// Appends an assessment to an in-memory history array, capping its length
// so a long-running caller doesn't grow it unbounded. Pure — returns a new
// array, does not mutate the input. This is the closest thing to
// "recording" this module does; whether/how that record is ever persisted
// beyond the calling process's own memory is explicitly out of scope here.
export function recordAssessment(history = [], assessment, maxHistory = 50) {
  if (!assessment) return history;
  const next = [...history, { overall_score: assessment.overall_score, categories: assessment.categories }];
  return next.length > maxHistory ? next.slice(next.length - maxHistory) : next;
}
