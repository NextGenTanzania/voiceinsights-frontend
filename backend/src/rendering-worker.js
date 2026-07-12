// VoiceInsights v186 Rendering Worker Orchestrator
// Worker-compatible lifecycle orchestration. Binary rendering is delegated to
// external/queue renderers when required by Cloudflare constraints.

import { buildDocumentComposition } from './document-composer.js';
import { transitionRenderJob } from './rendering-queue.js';
import { validateRenderedDocument } from './rendering-quality-validator.js';
import { buildSignedDownloadDescriptor, buildDownloadAuditRecord } from './download-infrastructure.js';
import { processDedicatedBinaryRenderJob } from './dedicated-binary-renderer.js';

export const V186_RENDERING_WORKER_VERSION = 'v187-dedicated-binary-rendering-worker-orchestrator';

export async function processRenderJob(job, documentModel = {}, options = {}) {
  // v187: process the job through the dedicated binary renderer. When an R2
  // binding is supplied in options.env the bytes are written to R2; tests and
  // local QA can run without R2 and still receive a complete descriptor.
  const result = await processDedicatedBinaryRenderJob(job, documentModel, options.env || {}, { actor: options.actor || 'rendering-worker' });
  return { worker_version: V186_RENDERING_WORKER_VERSION, ...result };
}

export async function computeArtifactChecksum(value) {
  const text = String(value || '');
  if (globalThis.crypto?.subtle) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

export function buildRendererDeploymentTopology() {
  return {
    worker_version: V186_RENDERING_WORKER_VERSION,
    topology: [
      { layer: 'Cloudflare Worker API', responsibility: 'authorize request, create render job, return job status' },
      { layer: 'Rendering Queue', responsibility: 'asynchronous job lifecycle, retries, deduplication, priority' },
      { layer: 'Rendering Worker', responsibility: 'consume queue jobs and call the v187 dedicated binary renderer' },
      { layer: 'Document Composer', responsibility: 'pagination-ready HTML and editable slide schema' },
      { layer: 'Dedicated Binary Renderer', responsibility: 'generate real .pdf/.pptx bytes for controlled production exports; can be replaced by Chromium/PptxGenJS service for heavyweight jobs' },
      { layer: 'R2 Storage', responsibility: 'store immutable rendered artifacts and checksums' },
      { layer: 'Signed Download', responsibility: 'short-lived access with audit logging' },
    ],
    cloudflare_constraint: 'Binary PDF/PPTX rendering is now available through the v187 dedicated rendering worker; heavyweight/large enterprise jobs may still be routed to a dedicated queue worker or external rendering service using the same adapter contract.',
  };
}
