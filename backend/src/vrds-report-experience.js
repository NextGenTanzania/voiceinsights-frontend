// VoiceInsights Report Design System (VRDS) — Report Experience Layer
// Phase B applies the Phase A foundation to report outputs without changing
// database schema, authentication, public branding, navigation, or API contracts.

import { VRDS_VERSION, vrdsTokens, vrdsExportTokens, getVRDSComponentSpec, classifyVRDSConfidence, getVRDSEvidenceStyle } from './vrds-foundation.js';
import {
  buildOnePageExecutiveBriefV20,
  buildMethodologyTransparencyV20,
  buildEvidenceTraceabilityV20,
  buildPublicationInfographicV20,
  sanitizePublicReportTextV20,
} from './report-experience.js';

export const VRDS_REPORT_EXPERIENCE_VERSION = '1.0.0-report-experience';

export const VRDS_REPORT_TYPES = Object.freeze({
  executive_report: {
    label: 'Executive Report', audience: 'CEO / Board / Country Director', recommendedLength: '8–15 pages', exportFormats: ['html', 'pdf'],
    purpose: 'Convert report evidence into executive decisions, risks and prioritized actions.',
  },
  board_report: {
    label: 'Board Report', audience: 'Board of Directors', recommendedLength: '5–10 pages/slides', exportFormats: ['pdf', 'pptx'],
    purpose: 'Compress the report into oversight decisions, risks, confidence and actions.',
  },
  government_report: {
    label: 'Government Report', audience: 'Minister / Permanent Secretary / Policy Team', recommendedLength: '8–20 pages', exportFormats: ['pdf'],
    purpose: 'Frame evidence as policy problems, options, fiscal implications and decisions required.',
  },
  donor_report: {
    label: 'Donor Impact Report', audience: 'Donor / Development Partner', recommendedLength: '12–25 pages', exportFormats: ['pdf'],
    purpose: 'Show outcomes, value for money, inclusion, lessons, risks and next-cycle funding justification.',
  },
  policy_brief: {
    label: 'Policy Brief', audience: 'Government / Donor / Advocacy Leadership', recommendedLength: '4–8 pages', exportFormats: ['pdf'],
    purpose: 'Provide a concise policy problem, options and recommended direction.',
  },
  research_report: {
    label: 'Research Report', audience: 'Research Firm / M&E Specialist', recommendedLength: '20–60 pages', exportFormats: ['pdf', 'annex'],
    purpose: 'Document findings with methodology, sample, limitations, annexes and research transparency.',
  },
  technical_annex: {
    label: 'Technical Annex', audience: 'M&E / Data / Evaluation Team', recommendedLength: 'Variable', exportFormats: ['pdf', 'json', 'xlsx'],
    purpose: 'Expose detailed methodology, tables, definitions, metadata and appendices.',
  },
  statistical_annex: {
    label: 'Statistical Annex', audience: 'Researchers / Analysts', recommendedLength: 'Variable', exportFormats: ['pdf', 'json'],
    purpose: 'Present sample statistics, crosstabs, confidence level, missing data and indicator tables.',
  },
  infographic_report: {
    label: 'Infographic Report', audience: 'Executives / Public / Donor Communications', recommendedLength: '1–8 pages', exportFormats: ['html', 'pdf'],
    purpose: 'Translate evidence into publication-grade visual pages for rapid understanding.',
  },
  interactive_report: {
    label: 'Interactive Report', audience: 'All Users', recommendedLength: 'Web experience', exportFormats: ['html'],
    purpose: 'Enable progressive disclosure, evidence panels, assistant actions, filters and exports.',
  },
  community_version: {
    label: 'Community Version', audience: 'Community / Public Audience', recommendedLength: '1–4 pages', exportFormats: ['html', 'pdf'],
    purpose: 'Explain findings and actions in plain language with public-safe evidence.',
  },
  media_summary: {
    label: 'Media Summary', audience: 'Communications / Media', recommendedLength: '1–2 pages', exportFormats: ['pdf', 'html'],
    purpose: 'Provide public-safe headline facts and quotations without technical detail.',
  },
});

function arr(value) { return Array.isArray(value) ? value : []; }
function first(value, fallback = 'Insufficient verified evidence is available for this section.') { return value || fallback; }
function templateName(dm) { return dm?.metadata?.template_name || dm?.title || 'VoiceInsights Intelligence Report'; }
function orgName(dm) { return dm?.metadata?.organization_name || 'VoiceInsights Client'; }
function generatedAt(dm) { return dm?.metadata?.generated_at || new Date(0).toISOString(); }
function totalResponses(dm) { return Number(dm?.kpis?.total_responses || 0); }
function regionRows(dm) { return arr(dm?.demographics?.regions || dm?.statistical_tables?.regions); }
function genderRows(dm) { return arr(dm?.demographics?.gender || dm?.statistical_tables?.gender); }
function ageRows(dm) { return arr(dm?.demographics?.age || dm?.statistical_tables?.age); }
function sentimentRows(dm) { return arr(dm?.findings?.sentiment || dm?.statistical_tables?.sentiment); }
function recommendations(dm) { return dm?.recommendations || {}; }
function keyFindings(dm) { return arr(dm?.narrative?.key_findings).slice(0, 5); }
function risks(dm) { return arr(dm?.narrative?.risks).slice(0, 5); }
function opportunities(dm) { return arr(dm?.narrative?.opportunities).slice(0, 5); }

function recommendationItems(dm) {
  const recs = recommendations(dm);
  const tiers = [
    ['Immediate', 'Field/Operations Team', '0–30 days', recs.immediate],
    ['Medium-term', 'Programme Management', '30–90 days', recs.medium_term],
    ['Long-term', 'Country Leadership / Donor Liaison', '6–12 months', recs.long_term],
  ];
  return tiers.flatMap(([tier, owner, timeline, actions]) => arr(actions).map((action, index) => ({
    action, tier, owner, timeline, priority: index === 0 ? 'High' : 'Medium',
    evidenceType: dm?.is_demo ? 'Synthetic demo evidence' : 'Report-model evidence',
  })));
}

export function buildVRDSExecutiveSnapshot(dm) {
  const q = dm?.report_quality_gate_v19?.overall_score ?? dm?.intelligence_os_v7?.report_quality_gate?.overall_score ?? dm?.data_quality?.score ?? null;
  const confidence = classifyVRDSConfidence(q ?? dm?.kpis?.response_rate_pct ?? 0);
  const positive = sentimentRows(dm).find(s => String(s.label).toLowerCase() === 'positive');
  return {
    component: 'executiveSnapshot',
    component_spec: getVRDSComponentSpec('executiveSnapshot'),
    headline: first(dm?.narrative?.executive_summary, keyFindings(dm)[0]),
    kpis: [
      { label: 'Responses', value: totalResponses(dm), interpretation: `${totalResponses(dm)} responses form the evidence base for this report.` },
      { label: 'Response Rate', value: dm?.kpis?.response_rate_pct ?? '—', suffix: '%', interpretation: 'Higher response rates increase confidence in decision use.' },
      { label: 'Regions', value: dm?.kpis?.regions_covered ?? regionRows(dm).length ?? '—', interpretation: 'Coverage indicates the geographic spread of evidence.' },
      { label: 'Positive Sentiment', value: positive?.n && totalResponses(dm) ? Math.round((positive.n / totalResponses(dm)) * 100) : '—', suffix: '%', interpretation: 'Sentiment should be interpreted together with risks and qualitative evidence.' },
      { label: 'Quality', value: q ?? '—', suffix: q ? '/100' : '', interpretation: 'Quality score reflects completeness, fraud risk, and evidence coverage where available.' },
    ],
    confidence: { score: q, ...confidence },
    decision_required: recommendationItems(dm)[0]?.action || 'Review findings and assign an accountable decision owner.',
  };
}

export function buildVRDSDecisionDashboard(dm) {
  const items = recommendationItems(dm).slice(0, 6);
  return {
    component: 'decisionMatrix',
    component_spec: getVRDSComponentSpec('decisionMatrix'),
    title: 'Decision Dashboard',
    primary_decision: items[0]?.action || 'No decision is available until recommendations are verified.',
    matrix: items.map((item, index) => ({
      ...item,
      impact: index < 2 ? 'High' : 'Medium',
      effort: item.tier === 'Immediate' ? 'Low' : item.tier === 'Medium-term' ? 'Medium' : 'High',
      quadrant: item.tier === 'Immediate' ? 'Quick win' : item.tier === 'Medium-term' ? 'Strategic improvement' : 'Institutional investment',
    })),
  };
}

export function buildVRDSRiskDashboard(dm) {
  const riskItems = risks(dm).map((risk, index) => ({
    risk,
    likelihood: index === 0 ? 'High' : 'Medium',
    impact: index === 0 ? 'High' : 'Medium',
    severity: index === 0 ? 'High' : 'Medium',
    mitigation: recommendationItems(dm)[index]?.action || 'Assign mitigation owner and validate evidence.',
  }));
  return {
    component: 'riskMatrix',
    component_spec: getVRDSComponentSpec('riskMatrix'),
    title: 'Risk Dashboard',
    risks: riskItems,
    matrix_note: 'Risk positions are structured from existing narrative risks and recommendation priorities; they do not introduce new statistics.',
  };
}

export function buildVRDSEvidenceSummary(dm) {
  const trace = buildEvidenceTraceabilityV20(dm).slice(0, 8);
  const counts = trace.reduce((acc, item) => {
    const key = item.evidence_classification || item.evidence_label || 'report-model evidence';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    component: 'evidenceCard',
    component_spec: getVRDSComponentSpec('evidenceCard'),
    title: 'Evidence Summary',
    evidence_mix: Object.entries(counts).map(([label, count]) => ({ label, count, style: getVRDSEvidenceStyle(label) })),
    traceability: trace,
    rule: 'Raw-source evidence is only labelled when raw response/transcript/audio/consent metadata is present.',
  };
}

export function buildVRDSRegionalIntelligence(dm) {
  return {
    component: 'regionalIntelligenceCard',
    title: 'Regional Intelligence',
    regions: regionRows(dm).map(r => ({ region: r.label || r.region, responses: r.n ?? r.responses ?? 0 })),
    interpretation: regionRows(dm).length ? 'Regional patterns should guide where follow-up action is prioritized.' : 'Regional evidence is unavailable for this report.',
  };
}

export function buildVRDSDemographicIntelligence(dm) {
  return {
    component: 'demographicCard',
    title: 'Demographic Intelligence',
    gender: genderRows(dm),
    age: ageRows(dm),
    interpretation: 'Demographic interpretation should be used to assess inclusion and identify groups requiring follow-up.',
  };
}

export function buildVRDSRootCauseAnalysis(dm) {
  const topics = arr(dm?.findings?.topics).slice(0, 5);
  return {
    component: 'rootCauseTree',
    title: 'Root Cause Analysis',
    primary_issue: topics[0]?.topic || keyFindings(dm)[0] || 'Primary issue requires further verification.',
    drivers: topics.map((t, index) => ({ driver: t.topic, evidence_count: t.count, level: index === 0 ? 'primary' : 'contributing' })),
    limitation: topics.length ? 'Root-cause framing is based on observed topic patterns, not causal attribution.' : 'Insufficient verified evidence is available for root-cause analysis.',
  };
}

export function buildVRDSImplementationRoadmap(dm) {
  return {
    component: 'timeline',
    component_spec: getVRDSComponentSpec('timeline'),
    phases: [
      { phase: '0–30 days', actions: recommendationItems(dm).filter(r => r.tier === 'Immediate') },
      { phase: '30–90 days', actions: recommendationItems(dm).filter(r => r.tier === 'Medium-term') },
      { phase: '6–12 months', actions: recommendationItems(dm).filter(r => r.tier === 'Long-term') },
    ],
  };
}

export function buildVRDSExpectedImpact(dm) {
  return {
    component: 'opportunityCard',
    component_spec: getVRDSComponentSpec('opportunityCard'),
    title: 'Expected Impact',
    impact_statements: opportunities(dm).length ? opportunities(dm) : ['Expected impact requires follow-up measurement and should not be numerically estimated without supporting data.'],
    confidence_note: 'Impact language must remain tied to available evidence; unsupported percentage forecasts are not permitted.',
  };
}

export function buildVRDSReportLayout(reportType = 'executive_report') {
  const type = VRDS_REPORT_TYPES[reportType] || VRDS_REPORT_TYPES.executive_report;
  return {
    report_type: reportType,
    label: type.label,
    audience: type.audience,
    purpose: type.purpose,
    recommended_length: type.recommendedLength,
    export_formats: type.exportFormats,
    design_system: VRDS_VERSION,
    grid: {
      html: { columns: vrdsTokens.grid.htmlColumns, maxWidth: vrdsTokens.grid.maxWidth, sidebarWidth: vrdsTokens.grid.sidebarWidth, evidencePanelWidth: vrdsTokens.grid.evidencePanelWidth },
      pdf: vrdsExportTokens.pdf,
      pptx: vrdsExportTokens.pptx,
    },
    page_sequence: [
      'cover', 'executive_snapshot', 'executive_brief', 'decision_dashboard', 'risk_dashboard', 'evidence_summary',
      'regional_intelligence', 'demographic_intelligence', 'root_cause_analysis', 'recommendations', 'implementation_roadmap',
      'expected_impact', 'methodology', 'evidence_traceability', 'appendices',
    ],
  };
}

export function buildVRDSReportExperience(dm, reportType = 'executive_report') {
  const type = VRDS_REPORT_TYPES[reportType] ? reportType : 'executive_report';
  const methodology = buildMethodologyTransparencyV20(dm);
  const brief = buildOnePageExecutiveBriefV20(dm);
  const infographic = buildPublicationInfographicV20(dm);
  const sections = {
    cover: {
      component: 'cover',
      component_spec: getVRDSComponentSpec('cover'),
      title: templateName(dm),
      report_type: VRDS_REPORT_TYPES[type].label,
      organization: orgName(dm),
      country: dm?.demo_country || dm?.metadata?.country || 'Reported where available',
      date: generatedAt(dm),
      status: dm?.is_demo ? 'Demonstration Report — demo data only' : 'Client Report',
    },
    executive_snapshot: buildVRDSExecutiveSnapshot(dm),
    executive_brief: { component: 'executiveBrief', component_spec: getVRDSComponentSpec('executiveBrief'), ...brief },
    decision_dashboard: buildVRDSDecisionDashboard(dm),
    risk_dashboard: buildVRDSRiskDashboard(dm),
    evidence_summary: buildVRDSEvidenceSummary(dm),
    regional_intelligence: buildVRDSRegionalIntelligence(dm),
    demographic_intelligence: buildVRDSDemographicIntelligence(dm),
    root_cause_analysis: buildVRDSRootCauseAnalysis(dm),
    recommendations: { component: 'recommendationCard', component_spec: getVRDSComponentSpec('recommendationCard'), items: recommendationItems(dm) },
    implementation_roadmap: buildVRDSImplementationRoadmap(dm),
    expected_impact: buildVRDSExpectedImpact(dm),
    methodology: { component: 'methodologyCard', component_spec: getVRDSComponentSpec('methodologyCard'), ...methodology },
    evidence_traceability: buildEvidenceTraceabilityV20(dm).slice(0, 12),
    appendices: { statistical_annex: !!dm?.annexes, data_dictionary: arr(dm?.annexes?.questionnaire).length },
    infographic_pages: infographic.pages,
  };

  return sanitizePublicReportTextV20({
    vrds_version: VRDS_VERSION,
    vrds_report_experience_version: VRDS_REPORT_EXPERIENCE_VERSION,
    layout: buildVRDSReportLayout(type),
    tokens_reference: {
      colors: ['--vi-blue-900', '--vi-blue-700', '--vi-teal-700', '--vi-gold-500', '--vi-slate-900'],
      spacing: ['--space-16', '--space-24', '--space-32', '--space-48'],
      radius: ['--radius-card', '--radius-panel'],
    },
    sections,
    accessibility: {
      wcag_target: 'AA', chart_alt_text_required: true, color_only_meaning_allowed: false,
      keyboard_navigation_required: true, print_safe_required: true,
    },
    writing_standard: {
      tone: VRDS_REPORT_TYPES[type].audience,
      rules: ['decision before detail', 'evidence before opinion', 'no unsupported certainty', 'no raw JSON in public outputs'],
    },
  });
}

export function buildVRDSAllReportTypes(dm) {
  const out = {};
  for (const reportType of Object.keys(VRDS_REPORT_TYPES)) out[reportType] = buildVRDSReportExperience(dm, reportType);
  return out;
}
