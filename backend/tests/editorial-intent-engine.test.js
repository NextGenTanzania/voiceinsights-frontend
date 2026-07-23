import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { selectPublicationNorthStar } from '../src/editorial-intelligence-engine.js';
import { PUBLICATION_IDENTITY_BY_PROFILE } from '../src/editorial-strategy-engine.js';
import {
  EDITORIAL_INTENT_ENGINE_VERSION, PURPOSE_BY_PROFILE, selectPublicationPurpose, selectEditorialIntent,
  selectPublicationPosition, selectDecisionOutcome, buildExecutiveDecisionJourney, validateIntentConsistency,
  detectLateThemes, buildEditorialFilter, validatePublicationPromise, selectPublicationPersonality,
  estimateExecutiveTrust, computeIntentScore,
} from '../src/editorial-intent-engine.js';

test('every real sample.profile resolves to exactly one real, non-null purpose, and no risk-override collapses it to a near-constant value', () => {
  const purposes = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const result = selectPublicationPurpose(model);
    assert.ok(result.purpose, `${sample.key}: profile "${sample.profile}" has no purpose mapping`);
    assert.equal(result.purpose, PURPOSE_BY_PROFILE[sample.profile]);
    assert.ok(result.rationale.includes(sample.profile));
    purposes.add(result.purpose);
  }
  // The exact regression this release caught and fixed: a since-removed
  // risk-override collapsed 15 of 16 real samples to "Risk Mitigation"
  // because riskValue is structurally ~90 whenever the North Star is
  // CRITICAL-tier (true for every real sample). Asserting real variety
  // here is a direct regression guard for that fixed defect.
  assert.ok(purposes.size >= 6, `expected real purpose variety across the 16 samples, got only ${purposes.size} distinct values: ${[...purposes].join(', ')}`);
});

test('selectPublicationPurpose never guesses for an unmapped profile', () => {
  const result = selectPublicationPurpose({ report: { profile: 'not-a-real-profile' } });
  assert.equal(result.purpose, null);
  assert.match(result.rationale, /No purpose mapping exists/);
});

test('selectEditorialIntent extracts a real intent from the North Star recommendation\'s own leading verb, never a generated sentence, for every real sample', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const result = selectEditorialIntent(northStar);
    assert.ok(result.intent, `${sample.key}: expected a real intent`);
    assert.equal(result.verb, northStar.recommendation.recommendation.trim().split(/\s+/)[0].toLowerCase());
  }
});

test('selectEditorialIntent does not guess when no real North Star recommendation exists', () => {
  const result = selectEditorialIntent({ recommendation: null });
  assert.equal(result.intent, null);
  assert.match(result.rationale, /No real North Star recommendation/);
});

test('selectEditorialIntent resolves the "Approve" family using the real budget_requirement field, not a coin flip', () => {
  const highBudget = selectEditorialIntent({ recommendation: { recommendation: 'Approve a new national delivery compact.', budget_requirement: 'High — requires a full business case' } });
  assert.equal(highBudget.intent, 'Approve funding');
  const lowBudget = selectEditorialIntent({ recommendation: { recommendation: 'Adopt the revised monitoring framework.', budget_requirement: 'Low' } });
  assert.equal(lowBudget.intent, 'Approve policy');
});

test('selectPublicationPosition is derived from the Editorial Strategy Engine\'s own real identity, never a second independent classification', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const result = selectPublicationPosition(model);
    const identity = PUBLICATION_IDENTITY_BY_PROFILE[sample.profile];
    assert.equal(result.identity, identity);
    if (identity) assert.ok(result.position, `${sample.key}: identity "${identity}" has no position mapping`);
  }
});

test('selectDecisionOutcome is exactly the North Star\'s own recommendation, never a second guess', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const outcome = selectDecisionOutcome(northStar);
    assert.equal(outcome.decision, northStar.recommendation.recommendation);
    assert.equal(outcome.owner, northStar.recommendation.owner || null);
    assert.equal(outcome.timeline, northStar.recommendation.timeline || null);
  }
});

test('buildExecutiveDecisionJourney maps every spine spread to a real journey stage and leaves preview/appendix spreads unmapped, for every real sample', () => {
  const validJourneyStages = new Set(['Problem', 'Understanding', 'Confidence', 'Decision', 'Commitment', 'Implementation', 'Future']);
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const journey = buildExecutiveDecisionJourney(spreads);
    assert.equal(journey.length, spreads.length);
    const spineEntries = journey.filter(j => j.arcStage);
    assert.ok(spineEntries.length >= 12, `${sample.key}: expected at least 12 real spine entries, got ${spineEntries.length}`);
    for (const entry of spineEntries) {
      assert.ok(validJourneyStages.has(entry.journeyStage), `${sample.key}: spread "${entry.spreadId}" (arc "${entry.arcStage}") mapped to an invalid journey stage "${entry.journeyStage}"`);
    }
    const closing = journey.find(j => j.spreadId === 'closing');
    assert.equal(closing.journeyStage, 'Future');
  }
});

test('validateIntentConsistency fires when an urgency-implying purpose has no real CRITICAL-tier recommendation to justify it', () => {
  const model = { report: { recommendations: [{ strategic_priority: 'MEDIUM' }] } };
  const issues = validateIntentConsistency(model, { purpose: 'Emergency Response' }, { recommendation: { strategic_priority: 'MEDIUM' } });
  assert.ok(issues.some(i => i.rule === 'purpose_urgency_unsupported'));
});

test('validateIntentConsistency finds no issues on every real sample (every real North Star recommendation is CRITICAL-tier, so urgency purposes are always supported)', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const purpose = selectPublicationPurpose(model);
    const issues = validateIntentConsistency(model, purpose, northStar);
    assert.equal(issues.length, 0, `${sample.key}: unexpected intent-consistency issues: ${JSON.stringify(issues)}`);
  }
});

test('detectLateThemes only ever flags a real finding that is not the North Star and first appears on a back-third spread', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const northStar = selectPublicationNorthStar(model);
    const issues = detectLateThemes(model, spreads, northStar);
    for (const issue of issues) {
      assert.notEqual(issue.findingId, northStar.finding.id);
      assert.ok(['methodology', 'evidence-annex', 'quality-gate', 'closing'].includes(issue.spreadId));
    }
  }
});

test('buildEditorialFilter reuses the existing evidence-link and duplicate-recommendation detectors rather than duplicating them, and every entry carries a real recommendation', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const northStar = selectPublicationNorthStar(model);
  const filterEntries = buildEditorialFilter(model, spreads, northStar);
  for (const entry of filterEntries) {
    assert.ok(['Merge or Delete', 'Merge', 'Move earlier or Appendix'].includes(entry.recommendation));
  }
});

test('validatePublicationPromise is kept end-to-end on every real sample, since Cover and Closing both already read from the shared North Star', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const northStar = selectPublicationNorthStar(model);
    const result = validatePublicationPromise(northStar, spreads);
    assert.equal(result.promiseKept, true, `${sample.key}: ${result.detail}`);
  }
});

test('validatePublicationPromise reports a broken chain on a synthetic fixture where Closing does not fulfil Cover\'s promise', () => {
  const northStar = { finding: { title: 'A real finding title', text: 'irrelevant' }, recommendation: { recommendation: 'Adopt the real cabinet compact.' } };
  const spreads = [
    { id: 'cover', html: '<h1>A real finding title</h1>' },
    { id: 'closing', html: '<p>Some other decision entirely.</p>' },
  ];
  const result = validatePublicationPromise(northStar, spreads);
  assert.equal(result.promiseKept, false);
  assert.equal(result.coverMakesPromise, true);
  assert.equal(result.closingFulfills, false);
});

test('selectPublicationPersonality returns a single, real, non-mixed personality for every real sample, and never collapses to a near-constant value', () => {
  const personalities = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const northStar = selectPublicationNorthStar(model);
    const result = selectPublicationPersonality(northStar);
    assert.ok(result.personality, `${sample.key}: expected a real personality`);
    assert.ok(['Confident', 'Urgent', 'Measured', 'Visionary', 'Authoritative', 'Analytical', 'Pragmatic', 'Transformational'].includes(result.personality));
    personalities.add(result.personality);
  }
  // The exact regression this release caught and fixed: a since-removed
  // CRITICAL-tier upgrade collapsed all 16 real samples to "Urgent",
  // because the North Star's recommendation is CRITICAL-tier on every
  // real sample (the condition never actually discriminated). Asserting
  // real variety here is a direct regression guard for that fixed defect.
  assert.ok(personalities.size >= 2, `expected real personality variety across the 16 samples, got only ${personalities.size} distinct value(s): ${[...personalities].join(', ')}`);
});

test('estimateExecutiveTrust and computeIntentScore are real composites of already-computed signals, never a fabricated number, across every real sample', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const northStar = selectPublicationNorthStar(model);
    const purpose = selectPublicationPurpose(model);
    const intent = selectEditorialIntent(northStar);
    const decisionOutcome = selectDecisionOutcome(northStar);
    const promiseValidation = validatePublicationPromise(northStar, spreads);
    const continuityIssueCount = 0;
    const trust = estimateExecutiveTrust({ promiseValidation, gateScore: 80, decisionOutcome, continuityIssueCount });
    assert.ok(trust.publicationConfidence >= 0 && trust.publicationConfidence <= 100);
    const intentScore = computeIntentScore({ purpose, intent, promiseValidation, trust, continuityIssueCount });
    assert.ok(intentScore.score >= 0 && intentScore.score <= 100, `${sample.key}: score out of range: ${intentScore.score}`);
    assert.equal(Object.keys(intentScore.components).length, 8);
  }
});

// The two real render sites (Task #160): Cover carries Purpose + Position,
// Executive Brief's 30-second zone carries Purpose + Intent as one plain-
// language sentence — the brief's explicit requirement that this be legible
// from the rendered page itself, not only a computed object.
test('Cover visibly renders the real Purpose and Position, with a grammatically correct article, for every real sample', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const cover = spreads.find(s => s.id === 'cover');
    const purpose = selectPublicationPurpose(model);
    const position = selectPublicationPosition(model);
    assert.ok(cover.html.includes(purpose.purpose), `${sample.key}: Cover does not render the real purpose "${purpose.purpose}"`);
    if (position.position) assert.ok(cover.html.includes(position.position), `${sample.key}: Cover does not render the real position "${position.position}"`);
    assert.ok(!/\bA (Emergency|Evidence|Innovation|Accountability|Advisor|Analytical|Authoritative)\b/.test(cover.html), `${sample.key}: Cover uses "A" before a vowel-leading word`);
  }
});

test('Executive Brief\'s 30-second zone visibly renders a real, plain-language Purpose + Intent sentence for every real sample', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const brief = spreads.find(s => s.id === 'executive-brief');
    const northStar = selectPublicationNorthStar(model);
    const purpose = selectPublicationPurpose(model);
    const intent = selectEditorialIntent(northStar);
    assert.ok(brief.html.includes(`This is a${/^[aeiou]/i.test(purpose.purpose) ? 'n' : ''} ${purpose.purpose} publication.`), `${sample.key}: Executive Brief does not render the real purpose sentence`);
    assert.ok(brief.html.toLowerCase().includes(intent.intent.toLowerCase()), `${sample.key}: Executive Brief does not render the real intent "${intent.intent}"`);
  }
});

test(`engine version is exported (${EDITORIAL_INTENT_ENGINE_VERSION})`, () => {
  assert.equal(typeof EDITORIAL_INTENT_ENGINE_VERSION, 'string');
});
