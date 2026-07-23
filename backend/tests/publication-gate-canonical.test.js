import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePublicationGate, toLegacyPublicationFields, makeValidatorResult,
  PUBLICATION_STATUS, VALIDATOR_STATUS, PUBLICATION_DOMAIN_WEIGHTS, SCORE_STATE,
} from '../src/quality-scoring-engine.js';

// ---------------------------------------------------------------
// Adversarial fixtures A-H, per the Canonical Publication Quality Gate spec.
// ---------------------------------------------------------------

const fixtureA_empty = {
  dataset_version: null,
  organization_id: null, project_id: null,
  is_demo: false, report_type: 'standard',
  findings: [], evidence: [], decisions: [],
  methodology: null, statistics: [], claims: [], quotes: [],
  approvals: { required: [], completed: [] },
  exports: {},
};

const fixtureB_polishedUnsupported = {
  dataset_version: 'v1', organization_id: 'org_1', project_id: 'proj_1',
  is_demo: false, report_type: 'standard',
  findings: [
    { text: 'Programme performance has improved significantly across all regions.' },
    { text: 'Beneficiaries report transformative change in their livelihoods.' },
    { text: 'Stakeholder engagement reached an all-time high this quarter.' },
  ],
  evidence: [],
  decisions: [{ text: 'Scale the programme nationally.', evidence_ids: [] }],
  methodology: { limitations: ['none noted'] },
  statistics: [],
  claims: [{ text: 'The programme caused a 40% increase in household income.', causal: true, evidence_ids: [] }],
  quotes: [{ text: 'This programme changed my life.' }],
  editorial: { prose_quality: 'high', grammar_reviewed: true, tone_reviewed: true },
  approvals: { required: [], completed: [] },
  exports: {},
};

const fixtureC_statsInvalid = {
  dataset_version: null, organization_id: 'org_1', project_id: 'proj_1',
  is_demo: false, report_type: 'standard',
  findings: [{ text: 'Access improved.', evidence_ids: ['EV-1'] }],
  evidence: [{ id: 'EV-1', source: 'survey' }],
  decisions: [],
  methodology: { limitations: ['sample size'] },
  statistics: [{ id: 'S1', unit: '%', value: 62 }],
  claims: [{ text: 'This intervention directly caused the 40-point improvement.', causal: true, evidence_ids: [] }],
  quotes: [],
  approvals: { required: [], completed: [] },
  exports: {},
};

const strongCore = {
  dataset_version: 'v3-locked', organization_id: 'org_1', project_id: 'proj_1',
  is_demo: false, report_type: 'standard',
  findings: [
    { text: 'Facility waiting times remain the strongest driver of negative patient experience.', evidence_ids: ['EV-1'] },
    { text: 'Rural clinics report medicine stockouts twice as often as urban clinics.', evidence_ids: ['EV-2'] },
  ],
  evidence: [
    { id: 'EV-1', source: 'survey', confidence: 0.9 },
    { id: 'EV-2', source: 'admin_records', confidence: 0.85 },
  ],
  decisions: [{ text: 'Deploy a 30-day stockout response plan.', evidence_ids: ['EV-2'], owner: 'MOH Logistics', timeline: '30 days' }],
  methodology: { sampling_frame: 'national', limitations: ['cross-sectional design'] },
  statistics: [{ id: 'S1', unit: '%', value: 58, denominator: 1200, evidence_ids: ['EV-1'] }],
  claims: [{ text: 'Waiting times are associated with lower satisfaction scores.', causal: false, evidence_ids: ['EV-1'] }],
  quotes: [{ text: 'I waited four hours to see a nurse.', source_id: 'EV-1' }],
  exports: { pdf: { valid: true }, docx: { valid: true } },
  editorial: { prose_quality: 'high', grammar_reviewed: true, tone_reviewed: true },
  accessibility: { alt_text_policy: true, reading_order: true },
  visualizations: [{ id: 'V1', evidence_ids: ['EV-1'] }],
};

const fixtureD_missingApproval = { ...strongCore, approvals: { required: ['statistician', 'executive_approver'], completed: ['statistician'] } };

const fixtureE_syntheticValid = {
  dataset_version: 'synthetic-2026.1', organization_id: null, project_id: null,
  is_demo: true, report_type: 'standard',
  findings: [
    { text: 'Multidimensional poverty transitions is the clearest differentiator of human development performance.', evidence_ids: ['EV-1'] },
    { text: 'Primary healthcare continuity varies sharply by region.', evidence_ids: ['EV-2'] },
  ],
  evidence: [
    { id: 'EV-1', source: 'synthetic_survey', confidence: 0.9, synthetic: true },
    { id: 'EV-2', source: 'synthetic_survey', confidence: 0.88, synthetic: true },
  ],
  decisions: [{ text: 'Adopt a cabinet-owned human development delivery compact.', evidence_ids: ['EV-1'], owner: 'Permanent Secretary', timeline: '0-90 days' }],
  methodology: { sampling_frame: 'synthetic demonstration frame', limitations: ['synthetic data cannot support population inference'] },
  statistics: [{ id: 'S1', unit: '%', value: 67, denominator: 1240, evidence_ids: ['EV-1'] }],
  claims: [{ text: 'The evidence indicates a gap concentrated in Lake Zone.', causal: false, evidence_ids: ['EV-1'] }],
  quotes: [{ text: 'In Lake Zone, poverty shapes whether services translate into outcomes.', source_id: 'EV-1' }],
  approvals: { required: ['reviewer'], completed: ['reviewer'] },
  exports: { pdf: { valid: true }, docx: { valid: true }, pptx: { valid: true }, xlsx: { valid: true } },
  editorial: { prose_quality: 'high', grammar_reviewed: true, tone_reviewed: true },
  accessibility: { alt_text_policy: true, reading_order: true, contrast_review: true },
  visualizations: [{ id: 'V1', evidence_ids: ['EV-1'] }],
};

const fixtureF_strongReal = { ...strongCore, approvals: { required: ['statistician', 'executive_approver'], completed: ['statistician', 'executive_approver'] } };

const fixtureG_crossTenant = {
  dataset_version: 'v1', organization_id: 'org_1', project_id: 'proj_1', requested_by_org_id: 'org_2',
  is_demo: false, report_type: 'standard',
  findings: [{ text: 'Some finding.', evidence_ids: ['EV-1'] }],
  evidence: [{ id: 'EV-1', source: 'survey' }],
  decisions: [], methodology: { limitations: ['x'] },
  approvals: { required: [], completed: [] }, exports: {},
};

const fixtureH_invalidExport = { ...fixtureF_strongReal, exports: { pdf: { valid: true }, docx: { valid: false, error: 'corrupt zip' } } };

// ---------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------

test('domain weights sum to exactly 100', () => {
  const total = Object.values(PUBLICATION_DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test('makeValidatorResult enforces required fields and stamps evaluated_at', () => {
  const result = makeValidatorResult({ validator_id: 'v1', domain: 'editorial_quality', status: VALIDATOR_STATUS.PASS });
  assert.equal(result.validator_id, 'v1');
  assert.equal(result.status, 'PASS');
  assert.ok(result.evaluated_at);
  assert.throws(() => makeValidatorResult({ domain: 'x', status: 'PASS' }), /validator_id/);
});

// ---------------------------------------------------------------
// Fixture A — Empty report
// ---------------------------------------------------------------
test('Fixture A (empty report): BLOCKED, NOT_EVALUATED, export not allowed, null score', () => {
  const d = evaluatePublicationGate(fixtureA_empty);
  assert.equal(d.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.equal(d.score_state, SCORE_STATE.NOT_EVALUATED);
  assert.equal(d.export_allowed, false);
  assert.equal(d.overall_score, null, 'NOT_EVALUATED must never surface a numeric score');
  assert.ok(d.blocking_failures.includes('NO_DATASET_VERSION'));
  assert.ok(d.blocking_failures.includes('NO_ORGANIZATION_OR_PROJECT_SCOPE'));
  assert.ok(d.blocking_failures.includes('EMPTY_DATASET_WITHOUT_INSUFFICIENT_EVIDENCE_LABEL'));
});

// ---------------------------------------------------------------
// Part 1 invariant (Customer Report Generation Pilot Hardening release):
// NOT_EVALUATED and INVALIDATED must never carry a numeric score.
// ---------------------------------------------------------------
test('invariant: score_state NOT_EVALUATED or INVALIDATED never carries a numeric overall_score', () => {
  const scenarios = [fixtureA_empty, fixtureG_crossTenant];
  for (const scenario of scenarios) {
    const d = evaluatePublicationGate(scenario);
    assert.ok([SCORE_STATE.NOT_EVALUATED, SCORE_STATE.INVALIDATED].includes(d.score_state), `expected NOT_EVALUATED or INVALIDATED, got ${d.score_state}`);
    assert.equal(d.overall_score, null, `${d.score_state} must have overall_score:null, got ${d.overall_score}`);
    const legacy = toLegacyPublicationFields(d);
    assert.equal(legacy.rating_10, null);
    assert.equal(legacy.quality_score, null);
    assert.equal(legacy.status, d.publication_status, 'status must still reflect canonical publication status even when the score is null');
  }
});

// ---------------------------------------------------------------
// Fixture B — Polished but unsupported
// ---------------------------------------------------------------
test('Fixture B (polished but unsupported): BLOCKED, score materially reduced despite a high editorial score', () => {
  const d = evaluatePublicationGate(fixtureB_polishedUnsupported);
  assert.equal(d.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.equal(d.score_state, SCORE_STATE.VALID);
  assert.equal(d.export_allowed, false);
  assert.ok(d.overall_score <= 30, `expected the evidence/claim penalty to pull the score well down, got ${d.overall_score}`);
  assert.equal(d.domain_results.editorial_quality.score, 100, 'editorial domain should score well on its own merits');
  assert.equal(d.domain_results.evidence_traceability.score, 0);
  assert.equal(d.domain_results.claim_validity.score, 0);
  assert.ok(d.blocking_failures.includes('NO_VERIFIED_EVIDENCE'));
  assert.ok(d.blocking_failures.includes('UNSUPPORTED_CAUSAL_CLAIM'));
  assert.ok(d.blocking_failures.includes('QUOTATION_WITHOUT_SOURCE'));
});

// ---------------------------------------------------------------
// Fixture C — Statistically invalid
// ---------------------------------------------------------------
test('Fixture C (statistically invalid): BLOCKED, score reflects the failures', () => {
  const d = evaluatePublicationGate(fixtureC_statsInvalid);
  assert.equal(d.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.equal(d.score_state, SCORE_STATE.VALID);
  assert.equal(d.export_allowed, false);
  assert.ok(d.overall_score <= 30, `expected the statistics/methodology penalty to pull the score well down, got ${d.overall_score}`);
  assert.ok(d.blocking_failures.includes('NO_DATASET_VERSION'));
  assert.ok(d.blocking_failures.some(b => b.startsWith('NO_DENOMINATOR')));
  assert.ok(d.blocking_failures.includes('UNSUPPORTED_CAUSAL_CLAIM'));
});

// ---------------------------------------------------------------
// Fixture D — Strong report missing approval
// ---------------------------------------------------------------
test('Fixture D (strong report, missing approval): PROVISIONAL, capped below the approved band, export not allowed', () => {
  const d = evaluatePublicationGate(fixtureD_missingApproval);
  assert.equal(d.publication_status, PUBLICATION_STATUS.REVIEW_REQUIRED);
  assert.equal(d.score_state, SCORE_STATE.PROVISIONAL);
  assert.equal(d.export_allowed, false);
  assert.ok(d.overall_score >= 60 && d.overall_score <= 84, `expected a strong-but-capped score, got ${d.overall_score}`);
  assert.ok(d.domain_results.evidence_traceability.score >= 50, 'evidence domain should score well');
  assert.ok(d.blocking_failures.every(b => !b.startsWith('MISSING_APPROVAL')), 'approval gaps must not appear in hard blocking_failures');
  assert.ok(d.domain_results.approval_completeness.blocking_failures.includes('MISSING_APPROVAL:executive_approver'));
});

// ---------------------------------------------------------------
// Fixture E — Valid synthetic sample
// ---------------------------------------------------------------
test('Fixture E (valid synthetic sample): can reach PUBLICATION_READY, but stays labelled synthetic', () => {
  const d = evaluatePublicationGate(fixtureE_syntheticValid);
  assert.notEqual(d.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.equal(d.score_state, SCORE_STATE.VALID);
  assert.equal(d.synthetic_demonstration, true);
  assert.equal(d.blocking_failures.length, 0);
});

// ---------------------------------------------------------------
// Fixture F — Strong real customer report
// ---------------------------------------------------------------
test('Fixture F (strong real customer report): eligible for APPROVED or PUBLICATION_READY', () => {
  const d = evaluatePublicationGate(fixtureF_strongReal);
  assert.ok([PUBLICATION_STATUS.APPROVED, PUBLICATION_STATUS.PUBLICATION_READY].includes(d.publication_status), `got ${d.publication_status} at score ${d.overall_score}`);
  assert.equal(d.score_state, SCORE_STATE.VALID);
  assert.equal(d.export_allowed, true);
  assert.equal(d.synthetic_demonstration, false);
});

// ---------------------------------------------------------------
// Fixture G — Cross-tenant contamination
// ---------------------------------------------------------------
test('Fixture G (cross-tenant contamination): BLOCKED, INVALIDATED, null score, security event recorded', () => {
  const d = evaluatePublicationGate(fixtureG_crossTenant);
  assert.equal(d.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.equal(d.score_state, SCORE_STATE.INVALIDATED);
  assert.equal(d.overall_score, null, 'a security-invalidated report must not display any numeric score');
  assert.equal(d.export_allowed, false);
  assert.ok(d.blocking_failures.includes('CROSS_TENANT_REFERENCE'));
  assert.ok(d.security_event, 'expected a security event to be recorded');
  assert.equal(d.security_event.type, 'CROSS_TENANT_CONTAMINATION');
});

// ---------------------------------------------------------------
// Fixture H — Invalid binary export
// ---------------------------------------------------------------
test('Fixture H (invalid binary export): format integrity fails, content score retained but not near-perfect, export not allowed', () => {
  const d = evaluatePublicationGate(fixtureH_invalidExport);
  assert.equal(d.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.ok([SCORE_STATE.VALID, SCORE_STATE.PROVISIONAL].includes(d.score_state));
  assert.equal(d.domain_results.format_integrity.blocking_failures.length > 0, true);
  assert.ok(d.overall_score >= 60, `expected strong content to retain a reasonable score despite the bad export, got ${d.overall_score}`);
  assert.ok(d.overall_score < 93, `expected a corrupt export to prevent a near-perfect score, got ${d.overall_score}`);
  assert.equal(d.export_allowed, false);
});

// ---------------------------------------------------------------
// Score distribution — Part 8/10
// ---------------------------------------------------------------
test('score distribution meaningfully separates fixture quality', () => {
  const scores = {
    B_unsupported: evaluatePublicationGate(fixtureB_polishedUnsupported).overall_score,
    C_statsInvalid: evaluatePublicationGate(fixtureC_statsInvalid).overall_score,
    D_missingApproval: evaluatePublicationGate(fixtureD_missingApproval).overall_score,
    H_invalidExport: evaluatePublicationGate(fixtureH_invalidExport).overall_score,
    F_strong: evaluatePublicationGate(fixtureF_strongReal).overall_score,
  };
  // A_empty is excluded here on purpose: it is NOT_EVALUATED, so its
  // overall_score is null by invariant (Part 1) and is not a number to
  // compare against the rest of the distribution — see the dedicated
  // invariant test above.
  assert.ok(scores.C_statsInvalid <= scores.B_unsupported, `stats-invalid (${scores.C_statsInvalid}) should not outscore polished-unsupported (${scores.B_unsupported})`);
  assert.ok(scores.B_unsupported < scores.D_missingApproval, `unsupported (${scores.B_unsupported}) should score well below strong-missing-approval (${scores.D_missingApproval})`);
  assert.ok(scores.D_missingApproval <= scores.H_invalidExport, `missing-approval (${scores.D_missingApproval}) should not outscore invalid-export content (${scores.H_invalidExport})`);
  assert.ok(scores.H_invalidExport <= scores.F_strong, `invalid-export (${scores.H_invalidExport}) should not outscore the fully clean report (${scores.F_strong})`);
  assert.ok(scores.B_unsupported <= 30, 'a polished-but-unsupported report must not score above 30');
  assert.ok(scores.F_strong >= 85, 'a strong, fully-approved report must reach the APPROVED band');
});

test('an empty report has no numeric score above a review-worthy level even before blocking is considered', () => {
  const d = evaluatePublicationGate(fixtureA_empty);
  assert.equal(d.score_state, SCORE_STATE.NOT_EVALUATED);
});

// ---------------------------------------------------------------
// Legacy adapter (Part 9)
// ---------------------------------------------------------------
test('toLegacyPublicationFields derives every field strictly from the canonical decision', () => {
  const decision = evaluatePublicationGate(fixtureF_strongReal);
  const legacy = toLegacyPublicationFields(decision);
  assert.equal(legacy.export_allowed, decision.export_allowed);
  assert.equal(legacy.status, decision.publication_status);
  assert.equal(legacy.quality_score, decision.overall_score);
  assert.equal(legacy.rating_10, Math.round(decision.overall_score) / 10);
  assert.equal(legacy.publication_ready, decision.publication_status === PUBLICATION_STATUS.PUBLICATION_READY);
});

test('deterministic repeatability: identical input always yields identical decision', () => {
  const d1 = evaluatePublicationGate(fixtureF_strongReal);
  const d2 = evaluatePublicationGate(fixtureF_strongReal);
  assert.deepEqual({ ...d1, evaluated_at: null }, { ...d2, evaluated_at: null });
});
