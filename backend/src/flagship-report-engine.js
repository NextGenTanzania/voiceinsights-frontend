/**
 * VoiceInsights Flagship Report Engine™ v2 — Phase 1
 * Core decision-intelligence compiler for international research publications.
 *
 * Design principles:
 * - Never invent evidence, sample statistics, confidence, cost or policy claims.
 * - Distinguish measured values, analyst interpretation and scenarios.
 * - Block publication when evidence/methodology/limitations are materially incomplete.
 * - Produce audience-specific decision products from one governed report model.
 */

export const FLAGSHIP_REPORT_ENGINE_VERSION = '2.1.0-phase1';
export const FLAGSHIP_REPORT_ENGINE_NAME = 'VoiceInsights Flagship Report Engine™';

const arr = value => Array.isArray(value) ? value.filter(v => v !== null && v !== undefined && v !== '') : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const text = value => typeof value === 'string' ? value.trim() : '';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const slug = value => String(value || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const INTERNATIONAL_PUBLICATION_PROFILES = {
  un_agency: {
    label: 'UN Agency Evaluation & Intelligence Standard',
    audiences: ['Country Representative', 'Programme Director', 'Evaluation Manager', 'Donor'],
    mandatory: ['terms_of_reference', 'evaluation_questions', 'methodology', 'ethics', 'limitations', 'evidence', 'management_response'],
    emphasis: ['UNEG-aligned transparency', 'human rights and inclusion', 'gender equality', 'environmental and social implications', 'management response'],
    products: ['Executive Evaluation Report', 'Management Response Matrix', 'Country Office Brief', 'Technical Annex'],
  },
  world_bank: {
    label: 'World Bank Research & Decision Standard',
    audiences: ['Task Team Leader', 'Government Counterpart', 'Economist', 'M&E Specialist'],
    mandatory: ['sampling_frame', 'sample_design', 'instrument_version', 'field_protocol', 'weights_or_justification', 'data_quality', 'limitations', 'reproducibility'],
    emphasis: ['sampling validity', 'economic and policy implications', 'regional equity', 'data lineage', 'reproducible analysis'],
    products: ['Decision Intelligence Report', 'Policy Note', 'Statistical Annex', 'Reproducibility Pack'],
  },
  government: {
    label: 'Government & Cabinet Decision Standard',
    audiences: ['Minister', 'Permanent Secretary', 'Cabinet Secretariat', 'Technical Directorate'],
    mandatory: ['policy_problem', 'national_alignment', 'regional_analysis', 'fiscal_caution', 'implementation_risks', 'decision_required'],
    emphasis: ['cabinet clarity', 'national priorities', 'regional equity', 'legislative implications', 'budget implications'],
    products: ['Cabinet Memo', 'Minister Brief', 'Policy Intelligence Report', 'Regional Action Atlas'],
  },
  donor: {
    label: 'Donor Impact & Accountability Standard',
    audiences: ['Donor Programme Officer', 'Country Director', 'Grants Manager', 'Board'],
    mandatory: ['theory_of_change', 'results_chain', 'oecd_dac', 'inclusion', 'value_for_money', 'sustainability', 'lessons', 'management_response'],
    emphasis: ['contribution story', 'outcomes and impact', 'value for money', 'sustainability', 'next funding cycle'],
    products: ['Donor Impact Report', 'OECD-DAC Evaluation', 'Funding Brief', 'Results & Learning Annex'],
  },
  humanitarian: {
    label: 'Humanitarian Needs & Severity Standard',
    audiences: ['Humanitarian Coordinator', 'Cluster Lead', 'Emergency Director', 'Donor'],
    mandatory: ['affected_population', 'severity_method', 'protection', 'sector_needs', 'access_constraints', 'urgency', 'do_no_harm'],
    emphasis: ['severity', 'population movement', 'protection', 'WASH/health/food/shelter/education', 'accessibility and urgency'],
    products: ['Humanitarian Needs Assessment', 'Severity Overview', 'Cluster Briefs', 'Response Priority Matrix'],
  },
  corporate: {
    label: 'Corporate Executive Intelligence Standard',
    audiences: ['CEO', 'Board', 'Executive Committee', 'Business Unit Lead'],
    mandatory: ['business_question', 'kpis', 'financial_or_operational_implication', 'customer_or_employee_segments', 'decisions', 'owners'],
    emphasis: ['ROI', 'risk', 'customer/employee value', 'competitive position', 'accountability'],
    products: ['Executive Board Report', 'Management Dashboard', 'Investment Brief', 'Action Scorecard'],
  },
  research: {
    label: 'Technical Research & Statistical Standard',
    audiences: ['Principal Investigator', 'Statistician', 'Research Director', 'Peer Reviewer'],
    mandatory: ['research_questions', 'sampling', 'analysis_plan', 'reliability', 'validity', 'missing_data', 'limitations', 'data_dictionary'],
    emphasis: ['methodological transparency', 'statistical precision', 'reliability and validity', 'reproducibility', 'technical annexes'],
    products: ['Technical Research Report', 'Statistical Annex', 'Data Dictionary', 'Analysis Reproducibility Pack'],
  },
};

export const FLAGSHIP_SAMPLE_REPORTS = [
  { key: 'national_human_development', tier: 1, category: 'Government', title: 'National Human Development Intelligence Report', profile: 'world_bank', cover: { personality: 'National atlas', palette: 'deep blue · teal · gold', hero: 'National map with human-development index bands' } },
  { key: 'donor_impact_evaluation', tier: 1, category: 'UN & Donors', title: 'Donor Impact Evaluation Report', profile: 'donor', cover: { personality: 'Impact and accountability', palette: 'royal purple · indigo · white', hero: 'Theory-of-change impact chain' } },
  { key: 'government_policy_intelligence', tier: 1, category: 'Government', title: 'Government Policy Intelligence Report', profile: 'government', cover: { personality: 'Cabinet decision', palette: 'navy · civic blue · white', hero: 'Policy priority map and national emblem-safe layout' } },
  { key: 'humanitarian_needs_assessment', tier: 1, category: 'UN & Donors', title: 'Humanitarian Needs Assessment', profile: 'humanitarian', cover: { personality: 'Crisis severity', palette: 'orange · red · charcoal', hero: 'Severity map and affected-population timeline' } },
  { key: 'executive_board_intelligence', tier: 2, category: 'Corporate', title: 'Executive Board Intelligence Report', profile: 'corporate', cover: { personality: 'Board command', palette: 'black · gold · ivory', hero: 'Executive KPI wall and risk exposure' } },
  { key: 'customer_experience', tier: 2, category: 'Corporate', title: 'Customer Experience Intelligence Report', profile: 'corporate', cover: { personality: 'Customer journey', palette: 'midnight · cyan · silver', hero: 'Journey map and loyalty drivers' } },
  { key: 'employee_experience', tier: 2, category: 'Corporate', title: 'Employee Experience Intelligence Report', profile: 'corporate', cover: { personality: 'People and culture', palette: 'plum · coral · cream', hero: 'Engagement segmentation and retention risk' } },
  { key: 'community_scorecard', tier: 2, category: 'NGOs', title: 'Community Scorecard Intelligence Report', profile: 'donor', cover: { personality: 'Community accountability', palette: 'green · blue · warm white', hero: 'Community-provider agreement matrix' } },
  { key: 'annual_impact', tier: 2, category: 'NGOs', title: 'Annual Impact Intelligence Report', profile: 'donor', cover: { personality: 'Impact story', palette: 'emerald · navy · white', hero: 'Outcome pathway and beneficiary voice' } },
  { key: 'quarterly_performance', tier: 2, category: 'NGOs', title: 'Quarterly Performance Intelligence Report', profile: 'corporate', cover: { personality: 'Delivery performance', palette: 'cobalt · amber · white', hero: 'Traffic-light performance and action matrix' } },
  { key: 'market_intelligence', tier: 2, category: 'Corporate', title: 'Market Intelligence Report', profile: 'corporate', cover: { personality: 'Market opportunity', palette: 'charcoal · electric blue · gold', hero: 'Opportunity matrix and market segmentation' } },
  { key: 'citizen_voice', tier: 2, category: 'Government', title: 'Citizen Voice & Public Service Delivery Report', profile: 'government', cover: { personality: 'Public accountability', palette: 'civic blue · turquoise · white', hero: 'Ward/service heat map and trust gauge' } },
  { key: 'technical_research', tier: 3, category: 'Research', title: 'Technical Research Report', profile: 'research', cover: { personality: 'Academic precision', palette: 'white · graphite · blue', hero: 'Research design and statistical model' } },
  { key: 'statistical_annex', tier: 3, category: 'Research', title: 'Statistical Annex', profile: 'research', cover: { personality: 'Statistical evidence', palette: 'white · slate · burgundy', hero: 'Confidence intervals and model diagnostics' } },
  { key: 'interactive_intelligence', tier: 3, category: 'Research', title: 'Interactive Intelligence Report', profile: 'research', cover: { personality: 'Explore and drill down', palette: 'dark navy · neon teal · white', hero: 'Interactive evidence graph' } },
  { key: 'evidence_explorer', tier: 3, category: 'Research', title: 'Evidence Explorer & AI Research Companion', profile: 'un_agency', cover: { personality: 'Evidence traceability', palette: 'indigo · violet · white', hero: 'Claim-to-source evidence network' } },
];

export function normalizeFlagshipReport(input = {}) {
  const methodology = obj(input.methodology);
  const findings = arr(input.findings || input.key_findings || input.insights);
  const evidence = arr(input.evidence || input.evidence_traceability);
  const recommendations = arr(input.recommendations || input.actions || input.decisions);
  const risks = arr(input.risks || input.top_risks);
  return {
    id: input.id || input.report_id || null,
    title: text(input.title || input.report_title) || 'Untitled Intelligence Report',
    subtitle: text(input.subtitle),
    profile: input.profile || input.publication_profile || 'donor',
    sector: text(input.sector) || 'Cross-sector',
    country: text(input.country) || 'Not specified',
    geography: obj(input.geography),
    sample_size: num(input.sample_size || input.total_responses || input.responses),
    response_rate: num(input.response_rate),
    executive_summary: text(input.executive_summary || input.summary),
    findings,
    evidence,
    recommendations,
    risks,
    opportunities: arr(input.opportunities),
    kpis: arr(input.kpis || input.metrics),
    methodology,
    limitations: arr(input.limitations),
    demographics: obj(input.demographics || input.respondent_profile),
    sdgs: arr(input.sdgs || input.sdg_alignment),
    policy_context: obj(input.policy_context),
    theory_of_change: obj(input.theory_of_change),
    results_chain: obj(input.results_chain),
    budget: obj(input.budget),
    accessibility: obj(input.accessibility),
    ethics: obj(input.ethics),
    citations: arr(input.citations),
    metadata: obj(input.metadata),
  };
}

const itemText = item => typeof item === 'string' ? item : text(item?.claim || item?.finding || item?.insight || item?.title || item?.recommendation || item?.action || item?.risk);
const itemField = (item, key, fallback = null) => typeof item === 'object' && item ? (item[key] ?? fallback) : fallback;

export function buildExecutiveIntelligenceLayer(input = {}) {
  const report = normalizeFlagshipReport(input);
  const topFinding = itemText(report.findings[0]) || 'No validated critical finding is available.';
  const topRisk = itemText(report.risks[0]) || 'No validated strategic risk is available.';
  const topOpportunity = itemText(report.opportunities[0]) || 'No validated opportunity is available.';
  const decisions = report.recommendations.slice(0, 7).map((item, index) => ({
    rank: index + 1,
    decision: itemText(item),
    priority: itemField(item, 'priority', 'To be assigned'),
    owner: itemField(item, 'owner', 'To be assigned'),
    timeline: itemField(item, 'timeline', itemField(item, 'horizon', 'To be assigned')),
    budget_implication: itemField(item, 'budget_implication', itemField(item, 'cost', 'Not estimated')),
    monitoring_indicator: itemField(item, 'monitoring_indicator', 'To be defined'),
  }));
  const regional = arr(report.geography.regions || report.geography.areas).slice(0, 10);
  return {
    layer: 'Executive Intelligence',
    executive_headline: report.executive_summary || topFinding,
    executive_highlights: report.findings.slice(0, 5).map(itemText),
    critical_finding: topFinding,
    top_risk: topRisk,
    top_opportunity: topOpportunity,
    immediate_decisions: decisions,
    priority_actions: decisions.filter(d => String(d.priority).toLowerCase() === 'high').slice(0, 5),
    budget_implications: report.budget.implications || report.budget.summary || 'Not quantified; finance validation required before decision use.',
    regional_intelligence: regional,
    confidence_statement: report.evidence.length ? `${report.evidence.length} evidence item(s) are available for traceability review.` : 'Evidence confidence cannot be established because no evidence items are linked.',
    cost_of_inaction: text(input.cost_of_inaction) || 'Not modelled; scenario assumptions are required before estimating cost of inaction.',
    ownership_matrix: decisions.map(d => ({ decision: d.decision, owner: d.owner, timeline: d.timeline, indicator: d.monitoring_indicator })),
    narrative_arc: {
      context: `${report.title} examines ${report.sector} evidence in ${report.country}${report.sample_size ? ` from ${report.sample_size.toLocaleString()} responses` : ''}.`,
      signal: topFinding,
      implication: topRisk,
      decision: decisions[0]?.decision || 'Leadership decision pending validated recommendations.',
      accountability: !decisions[0] || decisions[0].owner === 'To be assigned' ? 'Ownership and delivery timeline must be assigned before publication.' : `${decisions[0].owner} is accountable within ${decisions[0].timeline}.`,
    },
  };
}

export function buildEvidenceIntelligenceLayer(input = {}) {
  const report = normalizeFlagshipReport(input);
  const source = report.evidence.length ? report.evidence : report.findings.map((finding, index) => ({ claim: itemText(finding), evidence_classification: 'unlinked report claim', confidence: null, verification_status: 'NOT_VERIFIED' }));
  const items = source.map((item, index) => {
    const confidence = num(itemField(item, 'confidence_score', itemField(item, 'confidence')));
    const pointers = {
      response_id: itemField(item, 'response_id'),
      transcript_id: itemField(item, 'transcript_id'),
      audio_key: itemField(item, 'audio_key'),
      photo_key: itemField(item, 'photo_key'),
      gps: itemField(item, 'gps'),
      survey_id: itemField(item, 'survey_id'),
      question_id: itemField(item, 'question_id'),
      enumerator_id: itemField(item, 'enumerator_id'),
      raw_data_url: itemField(item, 'raw_data_url'),
    };
    const linkedPointerCount = Object.values(pointers).filter(Boolean).length;
    return {
      evidence_id: itemField(item, 'evidence_id', itemField(item, 'id', `EV-${String(index + 1).padStart(4, '0')}`)),
      claim: itemText(item),
      quote: itemField(item, 'quote', itemField(item, 'respondent_quote')),
      evidence_classification: itemField(item, 'evidence_classification', itemField(item, 'evidence_type', 'report-model evidence')),
      pointers,
      confidence_score: confidence,
      verification_status: itemField(item, 'verification_status', linkedPointerCount ? 'SOURCE_LINKED' : 'NOT_SOURCE_LINKED'),
      reviewer: itemField(item, 'reviewer'),
      approval: itemField(item, 'approval_status', 'Pending review'),
      consent_status: itemField(item, 'consent_status', 'Not linked'),
      raw_source_available: linkedPointerCount > 0,
      traceability_score: Math.min(100, linkedPointerCount * 14 + (confidence !== null ? 15 : 0) + (itemField(item, 'reviewer') ? 15 : 0)),
    };
  });
  return {
    layer: 'Evidence Intelligence',
    total_evidence_items: items.length,
    source_linked_items: items.filter(i => i.raw_source_available).length,
    verified_items: items.filter(i => ['VERIFIED', 'APPROVED', 'SOURCE_LINKED'].includes(i.verification_status)).length,
    items,
    gaps: [
      ...(!items.length ? ['No evidence items are linked.'] : []),
      ...(items.some(i => !i.raw_source_available) ? ['One or more claims do not have a source pointer.'] : []),
      ...(items.some(i => i.confidence_score === null) ? ['One or more evidence items do not have a confidence assessment.'] : []),
      ...(items.some(i => i.consent_status === 'Not linked') ? ['Consent status is not linked for one or more respondent-level evidence items.'] : []),
    ],
  };
}

export function buildStatisticalIntelligenceLayer(input = {}) {
  const report = normalizeFlagshipReport(input);
  const m = report.methodology;
  const checks = {
    research_questions: Boolean(arr(m.research_questions || input.research_questions).length),
    sampling_frame: Boolean(m.sampling_frame),
    sample_design: Boolean(m.sample_design || m.sampling_design),
    sample_size: Boolean(report.sample_size && report.sample_size > 0),
    stratification: Boolean(m.stratification || m.strata),
    clustering: Boolean(m.clustering || m.clusters || m.cluster_design === 'not_applicable'),
    weights_or_justification: Boolean(m.weights || m.weighting || m.weights_not_required_reason),
    confidence_intervals: Boolean(m.confidence_intervals || m.margin_of_error),
    analysis_plan: Boolean(m.analysis_plan),
    missing_data: Boolean(m.missing_data || m.missingness),
    outliers: Boolean(m.outliers || m.outlier_protocol),
    reliability: Boolean(m.reliability || m.cronbach_alpha),
    validity: Boolean(m.validity || m.validity_protocol),
    instrument_version: Boolean(m.instrument_version),
    data_dictionary: Boolean(m.data_dictionary || m.data_dictionary_url),
    limitations: report.limitations.length > 0,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const readiness = Math.round((passed / Object.keys(checks).length) * 100);
  return {
    layer: 'Statistical Intelligence',
    sample_design: m.sample_design || m.sampling_design || 'Not documented',
    sampling_frame: m.sampling_frame || 'Not documented',
    sample_size: report.sample_size,
    weighting: m.weights || m.weighting || m.weights_not_required_reason || 'Not documented',
    confidence_interval: m.confidence_intervals || m.margin_of_error || 'Not calculated',
    regression: m.regression || m.models || 'Not provided',
    cross_tabs: arr(m.cross_tabs),
    trend_analysis: m.trend_analysis || 'Not provided',
    segmentation: m.segmentation || 'Not provided',
    correlation: m.correlation || 'Not provided',
    reliability: m.reliability || m.cronbach_alpha || 'Not assessed',
    validity: m.validity || m.validity_protocol || 'Not assessed',
    response_rate: report.response_rate,
    missing_data: m.missing_data || m.missingness || 'Not documented',
    outliers: m.outliers || m.outlier_protocol || 'Not documented',
    data_quality: m.data_quality || input.data_quality || 'Not measured',
    reproducibility: {
      analysis_plan: m.analysis_plan || null,
      instrument_version: m.instrument_version || null,
      data_dictionary: m.data_dictionary || m.data_dictionary_url || null,
      analysis_code: m.analysis_code || m.analysis_code_url || null,
    },
    readiness_score: readiness,
    checks,
    blocking_gaps: Object.entries(checks).filter(([, value]) => !value).map(([key]) => key),
  };
}

export function buildPolicyIntelligenceLayer(input = {}) {
  const report = normalizeFlagshipReport(input);
  const p = report.policy_context;
  return {
    layer: 'Policy Intelligence',
    policy_problem: p.policy_problem || itemText(report.findings[0]) || 'Not defined',
    current_policy: p.current_policy || 'Not documented',
    policy_gap: p.policy_gap || 'Not documented',
    suggested_policy: p.suggested_policy || itemText(report.recommendations[0]) || 'Not available',
    legislative_impact: p.legislative_impact || 'Requires legal review',
    budget_impact: p.budget_impact || report.budget.implications || 'Requires fiscal validation',
    regional_equity: p.regional_equity || 'Not assessed',
    national_priority: p.national_priority || 'Not mapped',
    sdg_mapping: report.sdgs,
    national_vision_alignment: p.national_vision_alignment || 'Not mapped',
    ministerial_recommendation: p.ministerial_recommendation || itemText(report.recommendations[0]) || 'Not available',
    cabinet_brief: {
      issue: p.policy_problem || itemText(report.findings[0]) || 'Not defined',
      options: arr(p.policy_options).slice(0, 4),
      decision_required: p.decision_required || itemText(report.recommendations[0]) || 'Decision not yet formulated',
      implementation_risks: report.risks.slice(0, 5).map(itemText),
    },
  };
}

export function buildDecisionIntelligenceLayer(input = {}) {
  const report = normalizeFlagshipReport(input);
  const evidence = buildEvidenceIntelligenceLayer(report);
  const defaultEvidenceIds = evidence.items.slice(0, 3).map(i => i.evidence_id);
  const decisions = report.recommendations.map((item, index) => ({
    decision_id: itemField(item, 'decision_id', `DEC-${String(index + 1).padStart(3, '0')}`),
    decision: itemText(item),
    why: itemField(item, 'why', itemField(item, 'rationale', itemText(report.findings[index] || report.findings[0]))),
    evidence_ids: arr(itemField(item, 'evidence_ids')).length ? arr(itemField(item, 'evidence_ids')) : defaultEvidenceIds,
    impact: itemField(item, 'impact', 'To be assessed'),
    priority: itemField(item, 'priority', 'To be assigned'),
    owner: itemField(item, 'owner', 'To be assigned'),
    timeline: itemField(item, 'timeline', itemField(item, 'horizon', 'To be assigned')),
    cost: itemField(item, 'cost', itemField(item, 'budget_implication', 'Not estimated')),
    risk: itemField(item, 'risk', itemText(report.risks[index] || report.risks[0]) || 'Not assessed'),
    dependencies: arr(itemField(item, 'dependencies')),
    expected_result: itemField(item, 'expected_result', 'To be defined'),
    monitoring_indicator: itemField(item, 'monitoring_indicator', 'To be defined'),
    confidence: num(itemField(item, 'confidence')),
  }));
  return {
    layer: 'Decision Intelligence',
    top_decision: decisions[0] || null,
    decisions,
    quick_wins: decisions.filter(d => /0.?30|immediate|quick/i.test(String(d.timeline))).slice(0, 5),
    medium_term: decisions.filter(d => /30.?90|1.?3 month|medium/i.test(String(d.timeline))).slice(0, 5),
    long_term: decisions.filter(d => /3.?12|long/i.test(String(d.timeline))).slice(0, 5),
    decision_matrix: decisions.map(d => ({ decision: d.decision, priority: d.priority, impact: d.impact, owner: d.owner, timeline: d.timeline, cost: d.cost, risk: d.risk })),
    gaps: [
      ...(!decisions.length ? ['No decision-ready recommendations are available.'] : []),
      ...(decisions.some(d => d.owner === 'To be assigned') ? ['One or more decisions do not have an accountable owner.'] : []),
      ...(decisions.some(d => d.timeline === 'To be assigned') ? ['One or more decisions do not have a delivery timeline.'] : []),
      ...(decisions.some(d => d.monitoring_indicator === 'To be defined') ? ['One or more decisions do not have a monitoring indicator.'] : []),
    ],
  };
}

function scoreDimension(name, checks, weight, blockers = []) {
  const entries = Object.entries(checks);
  const score = entries.length ? Math.round(entries.filter(([, value]) => Boolean(value)).length / entries.length * 100) : 0;
  return { name, score, weight, checks, blockers: blockers.filter(Boolean) };
}

export function evaluateFlagshipPublicationQuality(input = {}) {
  const report = normalizeFlagshipReport(input);
  const executive = buildExecutiveIntelligenceLayer(report);
  const evidence = buildEvidenceIntelligenceLayer(report);
  const statistics = buildStatisticalIntelligenceLayer(report);
  const decisions = buildDecisionIntelligenceLayer(report);
  const profile = INTERNATIONAL_PUBLICATION_PROFILES[report.profile] || INTERNATIONAL_PUBLICATION_PROFILES.donor;

  const dimensions = [
    scoreDimension('Executive Quality', {
      executive_summary: Boolean(report.executive_summary),
      critical_findings: report.findings.length >= 3,
      risks: report.risks.length >= 1,
      decisions: decisions.decisions.length >= 1,
      owner_and_timeline: decisions.decisions.length > 0 && decisions.decisions.every(d => d.owner !== 'To be assigned' && d.timeline !== 'To be assigned'),
    }, 14),
    scoreDimension('Evidence Integrity', {
      evidence_items: evidence.items.length >= 1,
      source_linkage: evidence.items.length > 0 && evidence.items.every(i => i.raw_source_available),
      confidence: evidence.items.length > 0 && evidence.items.every(i => i.confidence_score !== null),
      verification: evidence.items.length > 0 && evidence.items.every(i => i.verification_status !== 'NOT_VERIFIED'),
      consent: evidence.items.filter(i => i.pointers.response_id).every(i => i.consent_status !== 'Not linked'),
    }, 16, evidence.gaps),
    scoreDimension('Statistics', {
      sample_design: statistics.checks.sample_design,
      sample_size: statistics.checks.sample_size,
      weights: statistics.checks.weights_or_justification,
      confidence_intervals: statistics.checks.confidence_intervals,
      missing_data: statistics.checks.missing_data,
      reliability: statistics.checks.reliability,
      validity: statistics.checks.validity,
      reproducibility: statistics.checks.analysis_plan && statistics.checks.instrument_version && statistics.checks.data_dictionary,
    }, 14, statistics.blocking_gaps),
    scoreDimension('Methodology', {
      research_questions: statistics.checks.research_questions,
      sampling_frame: statistics.checks.sampling_frame,
      stratification: statistics.checks.stratification,
      field_protocol: Boolean(report.methodology.field_protocol || report.methodology.training_protocol),
      ethics: Object.keys(report.ethics).length > 0,
      limitations: report.limitations.length >= 1,
    }, 12),
    scoreDimension('Decision Intelligence', {
      decisions: decisions.decisions.length >= 1,
      evidence_linkage: decisions.decisions.length > 0 && decisions.decisions.every(d => d.evidence_ids.length),
      impact: decisions.decisions.length > 0 && decisions.decisions.every(d => d.impact !== 'To be assessed'),
      owner: decisions.decisions.length > 0 && decisions.decisions.every(d => d.owner !== 'To be assigned'),
      timeline: decisions.decisions.length > 0 && decisions.decisions.every(d => d.timeline !== 'To be assigned'),
      indicator: decisions.decisions.length > 0 && decisions.decisions.every(d => d.monitoring_indicator !== 'To be defined'),
    }, 12, decisions.gaps),
    scoreDimension('Storytelling', {
      narrative_arc: Object.values(executive.narrative_arc).every(Boolean),
      human_voice: evidence.items.some(i => Boolean(i.quote)),
      regional_story: executive.regional_intelligence.length > 0,
      implication: executive.top_risk !== 'No validated strategic risk is available.',
      cost_of_inaction: executive.cost_of_inaction && !executive.cost_of_inaction.startsWith('Not modelled'),
    }, 8),
    scoreDimension('Visualization Readiness', {
      kpis: report.kpis.length >= 3,
      geography: Object.keys(report.geography).length > 0,
      demographics: Object.keys(report.demographics).length > 0,
      risks: report.risks.length > 0,
      decisions: decisions.decisions.length > 0,
      sdgs: report.sdgs.length > 0,
    }, 7),
    scoreDimension('Accessibility', {
      language: Boolean(report.metadata.language || input.language),
      alt_text_policy: Boolean(report.accessibility.alt_text_policy),
      reading_order: Boolean(report.accessibility.reading_order),
      contrast_review: Boolean(report.accessibility.contrast_review),
      mobile_review: Boolean(report.accessibility.mobile_review),
    }, 5),
    scoreDimension('Citation & Consistency', {
      citations: report.citations.length > 0 || evidence.items.every(i => i.raw_source_available),
      evidence_ids: evidence.items.every(i => Boolean(i.evidence_id)),
      consistent_sample_size: report.sample_size !== null,
      terminology_review: Boolean(report.metadata.terminology_review),
      grammar_review: Boolean(report.metadata.grammar_review),
    }, 6),
    scoreDimension('Audience Standard', {
      profile_selected: Boolean(report.profile),
      mandatory_evidence: profile.mandatory.every(key => Boolean(input[key] || report.methodology[key] || report.policy_context[key] || report[key])),
      audience_products: profile.products.length >= 2,
      publication_purpose: Boolean(input.publication_purpose || report.metadata.publication_purpose),
    }, 6),
  ];

  const weighted = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0) / dimensions.reduce((sum, dimension) => sum + dimension.weight, 0));
  const hardBlockers = [
    !report.executive_summary && 'Executive summary is missing.',
    report.findings.length < 1 && 'No validated findings are available.',
    report.evidence.length < 1 && 'No evidence records are linked.',
    !Object.keys(report.methodology).length && 'Methodology is missing.',
    report.limitations.length < 1 && 'Limitations are missing.',
    decisions.decisions.length < 1 && 'No decision-ready recommendation is available.',
    evidence.items.some(i => !i.raw_source_available) && 'One or more claims lack source traceability.',
  ].filter(Boolean);
  const threshold = num(input.publication_threshold) || 90;
  const status = hardBlockers.length ? 'BLOCKED' : weighted >= threshold ? 'PASS' : weighted >= 80 ? 'CONDITIONAL_PASS' : 'BLOCKED';
  return {
    engine: FLAGSHIP_REPORT_ENGINE_NAME,
    version: FLAGSHIP_REPORT_ENGINE_VERSION,
    profile: { key: report.profile, ...profile },
    overall_score: weighted,
    threshold,
    status,
    publication_allowed: status === 'PASS',
    dimensions,
    hard_blockers: hardBlockers,
    required_actions: [...new Set(dimensions.flatMap(d => d.blockers).concat(hardBlockers))],
    governance: {
      reviewer_required: true,
      approval_required: true,
      no_invented_data: true,
      scenario_labelling_required: true,
      raw_source_claims_require_pointer: true,
    },
  };
}

export function buildFlagshipVisualizationPlan(input = {}) {
  const report = normalizeFlagshipReport(input);
  return [
    { visual: 'Executive KPI Cards', readiness: report.kpis.length >= 3, source: 'kpis' },
    { visual: 'Regional Heat Map', readiness: Object.keys(report.geography).length > 0, source: 'geography' },
    { visual: 'Population Pyramid', readiness: Boolean(report.demographics.age && report.demographics.gender), source: 'demographics' },
    { visual: 'Risk Matrix', readiness: report.risks.length > 0, source: 'risks' },
    { visual: 'Decision Matrix', readiness: report.recommendations.length > 0, source: 'recommendations' },
    { visual: 'Impact Chain', readiness: Object.keys(report.theory_of_change).length > 0 || Object.keys(report.results_chain).length > 0, source: 'theory_of_change/results_chain' },
    { visual: 'SDG Cards', readiness: report.sdgs.length > 0, source: 'sdgs' },
    { visual: 'Timeline', readiness: report.recommendations.some(r => itemField(r, 'timeline') || itemField(r, 'horizon')), source: 'recommendation timelines' },
    { visual: 'Benchmark Chart', readiness: Boolean(input.benchmarks), source: 'benchmarks' },
    { visual: 'Sankey / Journey Map', readiness: Boolean(input.journey || input.flow), source: 'journey/flow' },
    { visual: 'Opportunity Matrix', readiness: report.opportunities.length > 0, source: 'opportunities' },
    { visual: 'Evidence Network', readiness: report.evidence.length > 0, source: 'evidence traceability' },
  ];
}

export function compileFlagshipReport(input = {}) {
  const report = normalizeFlagshipReport(input);
  const executive = buildExecutiveIntelligenceLayer(report);
  const evidence = buildEvidenceIntelligenceLayer(report);
  const statistics = buildStatisticalIntelligenceLayer(report);
  const policy = buildPolicyIntelligenceLayer(report);
  const decisions = buildDecisionIntelligenceLayer(report);
  const qualityGate = evaluateFlagshipPublicationQuality(input);
  const profile = INTERNATIONAL_PUBLICATION_PROFILES[report.profile] || INTERNATIONAL_PUBLICATION_PROFILES.donor;
  const sampleArchetype = FLAGSHIP_SAMPLE_REPORTS.find(s => s.key === input.sample_archetype) || null;
  return {
    engine: FLAGSHIP_REPORT_ENGINE_NAME,
    version: FLAGSHIP_REPORT_ENGINE_VERSION,
    generated_at: new Date().toISOString(),
    report,
    publication_profile: { key: report.profile, ...profile },
    cover_system: sampleArchetype?.cover || input.cover || { personality: 'Executive intelligence', palette: 'navy · teal · white', hero: 'Evidence-to-decision visual' },
    layers: { executive, evidence, statistics, policy, decisions },
    visualization_plan: buildFlagshipVisualizationPlan(input),
    publication_products: profile.products,
    presentation_builder: {
      outputs: ['PowerPoint', 'Speaker Notes', 'Executive Talking Points', 'Meeting Slides', 'Board Deck', 'Minister Brief'],
      core_slides: ['Cover', 'Executive headline', 'KPI wall', 'Critical findings', 'Regional intelligence', 'Evidence confidence', 'Risk matrix', 'Decision matrix', 'Action roadmap'],
    },
    interactive_report: {
      drilldown: ['finding → evidence', 'evidence → quote/transcript/audio/photo/GPS', 'finding → region/demographic', 'recommendation → owner/timeline/indicator'],
      ai_grounding: 'Answers must cite evidence IDs and confidence; unsupported answers are blocked.',
    },
    export_engine: {
      pdf: 'publication-ready contract',
      powerpoint: 'presentation-ready contract',
      word: 'editable publication contract',
      excel: 'data and evidence workbook contract',
    },
    quality_gate: qualityGate,
  };
}

export function getFlagshipReportEngineCatalog() {
  return {
    engine: FLAGSHIP_REPORT_ENGINE_NAME,
    version: FLAGSHIP_REPORT_ENGINE_VERSION,
    phases: ['Executive Intelligence', 'Evidence Intelligence', 'Statistical Intelligence', 'Policy Intelligence', 'Decision Intelligence', 'Publication Quality Gate'],
    profiles: INTERNATIONAL_PUBLICATION_PROFILES,
    sample_reports: FLAGSHIP_SAMPLE_REPORTS,
  };
}
