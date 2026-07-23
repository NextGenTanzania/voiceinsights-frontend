import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { buildArtDirectionPlans, LAYOUT_FAMILIES, TYPOGRAPHY_ROLES, EDITORIAL_ART_DIRECTION_ENGINE_VERSION } from '../src/editorial-art-direction-engine.js';

test('all 20 real spreads receive a valid art-direction plan, across every real flagship sample', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    assert.equal(spreads.length, 30, `${sample.key}: expected 30 real composed spreads (26 PX Release 3 + 4 Editorial Division Release spreads: executive-dashboard, ai-insights, oecd-dac, theory-of-change)`);
    const plans = buildArtDirectionPlans(model, spreads);
    assert.equal(plans.size, 30, `${sample.key}: expected a plan for every real spread`);
    for (const spread of spreads) {
      const plan = plans.get(spread.id);
      assert.ok(plan, `${sample.key}: missing a plan for ${spread.id}`);
      for (const field of [
        'spreadId', 'spreadType', 'editorialPurpose', 'primaryReaderQuestion', 'primaryMessage', 'readerMode',
        'attentionAnchor', 'layoutFamily', 'dominantVisualType', 'secondaryVisualTypes', 'hierarchyStrategy',
        'typographyMode', 'whitespaceMode', 'visualDensity', 'textDensity', 'evidenceEmphasis', 'decisionEmphasis',
        'geographicMode', 'imagePolicy', 'permittedComponents', 'prohibitedPatterns', 'repetitionRisk',
        'accessibilityNotes', 'rationale',
      ]) {
        assert.ok(field in plan, `${sample.key}: ${spread.id}'s plan is missing required field "${field}"`);
      }
    }
  }
});

test('the same input produces byte-identical art-direction plans (determinism, no Math.random/Date.now anywhere in the engine)', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const plansA = buildArtDirectionPlans(model, spreads);
  const plansB = buildArtDirectionPlans(model, spreads);
  assert.equal(JSON.stringify([...plansA.values()]), JSON.stringify([...plansB.values()]));
});

// No flat hash rotation, no index-only assignment: layoutFamily is a real,
// static, role-based mapping — the SAME spread ID must always resolve to
// the SAME layout family regardless of which of the 16 real samples (and
// therefore which real content/hash seed) produced it.
test('layoutFamily is a real role-based mapping, never a hash rotation — the same spread ID always resolves to the same family across all 16 samples', () => {
  const familyBySpreadId = new Map();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { spreads } = composePublicationSpreads(model);
    const plans = buildArtDirectionPlans(model, spreads);
    for (const [id, plan] of plans) {
      if (familyBySpreadId.has(id)) {
        assert.equal(plan.layoutFamily, familyBySpreadId.get(id), `${sample.key}: ${id}'s layoutFamily varied across samples — that would mean it is index/hash-driven, not role-driven`);
      } else {
        familyBySpreadId.set(id, plan.layoutFamily);
      }
    }
  }
  assert.equal(new Set(familyBySpreadId.values()).size, LAYOUT_FAMILIES.length, 'expected all 19 required layout families to be in real use');
});

test('all 19 required layout families exist and every one is genuinely used across the real 20-spread arc', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const plans = [...buildArtDirectionPlans(model, spreads).values()];
  assert.equal(LAYOUT_FAMILIES.length, 19);
  const used = new Set(plans.map(p => p.layoutFamily));
  for (const family of LAYOUT_FAMILIES) {
    assert.ok(used.has(family), `layout family "${family}" is declared but never assigned to a real spread`);
  }
});

test('all 16 semantic typography roles are declared, and every role actually assigned to a spread is one of the 16', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const plans = [...buildArtDirectionPlans(model, spreads).values()];
  assert.equal(TYPOGRAPHY_ROLES.length, 16);
  for (const plan of plans) {
    assert.ok(TYPOGRAPHY_ROLES.includes(plan.typographyMode), `${plan.spreadId}: typographyMode "${plan.typographyMode}" is not one of the declared 16 roles`);
  }
});

// Content-grounded, not decorative: dominantVisualType/attentionAnchor/
// primaryMessage must be read from the spread's own real, final content
// (spread.components / spread.text), not a fixed per-spread string — this
// is testable by confirming a real sample with different underlying
// content (a different hero finding, different components present) yields
// a genuinely different attentionAnchor/dominantVisualType, not the same
// value repeated regardless of input.
test('attentionAnchor and dominantVisualType are derived from real, sample-specific content, not a fixed per-spread string', () => {
  const modelA = buildFlagshipSampleReport('national-human-development');
  const modelB = buildFlagshipSampleReport('humanitarian-needs-assessment');
  const plansA = buildArtDirectionPlans(modelA, composePublicationSpreads(modelA).spreads);
  const plansB = buildArtDirectionPlans(modelB, composePublicationSpreads(modelB).spreads);
  assert.notEqual(plansA.get('hero-insight').attentionAnchor, plansB.get('hero-insight').attentionAnchor, 'hero-insight attentionAnchor must reflect each sample\'s own real hero finding');
  assert.notEqual(plansA.get('cover').primaryMessage, plansB.get('cover').primaryMessage, 'cover primaryMessage must reflect each sample\'s own real title/content');
});

test(`engine version is exported (${EDITORIAL_ART_DIRECTION_ENGINE_VERSION})`, () => {
  assert.equal(typeof EDITORIAL_ART_DIRECTION_ENGINE_VERSION, 'string');
  assert.ok(EDITORIAL_ART_DIRECTION_ENGINE_VERSION.length > 0);
});

test('repetitionRisk is genuinely comparative — the first plan is always "low", and a plan sharing its predecessor\'s layoutFamily is flagged "high"', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const plans = [...buildArtDirectionPlans(model, spreads).values()];
  assert.equal(plans[0].repetitionRisk, 'low', 'the first real spread has no predecessor to repeat');
  for (let i = 1; i < plans.length; i++) {
    if (plans[i].layoutFamily === plans[i - 1].layoutFamily) {
      assert.equal(plans[i].repetitionRisk, 'high', `${plans[i].spreadId}: shares its predecessor's layoutFamily but was not flagged high`);
    }
  }
});

// Decision Canvas A/B: the engine's own static subLayout assignment must be
// real and distinct — checked here at the engine level (publication-
// rhythm-validator.test.js checks the same requirement at the rendered-
// output level).
test('decisions-a and decisions-b carry two different, real, non-null subLayout values', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads } = composePublicationSpreads(model);
  const plans = buildArtDirectionPlans(model, spreads);
  const a = plans.get('decisions-a'), b = plans.get('decisions-b');
  assert.ok(a.subLayout, 'decisions-a must carry a real subLayout');
  assert.ok(b.subLayout, 'decisions-b must carry a real subLayout');
  assert.notEqual(a.subLayout, b.subLayout, 'decisions-a and decisions-b must use visibly different sub-layouts');
});
