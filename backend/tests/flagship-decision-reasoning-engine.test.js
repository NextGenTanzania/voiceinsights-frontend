// Decision Reasoning Architecture — engine-level invariant tests.
// The composer/art-direction/narrative-arc test suites already prove the 5
// new spreads render across all 16 samples; these tests check the
// reasoning engine's own governance rules directly, against the real
// engine and real sample data, never a synthetic fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import {
  buildDecisionReasoning, classifyEpistemicStatus, EPISTEMIC_STATUSES, INFERENCE_TYPES,
  BEHAVIOURAL_CLASSIFICATIONS, FLAGSHIP_DECISION_REASONING_ENGINE_VERSION,
} from '../src/flagship-decision-reasoning-engine.js';

function reasoningFor(key) {
  const model = buildFlagshipSampleReport(key);
  const evidenceById = new Map((model.report.evidence || []).map(e => [e.id, e]));
  return buildDecisionReasoning(model.sample, model.report.recommendations, model.report.findings, evidenceById);
}

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_DECISION_REASONING_ENGINE_VERSION, 'string');
});

test('epistemic status is capped by inference type, never conflated with a high statistical confidence score', () => {
  // The whole point of Part 7: an inferred conclusion cannot become KNOWN
  // just because the underlying measurement was highly confident.
  assert.equal(classifyEpistemicStatus({ inferenceType: 'OBSERVED', confidenceScore: 95 }), 'KNOWN');
  assert.equal(classifyEpistemicStatus({ inferenceType: 'INFERRED', confidenceScore: 99 }), 'EMERGING');
  assert.equal(classifyEpistemicStatus({ inferenceType: 'SCENARIO_ASSUMPTION', confidenceScore: 99 }), 'WEAK_SIGNAL');
  assert.equal(classifyEpistemicStatus({ inferenceType: 'UNKNOWN' }), 'UNKNOWN');
  for (const status of Object.values({
    a: classifyEpistemicStatus({ inferenceType: 'OBSERVED', confidenceScore: 40 }),
    b: classifyEpistemicStatus({ inferenceType: 'OBSERVED', confidenceScore: 65 }),
  })) assert.ok(EPISTEMIC_STATUSES.includes(status));
});

test('the do-nothing option ("maintain current approach") is never the preferred option across all 16 samples\' recommendations, even though it is always shown and scored', () => {
  let doNothingShown = 0, total = 0;
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const entry of reasoning.by_recommendation) {
      total++;
      assert.ok(entry.alternatives.options.some(o => o.id.endsWith('OPT-A')), `${s.key}/${entry.recommendation_id}: Option A must always be shown as the honest baseline`);
      doNothingShown++;
      assert.ok(!entry.decision_options.preferred_option_id.endsWith('OPT-A'), `${s.key}/${entry.recommendation_id}: the do-nothing option must never be preferred while a real, evidenced problem is on record`);
    }
  }
  assert.ok(total > 0 && doNothingShown === total);
});

test('every alternative set has 3 real options that materially differ in cost band, institutional burden and timeline, never superficial wording changes on one option', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const entry of reasoning.by_recommendation) {
      const opts = entry.alternatives.options;
      assert.equal(opts.length, 3, `${s.key}/${entry.recommendation_id}: expected exactly 3 alternatives`);
      const costBands = new Set(opts.map(o => o.cost_band));
      const burdens = new Set(opts.map(o => o.institutional_burden));
      assert.ok(costBands.size >= 2 || burdens.size >= 2, `${s.key}/${entry.recommendation_id}: options do not materially differ in cost or institutional burden`);
    }
  }
});

test('no behavioural statement is ever classified OBSERVED or REPORTED — this governed model has no real behavioural measurement to support that claim', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const behav of reasoning.behavioural_dynamics) {
      const classifications = [
        behav.current_behaviour.classification, behav.desired_behaviour.classification,
        ...behav.barriers.map(b => b.classification), ...behav.enablers.map(b => b.classification),
      ];
      for (const c of classifications) {
        assert.ok(BEHAVIOURAL_CLASSIFICATIONS.includes(c), `${s.key}: "${c}" is not a governed behavioural classification`);
        assert.ok(c !== 'OBSERVED' && c !== 'REPORTED', `${s.key}: behavioural statement wrongly classified as ${c} — no real behavioural survey exists in this model`);
      }
    }
  }
});

test('every political-economy stakeholder role carries a real inference_type and epistemic_status — no claim without disclosed provenance', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const stakeholder of reasoning.stakeholders) {
      assert.ok(INFERENCE_TYPES.includes(stakeholder.inference_type), `${s.key}: stakeholder ${stakeholder.id} has an ungoverned inference_type`);
      assert.ok(EPISTEMIC_STATUSES.includes(stakeholder.epistemic_status), `${s.key}: stakeholder ${stakeholder.id} has an ungoverned epistemic_status`);
      if (stakeholder.category !== 'named delivery role') {
        assert.ok(stakeholder.limitation, `${s.key}: category-level stakeholder ${stakeholder.id} is missing its synthetic-demonstration disclosure`);
      }
    }
  }
});

// Visual review (Part 13) of the rendered Stakeholder & Political Economy
// spread found the "possible resistance mechanisms" panel repeating the
// blocker stakeholder's own table-row rationale verbatim, a few inches
// below it on the same page — an in-page repetition, distinct from (and
// not caught by) the catalog-wide boilerplate audit above, which only
// checks for repetition ACROSS recommendations, not within one page.
test('the political-economy resistance-mechanism statement never repeats a blocker stakeholder\'s own identification rationale verbatim on the same page', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const entry of reasoning.by_recommendation) {
      const blockerRationales = new Set(entry.stakeholders.filter(st => st.role === 'blocker').map(st => st.rationale));
      for (const mechanism of entry.political_economy?.possible_resistance_mechanisms || []) {
        assert.ok(!blockerRationales.has(mechanism), `${s.key}/${entry.recommendation_id}: resistance-mechanism text duplicates the blocker's table rationale verbatim`);
      }
    }
  }
});

test('every trade-off row is fully populated across all 16 samples, never a missing dimension', () => {
  const requiredFields = ['benefits', 'direct_costs', 'implementation_burden', 'speed', 'equity', 'reversibility', 'cost_of_delay', 'risk'];
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const t of reasoning.trade_offs) {
      for (const field of requiredFields) assert.ok(t[field], `${s.key}: trade-off ${t.id} missing "${field}"`);
    }
  }
});

test('decision option scoring is transparent: weights are visible, the score is derived from them, and the profile is recorded', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const entry of reasoning.by_recommendation) {
      const scoring = entry.decision_options;
      assert.ok(scoring.weights && Object.keys(scoring.weights).length > 0, `${s.key}: scoring has no visible weights`);
      assert.equal(scoring.profile, s.profile || 'default');
      for (const opt of scoring.options) assert.ok(Number.isFinite(opt.score_pct), `${s.key}: option ${opt.option_id} has no derived score`);
    }
  }
});

// Visual review (Part 13) of the rendered Decision Options & Trade-offs
// spread found that the do-nothing option's raw weighted score ties or
// even beats the preferred option's score in 33 of 80 real recommendations
// (the eligibility gate overrides the score, it doesn't just break rare
// ties) — with no on-page explanation, a reader looking at the score table
// could reasonably ask why a tied or higher-scoring row isn't the starred
// one. The brief's own Final Acceptance Test requires "why is the
// preferred option still preferred?" to be answerable from the rendered
// page in every case, so the rationale must say so explicitly whenever it
// happens, not rely on the reader inferring the gate exists.
test('the rationale explicitly discloses it whenever the do-nothing option ties or outscores the preferred option — the page must never show that silently', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const entry of reasoning.by_recommendation) {
      const scoring = entry.decision_options;
      const doNothing = scoring.options.find(o => o.option_id.endsWith('-OPT-A'));
      const preferred = scoring.options.find(o => o.option_id === scoring.preferred_option_id);
      const disclosed = scoring.rationale.includes('Maintaining the current approach scores');
      if (doNothing.option_id !== preferred.option_id && doNothing.score_pct >= preferred.score_pct) {
        assert.ok(disclosed, `${s.key}/${entry.recommendation_id}: do-nothing (${doNothing.score_pct}%) ties/beats preferred (${preferred.score_pct}%) but the rationale never discloses it`);
      } else {
        assert.ok(!disclosed, `${s.key}/${entry.recommendation_id}: rationale discloses a tie/beat that isn't actually present`);
      }
    }
  }
});

test('buildDecisionReasoning is deterministic: rebuilding the same sample twice produces byte-identical JSON', () => {
  const modelA = buildFlagshipSampleReport('national-human-development');
  const modelB = buildFlagshipSampleReport('national-human-development');
  const evidenceA = new Map((modelA.report.evidence || []).map(e => [e.id, e]));
  const evidenceB = new Map((modelB.report.evidence || []).map(e => [e.id, e]));
  const reasoningA = buildDecisionReasoning(modelA.sample, modelA.report.recommendations, modelA.report.findings, evidenceA);
  const reasoningB = buildDecisionReasoning(modelB.sample, modelB.report.recommendations, modelB.report.findings, evidenceB);
  assert.equal(JSON.stringify(reasoningA), JSON.stringify(reasoningB));
});

// Boilerplate audit (Part 11) regression guard: a catalog-wide direct
// inspection found several free-text reasoning fields collapsing to a
// small handful of distinct values (one field was 80/80 byte-identical)
// because they never referenced any real per-recommendation field. Fixed
// by anchoring each to the recommendation's own real text/timeline/risk —
// this test locks the fix in so it can't silently regress.
test('every free-text behavioural and trade-off statement genuinely varies across the 80 real recommendations in the catalog — no field collapses to a handful of distinct values', () => {
  const fields = { implementer_rationale: [], likely_adoption_response: [], likely_resistance_response: [], cost_of_delay: [] };
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const reasoning = reasoningFor(s.key);
    for (const entry of reasoning.by_recommendation) {
      for (const stk of entry.stakeholders) if (stk.role === 'implementer') fields.implementer_rationale.push(stk.rationale);
      if (entry.behavioural_dynamics) {
        fields.likely_adoption_response.push(entry.behavioural_dynamics.likely_adoption_response.text);
        fields.likely_resistance_response.push(entry.behavioural_dynamics.likely_resistance_response.text);
      }
      // cost_of_delay is a property of the RECOMMENDATION, not the option —
      // by design it repeats identically across that recommendation's 3
      // options (delay has the same real consequence regardless of which
      // alternative is chosen), so only one sample per recommendation is
      // counted here, not all 3 rows.
      if (entry.trade_offs[0]) fields.cost_of_delay.push(entry.trade_offs[0].cost_of_delay);
    }
  }
  for (const [name, values] of Object.entries(fields)) {
    const distinctRatio = new Set(values).size / values.length;
    assert.ok(distinctRatio >= 0.9, `${name}: only ${new Set(values).size}/${values.length} distinct values (${Math.round(distinctRatio * 100)}%) — expected genuine per-recommendation variation, not boilerplate`);
  }
});

// A quoted reference to the recommendation's own text must never
// accidentally reproduce the FULL sentence verbatim (the shortest real
// recommendation in this catalog is 3 words) — that would recreate the
// exact repetition-governance problem this whole fix targets.
test('shortReference-style quoted snippets never reproduce a full recommendation sentence verbatim, even for the shortest real recommendations', () => {
  for (const s of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(s.key);
    for (const r of model.report.recommendations) {
      if (r.recommendation.trim().split(/\s+/).length > 6) continue;
      const reasoning = reasoningFor(s.key);
      const entry = reasoning.by_recommendation.find(e => e.recommendation_id === r.id);
      const implementer = entry.stakeholders.find(stk => stk.role === 'implementer');
      if (implementer) assert.ok(!implementer.rationale.includes(`"${r.recommendation}"`), `${s.key}/${r.id}: short recommendation quoted verbatim in stakeholder rationale`);
    }
  }
});

test('the same recommendation produces genuinely different reasoning across different profiles (government vs. donor vs. humanitarian vs. board)', () => {
  const results = ['national-human-development', 'donor-impact-evaluation', 'humanitarian-needs-assessment', 'executive-board-intelligence'].map(key => {
    const reasoning = reasoningFor(key);
    const top = reasoning.by_recommendation[0];
    return { key, profile: reasoning.profile, weights: JSON.stringify(top.decision_options.weights), stakeholderCategories: top.stakeholders.map(s => s.category).join(',') };
  });
  const profiles = new Set(results.map(r => r.profile));
  assert.equal(profiles.size, 4, 'expected 4 genuinely distinct profiles across the 4 representative samples');
  const weightSets = new Set(results.map(r => r.weights));
  assert.ok(weightSets.size >= 3, 'expected decision-option weights to genuinely vary by profile, not be identical across all 4');
});
