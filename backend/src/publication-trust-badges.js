// Public Trust Badges — Enterprise Market Validation Release, Part A.
//
// The platform's internal 0-100 Quality Gate score (flagship-publication-
// quality-gate.js) must never appear on a public surface — only a pass/fail
// verification badge, backed by a real, already-computed signal. This module
// composes exactly that: no new scoring, no new judgment calls, just a
// pass/fail readout over signals that already exist. Detailed numeric scores
// remain internal-only (site/admin/quality-control.html).
//
// Originally a deliberate 6 badges, not more: every one maps to a real,
// independently computed check. A badge with no real backing signal would
// be exactly the kind of fabricated claim this platform's own
// non-negotiable rules forbid.
//
// Editorial Division Release (Editorial Constitution Article II): grown to
// mirror the full 9-review governance set (publication-governance-gate.js)
// by name — additively, never by removing or renaming an existing badge,
// so every established caller (buildIntegritySpread, the PPTX deck, the
// catalog, the public API strip) keeps working unchanged. The 4 new
// reviews (Statistical, Decision Intelligence, Executive Readability,
// International Standards) only appear when a caller actually supplies the
// real underlying signal — never defaulted to a pass, matching the
// existing runtimeValidationPassed convention below.
export const PUBLICATION_TRUST_BADGES_VERSION = 'publication-trust-badges-v2';

export function computeTrustBadges({
  editorialConsensus, assurance, runtimeValidationPassed,
  statisticalIntegrityPassed, knowledgeValidation, executiveQuestionsAnswered, internationalStandardsSatisfied,
} = {}) {
  const components = assurance?.components || {};
  const badges = [
    { id: 'editorial_review', label: 'Editorial Review Passed', satisfied: !!editorialConsensus?.consensus },
    { id: 'evidence_review', label: 'Evidence Review Passed', satisfied: (components.evidence_traceability ?? 0) >= 90 },
    { id: 'publication_integrity', label: 'Publication Integrity Verified', satisfied: components.contradiction_free === 100 },
    { id: 'accessibility', label: 'Accessibility Verified', satisfied: (components.accessibility ?? 0) >= 90 },
    { id: 'export_validation', label: 'Export Validation Passed', satisfied: components.export_consistency === 100 },
  ];
  // Runtime validation (editorial_validation.passed) is only known after
  // publication-runtime.js runs validatePublication() over the ALREADY-BUILT
  // spreads — this module's caller inside the spread composer runs before
  // that exists, so it correctly gets only the first 5. Callers downstream
  // of runtime composition (the public API route, the PPTX dashboard block)
  // pass runtimeValidationPassed explicitly to get the full 6.
  if (runtimeValidationPassed !== undefined) {
    badges.push({ id: 'runtime_validation', label: 'Runtime Validation Passed', satisfied: !!runtimeValidationPassed });
  }
  if (statisticalIntegrityPassed === undefined && components.statistical_integrity !== undefined) {
    statisticalIntegrityPassed = components.statistical_integrity >= 90;
  }
  if (statisticalIntegrityPassed !== undefined) {
    badges.push({ id: 'statistical_review', label: 'Statistical Review Passed', satisfied: !!statisticalIntegrityPassed });
  }
  if (knowledgeValidation !== undefined) {
    badges.push({ id: 'decision_intelligence_review', label: 'Decision Intelligence Review Passed', satisfied: !!knowledgeValidation?.valid });
  }
  if (executiveQuestionsAnswered !== undefined) {
    badges.push({ id: 'executive_readability_review', label: 'Executive Readability Review Passed', satisfied: !!executiveQuestionsAnswered });
  }
  if (internationalStandardsSatisfied !== undefined) {
    badges.push({ id: 'international_standards_review', label: 'International Standards Review Passed', satisfied: !!internationalStandardsSatisfied });
  }
  return badges;
}

// The flagship model accumulates the same raw Quality Gate number at
// several paths (sample.quality_score, report.quality_scores,
// report.publication_assurance, full_publication.overall_score,
// full_publication.quality_gate.score, platinum.report_intelligence_score,
// core.report/core.quality, and top-level quality_gate/publication_assurance)
// — an artifact of the model being built up across many prior sessions, not
// a deliberate public contract. buildFlagshipSampleReport() itself stays
// untouched (internal callers still need the real numbers); this strips
// every one of those paths only at the public API response boundary and
// attaches the same trust badges every other public surface now shows.
export function stripInternalScoresForPublicResponse(model) {
  if (!model) return model;
  const { quality_score, evidence_score, decision_intelligence_score, ...sampleRest } = model.sample || {};
  const { quality_scores, publication_assurance: reportAssurance, ...reportRest } = model.report || {};
  const { overall_score, quality_gate: fullPubQualityGate, ...fullPublicationRest } = model.full_publication || {};
  const { report_intelligence_score, ...platinumRest } = model.platinum || {};
  const { quality_gate, publication_assurance, core, sample, report, full_publication, platinum, ...modelRest } = model;
  return {
    ...modelRest,
    sample: sampleRest,
    report: reportRest,
    full_publication: fullPublicationRest,
    platinum: platinumRest,
    trust_badges: computeTrustBadges({ editorialConsensus: model.report?.editorial_consensus, assurance: model.publication_assurance }),
  };
}
