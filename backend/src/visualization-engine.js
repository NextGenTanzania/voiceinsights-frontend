// ============================================================
// VISUALIZATION RULES ENGINE (Phase 8, Task 8.5)
// ------------------------------------------------------------
// Chooses the RIGHT chart type by inspecting the actual DATA SHAPE handed
// to it — never a hardcoded "this report type always gets a bar chart"
// lookup. A report_templates row's chart_defaults_json is treated as an
// optional HINT (author intent), but the engine can override it when the
// real data clearly calls for something else (e.g., a "trend" hint with
// only 2 categories still renders as a line, but a "demographics" hint
// with 12 age brackets renders as a bar, not a donut, because a donut
// with 12 slices is unreadable — matching real design practice).
//
// Pure functions — no I/O, no D1 — fully unit-testable in isolation.
// ============================================================

const CHART_TYPES = {
  KPI_CARD: 'kpi_card',
  BAR: 'bar',
  LINE: 'line',
  DONUT: 'donut',
  PIE: 'pie',
  MAP: 'map',
  RADAR: 'radar',
};

// Is this array shaped like time-series data (ordered by date/period)?
function looksLikeTimeSeries(data) {
  if (!Array.isArray(data) || data.length < 2) return false;
  const sample = data[0];
  return !!(sample && (sample.date || sample.period || sample.day || sample.round));
}

// Is this array shaped like geographic data (has explicit lat/lng, the
// strongest possible signal)? NOTE: region-name category data (the common
// case here) is structurally IDENTICAL to any other categorical breakdown
// ({label, n}) — there is no field-name way to distinguish "this label is
// a region" from "this label is a gender" by shape alone. That distinction
// necessarily comes from the caller's hint (see selectChartType below),
// which is why the map-selection rule treats the hint as sufficient on its
// own, using this function only to detect the STRONGER lat/lng signal when present.
function looksLikeGeographic(data) {
  if (!Array.isArray(data) || !data.length) return false;
  const sample = data[0];
  return !!(sample && (sample.lat != null || sample.lng != null));
}

// Core rule function — given a data array and a semantic hint about what
// it represents, returns the chart type that best fits its actual shape.
export function selectChartType(data, hint = '') {
  if (!Array.isArray(data)) return CHART_TYPES.KPI_CARD; // a single scalar value — always a KPI card, never a chart

  const categoryCount = data.length;
  const hintLower = (hint || '').toLowerCase();

  // Geographic data always wants a map when the caller's hint says so
  // (explicit lat/lng data always qualifies too, regardless of hint) — a
  // bar chart of regions loses the spatial information a map conveys.
  if (looksLikeGeographic(data) || hintLower.includes('regional') || hintLower.includes('map') || hintLower.includes('geographic')) {
    return CHART_TYPES.MAP;
  }

  // Time-ordered data (trend/panel/baseline-midline-endline comparisons)
  // always wants a line chart — a bar chart of ordered time periods implies
  // the periods are unrelated categories, which misrepresents a trend.
  if (looksLikeTimeSeries(data) || hintLower.includes('trend')) {
    return CHART_TYPES.LINE;
  }

  // Parts-of-a-whole data (percentages that sum to ~100%, e.g. gender,
  // sentiment) reads best as a donut IF there are few enough categories to
  // stay legible — otherwise it collapses into unreadable slivers, so the
  // engine falls back to a bar chart for anything with more than 5 categories,
  // regardless of what the report-type hint originally suggested.
  const isPartsOfWhole = hintLower.includes('demographic') || hintLower.includes('sentiment') || hintLower.includes('gender') || hintLower.includes('satisfaction');
  if (isPartsOfWhole) {
    return categoryCount <= 5 ? CHART_TYPES.DONUT : CHART_TYPES.BAR;
  }

  // Channel comparison, age brackets, region volume, and anything else
  // categorical-but-not-parts-of-a-whole defaults to a bar chart — the
  // safest, most legible default for comparing discrete categories,
  // matching standard data-visualization practice (never default to pie
  // for anything with more than a handful of categories).
  if (hintLower.includes('channel') || hintLower.includes('age') || categoryCount > 5) {
    return CHART_TYPES.BAR;
  }

  // A genuinely small (2-3), non-time, non-parts-of-whole categorical set
  // (e.g. yes/no/unsure) can still read fine as a donut.
  if (categoryCount >= 2 && categoryCount <= 3) return CHART_TYPES.DONUT;

  return CHART_TYPES.BAR; // safe universal fallback
}

// Builds the final chart specification list for a document model — takes
// the REAL data already assembled by the Report Generator (Task 8.2) and
// runs each relevant dataset through selectChartType(), rather than the
// static per-template lookup previously used.
export function buildChartSpecs({ demographics, findings, dataQuality }) {
  const specs = [];

  if (demographics?.gender?.length) {
    specs.push({ section: 'demographics_gender', chart_type: selectChartType(demographics.gender, 'demographic gender'), data: demographics.gender });
  }
  if (demographics?.age?.length) {
    specs.push({ section: 'demographics_age', chart_type: selectChartType(demographics.age, 'demographic age'), data: demographics.age });
  }
  if (demographics?.regions?.length) {
    specs.push({ section: 'geographic_coverage', chart_type: selectChartType(demographics.regions, 'regional map'), data: demographics.regions });
  }
  if (findings?.sentiment?.length) {
    specs.push({ section: 'sentiment_analysis', chart_type: selectChartType(findings.sentiment, 'sentiment'), data: findings.sentiment });
  }
  if (findings?.topics?.length) {
    specs.push({ section: 'emerging_themes', chart_type: selectChartType(findings.topics, 'topics'), data: findings.topics });
  }
  if (dataQuality) {
    specs.push({ section: 'data_quality_score', chart_type: 'kpi_card', data: dataQuality });
  }

  return specs;
}
