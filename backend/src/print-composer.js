// VoiceInsights v184 Print Composer
// Worker-compatible HTML document composition for print-ready PDF production workflows.

import { escapeHtml, text } from './report-layout-engine.js';

export const V184_PRINT_COMPOSER_VERSION = 'v184-worker-compatible-print-composer';

function renderList(items = []) {
  return `<ul>${items.map(item => `<li>${escapeHtml(typeof item === 'string' ? item : item?.recommendation || item?.body || JSON.stringify(item))}</li>`).join('')}</ul>`;
}

function renderSection(section) {
  const c = section.content || {};
  if (section.type === 'executive_brief') {
    return `<section class="vi-page vi-section vi-executive-brief"><h2>${escapeHtml(section.title)}</h2><p class="vi-lead">${escapeHtml(c.summary)}</p><div class="vi-two-col"><div><h3>Key findings</h3>${renderList(c.key_findings || [])}</div><div><h3>Decisions required</h3>${renderList(c.decisions_required || [])}</div></div><div class="vi-metrics"><span>Confidence: ${escapeHtml(c.confidence_score)}%</span><span>${escapeHtml(c.evidence_label)}</span></div></section>`;
  }
  if (section.type === 'methodology') {
    return `<section class="vi-page vi-section"><h2>${escapeHtml(section.title)}</h2><div class="vi-kpi-row"><div><strong>${escapeHtml(c.sample_size)}</strong><span>Sample size</span></div><div><strong>${escapeHtml(c.response_rate_pct ?? 'n/a')}%</strong><span>Response rate</span></div><div><strong>${escapeHtml(c.regions_covered)}</strong><span>Regions</span></div></div><h3>Limitations</h3>${renderList(c.limitations || [])}<p class="vi-evidence">${escapeHtml(c.evidence_type)}</p></section>`;
  }
  if (section.type === 'decision_dashboard') {
    return `<section class="vi-page vi-section"><h2>${escapeHtml(section.title)}</h2><div class="vi-two-col"><div><h3>Risk matrix</h3>${renderList((c.risk_matrix || []).map(r => `${r.risk} — ${r.likelihood}/${r.severity}`))}</div><div><h3>Decision matrix</h3>${renderList((c.decision_matrix || []).map(d => `${d.decision} — ${d.expected_impact} impact`))}</div></div></section>`;
  }
  if (section.type === 'evidence') {
    return `<section class="vi-page vi-section"><h2>${escapeHtml(section.title)}</h2><div class="vi-kpi-row"><div><strong>${escapeHtml(c.confidence_score)}%</strong><span>Confidence</span></div><div><strong>${escapeHtml(c.evidence_quality_score)}%</strong><span>Evidence quality</span></div><div><strong>${escapeHtml(c.sample_size)}</strong><span>Responses</span></div></div><p class="vi-evidence">${escapeHtml(c.evidence_label)}</p>${renderList((c.representative_evidence || []).map(e => `${e.evidence_classification}: ${e.quote}`))}</section>`;
  }
  return `<section class="vi-page vi-section"><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(c.summary || c.interpretation || c.headline || section.title)}</p>${renderList(c.findings || c.recommendations || c.limitations || [])}</section>`;
}

export function composePrintReadyHtml(layout, infographicLayout = null, options = {}) {
  const metadata = layout.metadata || {};
  const toc = layout.table_of_contents || [];
  const sections = layout.sections || [];
  const infographics = infographicLayout?.pages || [];

  const css = `
  @page { size: A4; margin: 18mm 16mm; }
  :root { --vi-blue:#0B5FFF; --vi-teal:#087F8C; --vi-slate:#1F2937; --vi-muted:#64748B; --vi-line:#E5E7EB; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Segoe UI, Roboto, Arial, sans-serif; color: var(--vi-slate); line-height: 1.48; margin:0; background:white; }
  .vi-cover { min-height: 100vh; padding: 64px; display:flex; flex-direction:column; justify-content:space-between; page-break-after: always; border-left: 12px solid var(--vi-blue); }
  .vi-eyebrow { color: var(--vi-teal); text-transform: uppercase; letter-spacing: .12em; font-size: 12px; font-weight: 700; }
  h1 { font-size: 42px; line-height:1.05; margin: 20px 0; max-width: 820px; }
  h2 { font-size: 25px; margin: 0 0 18px; color: var(--vi-blue); }
  h3 { font-size: 15px; margin: 14px 0 8px; }
  .vi-meta { display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; max-width: 720px; }
  .vi-meta div, .vi-card, .vi-kpi-row div { border: 1px solid var(--vi-line); border-radius: 14px; padding: 14px; background: #fff; }
  .vi-page { page-break-after: always; padding: 28px 0; }
  .vi-section { max-width: 980px; margin: 0 auto; }
  .vi-lead { font-size: 18px; color:#334155; }
  .vi-two-col { display:grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .vi-kpi-row { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin: 14px 0 20px; }
  .vi-kpi-row strong { display:block; font-size: 28px; color: var(--vi-blue); }
  .vi-kpi-row span, .vi-evidence, .vi-footer { color: var(--vi-muted); font-size: 12px; }
  .vi-metrics { display:flex; gap:12px; flex-wrap:wrap; margin-top:18px; }
  .vi-metrics span { border:1px solid var(--vi-line); border-radius:999px; padding:8px 12px; font-size:12px; }
  .vi-infographic { border:1px solid var(--vi-line); border-radius:18px; padding:22px; margin: 0 auto 22px; max-width:980px; page-break-after: always; }
  .vi-infographic .main { min-height: 210px; border:1px dashed #CBD5E1; border-radius:14px; padding:18px; background:#F8FAFC; }
  .vi-footer { position: fixed; bottom: 8mm; left:16mm; right:16mm; display:flex; justify-content:space-between; border-top:1px solid var(--vi-line); padding-top:6px; }
  @media print { .vi-page, .vi-cover, .vi-infographic { break-after: page; } }
  @media(max-width:760px) { .vi-cover{padding:32px 20px}.vi-two-col,.vi-meta,.vi-kpi-row{grid-template-columns:1fr}h1{font-size:32px} }
  `;

  const cover = `<section class="vi-cover"><div><div class="vi-eyebrow">Executive Intelligence Report</div><h1>${escapeHtml(metadata.title)}</h1><p class="vi-lead">${escapeHtml(metadata.classification)}</p></div><div class="vi-meta"><div><strong>Prepared for</strong><br>${escapeHtml(metadata.organization)}</div><div><strong>Campaign</strong><br>${escapeHtml(metadata.campaign)}</div><div><strong>Sector</strong><br>${escapeHtml(metadata.sector)}</div><div><strong>Generated</strong><br>${escapeHtml(metadata.generated_at)}</div></div></section>`;
  const tocHtml = `<section class="vi-page vi-section"><h2>Table of Contents</h2>${renderList(toc.map(t => `${t.title} — page ${t.page_hint}`))}</section>`;
  const sectionHtml = sections.map(renderSection).join('\n');
  const infographicHtml = infographics.map(p => `<section class="vi-infographic"><div class="vi-eyebrow">${escapeHtml(p.title)}</div><h2>${escapeHtml(p.headline)}</h2><div class="main"><strong>Main visual:</strong> ${escapeHtml(p.main_visual?.type || 'publication visual')}</div><div class="vi-two-col">${(p.supporting_insight_cards || []).slice(0,4).map(card => `<div class="vi-card"><strong>${escapeHtml(card.title)}</strong><p>${escapeHtml(card.body)}</p></div>`).join('')}</div><p><strong>Decision implication:</strong> ${escapeHtml(p.decision_implication)}</p><p class="vi-evidence">${escapeHtml(p.evidence_label)}</p></section>`).join('\n');
  const footer = `<div class="vi-footer"><span>${escapeHtml(metadata.title)}</span><span>${escapeHtml(metadata.export_engine || 'v184')}</span></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(metadata.title)}</title><meta name="generator" content="VoiceInsights Africa v184 Production Export Engine"><style>${css}</style></head><body>${cover}${tocHtml}${sectionHtml}${infographicHtml}${footer}</body></html>`;
}

export function buildPrintCompositionManifest(layout, html) {
  return {
    composer_version: V184_PRINT_COMPOSER_VERSION,
    output_type: 'worker-compatible-html-pdf-composition',
    production_use: 'Print-ready HTML composition suitable for browser save-to-PDF or external HTML-to-PDF rendering service.',
    page_size: 'A4',
    includes: ['cover page', 'table of contents', 'headers/footers', 'page numbering placeholders via print engine', 'methodology', 'evidence labels', 'recommendations', 'limitations', 'infographic pages'],
    html_bytes: new TextEncoder().encode(html).length,
    layout_version: layout.layout_version,
  };
}
