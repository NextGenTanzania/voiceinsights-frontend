import { buildIntelligenceOSV7 } from './intelligence-os.js';
import { buildReportQualityGateV19, buildEvidenceTraceabilityV19, buildTrueInfographicRendererV19, buildSDGVisualCardsV19, buildAIVerificationLayerV19 } from './report-trust.js';

function arr(v) { return Array.isArray(v) ? v : []; }
function clean(s) { return String(s || '').replace(/This card reuses[^.]+\./gi, '').trim(); }

export function buildReportStudioV7(documentModel) {
  const dm = documentModel || {};
  const ios = dm.intelligence_os_v7 || buildIntelligenceOSV7(dm);
  const trust = {
    quality_gate: dm.report_quality_gate_v19 || buildReportQualityGateV19(dm),
    evidence_traceability: dm.evidence_traceability_v19 || buildEvidenceTraceabilityV19(dm),
    true_infographic: dm.true_infographic_v19 || buildTrueInfographicRendererV19(dm),
    sdg_visual_cards: dm.sdg_visual_cards_v19 || buildSDGVisualCardsV19(dm),
    ai_verification: dm.ai_verification_v19 || buildAIVerificationLayerV19(dm),
  };
  const narrative = dm.narrative || {};
  const recs = dm.recommendations || {};
  const findings = arr(narrative.key_findings).map(clean).filter(Boolean);
  const allRecs = [...arr(recs.immediate), ...arr(recs.medium_term), ...arr(recs.long_term)].map(clean).filter(Boolean);
  return {
    studio_version: 'Report Studio v7.0',
    title: dm?.metadata?.template_name || 'VoiceInsights Intelligence Report',
    subtitle: dm?.metadata?.campaign_name || '',
    demo_notice: dm.is_demo ? 'Demonstration Report — demo data only. Fictional sample data for product evaluation purposes.' : null,
    cover: {
      classification: dm.is_demo ? 'DEMONSTRATION' : 'CLIENT CONFIDENTIAL',
      report_id: dm.id || null,
      prepared_for: dm?.metadata?.organization_name,
      standards: arr(dm?.metadata?.standards),
      sector: ios.sector_profile.sector,
    },
    executive_snapshot: {
      responses: dm?.kpis?.total_responses || 0,
      response_rate: dm?.kpis?.response_rate_pct,
      regions: dm?.kpis?.regions_covered,
      quality_score: trust.quality_gate.overall_score || ios.quality_gate.overall_score,
      quality_label: trust.quality_gate.label || ios.quality_gate.label,
      export_status: trust.quality_gate.status || ios.quality_gate.status,
      verification_status: trust.ai_verification.status,
      top_decision: ios.decision_intelligence.decision_priority?.[0]?.decision || null,
    },
    executive_story: {
      summary: clean(narrative.executive_summary) || `${dm?.metadata?.template_name || 'This report'} converts respondent evidence into executive decisions, risk priorities and action pathways.`,
      three_biggest_findings: findings.slice(0, 3),
      three_biggest_risks: ios.decision_intelligence.risk_analysis.slice(0, 3),
      three_biggest_opportunities: ios.decision_intelligence.opportunity_analysis.slice(0, 3),
    },
    intelligence_chapters: [
      { id: 'data-quality', title: 'Research Quality Certificate', data: trust.quality_gate },
      { id: 'evidence', title: 'Clickable Evidence Traceability', data: trust.evidence_traceability.slice(0, 10) },
      { id: 'ai-verification', title: 'AI Verification Before Export', data: trust.ai_verification },
      { id: 'root-cause', title: 'Root Cause Analysis', data: ios.decision_intelligence.root_cause_analysis },
      { id: 'risk-radar', title: 'AI Risk Radar', data: ios.decision_intelligence.risk_analysis },
      { id: 'decision-matrix', title: 'Decision Matrix', data: ios.infographic_blueprint.decision_matrix },
      { id: 'sdgs', title: 'SDG Visual Cards', data: trust.sdg_visual_cards },
      { id: 'true-infographic', title: 'True Infographic Renderer', data: trust.true_infographic },
      { id: 'roadmap', title: 'Priority Roadmap', data: ios.decision_intelligence.decision_priority },
      { id: 'formats', title: 'Available Report Products', data: ios.report_formats },
    ],
    report_products: {
      executive_report: { findings: findings.slice(0, 5), recommendations: allRecs.slice(0, 5), decision_needed: ios.decision_intelligence.decision_priority?.[0] },
      donor_impact_report: { funding_justification: 'Invest in the highest-severity constraint first, then verify impact through repeat measurement.', outcome_scorecards: ios.infographic_blueprint.donor_outcome_scorecards },
      policy_brief: { policy_problem: ios.decision_intelligence.root_cause_analysis.headline, policy_options: allRecs.slice(0, 3), recommended_direction: arr(recs.long_term)[0] || allRecs[0] },
      management_report: { action_matrix: ios.decision_intelligence.decision_priority, owners: [...new Set(ios.decision_intelligence.decision_priority.map(d => d.owner))] },
      technical_annex: ios.research_transparency,
      statistical_annex: dm?.annexes?.statistical_tables || {},
      infographic_report: trust.true_infographic,
      powerpoint_board_deck: { slides: ['Cover', 'Executive snapshot', 'Top findings', 'Risk radar', 'Decision matrix', 'SDG cards', 'Recommended decisions', 'Next steps'] },
    },
    phase19_trust_layer: trust,
    guardrails: {
      no_fabricated_statistics: true,
      no_fabricated_standards: true,
      evidence_required_for_claims: true,
      human_review_recommended: true,
    },
  };
}
