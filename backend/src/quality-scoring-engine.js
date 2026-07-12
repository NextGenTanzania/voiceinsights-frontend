// ============================================================
// REPORT QUALITY SCORING (Phase 9, Task 9.7)
// ------------------------------------------------------------
// Deliberately NOT an AI call — every dimension here is a real, computable
// number from the document model itself (completeness of fields, response
// rate, sample size, whether narrative/charts/recommendations sections
// are actually populated, whether standards are declared). A quality
// score has to be trustworthy and reproducible, so it is pure arithmetic,
// not a Claude opinion that could vary between requests.
// ============================================================

export function scoreReportQuality(documentModel) {
  const scores = {};

  // Data completeness: how many of the core data sections have any content at all.
  const coreSections = [
    documentModel.demographics?.gender?.length > 0,
    documentModel.demographics?.age?.length > 0,
    documentModel.demographics?.regions?.length > 0,
    documentModel.findings?.sentiment?.length > 0,
    documentModel.findings?.topics?.length > 0,
  ];
  scores.data_completeness = Math.round((coreSections.filter(Boolean).length / coreSections.length) * 100);

  // Response rate itself, capped at 100 (a rate above target doesn't over-score).
  scores.response_rate = documentModel.kpis?.response_rate_pct != null ? Math.min(100, documentModel.kpis.response_rate_pct) : 0;

  // Sample quality: a simple, transparent banding by absolute response count
  // (a report with 5 responses cannot claim the same statistical confidence
  // as one with 500, regardless of what any AI narrative says about it).
  const n = documentModel.kpis?.total_responses || 0;
  scores.sample_quality = n >= 384 ? 100 : n >= 200 ? 80 : n >= 100 ? 60 : n >= 30 ? 40 : n > 0 ? 20 : 0;

  // Narrative coverage: how many of the expected narrative fields were
  // actually written (vs. still null because AI writing hasn't run yet).
  const narrative = documentModel.narrative;
  const narrativeFields = ['executive_summary', 'key_findings', 'discussion', 'conclusions', 'risks', 'opportunities', 'lessons_learned'];
  const narrativeFilled = narrative ? narrativeFields.filter(f => {
    const v = narrative[f];
    return Array.isArray(v) ? v.length > 0 : !!v && !String(v).startsWith('Not enough data');
  }).length : 0;
  scores.narrative_coverage = Math.round((narrativeFilled / narrativeFields.length) * 100);

  // Chart coverage: how many chart specs were actually generated (Task 8.5).
  scores.chart_coverage = documentModel.charts?.length ? Math.min(100, documentModel.charts.length * 20) : 0;

  // Recommendation quality: presence AND non-triviality (has real content
  // across the three tiers, not just an empty shell).
  const recs = documentModel.recommendations;
  const recCount = recs ? (recs.immediate?.length || 0) + (recs.medium_term?.length || 0) + (recs.long_term?.length || 0) : 0;
  scores.recommendation_quality = recCount >= 6 ? 100 : recCount >= 3 ? 70 : recCount >= 1 ? 40 : 0;

  // Standards compliance: whether this report declares alignment to any
  // recognized framework (SDG/OECD-DAC/CHS/Sphere/RBM/etc, Task 8.1).
  scores.standards_compliance = documentModel.metadata?.standards?.length ? 100 : 0;

  // AI confidence: reuses the data-quality signal already computed by the
  // Fraud Engine (Task 8.2) — a report full of fraud-flagged responses is
  // less trustworthy regardless of how confident the narrative sounds.
  const flaggedRatio = n > 0 ? (documentModel.data_quality?.flagged_response_count || 0) / n : 0;
  scores.ai_confidence = Math.round((1 - Math.min(1, flaggedRatio * 2)) * 100);

  // Overall — simple unweighted average across all dimensions. Kept
  // deliberately simple and transparent rather than a hidden weighting
  // scheme, so the number is explainable to a client who asks "why 74?".
  const values = Object.values(scores);
  const overall = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

  return { ...scores, overall_quality_score: overall };
}
