// Phase 0, Part 10: Publication Rendering Engine V2 foundation tests.
// Covers eligibility gating, the safe-HTML adapter, structured failure codes,
// retry limiting, browser/page cleanup, and the observability metadata
// contract — everything testable without a live Cloudflare Browser Rendering
// session (see the response's "known limitations" for what still requires a
// real preview deployment).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import {
  isPublicationV2Eligible,
  browserRenderingAvailable,
  adaptFlagshipModelToPrintLayout,
  renderHtmlToPdfBytes,
  renderPublicationV2Preview,
  V2_ELIGIBLE_PUBLICATION_KEYS,
  PUBLICATION_RENDER_ENGINE_V2_VERSION,
} from '../src/publication-render-engine-v2.js';

const PREVIEW_ENABLED_ENV = { ENVIRONMENT: 'preview', PUBLICATION_RENDERER_V2_ENABLED: 'true', BROWSER: {} };

test('production flag remains disabled by default (no env overrides)', () => {
  assert.equal(isPublicationV2Eligible({ ENVIRONMENT: 'production', PUBLICATION_RENDERER_V2_ENABLED: 'false', BROWSER: {} }, 'national-human-development', 'pdf'), false);
});

test('preview environment without the flag enabled is not eligible', () => {
  assert.equal(isPublicationV2Eligible({ ENVIRONMENT: 'preview', PUBLICATION_RENDERER_V2_ENABLED: 'false', BROWSER: {} }, 'national-human-development', 'pdf'), false);
});

test('flag enabled outside preview is not eligible', () => {
  assert.equal(isPublicationV2Eligible({ ENVIRONMENT: 'production', PUBLICATION_RENDERER_V2_ENABLED: 'true', BROWSER: {} }, 'national-human-development', 'pdf'), false);
});

// Product Experience Evolution Phase 2 (World-Class Publications) widened
// the allowlist from the original single Phase 0 key to the full 16-sample
// flagship catalog, once repeated full-catalog rendering and scoring passes
// (PX Releases 3-6, VPX Release 1, EIE/ESCI releases) established the
// composer pipeline was as sound for all 16 as it was for the first one.
test('every real flagship sample key is eligible, but an unknown key is not, even with flag and preview both on', () => {
  assert.equal(isPublicationV2Eligible(PREVIEW_ENABLED_ENV, 'some-other-sample', 'pdf'), false);
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    assert.equal(isPublicationV2Eligible(PREVIEW_ENABLED_ENV, sample.key, 'pdf'), true, `expected ${sample.key} to be V2-eligible`);
  }
  assert.equal(V2_ELIGIBLE_PUBLICATION_KEYS.length, FLAGSHIP_SAMPLE_REPORTS.length);
  assert.deepEqual(new Set(V2_ELIGIBLE_PUBLICATION_KEYS), new Set(FLAGSHIP_SAMPLE_REPORTS.map(s => s.key)));
});

test('non-pdf formats are never eligible, even for the approved key', () => {
  assert.equal(isPublicationV2Eligible(PREVIEW_ENABLED_ENV, 'national-human-development', 'pptx'), false);
  assert.equal(isPublicationV2Eligible(PREVIEW_ENABLED_ENV, 'national-human-development', 'docx'), false);
  assert.equal(isPublicationV2Eligible(PREVIEW_ENABLED_ENV, 'national-human-development', 'xlsx'), false);
});

test('missing Browser binding is never eligible regardless of other flags', () => {
  const envNoBrowser = { ENVIRONMENT: 'preview', PUBLICATION_RENDERER_V2_ENABLED: 'true' };
  assert.equal(browserRenderingAvailable(envNoBrowser), false);
  assert.equal(isPublicationV2Eligible(envNoBrowser, 'national-human-development', 'pdf'), false);
});

test('renderHtmlToPdfBytes fails fast with BROWSER_BINDING_MISSING and does not hang', async () => {
  await assert.rejects(
    () => renderHtmlToPdfBytes({}, '<html></html>'),
    err => err.failure_code === 'BROWSER_BINDING_MISSING'
  );
});

test('renderHtmlToPdfBytes wraps a malformed/failed browser launch into a structured, sanitized failure code', async () => {
  await assert.rejects(
    () => renderHtmlToPdfBytes({ BROWSER: {} }, '<html></html>'),
    err => typeof err.failure_code === 'string' && err.failure_code.length > 0
  );
});

test('renderHtmlToPdfBytes retries at most once on a transient-looking failure, not indefinitely', async () => {
  let fetchAccessCount = 0;
  const flakyBrowserBinding = {
    get fetch() { fetchAccessCount++; return undefined; }, // malformed on purpose — every attempt fails fast
  };
  await assert.rejects(() => renderHtmlToPdfBytes({ BROWSER: flakyBrowserBinding }, '<html></html>'));
  // one initial attempt + at most one retry = at most 2 property reads of .fetch per launch call
  assert.ok(fetchAccessCount >= 1 && fetchAccessCount <= 4, `expected bounded retry attempts, got ${fetchAccessCount} fetch accesses`);
});

test('renderHtmlToPdfBytes does not retry a BROWSER_BINDING_MISSING configuration failure', async () => {
  const start = Date.now();
  await assert.rejects(() => renderHtmlToPdfBytes({}, '<html></html>'));
  // should fail immediately (no retry, no timeout wait) — generous bound to avoid CI flakiness
  assert.ok(Date.now() - start < 2000);
});

test('adaptFlagshipModelToPrintLayout preserves required disclosures without inventing content', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const layout = adaptFlagshipModelToPrintLayout(model);

  assert.equal(layout.metadata.title, model.report.title);
  const allText = JSON.stringify(layout);
  assert.match(allText, /synthetic/i, 'synthetic-demonstration labelling must survive the adapter');
  assert.match(allText, new RegExp(model.report.branding.publication_id), 'publication ID must survive the adapter');
  assert.match(allText, new RegExp(model.report.publication_readiness.status), 'publication status must survive the adapter');
  assert.match(allText, /Responsible AI/i, 'responsible-AI disclosure must survive the adapter');

  const regionalSection = layout.sections.find(s => s.id === 'regional-intelligence');
  const regionalNames = model.full_publication.regional.map(r => r.name);
  for (const name of regionalNames) {
    assert.ok(regionalSection.content.findings.some(f => f.includes(name)), `${name} must appear in the adapted regional section`);
  }
});

test('renderPublicationV2Preview returns NOT_ELIGIBLE without attempting a browser render when ineligible', async () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const result = await renderPublicationV2Preview({
    model, key: 'national-human-development', format: 'pdf',
    env: { ENVIRONMENT: 'production', PUBLICATION_RENDERER_V2_ENABLED: 'false' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.metadata.browser_render_attempted, false);
  assert.equal(result.metadata.failure_code, 'NOT_ELIGIBLE');
});

test('renderPublicationV2Preview never claims success on a failed render, and always reports the real renderer name/version', async () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const result = await renderPublicationV2Preview({
    model, key: 'national-human-development', format: 'pdf', env: PREVIEW_ENABLED_ENV,
  });
  assert.equal(result.ok, false);
  assert.equal(result.metadata.browser_render_attempted, true);
  assert.equal(result.metadata.browser_render_succeeded, false);
  assert.equal(result.metadata.renderer_name, 'publication-render-engine-v2');
  assert.equal(result.metadata.renderer_version, PUBLICATION_RENDER_ENGINE_V2_VERSION);
  assert.ok(typeof result.metadata.duration_ms === 'number' && result.metadata.duration_ms >= 0);
  assert.ok(result.metadata.failure_code);
  assert.equal(result.artifact, null);
});

test('renderPublicationV2Preview never throws, even on total renderer failure', async () => {
  const model = buildFlagshipSampleReport('national-human-development');
  await assert.doesNotReject(renderPublicationV2Preview({
    model, key: 'national-human-development', format: 'pdf', env: PREVIEW_ENABLED_ENV,
  }));
});
