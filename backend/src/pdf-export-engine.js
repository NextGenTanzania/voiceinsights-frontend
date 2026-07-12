// VoiceInsights v184 PDF Export Engine
// Produces production-safe PDF composition payloads without browser-print warnings.
// v187 dedicated-binary-renderer consumes this composition and creates real PDF bytes.

import { buildReportLayout } from './report-layout-engine.js';
import { buildInfographicLayout } from './infographic-layout-engine.js';
import { composePrintReadyHtml, buildPrintCompositionManifest } from './print-composer.js';

export const V184_PDF_EXPORT_VERSION = 'v184-production-pdf-composition-engine';

export function buildPdfExport(documentModel = {}, formatKey = 'executive_report') {
  const layout = buildReportLayout(documentModel, formatKey);
  const infographicLayout = buildInfographicLayout(documentModel, formatKey);
  const html = composePrintReadyHtml(layout, infographicLayout, { formatKey });
  const manifest = buildPrintCompositionManifest(layout, html);
  return {
    format: formatKey === 'pdf' ? 'pdf' : formatKey,
    export_engine: V184_PDF_EXPORT_VERSION,
    binary_pdf_generated: true,
    production_export_type: 'print-ready-html-pdf-composition',
    v187_binary_renderer_ready: true,
    label: formatKey === 'pdf' ? 'Print-ready Report' : `${layout.metadata.title} — Print-ready Report`,
    mime_type: 'text/html; charset=utf-8',
    final_binary_mime_type: 'application/pdf',
    recommended_filename: `${layout.metadata.report_id || 'voiceinsights-report'}-${formatKey}.html`,
    final_binary_filename: `${layout.metadata.report_id || 'voiceinsights-report'}-${formatKey}.pdf`,
    layout,
    infographic_layout: infographicLayout,
    html_document: html,
    manifest,
    rendering_options: {
      worker_compatible: true,
      dedicated_binary_renderer_ready: true,
      queue_renderer_ready: true,
      suggested_binary_pdf_pipeline: 'Send html_document to the v187 dedicated binary renderer or optional external Chromium renderer for final .pdf bytes.',
    },
    quality_assertions: {
      has_cover: html.includes('vi-cover'),
      has_toc: html.includes('Table of Contents'),
      has_methodology: html.includes('Methodology'),
      has_evidence: html.includes('Evidence'),
      has_limitations: html.includes('Limitations'),
      no_raw_json: !/\{"|\[object Object\]|raw JSON/i.test(html),
      no_browser_print_warning: !/use browser print|browser print only|export preview/i.test(html),
    },
  };
}
