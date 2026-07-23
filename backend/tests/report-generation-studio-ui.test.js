import test from 'node:test';
import assert from 'node:assert/strict';

// NOTE (Part 13 honesty requirement): this project has no headless-browser
// test dependency (no puppeteer/playwright in either package.json — see the
// prior platform audit). These tests exercise the REAL pure logic module
// (site/assets/js/report-generation-studio.js) under Node — payload
// construction and response-state classification/rendering — but this is
// static JS execution, NOT a rendered-DOM or real-browser test. Actual
// interactive/visual verification was performed separately with the
// Claude_Browser tool against a locally served copy of the page (see the
// release notes' "manual verification" section for exactly what was
// checked there).
const mod = (await import('../../site/assets/js/report-generation-studio.js')).default;
const { buildGenerateRequestPayload, classifyResult, renderResultHtml, escapeHtml } = mod;

// ---------------------------------------------------------------
// Part 10 #2-4 — request payload construction
// ---------------------------------------------------------------
test('organization scope request is formed correctly (no campaign_id)', () => {
  const body = buildGenerateRequestPayload({ templateId: 'tmpl_1', scopeType: 'ORGANIZATION', campaignId: null });
  assert.deepEqual(body, { template_id: 'tmpl_1' });
});

test('campaign scope request is formed correctly', () => {
  const body = buildGenerateRequestPayload({ templateId: 'tmpl_1', scopeType: 'CAMPAIGN', campaignId: 'camp_1' });
  assert.deepEqual(body, { template_id: 'tmpl_1', campaign_id: 'camp_1' });
});

test('campaign is required for CAMPAIGN scope', () => {
  assert.throws(() => buildGenerateRequestPayload({ templateId: 'tmpl_1', scopeType: 'CAMPAIGN', campaignId: null }), /campaignId is required/);
});

test('template is always required', () => {
  assert.throws(() => buildGenerateRequestPayload({ templateId: null, scopeType: 'ORGANIZATION' }), /templateId is required/);
});

// ---------------------------------------------------------------
// Part 10 #8-16 — canonical response classification and score display
// ---------------------------------------------------------------
test('NOT_EVALUATED classifies correctly and the rendered HTML shows no numeric score', () => {
  const body = { ok: true, report_id: 'report_1', publication_evaluation: { score_state: 'NOT_EVALUATED', publication_status: 'BLOCKED', overall_score: null, scope_type: 'ORGANIZATION', dataset_version: 'abc123' } };
  const c = classifyResult({ httpStatus: 200, body });
  assert.equal(c.state, 'not_evaluated');
  const html = renderResultHtml(c);
  assert.doesNotMatch(html, /gr-score/);
  assert.doesNotMatch(html, /\bnull\b/);
  assert.doesNotMatch(html, /\bundefined\b/);
  assert.doesNotMatch(html, /\bNaN\b/);
  assert.match(html, /not enough eligible data/);
});

test('PROVISIONAL is labelled provisional and may show a numeric score', () => {
  const body = { ok: true, report_id: 'report_1', publication_evaluation: { score_state: 'PROVISIONAL', publication_status: 'REVIEW_REQUIRED', overall_score: 74, scope_type: 'CAMPAIGN', dataset_version: 'abc123' } };
  const c = classifyResult({ httpStatus: 200, body });
  assert.equal(c.state, 'provisional');
  const html = renderResultHtml(c);
  assert.match(html, /Provisional quality assessment/);
  assert.match(html, /74\/100/);
});

test('INVALIDATED (HTTP 409) displays no numeric score and no technical detail', () => {
  const c = classifyResult({ httpStatus: 409, body: { error: 'This report could not be evaluated due to a data integrity issue. The event has been recorded.' } });
  assert.equal(c.state, 'invalidated');
  const html = renderResultHtml(c);
  assert.doesNotMatch(html, /\d+\/100/);
  assert.match(html, /Quality assessment unavailable/);
  assert.doesNotMatch(html, /CROSS_TENANT|organization_id|stack|Error:/i, 'must not leak internal technical detail');
});

test('a BLOCKED draft (generation succeeded, publication blocked) is visually distinguished from a failed generation and from an invalidated block', () => {
  const blockedDraft = classifyResult({ httpStatus: 200, body: { ok: true, report_id: 'r1', publication_evaluation: { score_state: 'VALID', publication_status: 'BLOCKED', overall_score: 13, scope_type: 'ORGANIZATION', dataset_version: 'x' } } });
  const failedGeneration = classifyResult({ httpStatus: 400, body: { error: 'template_id is required' } });
  const invalidated = classifyResult({ httpStatus: 409, body: { error: 'integrity issue' } });
  assert.equal(blockedDraft.state, 'blocked_draft');
  assert.equal(failedGeneration.state, 'generation_failed');
  assert.equal(invalidated.state, 'invalidated');
  assert.notEqual(blockedDraft.state, failedGeneration.state);
  assert.notEqual(blockedDraft.state, invalidated.state);
  const htmlA = renderResultHtml(blockedDraft), htmlB = renderResultHtml(failedGeneration), htmlC = renderResultHtml(invalidated);
  assert.notEqual(htmlA.match(/gr-result--(\w+)/)[1], htmlB.match(/gr-result--(\w+)/)[1]);
  assert.notEqual(htmlA.match(/gr-result--(\w+)/)[1], htmlC.match(/gr-result--(\w+)/)[1]);
});

test('persistence warning is displayed distinctly and does not claim the draft is approved', () => {
  const c = classifyResult({ httpStatus: 200, body: { ok: true, report_id: 'r1', publication_evaluation_warning: 'Canonical evaluation completed but could not be persisted; this report was still generated successfully.', publication_evaluation: { score_state: 'VALID', publication_status: 'PUBLICATION_READY', overall_score: 96, scope_type: 'ORGANIZATION', dataset_version: 'x', evaluation_id: null } } });
  assert.equal(c.state, 'persistence_warning');
  const html = renderResultHtml(c);
  assert.match(html, /Do not treat this draft as approved/);
});

test('a safe scope-not-found error never echoes cross-tenant technical detail', () => {
  const c = classifyResult({ httpStatus: 404, body: { error: 'Report scope was not found or is not available.' } });
  const html = renderResultHtml(c);
  assert.match(html, /Report scope was not found or is not available\./);
  assert.doesNotMatch(html, /organization|tenant|campaign_id|org_/i);
});

test('canonical object is preferred over legacy fields when both are present', () => {
  // If publication_evaluation exists, classification must key off it, never
  // off legacy rating_10/status/export_allowed sitting alongside it.
  const body = { ok: true, report_id: 'r1', rating_10: 9.9, status: 'PUBLICATION_READY', export_allowed: true, publication_evaluation: { score_state: 'NOT_EVALUATED', publication_status: 'BLOCKED', overall_score: null, scope_type: 'ORGANIZATION', dataset_version: 'x' } };
  const c = classifyResult({ httpStatus: 200, body });
  assert.equal(c.state, 'not_evaluated', 'must follow the canonical object, not the legacy fields that (in this constructed example) disagree with it');
});

test('a missing canonical object (flag disabled) never creates a readiness badge', () => {
  const c = classifyResult({ httpStatus: 200, body: { ok: true, report_id: 'r1', document_model: {} } });
  assert.equal(c.state, 'generated_no_canonical');
  const html = renderResultHtml(c);
  assert.doesNotMatch(html, /publication-ready|PUBLICATION_READY/i);
  assert.doesNotMatch(html, /world-class|enterprise ready|international standard/i);
});

test('escapeHtml prevents a blocking-failure string (or any field) from injecting markup', () => {
  const c = classifyResult({ httpStatus: 200, body: { ok: true, report_id: 'r1', publication_evaluation: { score_state: 'VALID', publication_status: 'BLOCKED', overall_score: 10, scope_type: 'ORGANIZATION', dataset_version: 'x', blocking_failures: ['<img src=x onerror=alert(1)>'] } } });
  const html = renderResultHtml(c);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

// ---------------------------------------------------------------
// Part 13 #17-18 — this module never references synthetic-sample or export
// endpoints (static source check, since this module makes no fetch calls
// at all — it is pure logic, wiring lives in the HTML page).
// ---------------------------------------------------------------
test('the pure logic module contains no reference to synthetic-sample or export endpoints', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../site/assets/js/report-generation-studio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /flagship-sample-library|flagship-publication-quality-gate/);
  assert.doesNotMatch(src, /\/export\//);
  assert.doesNotMatch(src, /fetch\(/, 'this module must stay pure — no network calls of its own');
});
