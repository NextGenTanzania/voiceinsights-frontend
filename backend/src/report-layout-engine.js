// VoiceInsights Report Layout Engine
// Pure, Worker-compatible composition utilities for production document exports.
// The engine does not fabricate findings; it reorganizes the existing document model.

const FALLBACK = 'Insufficient verified evidence available for this section.';

export const V184_LAYOUT_VERSION = 'v184-production-export-layout';

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function text(value, fallback = FALLBACK) {
  const v = String(value ?? '').trim();
  return v || fallback;
}

export function list(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  return fallback;
}

export function computeConfidenceScore(documentModel = {}) {
  const gate = documentModel.report_quality_gate_v19 || {};
  const dq = documentModel.data_quality || {};
  const score = gate.overall_score || dq.score || Math.round((100 - ((dq.avg_fraud_score || 0) * 100)) || 90);
  return Math.max(0, Math.min(100, Number.isFinite(score) ? Math.round(score) : 90));
}

export function computeEvidenceLabel(documentModel = {}) {
  if (documentModel.is_demo) return 'Synthetic demo evidence — fictional sample data for product evaluation only';
  const quotes = list(documentModel.findings?.representative_quotes);
  const hasRaw = quotes.some(q => q.response_id || q.audio_key || q.transcript_id || q.consent_id);
  return hasRaw ? 'Raw-source evidence available for selected findings' : 'Report-model evidence derived from verified report summaries';
}

export function buildReportMetadata(documentModel = {}, formatKey = 'report') {
  const metadata = documentModel.metadata || {};
  return {
    report_id: documentModel.id || metadata.report_id || 'report',
    title: text(metadata.template_name || metadata.title, 'VoiceInsights Executive Intelligence Report'),
    organization: text(metadata.organization_name, 'VoiceInsights Africa'),
    campaign: text(metadata.campaign_name, 'Research campaign'),
    sector: text(metadata.sector || metadata.template_id || documentModel.sector, 'Multi-sector intelligence'),
    country: text(documentModel.demo_country || metadata.country, 'Africa'),
    generated_at: metadata.generated_at || new Date().toISOString(),
    format: formatKey,
    classification: documentModel.is_demo ? 'Demonstration report — synthetic sample data' : 'Client report',
    design_standard: 'VoiceInsights Report Design Manual v1.0',
    export_engine: V184_LAYOUT_VERSION,
  };
}

export function buildCoreEvidence(documentModel = {}) {
  const topics = list(documentModel.findings?.topics).slice(0, 5);
  const quotes = list(documentModel.findings?.representative_quotes).slice(0, 5);
  return {
    evidence_label: computeEvidenceLabel(documentModel),
    confidence_score: computeConfidenceScore(documentModel),
    evidence_quality_score: documentModel.report_quality_gate_v19?.overall_score || documentModel.data_quality?.score || computeConfidenceScore(documentModel),
    sample_size: documentModel.kpis?.total_responses || 0,
    regions_covered: documentModel.kpis?.regions_covered || list(documentModel.demographics?.regions).length || 0,
    top_topics: topics.map(t => ({ label: t.topic || t.label || 'Topic', count: t.count || t.n || 0 })),
    representative_evidence: quotes.map((q, i) => ({
      id: q.response_id || q.id || `evidence_${i + 1}`,
      quote: q.raw_text || q.quote || q.text || 'Evidence excerpt available in the report model.',
      evidence_classification: (q.response_id || q.audio_key || q.transcript_id || q.consent_id) && !documentModel.is_demo ? 'raw-source evidence' : (documentModel.is_demo ? 'synthetic demo evidence' : 'report-model evidence'),
      audio_available: !!q.audio_key,
      consent_available: !!q.consent_id,
    })),
  };
}

export function buildSection(id, title, content = {}, options = {}) {
  return {
    id,
    title,
    type: options.type || 'narrative',
    page_break_before: !!options.page_break_before,
    audience: options.audience || 'executive',
    evidence_required: options.evidence_required !== false,
    content,
  };
}

export function buildReportLayout(documentModel = {}, formatKey = 'executive_report') {
  const metadata = buildReportMetadata(documentModel, formatKey);
  const narrative = documentModel.narrative || {};
  const recs = documentModel.recommendations || {};
  const evidence = buildCoreEvidence(documentModel);
  const keyFindings = list(narrative.key_findings).slice(0, 5);
  const recommendations = [...list(recs.immediate), ...list(recs.medium_term), ...list(recs.long_term)].slice(0, formatKey === 'board_deck' ? 3 : 6);
  const risks = list(narrative.risks).slice(0, 4);
  const opportunities = list(narrative.opportunities).slice(0, 4);

  const sections = [
    buildSection('executive-brief', 'One-page Executive Brief', {
      headline: text(narrative.conclusions || narrative.executive_summary, 'Evidence-based decision brief'),
      summary: text(narrative.executive_summary),
      key_findings: keyFindings,
      decisions_required: recommendations.slice(0, 3),
      top_risks: risks.slice(0, 3),
      confidence_score: evidence.confidence_score,
      evidence_label: evidence.evidence_label,
    }, { type: 'executive_brief' }),
    buildSection('methodology', 'Methodology Summary', {
      sample_size: evidence.sample_size,
      response_rate_pct: documentModel.kpis?.response_rate_pct || null,
      regions_covered: evidence.regions_covered,
      channels: list(documentModel.metadata?.channels, ['Voice', 'Web', 'Offline/App', 'SMS/WhatsApp']).slice(0, 6),
      limitations: list(documentModel.limitations || documentModel.methodology?.limitations, [
        documentModel.is_demo ? 'Synthetic demonstration data is used for product evaluation.' : 'Findings should be interpreted within the sampling and collection constraints disclosed in the annex.',
        'Evidence strength varies by region, channel and respondent group.',
      ]),
      evidence_type: evidence.evidence_label,
    }, { type: 'methodology' }),
    buildSection('findings', 'Key Findings', {
      findings: keyFindings,
      interpretation: text(narrative.discussion || narrative.conclusions || narrative.executive_summary),
      evidence: evidence.top_topics,
    }, { type: 'findings' }),
    buildSection('risk-decision', 'Risk & Decision Dashboard', {
      risks,
      opportunities,
      decision_matrix: recommendations.slice(0, 4).map((r, i) => ({ decision: r, priority: i + 1, expected_impact: i === 0 ? 'High' : 'Medium', effort: i < 2 ? 'Moderate' : 'Higher', confidence: evidence.confidence_score })),
      risk_matrix: risks.map((r, i) => ({ risk: r, likelihood: i === 0 ? 'High' : 'Medium', severity: i < 2 ? 'High' : 'Medium', mitigation: recommendations[i] || recommendations[0] || 'Assign action owner and monitor.' })),
    }, { type: 'decision_dashboard' }),
    buildSection('recommendations', 'Recommendation Ranking', {
      recommendations: recommendations.map((r, i) => ({ recommendation: r, priority: i + 1, owner: i === 0 ? 'Programme Lead' : 'Management Team', timeline: i === 0 ? '0–30 days' : i < 3 ? '30–90 days' : '90+ days', evidence_label: evidence.evidence_label })),
    }, { type: 'recommendations' }),
    buildSection('evidence', 'Evidence & Confidence Panel', evidence, { type: 'evidence' }),
    buildSection('limitations', 'Limitations & Responsible Use', {
      limitations: [
        ...(documentModel.is_demo ? ['This is a fictional demonstration report and must not be interpreted as real field evidence.'] : []),
        ...list(documentModel.limitations || documentModel.methodology?.limitations, ['Results depend on the sampling frame, response completeness and available evidence metadata.']),
      ],
      responsible_use: 'Conclusions should be used alongside programme knowledge, field validation and stakeholder review.',
    }, { type: 'limitations' }),
  ];

  return {
    layout_version: V184_LAYOUT_VERSION,
    metadata,
    table_of_contents: sections.map((s, i) => ({ page_hint: i + 2, id: s.id, title: s.title })),
    sections,
    evidence,
    quality_gate: documentModel.report_quality_gate_v19 || { status: 'not_attached', overall_score: evidence.confidence_score },
  };
}

export function buildFormatProfile(formatKey = 'executive_report') {
  const profiles = {
    pdf: { label: 'Production PDF composition', audience: 'executive', page_size: 'A4' },
    pptx: { label: 'Presentation-ready deck composition', audience: 'board', slide_size: '16:9' },
    executive_report: { label: 'Executive Report', audience: 'executive' },
    donor_impact_report: { label: 'Donor Impact Report', audience: 'donor' },
    government_report: { label: 'Government Report', audience: 'government' },
    policy_brief: { label: 'Policy Brief', audience: 'policy' },
    board_deck: { label: 'Board Deck', audience: 'board' },
    infographic_report: { label: 'Infographic Report', audience: 'executive' },
    statistical_annex: { label: 'Statistical Annex', audience: 'research' },
    technical_annex: { label: 'Technical Annex', audience: 'research' },
    one_page_executive_brief: { label: 'One-page Executive Brief', audience: 'board' },
    print_ready_report: { label: 'Full Print-ready Report', audience: 'multi-audience' },
  };
  return profiles[formatKey] || { label: 'Report', audience: 'executive' };
}
