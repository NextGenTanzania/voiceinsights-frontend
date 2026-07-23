// Sector Intelligence Platform: flagship-publication-design-system.js
// previously had no dedicated test file at all (confirmed by grep before
// this migration). coverVariant()'s `composition` field was the narrowest,
// completely untested collision surface in the whole design system — a
// 4-value hash bucket that would start producing visible cover/layout
// collisions once the catalog grew past ~16-20 samples. Widened to 8+
// values as part of this release; this test pins that widening so it can't
// silently shrink back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverVariant } from '../src/flagship-publication-design-system.js';
import { FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';

test('coverVariant() composition pool has at least 8 distinct values', () => {
  const seen = new Set();
  // Probe with enough distinct synthetic keys to sample the pool broadly —
  // not asserting on the real catalog here (that's covered by the
  // catalog-wide anti-repetition test), just the pool's own size.
  for (let i = 0; i < 200; i++) seen.add(coverVariant(`probe-key-${i}`, 'research').composition);
  assert.ok(seen.size >= 8, `expected at least 8 distinct compositions, saw ${seen.size}`);
});

test('every real flagship sample gets a real theme, brand and composition value', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const variant = coverVariant(sample.key, sample.profile);
    assert.ok(variant.theme, `${sample.key}: missing theme`);
    assert.ok(variant.brand, `${sample.key}: missing brand`);
    assert.ok(typeof variant.composition === 'string' && variant.composition.length, `${sample.key}: missing composition`);
    assert.ok(Number.isInteger(variant.variant) && variant.variant >= 1 && variant.variant <= 16, `${sample.key}: variant out of range`);
  }
});
