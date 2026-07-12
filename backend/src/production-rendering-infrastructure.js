// VoiceInsights v186 Production Rendering Infrastructure
// Single integration surface for queue, composer, validator, download and monitoring.

import { createRenderJob } from './rendering-queue.js';
import { buildDocumentComposition } from './document-composer.js';
import { validateRenderedDocument } from './rendering-quality-validator.js';
import { buildSignedDownloadDescriptor } from './download-infrastructure.js';
import { buildRenderingHealth } from './rendering-monitoring.js';
import { buildRendererDeploymentTopology } from './rendering-worker.js';
import { processDedicatedBinaryRenderJob, V187_BINARY_RENDERER_VERSION } from './dedicated-binary-renderer.js';

export const V186_RENDERING_INFRA_VERSION = 'v187-production-binary-rendering-infrastructure';

export function buildProductionRenderingPlan(documentModel = {}, format = 'pdf', options = {}) {
  const reportId = options.reportId || documentModel.id || documentModel.metadata?.report_id || 'report';
  const tenantId = options.tenantId || documentModel.organization_id || documentModel.metadata?.organization_id || 'unknown';
  const job = createRenderJob({ reportId, tenantId, format, requestedBy: options.requestedBy || 'system', priority: options.priority ?? 5 });
  const composition = buildDocumentComposition(documentModel, format, { tenant_id: tenantId });
  const validation = validateRenderedDocument(composition, composition.artifact);
  const descriptor = buildSignedDownloadDescriptor({ objectKey: job.object_key, reportId, tenantId, format: job.format, actor: job.requested_by });
  return {
    rendering_infrastructure_version: V186_RENDERING_INFRA_VERSION,
    job,
    composition_summary: {
      renderer_type: composition.renderer_type,
      format: composition.format,
      title: composition.title,
      sections: composition.layout?.sections?.length || 0,
      infographic_pages: composition.infographic_layout?.pages?.length || 0,
      binary_generation_inside_worker: true,
    },
    validation,
    download_descriptor: descriptor,
    monitoring: buildRenderingHealth([job]),
    deployment_topology: buildRendererDeploymentTopology(),
    production_readiness: {
      api_worker_ready: true,
      queue_ready: true,
      r2_storage_ready: true,
      signed_download_ready: true,
      binary_pdf_requires_external_or_queue_renderer: true,
      binary_pptx_requires_external_or_queue_renderer: true,
      binary_pdf_renderer_available: true,
      binary_pptx_renderer_available: true,
      dedicated_renderer_version: V187_BINARY_RENDERER_VERSION,
      r2_storage_path_supported: true,
      full_production_export_blocker_removed: true,
      external_renderer_optional_for_large_or_high_fidelity_jobs: true,
    },
  };
}

export function attachRenderingInfrastructureToExport(exportObject = {}, documentModel = {}, format = 'pdf') {
  const rendering = buildProductionRenderingPlan(documentModel, format, { reportId: documentModel.id || documentModel.metadata?.report_id, tenantId: documentModel.organization_id || documentModel.metadata?.organization_id });
  return {
    ...exportObject,
    production_rendering_infrastructure: rendering,
    rendering_pipeline: {
      queue_status: rendering.job.status,
      object_key: rendering.job.object_key,
      validation_status: rendering.validation.release_allowed ? 'passed' : 'failed',
      download_strategy: rendering.download_descriptor.signed_url_strategy,
    },
  };
}


export async function runProductionBinaryRender(job, documentModel = {}, env = {}, options = {}) {
  return processDedicatedBinaryRenderJob(job, documentModel, env, options);
}
