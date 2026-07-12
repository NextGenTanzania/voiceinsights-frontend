import { runAIAssurancePipeline, buildEvidenceTrace, INSUFFICIENT_EVIDENCE } from './ai-assurance-pipeline.js';

const arr = v => Array.isArray(v) ? v : [];
const txt = v => String(v ?? '').trim();
const SUPPORTED_REPORT_TYPES = ['executive','donor','government','policy_brief','board','technical','statistical_annex','research','impact'];

function verifiedText(items, fallback = INSUFFICIENT_EVIDENCE) {
  const ok = arr(items).filter(x => x.verified).map(x => x.claim);
  return ok.length ? ok : [fallback];
}

function actionRows(verifiedRecommendations) {
  return arr(verifiedRecommendations).filter(x => x.verified).map((x, i) => ({
    priority: i < 2 ? 'HIGH' : i < 5 ? 'MEDIUM' : 'LOW', action: x.claim,
    evidence_ids: x.citation_ids, confidence: x.confidence.score,
    owner: 'To be assigned during approval', timeframe: 'To be confirmed', verification_status: x.verification_status,
  }));
}

export function buildExecutiveIntelligence(assurance = {}, context = {}) {
  const findings = verifiedText(assurance.claims);
  const actions = actionRows(assurance.recommendations);
  return {
    executive_summary: assurance.publication_gate?.publication_allowed
      ? `${findings.length} verified insight(s) were identified from dataset ${assurance.dataset_id || 'provided'}. All included statements passed evidence and citation checks.`
      : INSUFFICIENT_EVIDENCE,
    key_insights: findings,
    priority_actions: actions,
    decision_matrix: actions.map(a => ({ decision: a.action, urgency: a.priority, evidence_strength: a.confidence, decision_status: 'HUMAN_DECISION_REQUIRED' })),
    risk_matrix: arr(context.risks).map(r => ({ ...r, evidence_required: true })),
    opportunity_matrix: arr(context.opportunities).map(o => ({ ...o, evidence_required: true })),
    root_cause_analysis: arr(context.root_causes).length ? context.root_causes : [{ status: INSUFFICIENT_EVIDENCE, note: 'Root causes require explicit causal evidence; correlation alone is not accepted.' }],
    cost_of_inaction: context.cost_of_inaction?.evidence_ids?.length ? context.cost_of_inaction : { status: INSUFFICIENT_EVIDENCE },
    implementation_roadmap: actions.map((a, i) => ({ phase: i < 2 ? '0–30 days' : i < 5 ? '31–90 days' : '3–12 months', ...a })),
  };
}

export function generatePublicationReadyReport(input = {}) {
  const reportType = txt(input.report_type).toLowerCase();
  if (!SUPPORTED_REPORT_TYPES.includes(reportType)) throw new Error(`Unsupported report type: ${reportType}`);
  const assurance = runAIAssurancePipeline(input);
  const traces = [...assurance.claims, ...assurance.recommendations].flatMap(buildEvidenceTrace);
  const executive = buildExecutiveIntelligence(assurance, input.context || {});
  return {
    report_engine_version: 'v215.0', report_id: input.report_id, report_type: reportType,
    publication_status: assurance.publication_gate.status,
    publication_ready: assurance.publication_gate.publication_allowed,
    title: txt(input.title || `${reportType.replace('_',' ')} report`),
    assurance,
    sections: {
      executive_summary: executive.executive_summary,
      key_insights: executive.key_insights,
      methodology: input.methodology || { status: INSUFFICIENT_EVIDENCE },
      findings: assurance.claims,
      recommendations: assurance.recommendations,
      executive_intelligence: executive,
      limitations: arr(input.limitations),
      evidence_traceability: traces,
      ai_governance: assurance.governance,
    },
    export_policy: {
      pdf: assurance.publication_gate.publication_allowed,
      docx: assurance.publication_gate.publication_allowed,
      pptx: assurance.publication_gate.publication_allowed,
      xlsx: reportType === 'statistical_annex' && assurance.publication_gate.publication_allowed,
      watermark: assurance.publication_gate.publication_allowed ? null : 'DRAFT — NOT APPROVED FOR PUBLICATION',
    },
  };
}

export function validateReportExport(report = {}, format = 'pdf') {
  const allowed = report.publication_ready === true && report.export_policy?.[String(format).toLowerCase()] === true;
  return { allowed, status: allowed ? 'EXPORT_ALLOWED' : 'EXPORT_BLOCKED', reason: allowed ? null : 'Publication gate has not passed.' };
}

export { SUPPORTED_REPORT_TYPES };
