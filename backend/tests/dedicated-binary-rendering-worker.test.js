import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRenderJob } from '../src/rendering-queue.js';
import { buildDocumentComposition } from '../src/document-composer.js';
import { renderPdfBinary, renderPptxBinary, processDedicatedBinaryRenderJob, V187_BINARY_RENDERER_VERSION } from '../src/dedicated-binary-renderer.js';
import { buildProductionRenderingPlan, runProductionBinaryRender } from '../src/production-rendering-infrastructure.js';
import { processRenderJob } from '../src/rendering-worker.js';
import { buildPdfFormat, buildPptxFormat } from '../src/multi-format-renderer.js';

const indexSource = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');

const model = {
  id: 'report_demo_v187',
  is_demo: true,
  demo_country: 'Tanzania',
  organization_id: 'demo_org_showcase',
  metadata: { report_id: 'report_demo_v187', template_id: 'agriculture_climate', template_name: 'Agriculture & Climate — Smallholder Productivity Report', sector: 'Agriculture & Climate', organization_name: 'VoiceInsights Demo Organization', campaign_name: 'Smallholder Productivity Pulse', generated_at: '2026-01-01T00:00:00Z', standards: ['SDG 2', 'Climate-smart agriculture'] },
  kpis: { total_responses: 1200, response_rate_pct: 94, regions_covered: 9 },
  demographics: { regions: [{ label: 'Morogoro', n: 260 }, { label: 'Mbeya', n: 210 }], gender: [{ label: 'Female', n: 620 }, { label: 'Male', n: 580 }], age: [{ label: '18-25', n: 240 }] },
  findings: { topics: [{ topic: 'input access', count: 190 }, { topic: 'market access', count: 170 }], sentiment: [{ label: 'positive', n: 700 }, { label: 'negative', n: 150 }], representative_quotes: [{ raw_text: 'Extension advice helped, but input prices and rainfall variability still reduce yields.', response_id: 'resp_1', consent_id: 'consent_1' }] },
  narrative: { executive_summary: 'Smallholder productivity is constrained by input access, rainfall variability, post-harvest loss and uneven extension coverage.', key_findings: ['Input access is the highest-ranked productivity constraint.', 'Rainfall variability is affecting planting decisions.', 'Market access gaps reduce farm-gate value.', 'Women farmers report lower access to extension services.', 'Post-harvest loss remains material.'], risks: ['Climate variability may reduce yield improvement.', 'Input price inflation may lower adoption.'], opportunities: ['Expand climate-smart extension services.', 'Strengthen aggregation and market linkages.'], conclusions: 'Leadership should prioritise input access, climate resilience and aggregation.' },
  recommendations: { immediate: ['Prioritise input access support for the next planting window.'], medium_term: ['Expand climate-smart agriculture extension coverage.'], long_term: ['Build aggregation systems to reduce post-harvest loss.'] },
  data_quality: { score: 97, avg_fraud_score: 0.01, flagged_response_count: 0 },
  report_quality_gate_v19: { status: 'passed', overall_score: 97 },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'What most limits smallholder productivity?', question_type: 'open_voice' }] },
};

function fakeR2() {
  const writes = [];
  return {
    writes,
    async put(key, value, options) { writes.push({ key, value, options }); return { key }; },
  };
}

test('modules import and Worker entry imports', async () => {
  await import('../src/dedicated-binary-renderer.js');
  const worker = await import('../src/application.js');
  assert.equal(typeof worker.default.fetch, 'function');
});

test('PDF renderer produces real PDF binary bytes, not preview text', async () => {
  const composition = buildDocumentComposition(model, 'pdf', { tenant_id: model.organization_id });
  const pdf = await renderPdfBinary(composition);
  assert.equal(pdf.binary_generated, true);
  assert.equal(pdf.content_type, 'application/pdf');
  assert.equal(new TextDecoder().decode(pdf.bytes.slice(0, 8)).startsWith('%PDF-1.'), true);
  assert.match(pdf.checksum, /^[a-f0-9]{64}$/);
  assert.ok(pdf.byte_length > 1000);
  assert.equal(pdf.quality.has_page_numbers, true);
});

test('PPTX renderer produces real OpenXML zip binary bytes, not outline text', async () => {
  const composition = buildDocumentComposition(model, 'pptx', { tenant_id: model.organization_id });
  const pptx = await renderPptxBinary(composition);
  assert.equal(pptx.binary_generated, true);
  assert.equal(pptx.content_type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(new TextDecoder().decode(pptx.bytes.slice(0, 2)), 'PK');
  assert.match(pptx.checksum, /^[a-f0-9]{64}$/);
  assert.ok(pptx.byte_length > 1500);
  assert.equal(pptx.quality.has_title_slide, true);
});

test('dedicated renderer consumes job, writes binary artifact to R2 and returns signed descriptor', async () => {
  const bucket = fakeR2();
  const job = createRenderJob({ reportId: model.id, tenantId: model.organization_id, format: 'pdf', requestedBy: 'qa' });
  const result = await processDedicatedBinaryRenderJob(job, model, { RENDERED_REPORTS_BUCKET: bucket }, { actor: 'test-binary-renderer' });
  assert.equal(result.released, true);
  assert.equal(result.job.status, 'completed');
  assert.equal(result.storage.stored, true);
  assert.equal(bucket.writes.length, 1);
  assert.equal(bucket.writes[0].options.httpMetadata.contentType, 'application/pdf');
  assert.match(result.storage.checksum, /^[a-f0-9]{64}$/);
  assert.ok(result.download_descriptor.object_key.endsWith('.pdf'));
  assert.equal(result.audit.event, 'render_completed');
});

test('rendering worker wrapper now uses v187 dedicated binary renderer', async () => {
  const bucket = fakeR2();
  const job = createRenderJob({ reportId: model.id, tenantId: model.organization_id, format: 'pptx', requestedBy: 'qa' });
  const result = await processRenderJob(job, model, { env: { RENDERED_REPORTS_BUCKET: bucket }, actor: 'test-worker' });
  assert.equal(result.released, true);
  assert.equal(result.job.status, 'completed');
  assert.equal(result.binary.content_type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(bucket.writes.length, 1);
  assert.equal(new TextDecoder().decode(bucket.writes[0].value.slice(0, 2)), 'PK');
});

test('production rendering plan no longer reports binary export as missing', () => {
  const plan = buildProductionRenderingPlan(model, 'pdf', { requestedBy: 'qa' });
  assert.equal(plan.production_readiness.binary_pdf_renderer_available, true);
  assert.equal(plan.production_readiness.binary_pptx_renderer_available, true);
  assert.equal(plan.production_readiness.full_production_export_blocker_removed, true);
  assert.equal(plan.production_readiness.dedicated_renderer_version, V187_BINARY_RENDERER_VERSION);
});

test('multi-format outputs advertise binary-ready export engines and no browser-print warning', () => {
  const pdf = buildPdfFormat(model);
  assert.equal(pdf.production_export.binary_pdf_generated, true);
  assert.equal(pdf.production_export.final_binary_mime_type, 'application/pdf');
  const pptx = buildPptxFormat(model);
  assert.equal(pptx.production_export.binary_pptx_generated, true);
  assert.equal(pptx.production_export.final_binary_mime_type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.doesNotMatch(JSON.stringify(pdf), /use browser print|browser print only|export preview/i);
});

test('public and private binary render routes exist and enforce demo or organization ownership', () => {
  assert.ok(indexSource.includes('/api\\/public\\/demo-reports') || indexSource.includes('/api/public/demo-reports'));
  assert.match(indexSource, /is_demo = 1 AND status = 'published'/);
  assert.match(indexSource, /processDedicatedBinaryRenderJob/);
  assert.ok(indexSource.includes('/api\\/reports') || indexSource.includes('/api/reports'));
  assert.match(indexSource, /organization_id = \?/);
  assert.doesNotMatch(indexSource, /browser print only|Use browser print for PDF output until/i);
});

test('runProductionBinaryRender exposes service adapter for external queue workers', async () => {
  const bucket = fakeR2();
  const job = createRenderJob({ reportId: model.id, tenantId: model.organization_id, format: 'pdf', requestedBy: 'qa' });
  const result = await runProductionBinaryRender(job, model, { RENDERED_REPORTS_BUCKET: bucket }, { actor: 'queue-worker' });
  assert.equal(result.released, true);
  assert.equal(result.storage.stored, true);
  assert.equal(bucket.writes.length, 1);
});
