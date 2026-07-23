// PX Release 5.1, Part 1: the Narrative Arc Engine classifies every real
// spread ID from composePublicationSpreads into spine/preview/appendix-tier
// — it renders nothing itself, so these tests check the table directly
// against the real, current 20-spread arc rather than a synthetic list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { arcContextFor, NARRATIVE_ARC_STAGES, SPINE_SPREAD_ORDER, FLAGSHIP_NARRATIVE_ARC_VERSION } from '../src/flagship-narrative-arc.js';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';

test('the module exports a version constant', () => {
  assert.equal(typeof FLAGSHIP_NARRATIVE_ARC_VERSION, 'string');
});

test('every real spread ID the composer actually produces is classified: spine, preview, or explicitly appendix-tier (null)', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  // Decision Reasoning Architecture: the 5 new reasoning spreads are
  // deliberately appendix-tier deep-dives on the existing North Star
  // recommendation, not a new spine stage — see publication-spread-
  // composer.js's own comment at the call site for why.
  const APPENDIX_TIER = new Set([
    'cover', 'inside-cover', 'methodology', 'evidence-annex', 'quality-gate',
    'decision-options-tradeoffs', 'decision-conditions', 'stakeholder-political-economy', 'behavioural-adoption-pathway', 'system-effects-map', 'decision-under-uncertainty',
    // Editorial Division Release: 4 new spreads, same appendix-tier
    // treatment as methodology/evidence-annex/quality-gate — no arcBridge,
    // no spine-stage classification.
    'executive-dashboard', 'ai-insights', 'oecd-dac', 'theory-of-change',
  ]);
  for (const spread of spreads) {
    const ctx = arcContextFor(spread.id);
    if (APPENDIX_TIER.has(spread.id)) {
      assert.equal(ctx, null, `${spread.id} is expected appendix-tier (null), got ${JSON.stringify(ctx)}`);
    } else {
      assert.ok(ctx, `${spread.id} must be classified as spine or preview, got null`);
      assert.ok(['spine', 'preview'].includes(ctx.category));
    }
  }
});

test('every spine stage has a real editorialRole and, except the first/last, real prior/next questions', () => {
  NARRATIVE_ARC_STAGES.forEach((entry, i) => {
    assert.ok(entry.editorialRole, `${entry.spreadId} missing editorialRole`);
    if (i > 0) assert.ok(entry.priorQuestion, `${entry.spreadId} missing priorQuestion`);
    if (i < NARRATIVE_ARC_STAGES.length - 1) assert.ok(entry.nextQuestion, `${entry.spreadId} missing nextQuestion`);
  });
  assert.equal(NARRATIVE_ARC_STAGES[0].priorQuestion, null, 'the first spine stage should have no prior question');
  assert.equal(NARRATIVE_ARC_STAGES[NARRATIVE_ARC_STAGES.length - 1].nextQuestion, null, 'the last spine stage should have no next question');
});

test('hero-insight is honestly tagged Interpretation/develops even though it physically renders before Context/Problem/Evidence', () => {
  // This is the deliberate resolution documented in the PX 5.1 plan: PX
  // Release 3's reading-depth ordering (executive layer first) is
  // preserved, not undone — the arc tag is logical, not physical-order.
  const ctx = arcContextFor('hero-insight');
  assert.equal(ctx.stage, 'Interpretation');
  assert.equal(ctx.editorialRole, 'develops');
});

test('executive-brief and key-messages are tagged as previews, not spine stages', () => {
  assert.equal(arcContextFor('executive-brief').category, 'preview');
  assert.equal(arcContextFor('key-messages').category, 'preview');
});

test('SPINE_SPREAD_ORDER matches NARRATIVE_ARC_STAGES exactly, in order', () => {
  assert.deepEqual(SPINE_SPREAD_ORDER, NARRATIVE_ARC_STAGES.map(e => e.spreadId));
});
