// VoiceInsights v184 Infographic Layout Engine
// Builds publication-style infographic page specifications from the report layout.

import { vrdsTokens } from './vrds-foundation.js';
import { buildCoreEvidence, list, text } from './report-layout-engine.js';

export const V184_INFOGRAPHIC_VERSION = 'v184-publication-infographic-layout';

function safePalette() {
  return { primary: vrdsTokens.colors.blue700, evidence: vrdsTokens.evidenceColors.reportModel, risk: vrdsTokens.riskColors.high, success: vrdsTokens.colors.green600, neutral: vrdsTokens.colors.slate700 };
}

function page(id, title, headline, main_visual, supporting = [], decision = '', evidence = '') {
  return {
    id,
    title,
    headline,
    layout: 'publication_page',
    visual_hierarchy: ['headline', 'primary_visual', 'supporting_insights', 'decision_implication', 'evidence_label'],
    main_visual,
    supporting_insight_cards: supporting.slice(0, 4),
    decision_implication: decision || 'Use this evidence to prioritise the next management decision.',
    evidence_label: evidence,
    print_safe: true,
    mobile_safe: true,
    clutter_control: 'One primary visual per page; maximum four supporting insight cards.',
  };
}

export function buildInfographicLayout(documentModel = {}, formatKey = 'infographic_report') {
  const palette = safePalette();
  const evidence = buildCoreEvidence(documentModel);
  const kpis = documentModel.kpis || {};
  const demographics = documentModel.demographics || {};
  const narrative = documentModel.narrative || {};
  const recs = documentModel.recommendations || {};
  const recommendations = [...list(recs.immediate), ...list(recs.medium_term), ...list(recs.long_term)].slice(0, 5);
  const risks = list(narrative.risks).slice(0, 4);
  const findings = list(narrative.key_findings).slice(0, 5);

  const commonEvidence = evidence.evidence_label;
  const pages = [
    page('executive-kpi-dashboard', 'Executive KPI Dashboard', 'Performance at a glance', {
      type: 'kpi_wall',
      metrics: [
        { label: 'Responses', value: kpis.total_responses || 0, emphasis: 'primary' },
        { label: 'Response rate', value: `${kpis.response_rate_pct || 0}%`, emphasis: 'success' },
        { label: 'Regions covered', value: kpis.regions_covered || list(demographics.regions).length || 0, emphasis: 'neutral' },
        { label: 'Confidence', value: `${evidence.confidence_score}%`, emphasis: 'evidence' },
      ],
    }, findings.slice(0, 3).map(f => ({ title: 'Executive insight', body: f })), recommendations[0], commonEvidence),
    page('regional-intelligence', 'Regional Intelligence', 'Performance varies by geography', {
      type: 'regional_ranked_map_panel',
      regions: list(demographics.regions).slice(0, 8),
      map_treatment: 'ranked regional panel; choropleth-ready when boundaries are available',
    }, list(demographics.regions).slice(0, 4).map(r => ({ title: r.label || 'Region', body: `${r.n || 0} responses` })), 'Prioritise lower-coverage regions for follow-up.', commonEvidence),
    page('gender-inclusion-profile', 'Gender & Inclusion Profile', 'Inclusion patterns indicate who is being heard', {
      type: 'inclusion_split',
      groups: list(demographics.gender).slice(0, 6),
    }, list(demographics.gender).slice(0, 4).map(g => ({ title: g.label || 'Group', body: `${g.n || 0} responses` })), 'Use inclusion gaps to adjust outreach and programme delivery.', commonEvidence),
    page('youth-age-profile', 'Youth & Age Profile', 'Age distribution shapes programme interpretation', {
      type: 'age_distribution',
      groups: list(demographics.age).slice(0, 8),
    }, list(demographics.age).slice(0, 4).map(g => ({ title: g.label || 'Age group', body: `${g.n || 0} responses` })), 'Tailor response strategies by age cohort.', commonEvidence),
    page('sentiment-dashboard', 'Sentiment Dashboard', 'Sentiment provides an early signal of trust and experience', {
      type: 'sentiment_bar',
      sentiment: list(documentModel.findings?.sentiment).slice(0, 5),
    }, list(documentModel.findings?.sentiment).slice(0, 4).map(s => ({ title: s.label || 'Sentiment', body: `${s.n || 0} mentions` })), 'Address negative sentiment drivers before they become reputational risks.', commonEvidence),
    page('risk-matrix', 'Risk Matrix', 'Top risks require assigned mitigation', {
      type: 'risk_matrix',
      axes: { x: 'Likelihood', y: 'Severity' },
      risks: risks.map((r, i) => ({ label: r, likelihood: i === 0 ? 'High' : 'Medium', severity: i < 2 ? 'High' : 'Medium' })),
    }, risks.map(r => ({ title: 'Risk', body: r })), 'Assign owners to high-severity risks immediately.', commonEvidence),
    page('decision-matrix', 'Decision Matrix', 'Prioritise actions by impact and effort', {
      type: 'impact_effort_matrix',
      decisions: recommendations.map((r, i) => ({ label: r, impact: i < 2 ? 'High' : 'Medium', effort: i === 0 ? 'Moderate' : 'Higher' })),
    }, recommendations.slice(0, 4).map((r, i) => ({ title: `Priority ${i + 1}`, body: r })), 'Start with high-impact, moderate-effort actions.', commonEvidence),
    page('evidence-quality-dashboard', 'Evidence Quality Dashboard', 'Confidence and evidence quality determine decision risk', {
      type: 'quality_meter',
      confidence_score: evidence.confidence_score,
      evidence_quality_score: evidence.evidence_quality_score,
      evidence_type: evidence.evidence_label,
    }, evidence.representative_evidence.slice(0, 3).map(e => ({ title: e.evidence_classification, body: e.quote })), 'Use high-confidence sections for immediate decisions; validate lower-confidence gaps.', commonEvidence),
    page('recommendation-priority', 'Recommendation Priorities', 'Recommendations are ranked for action, not listed for reading', {
      type: 'priority_ladder',
      recommendations: recommendations.map((r, i) => ({ rank: i + 1, recommendation: r })),
    }, recommendations.slice(0, 4).map((r, i) => ({ title: `Action ${i + 1}`, body: r })), 'Convert top recommendations into tracked actions.', commonEvidence),
    page('implementation-timeline', 'Implementation Timeline', 'The report translates evidence into a sequenced roadmap', {
      type: 'timeline',
      milestones: recommendations.slice(0, 4).map((r, i) => ({ label: r, timeframe: i === 0 ? '0–30 days' : i === 1 ? '30–60 days' : i === 2 ? '60–90 days' : '90+ days' })),
    }, [{ title: 'Execution rule', body: 'Each action needs an owner, due date and follow-up evidence.' }], 'Use the timeline as the first management action plan.', commonEvidence),
    page('impact-forecast', 'Impact Forecast', 'Expected impact is expressed as a responsible directional forecast', {
      type: 'impact_forecast',
      confidence: evidence.confidence_score,
      forecast_basis: 'Directional forecast based on response volume, quality score and recommendation priority.',
      expected_change: evidence.confidence_score >= 85 ? 'Meaningful improvement likely if top actions are implemented' : 'Moderate improvement possible; validate evidence gaps first',
    }, [{ title: 'Forecast caution', body: 'Forecasts are decision-support estimates, not causal guarantees.' }], 'Use expected impact to prioritise resources.', commonEvidence),
    page('donor-impact-summary', 'Donor Impact Summary', 'Evidence is translated into outputs, outcomes and funding logic', {
      type: 'donor_logic_panel',
      outputs: ['Respondents reached', 'Regions covered', 'Evidence gaps identified'],
      outcomes: findings.slice(0, 3),
      value_for_money_note: 'Cost ratios require budget data; this report does not invent cost-per-outcome metrics.',
    }, [{ title: 'Funding implication', body: recommendations[0] || 'Prioritise evidence-based implementation follow-up.' }], 'Use this page for funding-cycle and donor update conversations.', commonEvidence),
    page('government-policy-options', 'Government Policy Options', 'Policy choices are framed by feasibility and implementation risk', {
      type: 'policy_options_panel',
      options: recommendations.slice(0, 3).map((r, i) => ({ option: r, fiscal_implication: i === 0 ? 'Low to moderate' : 'Requires planning', risk: risks[i] || risks[0] || 'Implementation risk to be monitored' })),
    }, [{ title: 'Decision required', body: recommendations[0] || 'Approve a targeted corrective action plan.' }], 'Use this page to brief ministries and senior public managers.', commonEvidence),
    page('board-one-page-summary', 'Board One-page Summary', 'The board sees decisions, risks and confidence — not operational clutter', {
      type: 'board_summary',
      insights: findings.slice(0, 5),
      decisions_required: recommendations.slice(0, 3),
      top_risks: risks.slice(0, 3),
      confidence_score: evidence.confidence_score,
    }, [{ title: 'Board rule', body: 'Maximum five insights and three decisions.' }], 'Use this page to approve decisions and assign executive ownership.', commonEvidence),
    page('sdg-aligned-contribution', 'SDG-aligned Contribution', 'Where relevant, the report connects local evidence to development goals', {
      type: 'sdg_alignment_cards',
      standards: list(documentModel.metadata?.standards).filter(s => /SDG/i.test(s)).slice(0, 6),
      note: 'SDG-aligned visual cards; official UN SDG logo assets are not used unless separately licensed/included.',
    }, [{ title: 'Alignment caution', body: 'Alignment indicates contribution logic, not official SDG certification.' }], 'Use SDG alignment to support strategic communication and donor reporting.', commonEvidence),
  ];

  return {
    infographic_layout_version: V184_INFOGRAPHIC_VERSION,
    format: formatKey,
    palette,
    pages,
    quality_target: '9.5/10 publication-grade structure; visual QA still required on staging/browser output.',
  };
}
