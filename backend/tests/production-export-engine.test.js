import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildReportLayout } from '../src/report-layout-engine.js';
import { buildPdfExport } from '../src/pdf-export-engine.js';
import { buildPptxExport } from '../src/pptx-export-engine.js';
import { buildInfographicLayout } from '../src/infographic-layout-engine.js';
import { composePrintReadyHtml } from '../src/print-composer.js';
import { buildPdfFormat, buildPptxFormat, buildProductionInfographicReportFormat, buildExecutiveSummaryFormat } from '../src/multi-format-renderer.js';

const indexSource = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
const rendererSource = fs.readFileSync(new URL('../src/multi-format-renderer.js', import.meta.url), 'utf8');

const baseModel = (template_id = 'agriculture_survey') => ({
  id: `report_${template_id}`,
  is_demo: true,
  demo_country: 'Tanzania',
  metadata: { template_id, template_name: 'Agriculture & Climate Intelligence Report', sector: 'Agriculture & Climate', organization_name: 'VoiceInsights Demo Organization', campaign_name: 'Smallholder Productivity Pulse', generated_at: '2026-01-01T00:00:00Z', standards: ['SDG 2', 'SDG 13'] },
  kpis: { total_responses: 1280, response_rate_pct: 94, regions_covered: 8 },
  demographics: { regions: [{ label: 'Morogoro', n: 260 }, { label: 'Mbeya', n: 210 }, { label: 'Arusha', n: 190 }], gender: [{ label: 'Female', n: 668 }, { label: 'Male', n: 612 }], age: [{ label: '18-25', n: 240 }, { label: '26-35', n: 410 }] },
  findings: { sentiment: [{ label: 'positive', n: 730 }, { label: 'neutral', n: 390 }, { label: 'negative', n: 160 }], topics: [{ topic: 'input access', count: 74 }, { topic: 'climate resilience', count: 61 }], representative_quotes: [{ raw_text: 'Input prices and rainfall changes affect planting decisions.', response_id: 'resp_demo_1', audio_key: 'demo/audio.mp3', consent_id: 'demo_consent_1' }] },
  narrative: { executive_summary: 'Smallholder productivity is improving where extension support, input access and market linkages are strongest.', key_findings: ['Input access remains the strongest productivity constraint.', 'Rainfall variability is shaping planting decisions.', 'Market access gaps reduce farmer income.', 'Women farmers report lower access to finance.', 'Extension contact improves adoption of climate-smart practices.'], risks: ['Climate variability may reduce production predictability.', 'Input affordability may weaken adoption.'], opportunities: ['Strengthen last-mile extension and aggregation.', 'Improve climate-smart input access.'], conclusions: 'Leadership should prioritise input access and climate-smart extension in lower-performing regions.' },
  recommendations: { immediate: ['Target input access support in lower-performing districts.'], medium_term: ['Strengthen extension services and aggregation models.'], long_term: ['Institutionalise climate-smart agriculture monitoring.'] },
  data_quality: { score: 95, avg_fraud_score: 0.02, flagged_response_count: 0 },
  report_quality_gate_v19: { status: 'passed', overall_score: 95 },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'What is limiting your farm productivity?', question_type: 'open_voice' }] },
});

test('modules exist and can be imported', async () => {
  await import('../src/report-layout-engine.js');
  await import('../src/pdf-export-engine.js');
  await import('../src/pptx-export-engine.js');
  await import('../src/infographic-layout-engine.js');
  await import('../src/print-composer.js');
});

test('Worker import succeeds after v184 export route integration', async () => {
  await import('../src/application.js');
});

test('public export routes include pdf and pptx renderers and remain demo-published safe', () => {
  assert.match(indexSource, /pdf: buildPdfFormat/);
  assert.match(indexSource, /pptx: buildPptxFormat/);
  assert.match(indexSource, /WHERE id = \? AND is_demo = 1 AND status = 'published'/);
});

test('report layout engine builds cover metadata, TOC, methodology, evidence and limitations sections', () => {
  const layout = buildReportLayout(baseModel(), 'executive_report');
  assert.equal(layout.layout_version, 'v184-production-export-layout');
  assert.ok(layout.metadata.title);
  assert.ok(layout.table_of_contents.length >= 5);
  const sectionIds = layout.sections.map(s => s.id);
  for (const id of ['executive-brief', 'methodology', 'evidence', 'limitations']) assert.ok(sectionIds.includes(id), id);
  assert.ok(layout.evidence.evidence_label.includes('Synthetic demo evidence'));
});

test('PDF export engine creates print-ready HTML composition without browser-print warning or raw JSON', () => {
  const pdf = buildPdfExport(baseModel(), 'pdf');
  assert.equal(pdf.export_engine, 'v184-production-pdf-composition-engine');
  assert.equal(pdf.production_export_type, 'print-ready-html-pdf-composition');
  assert.ok(pdf.html_document.includes('<!doctype html>'));
  assert.ok(pdf.html_document.includes('Table of Contents'));
  assert.ok(pdf.html_document.includes('Methodology'));
  assert.ok(pdf.html_document.includes('Evidence'));
  assert.ok(pdf.html_document.includes('Limitations'));
  assert.equal(pdf.quality_assertions.no_raw_json, true);
  assert.equal(pdf.quality_assertions.no_browser_print_warning, true);
  assert.doesNotMatch(pdf.html_document, /Use browser print|export preview|raw JSON|\[object Object\]/i);
});

test('PPTX export engine creates presentation-ready deck schema with required slides', () => {
  const pptx = buildPptxExport(baseModel(), 'pptx');
  assert.equal(pptx.export_engine, 'v184-production-pptx-deck-schema-engine');
  assert.equal(pptx.production_export_type, 'presentation-ready-editable-slide-schema');
  const ids = pptx.slides.map(s => s.id);
  for (const id of ['title', 'executive-summary', 'kpi', 'decision', 'risk', 'evidence', 'recommendations', 'appendix']) assert.ok(ids.includes(id), id);
  assert.equal(pptx.quality_assertions.no_outline_only, true);
});

test('infographic layout engine creates publication-style page structures', () => {
  const ig = buildInfographicLayout(baseModel(), 'infographic_report');
  assert.equal(ig.infographic_layout_version, 'v184-publication-infographic-layout');
  assert.ok(ig.pages.length >= 14);
  for (const page of ig.pages) {
    assert.equal(page.layout, 'publication_page');
    assert.ok(page.headline);
    assert.ok(page.main_visual?.type);
    assert.ok(page.supporting_insight_cards.length <= 4);
    assert.ok(page.decision_implication);
    assert.ok(page.evidence_label);
    assert.equal(page.print_safe, true);
    assert.equal(page.mobile_safe, true);
  }
});

test('print composer builds A4-ready report HTML from layout and infographic layout', () => {
  const layout = buildReportLayout(baseModel(), 'print_ready_report');
  const ig = buildInfographicLayout(baseModel(), 'print_ready_report');
  const html = composePrintReadyHtml(layout, ig);
  assert.match(html, /@page \{ size: A4/);
  assert.match(html, /vi-cover/);
  assert.match(html, /Table of Contents/);
  assert.match(html, /vi-footer/);
  assert.doesNotMatch(html, /undefined|\bnull\b|\bNaN\b|raw JSON|Use browser print/i);
});

test('multi-format renderer attaches v184 production exports to legacy report formats', () => {
  const executive = buildExecutiveSummaryFormat(baseModel());
  assert.ok(executive.production_export);
  assert.ok(executive.pdf_export.html_document);
  assert.ok(executive.pptx_export.slides.length >= 8);
  assert.ok(executive.report_layout.sections.length >= 5);
  assert.ok(executive.infographic_layout.pages.length >= 14);
  assert.doesNotMatch(JSON.stringify(executive.production_export), /browser print|export preview/i);
});

test('v184 explicit pdf, pptx and infographic formats are available', () => {
  const pdf = buildPdfFormat(baseModel());
  assert.equal(pdf.format, 'pdf');
  assert.ok(pdf.html_document.includes('Executive Intelligence Report'));
  const pptx = buildPptxFormat(baseModel());
  assert.equal(pptx.format, 'pptx');
  assert.ok(pptx.slides.length >= 8);
  const infographic = buildProductionInfographicReportFormat(baseModel());
  assert.equal(infographic.format, 'infographic_report');
  assert.ok(infographic.publication_pages.length >= 14);
});

test('all 16 sample templates can generate v184 export payloads', async () => {
  const { SECTOR_EXCELLENCE_PROFILES } = await import('../src/international-report-excellence.js');
  for (const templateId of Object.keys(SECTOR_EXCELLENCE_PROFILES)) {
    const dm = baseModel(templateId);
    const pdf = buildPdfExport(dm, 'pdf');
    const pptx = buildPptxExport(dm, 'pptx');
    const ig = buildInfographicLayout(dm, 'infographic_report');
    assert.ok(pdf.html_document.length > 3000, templateId);
    assert.ok(pptx.slides.length >= 8, templateId);
    assert.ok(ig.pages.length >= 14, templateId);
  }
});

test('multi-format renderer no longer contains public browser-print warning language', () => {
  assert.doesNotMatch(rendererSource, /Use browser print for PDF output until a server-side PDF\/PPTX engine is available/);
});
