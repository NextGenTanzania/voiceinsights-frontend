// Publication Experience (PX) Release 4/5: Intelligence Layer tests.
// PX Release 5, Task #51 grew the chain from 10 to 13 steps (uncertainty,
// alternative_explanation, cost_of_delay added) — v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import {
  PUBLICATION_INTELLIGENCE_LAYER_VERSION, INTELLIGENCE_CHAIN_STEPS, buildIntelligenceChain, buildIntelligenceChains,
} from '../src/publication-intelligence-layer.js';

test('the module exports a version constant and the 13 named chain steps', () => {
  assert.equal(PUBLICATION_INTELLIGENCE_LAYER_VERSION, 'publication-intelligence-layer-v2');
  assert.deepEqual(INTELLIGENCE_CHAIN_STEPS, [
    'finding', 'evidence', 'interpretation', 'implication', 'uncertainty', 'alternative_explanation',
    'policy_meaning', 'investment_meaning', 'risk', 'decision', 'cost_of_delay', 'expected_outcome', 'monitoring',
  ]);
});

test('buildIntelligenceChain never fabricates a step it has no real field for — a missing field marks the step unavailable, not invented', () => {
  const result = buildIntelligenceChain({ recommendation: 'Do X' }, null, null);
  assert.equal(result.chain.finding.available, false);
  assert.equal(result.chain.finding.value, null);
  assert.equal(result.chain.evidence.available, false);
  assert.equal(result.chain.decision.available, true, 'the recommendation action itself is real');
  assert.ok(result.missing_steps.includes('finding'));
  assert.ok(result.complete_steps.includes('decision'));
});

test('alternative_explanation is always unavailable — no field on the model captures a competing causal explanation, and this is disclosed, not hidden', () => {
  const recommendation = { id: 'DEC-1', recommendation: 'Adopt X', owner: 'Minister', timeline: '0-90 days' };
  const finding = { text: 'District gaps are widening.', interpretation: 'Concentrated in one region.', uncertainty_style: 'confident' };
  const evidence = { id: 'EVI-1', quote: 'Access remains uneven.', respondent_group: 'Rural women', region: 'Lake Zone', confidence_score: 88 };
  const result = buildIntelligenceChain(recommendation, finding, evidence, 'Delay compounds the gap.');
  assert.equal(result.chain.alternative_explanation.available, false);
  assert.equal(result.chain.alternative_explanation.value, null);
  assert.ok(result.missing_steps.includes('alternative_explanation'));
});

test('buildIntelligenceChain traces every real step to a real, named source field, including the 3 new PX Release 5 steps', () => {
  const recommendation = {
    id: 'DEC-1', recommendation: 'Adopt X', owner: 'Minister', timeline: '0-90 days',
    why_this_recommendation_exists: 'Because Y. And Z.', budget_requirement: 'Medium',
    expected_risk: 'Execution risk', expected_benefit: 'Improved outcomes', monitoring_indicator: 'Milestone completion',
  };
  const finding = { text: 'District gaps are widening.', interpretation: 'Concentrated in one region.', uncertainty_style: 'hedged' };
  const evidence = { id: 'EVI-1', quote: 'Access remains uneven.', respondent_group: 'Rural women', region: 'Lake Zone', confidence_score: 88 };
  const result = buildIntelligenceChain(recommendation, finding, evidence, 'A further delay compounds the gap.');
  // 12 of 13 steps real (alternative_explanation is always unavailable by design)
  assert.equal(result.completeness, Math.round((12 / 13) * 100) / 100);
  assert.deepEqual(result.missing_steps, ['alternative_explanation']);
  assert.equal(result.chain.finding.value, finding.text);
  assert.equal(result.chain.finding.source_field, 'findings[].text');
  assert.equal(result.chain.implication.value, 'Rural women in Lake Zone');
  assert.equal(result.chain.uncertainty.value, 'hedged');
  assert.equal(result.chain.uncertainty.source_field, 'findings[].uncertainty_style');
  assert.equal(result.chain.cost_of_delay.value, 'A further delay compounds the gap.');
  assert.equal(result.chain.cost_of_delay.source_field, 'executive_book.cost_of_inaction');
  assert.equal(result.chain.policy_meaning.value, 'Because Y.', 'extractive first sentence, not the full paragraph');
  assert.equal(result.chain.decision.value.action, 'Adopt X');
  assert.equal(result.chain.decision.value.owner, 'Minister');
  assert.equal(result.chain.monitoring.value, 'Milestone completion');
});

test('buildIntelligenceChain is deterministic: the same input always produces the same output', () => {
  const rec = { id: 'X', recommendation: 'Do X', owner: 'A', timeline: 'B' };
  const a = buildIntelligenceChain(rec, { text: 'F' }, { id: 'E', quote: 'Q' }, 'cost text');
  const b = buildIntelligenceChain(rec, { text: 'F' }, { id: 'E', quote: 'Q' }, 'cost text');
  assert.deepEqual(a, b);
});

test('buildIntelligenceChains threads the report-level cost_of_inaction into every chain, and against the real flagship model produces one fully-traceable-except-alternative_explanation chain per recommendation', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const evidenceById = new Map((model.report.evidence || []).map(e => [e.id, e]));
  const costOfInaction = model.report.executive_book.cost_of_inaction;
  const chains = buildIntelligenceChains(model.report.recommendations, model.report.findings, evidenceById, costOfInaction);
  assert.equal(chains.length, model.report.recommendations.length);
  for (const chain of chains) {
    assert.ok(chain.completeness > 0, `${chain.recommendation_id} must have at least some real traceable steps`);
    assert.ok(chain.chain.decision.available, `${chain.recommendation_id} must always have a real decision (it is the recommendation itself)`);
    assert.equal(chain.chain.cost_of_delay.value, costOfInaction);
    assert.ok(chain.missing_steps.includes('alternative_explanation'), 'alternative_explanation must always be disclosed as missing, never fabricated');
    assert.ok(chain.completeness < 1, 'completeness must never reach 100% while alternative_explanation has no real field');
  }
});
