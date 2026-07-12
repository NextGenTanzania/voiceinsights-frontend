import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRenderJob, transitionRenderJob, shouldRetryRenderJob, buildQueueRecoveryPlan, buildRenderingQueueMetrics } from '../src/rendering-queue.js';
import { buildDocumentComposition, buildRenderObjectKey } from '../src/document-composer.js';
import { processRenderJob, buildRendererDeploymentTopology } from '../src/rendering-worker.js';
import { validateRenderedDocument } from '../src/rendering-quality-validator.js';
import { buildSignedDownloadDescriptor, validateDownloadAuthorization } from '../src/download-infrastructure.js';
import { buildRenderingHealth } from '../src/rendering-monitoring.js';
import { buildProductionRenderingPlan } from '../src/production-rendering-infrastructure.js';
import { buildPdfFormat, buildPptxFormat, buildExecutiveSummaryFormat } from '../src/multi-format-renderer.js';

const indexSource = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');

const model = {
  id: 'report_demo_v186',
  is_demo: true,
  demo_country: 'Tanzania',
  organization_id: 'demo_org_showcase',
  metadata: { report_id: 'report_demo_v186', template_id: 'health_survey', template_name: 'Health Systems Intelligence Report', sector: 'Health Systems', organization_name: 'VoiceInsights Demo Organization', campaign_name: 'Health Access Pulse', generated_at: '2026-01-01T00:00:00Z', standards: ['WHO', 'SDG 3'] },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 8 },
  demographics: { regions: [{ label: 'Dar es Salaam', n: 200 }, { label: 'Mwanza', n: 160 }], gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }], age: [{ label: '18-25', n: 220 }] },
  findings: { topics: [{ topic: 'access to care', count: 80 }], sentiment: [{ label: 'positive', n: 650 }, { label: 'negative', n: 120 }], representative_quotes: [{ raw_text: 'The clinic is closer now but medicine availability still changes.', response_id: 'resp_1', consent_id: 'consent_1' }] },
  narrative: { executive_summary: 'Service readiness is improving, but medicine availability and referral continuity remain priority constraints.', key_findings: ['Medicine availability is the top health systems constraint.', 'Referral continuity is inconsistent across regions.', 'Community health worker contact improves access to care.', 'Women report stronger barriers in remote areas.', 'Facility readiness varies by region.'], risks: ['Medicine stock-outs may reduce trust.', 'Referral delays may worsen continuity of care.'], opportunities: ['Strengthen community health worker follow-up.', 'Improve facility readiness monitoring.'], conclusions: 'Leadership should prioritise medicine availability and referral continuity.' },
  recommendations: { immediate: ['Prioritise medicine availability monitoring in lower-performing facilities.'], medium_term: ['Strengthen referral feedback loops between facilities and community health workers.'], long_term: ['Institutionalise facility readiness dashboards.'] },
  data_quality: { score: 96, avg_fraud_score: 0.01, flagged_response_count: 0 },
  report_quality_gate_v19: { status: 'passed', overall_score: 96 },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'What limits access to care?', question_type: 'open_voice' }] },
};

test('v186 rendering infrastructure modules import and Worker entry still imports', async () => {
  for (const module of ['../src/rendering-queue.js','../src/document-composer.js','../src/rendering-worker.js','../src/rendering-quality-validator.js','../src/download-infrastructure.js','../src/rendering-monitoring.js','../src/production-rendering-infrastructure.js']) {
    await import(module);
  }
  const worker = await import('../src/application.js');
  assert.equal(typeof worker.default.fetch, 'function');
});

test('rendering queue supports lifecycle, duplicate prevention key, retry and metrics', () => {
  const job = createRenderJob({ reportId: 'report_demo_v186', tenantId: 'org_demo', format: 'pdf', requestedBy: 'qa', priority: 1 });
  assert.equal(job.status, 'pending');
  assert.equal(job.renderer_type, 'pdf');
  assert.match(job.idempotency_key, /org_demo:report_demo_v186:pdf/);
  const processing = transitionRenderJob(job, 'processing');
  assert.equal(processing.attempts, 1);
  const failed = transitionRenderJob(processing, 'failed', { error: 'temporary renderer error' });
  assert.equal(shouldRetryRenderJob(failed), true);
  const metrics = buildRenderingQueueMetrics([job, processing, failed]);
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.processing, 1);
  assert.equal(metrics.retryable, 1);
  const recovery = buildQueueRecoveryPlan([processing, failed]);
  assert.deepEqual(recovery.stuck_jobs, [processing.id]);
  assert.deepEqual(recovery.retryable_failed_jobs, [failed.id]);
});

test('document composer builds PDF and PPTX composition contracts with object keys', () => {
  const pdf = buildDocumentComposition(model, 'executive_report_pdf', { tenant_id: 'demo_org_showcase' });
  assert.equal(pdf.renderer_type, 'pdf');
  assert.equal(pdf.composition_contract.headers, true);
  assert.equal(pdf.composition_contract.footers, true);
  assert.equal(pdf.composition_contract.table_of_contents, true);
  assert.equal(pdf.binary_generation.inside_worker, false);
  const pptx = buildDocumentComposition(model, 'board_deck_pptx', { tenant_id: 'demo_org_showcase' });
  assert.equal(pptx.renderer_type, 'pptx');
  assert.ok(pptx.artifact.slides.length >= 8);
  assert.match(buildRenderObjectKey({ tenantId: 'org', reportId: 'report', format: 'pptx' }), /^rendered\/org\/report\/latest\/pptx\.pptx$/);
});

test('rendering quality validation blocks broken artifacts and releases complete documents', () => {
  const good = buildDocumentComposition(model, 'pdf');
  const validation = validateRenderedDocument(good, good.artifact);
  assert.equal(validation.release_allowed, true);
  const bad = validateRenderedDocument({ renderer_type: 'pdf', artifact: { html_document: '<html>{"raw":true}</html>' }, layout: { sections: [] } });
  assert.equal(bad.release_allowed, false);
  assert.ok(bad.issues.length >= 1);
});

test('rendering worker processes valid job into signed download descriptor and audit record', async () => {
  const job = createRenderJob({ reportId: model.id, tenantId: model.organization_id, format: 'pdf', requestedBy: 'qa' });
  const result = await processRenderJob(job, model, { actor: 'test-renderer' });
  assert.equal(result.released, true);
  assert.equal(result.job.status, 'completed');
  assert.ok(result.download_descriptor.signed_download_url_required);
  assert.equal(result.download_descriptor.authorization.deny_private_public_access, true);
  assert.equal(result.audit.event, 'render_completed');
  assert.match(result.job.result.checksum, /^[a-f0-9]{64}$/);
});

test('download infrastructure enforces public demo published and tenant-private authorization', () => {
  const descriptor = buildSignedDownloadDescriptor({ objectKey: 'rendered/org/report/latest/pdf.pdf', reportId: 'report', tenantId: 'org', format: 'pdf' });
  assert.ok(descriptor.token_preview);
  assert.equal(validateDownloadAuthorization({ isPublicRoute: true, isDemo: true, status: 'published' }).allowed, true);
  assert.equal(validateDownloadAuthorization({ isPublicRoute: true, isDemo: true, status: 'draft' }).allowed, false);
  assert.equal(validateDownloadAuthorization({ isPublicRoute: false, userTenantId: 'org', artifactTenantId: 'org' }).allowed, true);
  assert.equal(validateDownloadAuthorization({ isPublicRoute: false, userTenantId: 'orgA', artifactTenantId: 'orgB' }).allowed, false);
});

test('rendering monitoring reports queue length, success rate, failure rate and health', () => {
  const completed = transitionRenderJob(createRenderJob({ reportId: 'r1', tenantId: 'o', format: 'pdf' }), 'completed', { durationMs: 1000 });
  const failed = transitionRenderJob(createRenderJob({ reportId: 'r2', tenantId: 'o', format: 'pptx' }), 'failed', { error: 'renderer timeout' });
  const health = buildRenderingHealth([completed, failed], { maxFailureRatePct: 60 });
  assert.equal(health.metrics.completed, 1);
  assert.equal(health.metrics.failed, 1);
  assert.equal(health.metrics.success_rate_pct, 50);
  assert.ok(['operational', 'degraded'].includes(health.metrics.renderer_health));
});

test('production rendering plan exposes topology, validation, signed download and remaining binary renderer constraint', () => {
  const plan = buildProductionRenderingPlan(model, 'pdf', { requestedBy: 'qa' });
  assert.equal(plan.production_readiness.api_worker_ready, true);
  assert.equal(plan.production_readiness.queue_ready, true);
  assert.equal(plan.production_readiness.signed_download_ready, true);
  assert.equal(plan.production_readiness.binary_pdf_requires_external_or_queue_renderer, true);
  assert.equal(plan.validation.release_allowed, true);
  assert.ok(plan.deployment_topology.topology.length >= 6);
});

test('multi-format renderer attaches v186 rendering pipeline to PDF, PPTX and legacy formats', () => {
  const pdf = buildPdfFormat(model);
  assert.ok(pdf.production_rendering_infrastructure);
  assert.equal(pdf.rendering_pipeline.validation_status, 'passed');
  const pptx = buildPptxFormat(model);
  assert.ok(pptx.production_rendering_infrastructure);
  assert.equal(pptx.rendering_pipeline.object_key.endsWith('.pptx'), true);
  const executive = buildExecutiveSummaryFormat(model);
  assert.ok(executive.production_rendering_infrastructure);
  assert.equal(executive.rendering_pipeline.queue_status, 'pending');
});

test('public export routes remain safe and do not expose private rendering artifacts', () => {
  assert.match(indexSource, /WHERE id = \? AND is_demo = 1 AND status = 'published'/);
  assert.match(indexSource, /publicDemoFormatMatch/);
  assert.doesNotMatch(indexSource, /signed.*secret|R2_SECRET|PRIVATE_RENDER/i);
});

test('renderer deployment topology explicitly documents Cloudflare limitation and external queue option', () => {
  const topology = buildRendererDeploymentTopology();
  assert.match(topology.cloudflare_constraint, /dedicated queue worker|external rendering service/i);
  assert.ok(topology.topology.some(t => /R2 Storage/.test(t.layer)));
  assert.ok(topology.topology.some(t => /Signed Download/.test(t.layer)));
});
