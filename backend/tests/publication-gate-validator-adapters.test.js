import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFlagshipDecisionIntelligence } from '../src/flagship-report-engine.js';
import { validatePresentation } from '../src/presentation-publishing.js';
import { validateEvidenceTrust } from '../src/report-trust.js';
import { validateSyntheticSample } from '../src/flagship-publication-quality-gate.js';
import { validateInternationalStandards } from '../src/international-publication-quality-engine.js';
import { buildInternationalIntelligenceReportingSuiteV200 } from '../src/international-intelligence-reporting-suite.js';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';

// A validator result must never let a specialized engine re-declare
// publication authority — only quality-scoring-engine.js:evaluatePublicationGate
// may decide these fields (Canonical Publication Quality Gate, Part 3).
const FORBIDDEN_AUTHORITY_FIELDS = ['export_allowed', 'publication_ready', 'enterprise_ready', 'final_status'];

function assertIsValidatorResult(result, label) {
  assert.ok(result.validator_id, `${label}: missing validator_id`);
  assert.ok(result.domain, `${label}: missing domain`);
  assert.ok(result.status, `${label}: missing status`);
  assert.ok(['PASS', 'WARNING', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'].includes(result.status), `${label}: unrecognized status ${result.status}`);
  assert.ok(result.evaluated_at, `${label}: missing evaluated_at`);
  assert.ok(Array.isArray(result.blocking_failures), `${label}: blocking_failures must be an array`);
  assert.ok(Array.isArray(result.warnings), `${label}: warnings must be an array`);
  assert.ok(Array.isArray(result.passed_checks), `${label}: passed_checks must be an array`);
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    assert.equal(result[field], undefined, `${label}: must not carry independent authority field "${field}"`);
  }
}

const richFlagshipReport = {
  title: 'National Health Access Intelligence Report', profile: 'donor', sector: 'Health', country: 'Tanzania',
  executive_summary: 'Access to primary care varies sharply by district.',
  findings: [{ claim: 'Facility waiting times remain the strongest driver of negative patient experience.' }],
  evidence: [{ evidence_id: 'EV-1', response_id: 'R-1', confidence_score: 0.9, verification_status: 'VERIFIED', reviewer: 'QA Lead' }],
  recommendations: [{ recommendation: 'Deploy a stockout response plan.', owner: 'MOH Logistics', timeline: '30 days', evidence_ids: ['EV-1'] }],
  risks: ['Delayed financing weakens delivery confidence.'],
  methodology: { sampling_frame: 'national', sample_design: 'stratified', instrument_version: 'v2', analysis_plan: 'descriptive', data_dictionary: 'linked' },
  limitations: ['Cross-sectional design.'],
};

test('validateFlagshipDecisionIntelligence returns a well-formed validator result', () => {
  const result = validateFlagshipDecisionIntelligence(richFlagshipReport);
  assertIsValidatorResult(result, 'flagship-report-engine');
  assert.equal(result.domain, 'decision_usefulness');
});

test('validatePresentation returns a well-formed validator result', () => {
  const result = validatePresentation(richFlagshipReport, 'donor', 'premium_pdf');
  assertIsValidatorResult(result, 'presentation-publishing');
  assert.equal(result.domain, 'visualization_quality');
});

test('validateEvidenceTrust returns a well-formed validator result', () => {
  const documentModel = {
    kpis: { total_responses: 420 },
    demographics: { gender: [{ label: 'Women', n: 200 }], age: [{ label: '18-25', n: 90 }], regions: [{ label: 'Dar es Salaam', n: 80 }] },
    findings: { sentiment: [{ label: 'positive', n: 200 }], topics: [{ topic: 'access', n: 50 }] },
    narrative: { key_findings: ['Facility waiting times remain the strongest driver of negative patient experience.'], executive_summary: 'Access varies by district.' },
    recommendations: { immediate: ['Deploy a stockout response plan.'] },
  };
  const result = validateEvidenceTrust(documentModel);
  assertIsValidatorResult(result, 'report-trust');
  assert.equal(result.domain, 'evidence_traceability');
});

test('validateSyntheticSample returns a well-formed validator result, always tagged synthetic', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const result = validateSyntheticSample(model, { human_reviewed: true, export_checks: { pdf: { passed: true }, docx: { passed: true }, pptx: { passed: true }, xlsx: { passed: true } } });
  assertIsValidatorResult(result, 'flagship-publication-quality-gate');
  assert.equal(result.domain, 'data_readiness');
  assert.equal(result.evidence[0].synthetic_demonstration, true);
});

test('validateInternationalStandards returns a well-formed validator result', () => {
  const documentModel = {
    is_demo: true,
    metadata: { template_name: 'National Health Access Intelligence Report', sector: 'health' },
    kpis: { total_responses: 420, response_rate_pct: 100, quality_score: 95 },
    findings: { top_topics: ['facility access'], sentiment: { positive: 227, neutral: 127, negative: 66 } },
    recommendations: ['Activate a 30-day stockout and waiting-time review.'],
    demographics: { gender: [{ label: 'Male', n: 239 }] },
    geography: { regions: [{ label: 'Dar es Salaam', n: 84 }] },
  };
  const suite = buildInternationalIntelligenceReportingSuiteV200(documentModel);
  const result = validateInternationalStandards(documentModel, suite);
  assertIsValidatorResult(result, 'international-publication-quality-engine');
  assert.equal(result.domain, 'editorial_quality');
});
