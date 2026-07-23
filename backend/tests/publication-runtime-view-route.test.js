// Unified Publication Runtime, Phase 2: "View Publication equals Preview"
// verification. The new /view route must serve the exact same HTML the
// composePublicationRuntime object produces — the same function call the
// (rerouted) V2 preview path now uses — not a second, independently
// maintained summary view.
import test from 'node:test';
import assert from 'node:assert/strict';
import application from '../src/application.js';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationRuntime } from '../src/publication-runtime.js';

test('/view returns 200, real html, and the runtime version/build-id headers', async () => {
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/national-human-development/view'), {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.ok(response.headers.get('x-runtime-version'));
  assert.ok(response.headers.get('x-build-id'));
  const html = await response.text();
  assert.match(html, /<!doctype html>/);
});

test('/view serves the exact same HTML composePublicationRuntime produces for the same key', async () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const runtime = composePublicationRuntime(model);
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/national-human-development/view'), {});
  const html = await response.text();
  assert.equal(html, runtime.html);
});

test('/view shows the full Decision Reasoning Architecture — the exact content the old browser-side summary template never rendered', async () => {
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/national-human-development/view'), {});
  const html = await response.text();
  assert.match(html, /Decision Options.{0,10}Trade-offs/i);
  assert.match(html, /Stakeholder.{0,10}Political Economy Map/i);
  assert.match(html, /Behavioural Adoption Pathway/i);
  assert.match(html, /System Effects Map/i);
  assert.match(html, /Decision Under Uncertainty/i);
});

test('/view 404s for an unknown key', async () => {
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/not-a-real-key/view'), {});
  assert.equal(response.status, 404);
});

// "Preview equals View Publication" proven across every flagship
// publication in the live catalog (FLAGSHIP_SAMPLE_REPORTS), not just one
// representative sample. Since renderPublicationV2Preview (Preview/PDF) and
// the /view route both call composePublicationRuntime(model) and use its
// .html field directly (confirmed by direct read of
// publication-render-engine-v2.js and application.js — neither re-derives
// or re-templates it), byte-identical HTML at the source is the actual
// parity proof: it is not two independently-built views that happen to
// agree, it is structurally the same document string powering both
// surfaces, for every key in the catalog, including full spread ordering,
// reasoning, evidence, charts and disclosures (all embedded in that html).
test('/view and /export/html serve byte-identical, runtime-sourced HTML for every flagship publication in the catalog', async () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const runtime = composePublicationRuntime(model);
    assert.equal(runtime.sections.length, runtime.spreads.length, `${sample.key}: sections/spreads length mismatch`);
    assert.deepEqual(runtime.sections.map(s => s.id), runtime.spreads.map(s => s.id), `${sample.key}: section/spread id order mismatch`);

    const viewResponse = await application.fetch(new Request(`https://api.example/api/public/flagship-sample-library/${sample.key}/view`), {});
    assert.equal(viewResponse.status, 200, `${sample.key}: /view status`);
    const viewHtml = await viewResponse.text();
    assert.equal(viewHtml, runtime.html, `${sample.key}: /view html diverged from composePublicationRuntime`);

    const exportResponse = await application.fetch(new Request(`https://api.example/api/public/flagship-sample-library/${sample.key}/export/html`), {});
    assert.equal(exportResponse.status, 200, `${sample.key}: export/html status`);
    const exportHtml = await exportResponse.text();
    assert.equal(exportHtml, runtime.html, `${sample.key}: export/html diverged from composePublicationRuntime`);
  }
});
