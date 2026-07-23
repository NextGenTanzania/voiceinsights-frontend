import { newId } from './auth.js';
import { sha256Hex } from './enterprise-identity-access.js';

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

// ============================================================
// CANONICAL PUBLICATION DECISION ENGINE
// ------------------------------------------------------------
// This is the one authoritative publication decision for the platform.
// Specialized validators elsewhere in the codebase may assess narrow
// domains (methodology, statistics, presentation, SDGs, ...), but only
// this function may declare a report APPROVED, PUBLICATION_READY, or
// export_allowed=true. Wiring the five existing quality-related engines
// (flagship-report-engine.js, presentation-publishing.js, report-trust.js,
// flagship-publication-quality-gate.js, international-publication-quality-
// engine.js) into this gate as specialized validators, and updating the
// routes/UI that currently call them directly, is a separate, deliberately
// deferred follow-up — that touches live production routes and needs its
// own verification pass. This module is additive: scoreReportQuality above
// is untouched, so its existing caller (application.js) and the 563 tests
// covering it are unaffected.
//
// Design rule: no domain starts near-perfect. A domain score is
// earned_applicable_points / maximum_applicable_points, computed only over
// checks that are applicable to this report. A domain with nothing to
// evaluate is excluded from weighting (NOT_APPLICABLE), never defaulted to
// a full or zero score. Missing applicable evidence is a FAIL, never a
// neutral PASS.
// ============================================================

export const VALIDATOR_STATUS = Object.freeze({
  PASS: 'PASS', WARNING: 'WARNING', FAIL: 'FAIL', BLOCKED: 'BLOCKED', NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const PUBLICATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', APPROVED: 'APPROVED', PUBLICATION_READY: 'PUBLICATION_READY',
});

// Shared result schema every specialized validator should return (Part 1/2
// of the Canonical Publication Quality Gate spec).
export function makeValidatorResult({
  validator_id, validator_version = '1.0.0', domain, applicable = true, score = null,
  status, blocking_failures = [], warnings = [], passed_checks = [], evidence = [],
} = {}) {
  if (!validator_id) throw new Error('makeValidatorResult requires validator_id');
  if (!domain) throw new Error('makeValidatorResult requires domain');
  if (!status) throw new Error('makeValidatorResult requires status');
  return {
    validator_id, validator_version, domain, applicable, score, status,
    blocking_failures, warnings, passed_checks, evidence,
    evaluated_at: new Date().toISOString(),
  };
}

// 13 domains, weights sum to exactly 100 (verified by a test). Weights may
// vary by report type in a future pass; this is the default weighting.
export const PUBLICATION_DOMAIN_WEIGHTS = Object.freeze({
  data_readiness: 10,
  methodological_integrity: 10,
  statistical_integrity: 10,
  qualitative_integrity: 8,
  evidence_traceability: 12,
  claim_validity: 10,
  decision_usefulness: 8,
  ethical_safeguarding: 8,
  editorial_quality: 6,
  visualization_quality: 5,
  accessibility: 4,
  format_integrity: 5,
  approval_completeness: 4,
});

const arr2 = v => Array.isArray(v) ? v : [];
const obj2 = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};

// Normalizes an arbitrary report-like input into the flexible envelope the
// canonical gate scores against. Field names are deliberately neutral (not
// tied to any one existing engine's shape) so a future adapter can map any
// of the five existing engines' inputs into this envelope.
function normalizeForPublicationGate(input = {}) {
  return {
    dataset_version: input.dataset_version || null,
    organization_id: input.organization_id || null,
    project_id: input.project_id || null,
    requested_by_org_id: input.requested_by_org_id || input.organization_id || null,
    is_demo: Boolean(input.is_demo),
    report_type: input.report_type || 'standard',
    findings: arr2(input.findings),
    evidence: arr2(input.evidence),
    decisions: arr2(input.decisions || input.recommendations),
    methodology: input.methodology ? obj2(input.methodology) : null,
    statistics: arr2(input.statistics),
    claims: arr2(input.claims),
    quotes: arr2(input.quotes),
    safeguarding: obj2(input.safeguarding),
    confidentiality: obj2(input.confidentiality),
    approvals: { required: arr2(input.approvals?.required), completed: arr2(input.approvals?.completed) },
    exports: obj2(input.exports),
    accessibility: obj2(input.accessibility),
    sdgs: arr2(input.sdgs),
    editorial: obj2(input.editorial),
    visualizations: arr2(input.visualizations),
  };
}

const domainResult = (earned, max, blockers = [], warnings = [], passed = []) => ({ earned, max, applicable: max > 0, blockers, warnings, passed });

function scoreDataReadiness(r) {
  let earned = 0; const blockers = [], warnings = [], passed = [];
  if (r.dataset_version) { earned += 1; passed.push('dataset_version present'); } else blockers.push('NO_DATASET_VERSION');
  // A project/campaign scope is not mandatory — an organization-wide report
  // spanning every campaign (project_id: null) is a legitimate, supported
  // shape in report-generator.js's buildDocumentModel. Only organization
  // scope is actually required; a synthetic demo report is exempt entirely.
  if (r.is_demo || r.organization_id) { earned += 1; passed.push('organization scope present'); }
  else blockers.push('NO_ORGANIZATION_OR_PROJECT_SCOPE');
  const hasContent = r.findings.length > 0 || r.evidence.length > 0 || r.decisions.length > 0;
  if (hasContent) { earned += 1; passed.push('report has content'); }
  else if (r.report_type !== 'insufficient_evidence') blockers.push('EMPTY_DATASET_WITHOUT_INSUFFICIENT_EVIDENCE_LABEL');
  else warnings.push('report explicitly declares insufficient evidence');
  return domainResult(earned, 3, blockers, warnings, passed);
}

function scoreMethodologicalIntegrity(r) {
  if (!r.methodology && r.report_type !== 'research') return domainResult(0, 0);
  let earned = 0; const blockers = [], warnings = [], passed = [];
  if (r.methodology) { earned += 1; passed.push('methodology documented'); }
  else blockers.push('NO_METHODOLOGY_FOR_RESEARCH_REPORT');
  const limitations = r.methodology?.limitations;
  if (Array.isArray(limitations) ? limitations.length : Boolean(limitations)) { earned += 1; passed.push('limitations documented'); }
  else warnings.push('no limitations documented');
  return domainResult(earned, 2, blockers, warnings, passed);
}

function scoreStatisticalIntegrity(r) {
  if (!r.statistics.length) return domainResult(0, 0);
  let earned = 0; const blockers = [], warnings = [], passed = [];
  for (const s of r.statistics) {
    const isPercentage = s.unit === '%' || s.type === 'percentage';
    if (isPercentage && (s.denominator === undefined || s.denominator === null)) blockers.push(`NO_DENOMINATOR:${s.id || s.label || 'statistic'}`);
    else earned += 1;
    if (!(s.evidence_ids?.length) && !s.source) blockers.push(`UNSUPPORTED_STATISTIC:${s.id || s.label || 'statistic'}`);
    else earned += 1;
  }
  if (!blockers.length) passed.push('all statistics carry denominators and sources');
  return domainResult(earned, r.statistics.length * 2, blockers, warnings, passed);
}

function scoreQualitativeIntegrity(r) {
  if (!r.findings.length && !r.quotes.length) return domainResult(0, 0);
  let earned = 0; const warnings = [], passed = [];
  if (r.findings.length) { earned += 1; passed.push('qualitative findings present'); } else warnings.push('no qualitative findings');
  return domainResult(earned, 1, [], warnings, passed);
}

function scoreEvidenceTraceability(r) {
  if (!r.findings.length && !r.decisions.length) return domainResult(0, 0);
  const blockers = [], warnings = [], passed = [];
  if (!r.evidence.length) { blockers.push('NO_VERIFIED_EVIDENCE'); return domainResult(0, 2, blockers, warnings, passed); }
  let earned = 1; passed.push('evidence items present');
  const evidenceIds = new Set(r.evidence.map(e => e.id));
  const items = [...r.findings, ...r.decisions];
  const linked = items.filter(i => arr2(i.evidence_ids).some(id => evidenceIds.has(id)));
  if (items.length && linked.length === items.length) { earned += 1; passed.push('every finding/decision links to real evidence'); }
  else warnings.push('one or more findings/decisions are not linked to a real evidence item');
  return domainResult(earned, 2, blockers, warnings, passed);
}

function scoreClaimValidity(r) {
  if (!r.claims.length && !r.quotes.length) return domainResult(0, 0);
  let earned = 0, max = 0; const blockers = [], warnings = [], passed = [];
  for (const c of r.claims) {
    max += 1;
    if (c.causal && !arr2(c.evidence_ids).length) blockers.push('UNSUPPORTED_CAUSAL_CLAIM');
    else earned += 1;
  }
  for (const q of r.quotes) {
    max += 1;
    // A quote flagged synthetic must never pass as evidence-linked in a
    // real (non-demo) customer report, even if it happens to also carry a
    // source_id/evidence_id — same principle as scoreEvidenceTraceability's
    // is_demo/synthetic handling above, applied to quotes specifically.
    if (q.synthetic === true && !r.is_demo) { blockers.push('SYNTHETIC_QUOTE_IN_CUSTOMER_REPORT'); continue; }
    const hasSource = Boolean(q.source_id || q.evidence_id);
    if (!hasSource) { blockers.push('QUOTATION_WITHOUT_SOURCE'); continue; }
    // Defense in depth: a source_id/evidence_id existing is not sufficient
    // if it names a record from a different organization than this report —
    // that is not "unsourced", it is a worse problem (cross-tenant data
    // leakage into a report), so it gets its own distinct blocker rather
    // than being silently treated as evidence-linked.
    if (q.organization_id && r.organization_id && q.organization_id !== r.organization_id) {
      blockers.push('QUOTATION_CROSS_TENANT_SOURCE');
      continue;
    }
    earned += 1;
  }
  if (!blockers.length) passed.push('claims and quotations are evidence-linked');
  return domainResult(earned, max, blockers, warnings, passed);
}

function scoreDecisionUsefulness(r) {
  if (!r.decisions.length) return domainResult(0, 0);
  let earned = 0; const warnings = [], passed = [];
  const checks = [d => Boolean(d.owner), d => Boolean(d.timeline), d => arr2(d.evidence_ids).length > 0];
  const max = r.decisions.length * checks.length;
  for (const d of r.decisions) for (const check of checks) if (check(d)) earned += 1;
  if (earned === max) passed.push('every decision has an owner, timeline and linked evidence');
  else warnings.push('one or more decisions are missing an owner, timeline or linked evidence');
  return domainResult(earned, max, [], warnings, passed);
}

function scoreEthicalSafeguarding(r) {
  const hasContent = r.findings.length > 0 || r.quotes.length > 0 || r.evidence.length > 0;
  if (!hasContent) return domainResult(0, 0);
  let earned = 0; const blockers = [], passed = [];
  if (!arr2(r.safeguarding.unresolved_concerns).length) { earned += 1; passed.push('no unresolved safeguarding concerns'); }
  else blockers.push('UNRESOLVED_SAFEGUARDING_CONCERN');
  if (!arr2(r.confidentiality.violations).length) { earned += 1; passed.push('no unresolved confidentiality violations'); }
  else blockers.push('UNRESOLVED_CONFIDENTIALITY_VIOLATION');
  return domainResult(earned, 2, blockers, [], passed);
}

function scoreEditorialQuality(r) {
  const keys = ['prose_quality', 'grammar_reviewed', 'tone_reviewed'];
  const present = keys.filter(k => r.editorial[k]);
  if (!present.length) return domainResult(0, 0);
  return domainResult(present.length, keys.length, [], [], [`${present.length}/${keys.length} editorial checks confirmed`]);
}

function scoreVisualizationQuality(r) {
  if (!r.visualizations.length) return domainResult(0, 0);
  const linked = r.visualizations.filter(v => arr2(v.evidence_ids).length > 0);
  const warnings = linked.length < r.visualizations.length ? ['one or more visualizations are not linked to evidence'] : [];
  return domainResult(linked.length, r.visualizations.length, [], warnings, linked.length === r.visualizations.length ? ['every visualization links to evidence'] : []);
}

function scoreAccessibility(r) {
  const keys = ['alt_text_policy', 'reading_order', 'contrast_review', 'mobile_review'];
  const present = keys.filter(k => r.accessibility[k]);
  if (!Object.keys(r.accessibility).length) return domainResult(0, 0);
  return domainResult(present.length, keys.length, [], [], [`${present.length}/${keys.length} accessibility checks confirmed`]);
}

function scoreFormatIntegrity(r) {
  const formats = Object.keys(r.exports);
  if (!formats.length) return domainResult(0, 0);
  let earned = 0; const blockers = [], passed = [];
  for (const f of formats) { if (r.exports[f]?.valid !== false) earned += 1; else blockers.push(`FORMAT_INVALID:${f}`); }
  if (!blockers.length) passed.push('all declared exports are valid binaries');
  return domainResult(earned, formats.length, blockers, [], passed);
}

function scoreApprovalCompleteness(r) {
  if (!r.approvals.required.length) return domainResult(0, 0);
  const blockers = [], passed = [];
  const missing = r.approvals.required.filter(role => !r.approvals.completed.includes(role));
  missing.forEach(role => blockers.push(`MISSING_APPROVAL:${role}`));
  if (!missing.length) passed.push('all required approvals are completed');
  return domainResult(r.approvals.required.length - missing.length, r.approvals.required.length, blockers, [], passed);
}

const PUBLICATION_DOMAIN_SCORERS = {
  data_readiness: scoreDataReadiness,
  methodological_integrity: scoreMethodologicalIntegrity,
  statistical_integrity: scoreStatisticalIntegrity,
  qualitative_integrity: scoreQualitativeIntegrity,
  evidence_traceability: scoreEvidenceTraceability,
  claim_validity: scoreClaimValidity,
  decision_usefulness: scoreDecisionUsefulness,
  ethical_safeguarding: scoreEthicalSafeguarding,
  editorial_quality: scoreEditorialQuality,
  visualization_quality: scoreVisualizationQuality,
  accessibility: scoreAccessibility,
  format_integrity: scoreFormatIntegrity,
  approval_completeness: scoreApprovalCompleteness,
};

export const SCORE_STATE = Object.freeze({
  VALID: 'VALID', PROVISIONAL: 'PROVISIONAL', INVALIDATED: 'INVALIDATED', NOT_EVALUATED: 'NOT_EVALUATED',
});

// Blocking failures in this set don't just lower the score — they make the
// numeric score meaningless (a tampered or cross-tenant report cannot be
// "82% good"). These force score_state INVALIDATED and overall_score null.
const INVALIDATING_BLOCKERS = new Set([
  'CROSS_TENANT_REFERENCE', 'FABRICATED_EVIDENCE_PRESENTED_AS_REAL',
  // Quote Evidence Traceability release: same severity class as the two
  // above — a quote sourced from another organization, or a synthetic
  // quote dressed up as real evidence, is a security/integrity problem,
  // not a mere quality shortfall.
  'QUOTATION_CROSS_TENANT_SOURCE', 'SYNTHETIC_QUOTE_IN_CUSTOMER_REPORT',
]);

// Failures in these domains get an extra point penalty on top of the
// weighted average, so a report cannot dilute a real evidence/statistics
// failure by also being well-written or well-formatted elsewhere (Part 1.2).
// Format failures get a smaller penalty (Part 1.4: strong content should
// survive a single bad export, just not score near-perfect).
const MAJOR_PENALTY_PER_BLOCKER = 15;
const MAJOR_PENALTY_DOMAINS = new Set(['data_readiness', 'methodological_integrity', 'statistical_integrity', 'evidence_traceability', 'claim_validity']);
const MINOR_PENALTY_PER_BLOCKER = 10;
const MINOR_PENALTY_DOMAINS = new Set(['format_integrity']);

// The one authoritative publication decision. See Part 2/4/5/6 of the
// Canonical Publication Quality Gate spec for the schema, blocking-rule and
// threshold rules this implements.
export function evaluatePublicationGate(input = {}) {
  const r = normalizeForPublicationGate(input);
  const domainResults = {};
  let weightedEarnedSum = 0, applicableWeightSum = 0;
  const blockingFailures = [];
  const warnings = [];

  if (r.requested_by_org_id && r.organization_id && r.requested_by_org_id !== r.organization_id) {
    blockingFailures.push('CROSS_TENANT_REFERENCE');
  }
  if (!r.is_demo && r.evidence.some(e => e.synthetic === true)) {
    blockingFailures.push('FABRICATED_EVIDENCE_PRESENTED_AS_REAL');
  }

  let penalty = 0;
  for (const [domain, scorer] of Object.entries(PUBLICATION_DOMAIN_SCORERS)) {
    const result = scorer(r);
    const weight = PUBLICATION_DOMAIN_WEIGHTS[domain];
    const pct = result.applicable ? Math.round((result.earned / result.max) * 100) : null;
    domainResults[domain] = {
      score: pct, applicable: result.applicable, weight,
      blocking_failures: result.blockers, warnings: result.warnings, passed_checks: result.passed,
    };
    if (domain !== 'approval_completeness') blockingFailures.push(...result.blockers);
    warnings.push(...result.warnings);
    if (result.applicable) { weightedEarnedSum += pct * weight; applicableWeightSum += weight; }
    if (MAJOR_PENALTY_DOMAINS.has(domain)) penalty += result.blockers.length * MAJOR_PENALTY_PER_BLOCKER;
    if (MINOR_PENALTY_DOMAINS.has(domain)) penalty += result.blockers.length * MINOR_PENALTY_PER_BLOCKER;
  }

  const rawScore = applicableWeightSum > 0 ? Math.round(weightedEarnedSum / applicableWeightSum) : 0;
  const approvalGapBlockers = domainResults.approval_completeness.blocking_failures;
  const uniqueBlockingFailures = [...new Set(blockingFailures)];
  const hasHardBlockingFailure = uniqueBlockingFailures.length > 0;
  const hasInvalidatingFailure = uniqueBlockingFailures.some(b => INVALIDATING_BLOCKERS.has(b));

  // A report with nothing but the always-applicable data_readiness domain to
  // evaluate has no meaningful content to score at all (Fixture A).
  const onlyStructuralDomainApplicable = applicableWeightSum <= PUBLICATION_DOMAIN_WEIGHTS.data_readiness;

  let scoreState, overallScore, publicationStatus;
  if (hasInvalidatingFailure) {
    scoreState = SCORE_STATE.INVALIDATED;
    overallScore = null;
    publicationStatus = PUBLICATION_STATUS.BLOCKED;
  } else if (onlyStructuralDomainApplicable) {
    // Invariant (Part 1): NOT_EVALUATED means there is not enough content
    // to compute a MEANINGFUL score — rawScore here is not meaningful (it
    // is arithmetic over a single structural domain), so it must never be
    // surfaced as if it were one.
    scoreState = SCORE_STATE.NOT_EVALUATED;
    overallScore = null;
    publicationStatus = PUBLICATION_STATUS.BLOCKED;
  } else {
    overallScore = Math.max(0, rawScore - penalty);
    if (hasHardBlockingFailure || overallScore < 40) {
      scoreState = SCORE_STATE.VALID;
      publicationStatus = PUBLICATION_STATUS.BLOCKED;
    } else if (approvalGapBlockers.length > 0) {
      // Content may be strong, but an incomplete approval chain means the
      // score is provisional and must not read as near-perfect (Part 1.3).
      scoreState = SCORE_STATE.PROVISIONAL;
      overallScore = Math.min(overallScore, 84);
      publicationStatus = PUBLICATION_STATUS.REVIEW_REQUIRED;
    } else {
      scoreState = SCORE_STATE.VALID;
      publicationStatus = overallScore >= 93 ? PUBLICATION_STATUS.PUBLICATION_READY
        : overallScore >= 85 ? PUBLICATION_STATUS.APPROVED
        : PUBLICATION_STATUS.REVIEW_REQUIRED;
    }
  }

  const formatBlocked = domainResults.format_integrity.blocking_failures.length > 0;
  const exportAllowed = scoreState !== SCORE_STATE.INVALIDATED && !hasHardBlockingFailure && !formatBlocked
    && approvalGapBlockers.length === 0
    && (publicationStatus === PUBLICATION_STATUS.APPROVED || publicationStatus === PUBLICATION_STATUS.PUBLICATION_READY);

  return {
    publication_status: publicationStatus,
    score_state: scoreState,
    export_allowed: exportAllowed,
    overall_score: overallScore,
    blocking_failures: uniqueBlockingFailures,
    warnings: [...new Set(warnings)],
    domain_results: domainResults,
    required_approvals: r.approvals.required,
    completed_approvals: r.approvals.completed,
    synthetic_demonstration: r.is_demo,
    security_event: hasInvalidatingFailure ? {
      type: uniqueBlockingFailures.includes('CROSS_TENANT_REFERENCE') ? 'CROSS_TENANT_CONTAMINATION' : 'FABRICATED_EVIDENCE_PRESENTED_AS_REAL',
      requested_by_org_id: r.requested_by_org_id,
      resource_org_id: r.organization_id,
      project_id: r.project_id,
      dataset_version: r.dataset_version,
      detected_at: new Date().toISOString(),
    } : null,
    evaluated_at: new Date().toISOString(),
    engine: 'quality-scoring-engine.js:evaluatePublicationGate',
    engine_version: '1.1.0',
  };
}

// Legacy compatibility adapter (Part 9): maps the canonical decision onto
// field names already expected by existing routes/UI, without letting any
// legacy field carry independent logic — every value here is derived
// strictly from the canonical decision passed in.
export function toLegacyPublicationFields(decision) {
  const hasScore = decision.overall_score !== null && decision.overall_score !== undefined;
  return {
    rating_10: hasScore ? Math.round(decision.overall_score) / 10 : null,
    status: decision.publication_status,
    export_allowed: decision.export_allowed,
    quality_score: hasScore ? decision.overall_score : null,
    publication_ready: decision.publication_status === PUBLICATION_STATUS.PUBLICATION_READY,
    enterprise_ready: decision.publication_status === PUBLICATION_STATUS.PUBLICATION_READY && hasScore && decision.overall_score >= 93,
  };
}

// ============================================================
// PRODUCTION PERSISTENCE (Canonical Publication Quality Gate, Parts 6-7)
// ------------------------------------------------------------
// evaluatePublicationGate above is a pure function with no DB access, so it
// stays deterministically unit-testable. This is the wrapper a route should
// actually call in production: it evaluates, then persists both the
// evaluation-history record and (if present) the security event, so no
// caller can forget to do so.
// ============================================================

// Reuses the existing security_audit_events_v2 table (migrations 031/034 —
// see backend/schema.sql) rather than creating a parallel security-event
// table. correlation_id is a deterministic hash of the event's identifying
// fields, so re-evaluating the same report does not create duplicate alerts.
export async function persistSecurityEvent(env, event, context = {}) {
  if (!event) return null;
  const dedupSeed = [event.type, event.resource_org_id, event.requested_by_org_id, context.report_id, context.route].filter(Boolean).join('|');
  const correlationId = await sha256Hex(dedupSeed || newId('secevt-seed'));
  try {
    const existing = await env.DB.prepare(`SELECT id FROM security_audit_events_v2 WHERE correlation_id = ? LIMIT 1`).bind(correlationId).first();
    if (existing) return { id: existing.id, deduplicated: true };
    const id = newId('secevt');
    await env.DB.prepare(
      `INSERT INTO security_audit_events_v2 (id, organization_id, actor_id, actor_role, action, resource_type, resource_id, result, risk_level, correlation_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, event.resource_org_id || null, context.actor_id || null, context.actor_role || null,
      event.type, 'publication_gate_evaluation', context.report_id || null, 'BLOCKED', 'CRITICAL', correlationId,
      JSON.stringify({ requested_by_org_id: event.requested_by_org_id, project_id: event.project_id, dataset_version: event.dataset_version, evidence_ids: context.evidence_ids || [], route: context.route || null }),
      event.detected_at || new Date().toISOString(),
    ).run();
    return { id, deduplicated: false };
  } catch (e) {
    // Never let audit-persistence failure hide behind a thrown error — the
    // canonical decision has already blocked the request regardless.
    return null;
  }
}

// Inserts an immutable evaluation-history row (migration 038:
// publication_gate_evaluations) and flips is_latest on any prior rows for
// the same report_id, so the newest record is always cheap to find without
// ever overwriting the history a reproducibility audit would need.
export async function persistPublicationGateEvaluation(env, decision, context = {}) {
  const inputHash = await sha256Hex(JSON.stringify(context.input || {}));
  const resultHash = await sha256Hex(JSON.stringify({ ...decision, evaluated_at: null }));
  const id = newId('pgeval');
  try {
    if (context.report_id) {
      await env.DB.prepare(`UPDATE publication_gate_evaluations SET is_latest = 0 WHERE report_id = ?`).bind(context.report_id).run();
    }
    await env.DB.prepare(
      `INSERT INTO publication_gate_evaluations (id, report_id, report_version, dataset_version, scope_type, organization_id, project_id, report_context, canonical_engine_version, overall_score, score_state, publication_status, export_allowed, blocking_failures_json, warnings_json, domain_results_json, validator_results_json, required_approvals_json, completed_approvals_json, evaluated_by, evaluated_at, input_hash, result_hash, is_latest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(
      id, context.report_id || null, context.report_version || null, context.dataset_version || null, context.scope_type || null,
      context.organization_id || null, context.project_id || null, context.report_context || 'CUSTOMER',
      decision.engine_version, decision.overall_score, decision.score_state, decision.publication_status,
      decision.export_allowed ? 1 : 0, JSON.stringify(decision.blocking_failures), JSON.stringify(decision.warnings),
      JSON.stringify(decision.domain_results), JSON.stringify(context.validator_results || {}),
      JSON.stringify(decision.required_approvals), JSON.stringify(decision.completed_approvals),
      context.evaluated_by || null, decision.evaluated_at, inputHash, resultHash,
    ).run();
    return { id, input_hash: inputHash, result_hash: resultHash };
  } catch (e) {
    return null;
  }
}

// The actual production entry point. Routes should call this, not the pure
// evaluatePublicationGate, so evaluation history and security events are
// never left to the caller to remember to persist.
export async function evaluatePublicationGateAndPersist(env, input, context = {}) {
  const decision = evaluatePublicationGate(input);
  const evaluation = await persistPublicationGateEvaluation(env, decision, { ...context, input });
  const securityEventResult = decision.security_event ? await persistSecurityEvent(env, decision.security_event, context) : null;
  return { ...decision, evaluation_id: evaluation?.id || null, security_event_persisted: Boolean(securityEventResult) };
}
