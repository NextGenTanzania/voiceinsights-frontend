// Publication Experience (PX) Release 4: VoiceInsights Publication DNA tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { composePublicationSpreads, buildTypographyCss } from '../src/publication-spread-composer.js';
import { PUBLICATION_DNA_CHECKLIST_VERSION, checkPublicationDNA } from '../src/publication-dna-checklist.js';

test('the module exports a version constant', () => {
  assert.equal(PUBLICATION_DNA_CHECKLIST_VERSION, 'publication-dna-checklist-v1');
});

test('checkPublicationDNA never throws on empty inputs and reports every check absent', () => {
  const result = checkPublicationDNA([], '', {});
  assert.equal(result.score, 0);
  assert.ok(result.checks.every(c => c.present === false));
});

test('checkPublicationDNA detects the real Voice Thread mark, brand tokens, citation, tagline and classification disclosure', () => {
  const spreads = [
    { id: 'cover', html: '<p>CLASSIFICATION: Public. Synthetic demonstration.</p>' },
    { id: 'inside-cover', html: '<h4>Citation</h4>' },
    { id: 'hero-insight', html: '<span class="voice-thread"></span> Every Voice. Every Language.' },
  ];
  const cssText = '--vpds-gold500:#D9A441; --vpds-blue700:#124C8C; --vpds-teal700:#007C7A;';
  const result = checkPublicationDNA(spreads, cssText, {});
  const byKey = Object.fromEntries(result.checks.map(c => [c.key, c.present]));
  assert.equal(byKey.voice_thread_mark_present, true);
  assert.equal(byKey.brand_color_tokens_present, true);
  assert.equal(byKey.citation_format_present, true);
  assert.equal(byKey.tagline_present, true);
  assert.equal(byKey.classification_disclosure_present, true);
  assert.equal(result.score, 100);
});

test('checkPublicationDNA against the real flagship publication finds every real brand element already present', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const { spreads, metadata } = composePublicationSpreads(model);
  const result = checkPublicationDNA(spreads, buildTypographyCss(), metadata);
  assert.equal(result.score, 100, JSON.stringify(result.checks.filter(c => !c.present)));
});

test('checkPublicationDNA is deterministic', () => {
  const spreads = [{ id: 'cover', html: '<p>x</p>' }];
  assert.deepEqual(checkPublicationDNA(spreads, '', {}), checkPublicationDNA(spreads, '', {}));
});
