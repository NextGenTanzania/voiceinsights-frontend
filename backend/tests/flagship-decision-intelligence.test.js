// Decision, Policy, Donor and Government Intelligence — PX Release 9,
// Parts 4-8.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAGSHIP_DECISION_INTELLIGENCE_VERSION, classifyPolicyLever, buildDecisionIntelligence,
  checkDonorIntelligence, checkGovernmentIntelligence, validateKnowledgeFit,
} from '../src/flagship-decision-intelligence.js';
import { routeKnowledge } from '../src/flagship-knowledge-router.js';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_DECISION_INTELLIGENCE_VERSION, 'string');
});

// ------------------------------------------------------------------
// Part 4: Policy Intelligence
// ------------------------------------------------------------------
test('classifyPolicyLever names a real matched field, never an unexplained label', () => {
  const budgeting = classifyPolicyLever({ recommendation: 'Adopt a compact.', budget_requirement: 'A dedicated budget line is required.' });
  assert.equal(budgeting.lever, 'Budgeting');
  assert.ok(budgeting.rationale.length > 0);

  const accountability = classifyPolicyLever({ recommendation: 'Publish a performance scorecard.', budget_requirement: 'Low' });
  assert.equal(accountability.lever, 'Accountability');

  const fallback = classifyPolicyLever({ recommendation: 'Do something unrelated.', budget_requirement: 'Low' });
  assert.equal(fallback.lever, 'Implementation Guidance');
});

// ------------------------------------------------------------------
// Part 5: Decision Intelligence
// ------------------------------------------------------------------
test('buildDecisionIntelligence never invents evidence — every returned field traces to a real input field', () => {
  const recommendation = {
    recommendation: 'Adopt a cabinet-owned compact.', owner: 'Permanent Secretary', timeline: '0–90 days',
    budget_requirement: 'High — full business case and multi-year funding commitment required',
    priority: 'CRITICAL', expected_benefit: 'Improved outcomes.', expected_risk: 'Coordination risk.',
    dependencies: ['Named executive sponsor'], monitoring_indicator: 'Milestone completion rate',
  };
  const result = buildDecisionIntelligence(recommendation);
  assert.equal(result.owner, recommendation.owner);
  assert.equal(result.timeHorizon, recommendation.timeline);
  assert.equal(result.financialFeasibility, recommendation.budget_requirement);
  assert.equal(result.expectedImpact, recommendation.expected_benefit);
  assert.deepEqual(result.dependencies, recommendation.dependencies);
  assert.equal(result.risks, recommendation.expected_risk);
  assert.equal(result.successMetric, recommendation.monitoring_indicator);
  assert.equal(result.approvalLevel, 'Cabinet-level approval');
  assert.equal(result.politicalSensitivity, 'High');
  assert.ok(result.decisionTypes.length > 0);
});

test('buildDecisionIntelligence never crashes and always returns at least one decision type, even for a minimal recommendation', () => {
  const result = buildDecisionIntelligence({});
  assert.ok(Array.isArray(result.decisionTypes) && result.decisionTypes.length > 0);
});

test('a Board-owned recommendation resolves Board-level approval and a Principal-Investigator-owned one resolves institutional review', () => {
  const board = buildDecisionIntelligence({ owner: 'Chief Executive Officer / Board Sponsor' });
  const research = buildDecisionIntelligence({ owner: 'Principal Investigator' });
  assert.equal(board.approvalLevel, 'Board-level approval');
  assert.equal(research.approvalLevel, 'Institutional review approval');
  assert.notEqual(board.politicalSensitivity, research.politicalSensitivity);
});

// ------------------------------------------------------------------
// Parts 6-7: Donor and Government Intelligence
// ------------------------------------------------------------------
test('checkDonorIntelligence reads only real report fields and reports 8 dimensions', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const dims = checkDonorIntelligence(model.report);
  assert.equal(dims.length, 8);
  for (const d of dims) assert.ok(typeof d.present === 'boolean' && d.rationale);
});

test('checkGovernmentIntelligence reads only real report fields and reports 6 institutional uses', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const uses = checkGovernmentIntelligence(model.report);
  assert.equal(uses.length, 6);
  const cabinet = uses.find(u => u.use === 'Cabinet paper');
  assert.equal(cabinet.ready, true);
});

// ------------------------------------------------------------------
// Part 8: Knowledge Validation
// ------------------------------------------------------------------
test('validateKnowledgeFit passes for every one of the 16 real flagship samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const routing = routeKnowledge(sample);
    const result = validateKnowledgeFit(routing);
    assert.equal(result.valid, true, `${sample.key} failed knowledge validation: ${JSON.stringify(result.checks.filter(c => !c.pass))}`);
  }
});

test('validateKnowledgeFit returns weaknesses before any writing, for an unrecognized routing', () => {
  const result = validateKnowledgeFit({ domain: 'Not A Real Domain', audience: 'not-a-real-audience' });
  assert.equal(result.valid, false);
  assert.ok(result.checks.some(c => !c.pass));
});

// ------------------------------------------------------------------
// Integration: every real flagship sample's full decision intelligence
// ------------------------------------------------------------------
test('every real flagship sample computes decision intelligence for every recommendation, and donor/government checks', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    assert.equal(model.report.decision_intelligence.length, model.report.recommendations.length);
    assert.equal(model.report.donor_intelligence.length, 8);
    assert.equal(model.report.government_intelligence.length, 6);
  }
});

test('rebuilding the same sample key twice produces byte-identical decision intelligence (determinism)', () => {
  const a = buildFlagshipSampleReport('national-human-development');
  const b = buildFlagshipSampleReport('national-human-development');
  assert.deepEqual(a.report.decision_intelligence, b.report.decision_intelligence);
  assert.deepEqual(a.report.donor_intelligence, b.report.donor_intelligence);
  assert.deepEqual(a.report.government_intelligence, b.report.government_intelligence);
});
