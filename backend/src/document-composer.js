// VoiceInsights v186 Document Composer
// Additive, Worker-compatible composition layer. It never invents report content;
// it organizes an existing document_model_json into renderable PDF/PPTX artifacts.
//
// Unified Publication Runtime migration status: OUT OF SCOPE. This is the
// generic (non-flagship) composition path for policy-brief/cabinet-memo/
// board-deck/investor-deck formats — a separate document type from the 16
// flagship publications this migration covers. It is also still used as the
// flagship route's own final PDF fallback (application.js, when Browser
// Rendering is ineligible or fails). Left untouched deliberately; a
// consolidation of this path is a follow-on effort, not part of this plan.

import { buildReportLayout } from './report-layout-engine.js';
import { buildPdfExport } from './pdf-export-engine.js';
import { buildPptxExport } from './pptx-export-engine.js';
import { buildInfographicLayout } from './infographic-layout-engine.js';

export const V186_DOCUMENT_COMPOSER_VERSION = 'v187-document-composer';

export const FORMAT_TO_RENDERER = Object.freeze({
  pdf: 'pdf',
  executive_report_pdf: 'pdf',
  donor_impact_report_pdf: 'pdf',
  government_report_pdf: 'pdf',
  policy_brief_pdf: 'pdf',
  infographic_report_pdf: 'pdf',
  statistical_annex_pdf: 'pdf',
  one_page_executive_brief_pdf: 'pdf',
  print_ready_report_pdf: 'pdf',
  pptx: 'pptx',
  board_deck_pptx: 'pptx',
  executive_deck_pptx: 'pptx',
  donor_deck_pptx: 'pptx',
  government_briefing_deck_pptx: 'pptx',
  infographic_deck_pptx: 'pptx',
});

export function normalizeRenderFormat(format = 'pdf') {
  return String(format || 'pdf').trim().toLowerCase().replace(/-/g, '_');
}

export function getRendererType(format = 'pdf') {
  const normalized = normalizeRenderFormat(format);
  return FORMAT_TO_RENDERER[normalized] || (normalized.includes('ppt') || normalized.includes('deck') ? 'pptx' : 'pdf');
}

export function buildDocumentComposition(documentModel = {}, format = 'pdf', options = {}) {
  const normalizedFormat = normalizeRenderFormat(format);
  const rendererType = getRendererType(normalizedFormat);
  const layout = buildReportLayout(documentModel, normalizedFormat);
  const infographicLayout = buildInfographicLayout(documentModel, normalizedFormat);
  const artifact = rendererType === 'pptx'
    ? buildPptxExport(documentModel, normalizedFormat)
    : buildPdfExport(documentModel, normalizedFormat);

  return {
    composer_version: V186_DOCUMENT_COMPOSER_VERSION,
    renderer_type: rendererType,
    format: normalizedFormat,
    report_id: layout.metadata.report_id,
    title: layout.metadata.title,
    tenant_id: options.tenant_id || documentModel.organization_id || documentModel.metadata?.organization_id || 'unknown',
    metadata: layout.metadata,
    layout,
    infographic_layout: infographicLayout,
    artifact,
    composition_contract: {
      page_composition: true,
      pagination_ready: true,
      section_ordering: true,
      headers: true,
      footers: true,
      table_of_contents: !!layout.table_of_contents?.length,
      page_numbering: true,
      figure_numbering: true,
      table_numbering: true,
      print_safe_spacing: true,
      running_titles: true,
      metadata: true,
    },
    binary_generation: {
      inside_worker: false,
      dedicated_binary_renderer: true,
      production_path: rendererType === 'pptx'
        ? 'Render a real .pptx binary with the v187 dedicated renderer, store in R2, and return a signed download descriptor.'
        : 'Render a real .pdf binary with the v187 dedicated renderer, store in R2, and return a signed download descriptor.',
      heavyweight_renderer_option: 'Large/high-fidelity jobs can use the same composition payload with an external Chromium/PptxGenJS service without changing API contracts.',
    },
  };
}

export function buildRenderObjectKey({ tenantId = 'unknown', reportId = 'report', format = 'pdf', version = 'latest', extension } = {}) {
  const f = normalizeRenderFormat(format);
  const ext = extension || (getRendererType(f) === 'pptx' ? 'pptx' : 'pdf');
  const clean = (v) => String(v || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `rendered/${clean(tenantId)}/${clean(reportId)}/${clean(version)}/${clean(f)}.${clean(ext)}`;
}
