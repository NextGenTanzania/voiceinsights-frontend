// VoiceInsights v210.4 — Enterprise Reports
// Audience-specific reporting, evidence exploration, AI assistance and export contracts.

export const ENTERPRISE_REPORTS_V2104_VERSION = 'v210.4.0';

const AUDIENCE_PRODUCTS = {
  board: {
    label: 'Board Intelligence Report',
    purpose: 'Compress evidence into a short decision pack for directors and executive committees.',
    sections: ['Executive decision', 'Five critical insights', 'Risk exposure', 'Three decisions required', 'Implementation oversight'],
    tone: 'concise, risk-aware, decision-first',
  },
  government: {
    label: 'Government Decision Brief',
    purpose: 'Translate findings into policy options, implementation implications and regional priorities.',
    sections: ['Policy problem', 'Evidence summary', 'Policy options', 'Fiscal and delivery implications', 'Decision required'],
    tone: 'policy-ready, implementation-oriented, fiscally aware',
  },
  donor: {
    label: 'Donor Impact Report',
    purpose: 'Connect evidence to outputs, outcomes, inclusion, value for money and the next funding cycle.',
    sections: ['Contribution story', 'Results and outcomes', 'Inclusion', 'Value for money', 'Lessons and next-cycle recommendations'],
    tone: 'outcome-oriented, evidence-backed, funding-aware',
  },
  executive: {
    label: 'Executive Intelligence Publication',
    purpose: 'Give leadership a rapid, decision-ready narrative supported by visual evidence.',
    sections: ['Executive headline', 'What changed', 'Why it matters', 'Decision required', 'Action roadmap'],
    tone: 'strategic, polished, action-focused',
  },
  research: {
    label: 'Research & Technical Report',
    purpose: 'Preserve methodology, sampling, limitations, statistical interpretation and evidence lineage.',
    sections: ['Methodology', 'Sampling and quality', 'Findings', 'Statistical interpretation', 'Limitations and annexes'],
    tone: 'methodological, transparent, limitations-aware',
  },
};

function cleanArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeModel(model = {}) {
  const findings = cleanArray(model.findings || model.key_findings || model.insights);
  const recommendations = cleanArray(model.recommendations || model.actions);
  const risks = cleanArray(model.risks || model.top_risks);
  const evidence = cleanArray(model.evidence || model.evidence_traceability);
  const kpis = cleanArray(model.kpis || model.metrics);
  return {
    title: model.title || model.report_title || 'Enterprise Intelligence Report',
    sector: model.sector || model.sector_key || 'cross-sector',
    country: model.country || 'Not specified',
    sample_size: Number(model.sample_size || model.total_responses || model.responses || 0),
    findings,
    recommendations,
    risks,
    evidence,
    kpis,
    methodology: model.methodology || {},
    limitations: cleanArray(model.limitations),
    executive_summary: model.executive_summary || model.summary || '',
  };
}

function findingText(item) {
  if (typeof item === 'string') return item;
  return item?.finding || item?.claim || item?.title || item?.insight || JSON.stringify(item);
}

function recommendationText(item) {
  if (typeof item === 'string') return item;
  return item?.recommendation || item?.action || item?.title || JSON.stringify(item);
}

export function buildExecutiveStorytelling(model = {}, audience = 'executive') {
  const dm = normalizeModel(model);
  const product = AUDIENCE_PRODUCTS[audience] || AUDIENCE_PRODUCTS.executive;
  const leadFinding = findingText(dm.findings[0] || 'The available evidence requires leadership review.');
  const leadAction = recommendationText(dm.recommendations[0] || 'Validate priority actions with programme leadership.');
  return {
    audience,
    title: product.label,
    tone: product.tone,
    headline: dm.executive_summary || leadFinding,
    narrative_arc: [
      { stage: 'Context', text: `${dm.title} covers ${dm.sample_size || 'the available'} respondent records in ${dm.country}.` },
      { stage: 'Signal', text: leadFinding },
      { stage: 'Implication', text: dm.risks.length ? findingText(dm.risks[0]) : 'Leadership should validate operational and programme implications.' },
      { stage: 'Decision', text: leadAction },
      { stage: 'Accountability', text: 'Assign an owner, timeline, success indicator and evidence review date.' },
    ],
    sections: product.sections,
  };
}

export function buildEvidenceExplorer(model = {}) {
  const dm = normalizeModel(model);
  const items = dm.evidence.length ? dm.evidence : dm.findings.map((f, index) => ({
    id: `evidence_${index + 1}`,
    claim: findingText(f),
    evidence_classification: 'report-model evidence',
    confidence_score: 80,
    raw_available: false,
  }));
  return {
    total_items: items.length,
    evidence_classes: [...new Set(items.map(i => i.evidence_classification || i.evidence_type || 'report-model evidence'))],
    items: items.map((item, index) => ({
      id: item.id || `evidence_${index + 1}`,
      claim: item.claim || item.finding || findingText(item),
      source: item.source || item.evidence_label || item.evidence_classification || 'Report model',
      confidence_score: Number(item.confidence_score || item.confidence || 80),
      raw_available: Boolean(item.raw_available || item.audio_available || item.transcript_available),
      respondent_reference: item.respondent_reference || item.response_id || null,
      consent_status: item.consent_status || (item.consent_available ? 'available' : 'not linked'),
      trace_path: item.claim_to_source_path || [],
    })),
  };
}

export function buildPresentation(model = {}, audience = 'board') {
  const dm = normalizeModel(model);
  const story = buildExecutiveStorytelling(dm, audience);
  return {
    version: ENTERPRISE_REPORTS_V2104_VERSION,
    audience,
    title: story.title,
    design_standard: 'VoiceInsights Enterprise Presentation Standard v210.4',
    slides: [
      { type: 'cover', title: dm.title, subtitle: `${dm.sector} · ${dm.country}` },
      { type: 'executive_headline', title: 'Executive headline', body: story.headline },
      { type: 'kpi_grid', title: 'Performance at a glance', items: dm.kpis.slice(0, 6) },
      { type: 'findings', title: 'Critical findings', items: dm.findings.slice(0, 5).map(findingText) },
      { type: 'risk_matrix', title: 'Risk exposure', items: dm.risks.slice(0, 5).map(findingText) },
      { type: 'decision_matrix', title: 'Decisions required', items: dm.recommendations.slice(0, 5).map(recommendationText) },
      { type: 'evidence', title: 'Evidence confidence', items: buildEvidenceExplorer(dm).items.slice(0, 5) },
      { type: 'roadmap', title: 'Action roadmap', items: dm.recommendations.slice(0, 5).map((r, i) => ({ rank: i + 1, action: recommendationText(r) })) },
    ],
  };
}

export function buildEnterpriseReportProducts(model = {}) {
  const dm = normalizeModel(model);
  return Object.entries(AUDIENCE_PRODUCTS).map(([key, product]) => ({
    key,
    label: product.label,
    purpose: product.purpose,
    tone: product.tone,
    sections: product.sections,
    storytelling: buildExecutiveStorytelling(dm, key),
    presentation: buildPresentation(dm, key),
  }));
}

export function buildInteractiveReport(model = {}) {
  const dm = normalizeModel(model);
  return {
    version: ENTERPRISE_REPORTS_V2104_VERSION,
    filters: ['region', 'gender', 'age', 'channel', 'language', 'time period'],
    drilldowns: ['finding → chart → question → response', 'recommendation → evidence → owner → timeline'],
    panels: {
      executive_story: buildExecutiveStorytelling(dm),
      evidence_explorer: buildEvidenceExplorer(dm),
      kpis: dm.kpis,
      findings: dm.findings,
      risks: dm.risks,
      recommendations: dm.recommendations,
      methodology: dm.methodology,
      limitations: dm.limitations,
    },
  };
}

export function buildExportManifest(model = {}) {
  const dm = normalizeModel(model);
  return {
    pdf: { status: 'binary-ready', engine: 'VoiceInsights PDF Renderer', formats: ['executive', 'board', 'government', 'donor', 'research'] },
    powerpoint: { status: 'binary-ready', engine: 'VoiceInsights PPTX Renderer', presentation: buildPresentation(dm, 'board') },
    word: { status: 'binary-ready', engine: 'VoiceInsights DOCX OpenXML Renderer', sections: buildExecutiveStorytelling(dm).sections },
    excel: { status: 'binary-ready', engine: 'VoiceInsights XLSX OpenXML Renderer', sheets: ['Executive Summary', 'KPIs', 'Findings', 'Evidence', 'Recommendations', 'Methodology'] },
  };
}

export function answerReportAssistant(model = {}, question = '') {
  const dm = normalizeModel(model);
  const q = String(question || '').trim();
  if (!q) return { answer: 'Ask a question about findings, risks, evidence, recommendations or methodology.', citations: [] };
  const evidence = buildEvidenceExplorer(dm).items;
  const lower = q.toLowerCase();
  let answer;
  if (lower.includes('risk')) answer = dm.risks.length ? `The leading risk is: ${findingText(dm.risks[0])}` : 'No explicit risk has been recorded in this report model.';
  else if (lower.includes('recommend') || lower.includes('action')) answer = dm.recommendations.length ? `The highest-priority action is: ${recommendationText(dm.recommendations[0])}` : 'No recommendation is currently available.';
  else if (lower.includes('evidence') || lower.includes('confidence')) answer = `The report contains ${evidence.length} traceable evidence item(s).`;
  else if (lower.includes('method')) answer = dm.methodology && Object.keys(dm.methodology).length ? 'Methodology details are available in the methodology panel.' : 'Methodology details are limited and should be completed before publication.';
  else answer = dm.executive_summary || findingText(dm.findings[0] || 'No executive summary is available.');
  return { answer, citations: evidence.slice(0, 3).map(e => ({ evidence_id: e.id, claim: e.claim, confidence_score: e.confidence_score })) };
}

export function buildEnterpriseReportsWorkspace(model = {}) {
  const dm = normalizeModel(model);
  return {
    version: ENTERPRISE_REPORTS_V2104_VERSION,
    label: 'Enterprise Reports Studio',
    report: dm,
    products: buildEnterpriseReportProducts(dm),
    interactive_report: buildInteractiveReport(dm),
    evidence_explorer: buildEvidenceExplorer(dm),
    export_manifest: buildExportManifest(dm),
    capabilities: ['Board Reports', 'Government Reports', 'Donor Reports', 'AI Assistant', 'Evidence Explorer', 'Interactive Reports', 'Executive Storytelling', 'Presentation Builder', 'PowerPoint', 'Word', 'Excel'],
  };
}
