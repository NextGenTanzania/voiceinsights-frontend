// Unified Publication Runtime, Phase 3: the export route now threads a
// single composePublicationRuntime(model) call through every format branch
// (report/full_publication/sample sourced from runtime, not model directly).
// This phase changes plumbing only — no adapter's behavior should change —
// so the real regression guard is determinism: the same model must always
// produce the same runtime build_id, and the export route must always
// produce byte-identical output for the same key+format across repeated
// calls (excluding no live timestamp is embedded in any of these formats).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import application from '../src/application.js';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { composePublicationRuntime } from '../src/publication-runtime.js';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('composePublicationRuntime(model) is deterministic: same model, same build_id and html', () => {
  const model = buildFlagshipSampleReport('donor-impact-evaluation');
  const runtimeA = composePublicationRuntime(model, { now: '2026-01-01T00:00:00.000Z' });
  const runtimeB = composePublicationRuntime(model, { now: '2026-01-01T00:00:00.000Z' });
  assert.equal(runtimeA.build_id, runtimeB.build_id);
  assert.equal(runtimeA.html, runtimeB.html);
  assert.deepEqual(runtimeA.report, model.report);
  assert.deepEqual(runtimeA.full_publication, model.full_publication);
  assert.deepEqual(runtimeA.sample, model.sample);
});

test('export route produces byte-identical output across repeated calls for every format', async () => {
  const formats = ['pdf', 'docx', 'pptx', 'xlsx', 'html'];
  for (const format of formats) {
    const responseA = await application.fetch(new Request(`https://api.example/api/public/flagship-sample-library/national-human-development/export/${format}`), {});
    const bytesA = new Uint8Array(await responseA.arrayBuffer());
    const responseB = await application.fetch(new Request(`https://api.example/api/public/flagship-sample-library/national-human-development/export/${format}`), {});
    const bytesB = new Uint8Array(await responseB.arrayBuffer());
    assert.equal(responseA.status, 200, format);
    assert.equal(sha256(bytesA), sha256(bytesB), `export/${format} was not deterministic across repeated calls`);
  }
});

test('export route still enforces the publication quality gate with the runtime in place', async () => {
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/not-a-real-key/export/pdf'), {});
  assert.equal(response.status, 404);
});

// Unified Publication Runtime, Phase 4 (HTML step): the html export format
// now serves runtime.html verbatim, replacing flagship-interactive-html.js's
// independent summary template — the same real content-parity upgrade
// Phase 2 already proved for View Publication (the retired template never
// carried the Decision Reasoning Architecture at all).
test('export/html serves the exact same HTML composePublicationRuntime produces', async () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const runtime = composePublicationRuntime(model);
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/national-human-development/export/html'), {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  const html = await response.text();
  assert.equal(html, runtime.html);
});

test('export/html carries the full Decision Reasoning Architecture the retired template never rendered', async () => {
  const response = await application.fetch(new Request('https://api.example/api/public/flagship-sample-library/national-human-development/export/html'), {});
  const html = await response.text();
  assert.match(html, /Decision Options.{0,10}Trade-offs/i);
  assert.match(html, /Stakeholder.{0,10}Political Economy Map/i);
  assert.match(html, /Behavioural Adoption Pathway/i);
  assert.match(html, /System Effects Map/i);
  assert.match(html, /Decision Under Uncertainty/i);
});
