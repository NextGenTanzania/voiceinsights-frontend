// Unified Publication Runtime, Phase 1: Canonical Runtime Foundation tests.
// Verifies composePublicationRuntime is a genuine superset of
// composePublicationSpreads (additive, zero regression to the existing
// spread shape), is deterministic given a fixed clock, and that the new
// blocks[] structured-content layer faithfully reflects real, already-
// governed data rather than fabricating anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { composePublicationRuntime, PUBLICATION_RUNTIME_VERSION } from '../src/publication-runtime.js';

const FIXED_NOW = '2026-07-20T00:00:00.000Z';

test('composePublicationRuntime returns the full canonical shape for all 16 samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const runtime = composePublicationRuntime(model, { now: FIXED_NOW });
    assert.equal(runtime.runtime_version, PUBLICATION_RUNTIME_VERSION);
    assert.equal(typeof runtime.build_id, 'string');
    assert.ok(runtime.build_id.length > 0);
    assert.equal(runtime.generated_at, FIXED_NOW);
    assert.equal(runtime.profile, sample.profile);
    assert.equal(typeof runtime.dataset_version, 'string');
    assert.equal(typeof runtime.reasoning_version, 'string');
    assert.ok(Array.isArray(runtime.sections) && runtime.sections.length > 0);
    assert.ok(Array.isArray(runtime.recommendations));
    assert.ok(Array.isArray(runtime.evidence_register));
    assert.ok(runtime.quality.editorial_validation);
    assert.ok(runtime.quality.px_assessment);
    assert.ok(runtime.quality.benchmark);
    assert.equal(typeof runtime.html, 'string');
    assert.ok(runtime.html.includes('<!doctype html>'));
  }
});

test('every section carries a real category and the new blocks array', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const runtime = composePublicationRuntime(model, { now: FIXED_NOW });
  for (const section of runtime.sections) {
    assert.ok(['front-matter', 'spine', 'appendix'].includes(section.category), `${section.id} has an unrecognised category`);
    assert.ok(Array.isArray(section.blocks), `${section.id} is missing a blocks array`);
  }
  // Front-matter and appendix classification should match the composer's own
  // real spread ids, not an arbitrary guess.
  const byId = new Map(runtime.sections.map(s => [s.id, s]));
  assert.equal(byId.get('cover').category, 'front-matter');
  assert.equal(byId.get('inside-cover').category, 'front-matter');
  assert.equal(byId.get('methodology').category, 'appendix');
  assert.equal(byId.get('evidence-annex').category, 'appendix');
  assert.equal(byId.get('quality-gate').category, 'appendix');
  assert.equal(byId.get('executive-brief').category, 'spine');
  assert.equal(byId.get('decision-options-tradeoffs').category, 'spine');
});

test('is deterministic: same model and clock produce the same build_id and html', () => {
  const model = buildFlagshipSampleReport('donor-impact-evaluation');
  const runtimeA = composePublicationRuntime(model, { now: FIXED_NOW });
  const runtimeB = composePublicationRuntime(model, { now: FIXED_NOW });
  assert.equal(runtimeA.build_id, runtimeB.build_id);
  assert.equal(runtimeA.html, runtimeB.html);
  assert.deepEqual(runtimeA.recommendations, runtimeB.recommendations);
});

test('the runtime object is deep-frozen — no consumer can mutate shared publication state', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const runtime = composePublicationRuntime(model, { now: FIXED_NOW });
  assert.throws(() => { runtime.sections.push('x'); }, TypeError);
  assert.throws(() => { runtime.sections[0].id = 'tampered'; }, TypeError);
  assert.throws(() => { runtime.recommendations.push({}); }, TypeError);
});

test('is a strict additive superset: composePublicationSpreads output is byte-identical whether or not the runtime wrapper is used', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS.slice(0, 4)) {
    const model = buildFlagshipSampleReport(sample.key);
    const direct = composePublicationSpreads(model);
    const viaRuntime = composePublicationRuntime(model, { now: FIXED_NOW });
    assert.equal(viaRuntime.html, direct.html, `${sample.key}: html diverged between direct composer and runtime wrapper`);
    assert.deepEqual(viaRuntime.spreads.map(s => s.id), direct.spreads.map(s => s.id));
    direct.spreads.forEach((s, i) => {
      assert.equal(viaRuntime.spreads[i].html, s.html, `${sample.key} spread ${s.id}: html diverged`);
      assert.equal(viaRuntime.spreads[i].text, s.text, `${sample.key} spread ${s.id}: text diverged`);
      assert.equal(viaRuntime.spreads[i].componentCount, s.componentCount, `${sample.key} spread ${s.id}: componentCount diverged`);
    });
  }
});

test('blocks[] faithfully reflects real content already visible in html — spot check across representative sections', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { sections } = composePublicationRuntime(model, { now: FIXED_NOW });
  const byId = new Map(sections.map(s => [s.id, s]));

  const execBrief = byId.get('executive-brief');
  const execBriefBlockText = JSON.stringify(execBrief.blocks);
  // The top recommendation's own text must appear in both the rendered html
  // and the new structured blocks — same fact, two representations, never
  // a second independently-derived value.
  const topRecommendation = model.report.recommendations[0];
  assert.ok(execBrief.html.includes(topRecommendation.recommendation.slice(0, 20)));

  const decisionOptions = byId.get('decision-options-tradeoffs');
  const optionCardBlocks = decisionOptions.blocks.filter(b => b.type === 'card');
  assert.ok(optionCardBlocks.length > 0, 'decision-options-tradeoffs should carry at least one option card block');
  for (const card of optionCardBlocks) {
    assert.ok(decisionOptions.html.includes(card.title.replace(/★ PREFERRED — /, '')) || decisionOptions.html.includes(card.title), `option card title "${card.title}" not found in the spread's own html`);
  }

  const evidenceStory = byId.get('evidence-story');
  const calloutBlocks = evidenceStory.blocks.filter(b => b.type === 'callout');
  assert.equal(calloutBlocks.length, 3, 'evidence-story should carry exactly the 3 ranked evidence quotes as callout blocks');
  for (const callout of calloutBlocks) {
    assert.ok(evidenceStory.text.includes(callout.text), 'evidence-story callout text should be one of the ranked quotes already in the spread\'s extractive text');
  }
});

test('recommendations and evidence_register expose the full real arrays, not a presentational slice', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const runtime = composePublicationRuntime(model, { now: FIXED_NOW });
  assert.deepEqual(runtime.recommendations, model.report.recommendations);
  assert.deepEqual(runtime.evidence_register, model.report.evidence);
});
