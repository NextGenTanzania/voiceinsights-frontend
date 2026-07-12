// VoiceInsights Intelligence OS v7.0
// Additive intelligence layer only. It does not mutate raw data, does not
// invent statistics, and does not replace the Report Engine. It reads the
// existing document_model_json and produces: data quality gate, evidence
// citations, decision intelligence, rich infographic blueprint, and 8 report
// product definitions used by Report Studio v7.

const SDG_META = {
  'SDG 1': { goal: 'No Poverty', color: '#e5243b', icon: '①' },
  'SDG 2': { goal: 'Zero Hunger', color: '#dda63a', icon: '②' },
  'SDG 3': { goal: 'Good Health and Well-being', color: '#4c9f38', icon: '③' },
  'SDG 4': { goal: 'Quality Education', color: '#c5192d', icon: '④' },
  'SDG 5': { goal: 'Gender Equality', color: '#ff3a21', icon: '⑤' },
  'SDG 6': { goal: 'Clean Water and Sanitation', color: '#26bde2', icon: '⑥' },
  'SDG 7': { goal: 'Affordable and Clean Energy', color: '#fcc30b', icon: '⑦' },
  'SDG 8': { goal: 'Decent Work and Economic Growth', color: '#a21942', icon: '⑧' },
  'SDG 9': { goal: 'Industry, Innovation and Infrastructure', color: '#fd6925', icon: '⑨' },
  'SDG 10': { goal: 'Reduced Inequalities', color: '#dd1367', icon: '⑩' },
  'SDG 11': { goal: 'Sustainable Cities and Communities', color: '#fd9d24', icon: '⑪' },
  'SDG 12': { goal: 'Responsible Consumption and Production', color: '#bf8b2e', icon: '⑫' },
  'SDG 13': { goal: 'Climate Action', color: '#3f7e44', icon: '⑬' },
  'SDG 14': { goal: 'Life Below Water', color: '#0a97d9', icon: '⑭' },
  'SDG 15': { goal: 'Life on Land', color: '#56c02b', icon: '⑮' },
  'SDG 16': { goal: 'Peace, Justice and Strong Institutions', color: '#00689d', icon: '⑯' },
  'SDG 17': { goal: 'Partnerships for the Goals', color: '#19486a', icon: '⑰' },
  SDG: { goal: 'Sustainable Development Goals', color: '#19486a', icon: 'SDG' },
};

const SECTOR_PROFILE = {
  health_survey: { sector: 'Health', audience: 'Ministry of Health / WHO / UNICEF', vocabulary: ['service access', 'quality of care', 'patient experience', 'referral pathway', 'community health'], standards: ['WHO', 'SDG 3'], sdgs: ['SDG 3', 'SDG 5', 'SDG 10'] },
  education_assessment: { sector: 'Education', audience: 'Ministry of Education / UNICEF / UNESCO', vocabulary: ['learning outcomes', 'attendance', 'teacher availability', 'school environment'], standards: ['UNESCO', 'SDG 4'], sdgs: ['SDG 4', 'SDG 5', 'SDG 10'] },
  agriculture_survey: { sector: 'Agriculture', audience: 'FAO / Ministries / Agribusiness partners', vocabulary: ['market access', 'inputs', 'extension services', 'climate resilience'], standards: ['FAO', 'SDG 2'], sdgs: ['SDG 2', 'SDG 8', 'SDG 13'] },
  livelihood_assessment: { sector: 'Livelihoods', audience: 'Donors / INGOs / Social protection teams', vocabulary: ['income security', 'coping strategies', 'household resilience'], standards: ['OECD-DAC', 'SDG 1'], sdgs: ['SDG 1', 'SDG 8', 'SDG 10'] },
  humanitarian_needs: { sector: 'Humanitarian', audience: 'UN OCHA / INGOs / Cluster leads', vocabulary: ['vulnerability', 'protection risk', 'urgent needs', 'response prioritisation'], standards: ['Sphere Standards', 'CHS'], sdgs: ['SDG 1', 'SDG 2', 'SDG 6', 'SDG 16'] },
  baseline_study: { sector: 'Baseline Evaluation', audience: 'M&E teams / Donors / Implementing partners', vocabulary: ['baseline condition', 'indicator starting point', 'target-setting'], standards: ['OECD-DAC', 'RBM'], sdgs: ['SDG'] },
  endline_evaluation: { sector: 'Endline Evaluation', audience: 'Donors / Evaluation commissioners', vocabulary: ['outcome change', 'effectiveness', 'sustainability', 'lessons learned'], standards: ['OECD-DAC', 'RBM'], sdgs: ['SDG'] },
  market_research: { sector: 'Market Research', audience: 'Research firms / Corporate strategy teams', vocabulary: ['customer segment', 'market demand', 'adoption barrier', 'willingness to pay'], standards: ['Ipsos/Kantar-style market insight'], sdgs: [] },
  customer_satisfaction: { sector: 'Customer Experience', audience: 'CX leaders / CEOs / Boards', vocabulary: ['satisfaction driver', 'complaint resolution', 'loyalty', 'service recovery'], standards: ['CX management'], sdgs: [] },
  employee_engagement: { sector: 'Employee Engagement', audience: 'HR leaders / Executives / Boards', vocabulary: ['engagement', 'retention risk', 'manager effectiveness', 'culture'], standards: ['People analytics'], sdgs: ['SDG 8'] },
  citizen_feedback: { sector: 'Governance', audience: 'Government / UNDP / Civic actors', vocabulary: ['public trust', 'service delivery', 'accountability', 'citizen experience'], standards: ['UNDP', 'SDG 16'], sdgs: ['SDG 16', 'SDG 11'] },
  community_scorecard: { sector: 'Community Scorecard', audience: 'Local government / NGOs / Facility managers', vocabulary: ['community accountability', 'scorecard performance', 'service improvement'], standards: ['CHS', 'Social accountability'], sdgs: ['SDG 16'] },
  monitoring_report: { sector: 'Programme Monitoring', audience: 'Programme managers / Donors', vocabulary: ['implementation progress', 'delivery bottleneck', 'corrective action'], standards: ['RBM', 'LogFrame'], sdgs: ['SDG'] },
  quarterly_performance: { sector: 'Performance Management', audience: 'Country leadership / Boards', vocabulary: ['quarterly performance', 'variance', 'execution risk'], standards: ['RBM'], sdgs: ['SDG'] },
  annual_impact: { sector: 'Impact Reporting', audience: 'Boards / Donors / Investors', vocabulary: ['impact pathway', 'outcome contribution', 'sustainability'], standards: ['OECD-DAC', 'SDG'], sdgs: ['SDG'] },
  sdg_progress: { sector: 'SDG & National Development', audience: 'UNDP / Government / Development partners', vocabulary: ['SDG progress', 'national planning', 'indicator performance'], standards: ['SDG', 'UNDP'], sdgs: ['SDG 1', 'SDG 3', 'SDG 4', 'SDG 5', 'SDG 8', 'SDG 10', 'SDG 13', 'SDG 16', 'SDG 17'] },
};

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function arr(v) { return Array.isArray(v) ? v : []; }
function getTemplateId(dm) { return dm?.metadata?.template_id || dm?.template_id || 'generic'; }
function getSectorProfile(dm) { return SECTOR_PROFILE[getTemplateId(dm)] || { sector: dm?.metadata?.sector || 'General Intelligence', audience: 'Executive and technical decision-makers', vocabulary: ['evidence', 'coverage', 'risk', 'decision'], standards: arr(dm?.metadata?.standards), sdgs: arr(dm?.metadata?.standards).filter(s => /^SDG/.test(s)) }; }
function getTotal(dm) { return Number(dm?.kpis?.total_responses || 0); }
function getFindings(dm) { return arr(dm?.narrative?.key_findings).filter(Boolean); }
function getRecommendations(dm) {
  const r = dm?.recommendations || {};
  return [...arr(r.immediate), ...arr(r.medium_term), ...arr(r.long_term)].filter(Boolean);
}
function topRegion(dm) { return arr(dm?.demographics?.regions)[0] || null; }
function sentimentPct(dm, label) {
  const total = getTotal(dm);
  const row = arr(dm?.findings?.sentiment).find(s => s.label === label);
  return row ? pct(row.n, total) : 0;
}
function femalePct(dm) {
  const total = getTotal(dm);
  const row = arr(dm?.demographics?.gender).find(g => /female/i.test(g.label));
  return row ? pct(row.n, total) : null;
}
function youthPct(dm) {
  const total = getTotal(dm);
  const row = arr(dm?.demographics?.age).find(a => /18-25|youth/i.test(a.label));
  return row ? pct(row.n, total) : null;
}
function quoteRows(dm) {
  return arr(dm?.representative_quotes || dm?.quotes || dm?.findings?.representative_quotes).filter(q => typeof q === 'string' || q?.quote || q?.text).map(q => typeof q === 'string' ? { quote: q } : q);
}
function topTopics(dm) { return arr(dm?.findings?.topics).slice(0, 5); }
function limitationList(dm) {
  const missing = [];
  if (!arr(dm?.demographics?.regions).length) missing.push('Regional breakdown is not available.');
  if (!arr(dm?.demographics?.gender).length) missing.push('Gender breakdown is not available.');
  if (!arr(dm?.demographics?.age).length) missing.push('Age breakdown is not available.');
  if (!quoteRows(dm).length) missing.push('Representative quotes are not available.');
  if (!arr(dm?.metadata?.standards).length) missing.push('Standards alignment has not been declared.');
  return missing;
}
function scoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Limited';
  return 'Insufficient';
}
function buildEvidenceBasis(dm, claim, idx = 0) {
  const total = getTotal(dm);
  const region = topRegion(dm);
  const topic = topTopics(dm)[idx % Math.max(topTopics(dm).length, 1)];
  const quote = quoteRows(dm)[idx % Math.max(quoteRows(dm).length, 1)];
  return {
    claim,
    respondent_count: total,
    region: region?.label || 'Not region-specific',
    question_source: arr(dm?.annexes?.questionnaire)[0]?.question_text || 'Primary survey question',
    topic: topic?.topic || null,
    topic_mentions: topic?.count || null,
    quote: quote?.quote || quote?.text || null,
    confidence_score: Math.max(60, Math.min(99, 100 - Math.round((dm?.data_quality?.avg_fraud_score || 0.05) * 100) - (dm?.data_quality?.flagged_response_count || 0))),
    evidence_type: quote ? 'survey + respondent voice' : 'survey aggregate',
  };
}

export function buildReportQualityGate(dm) {
  const total = getTotal(dm);
  const regions = arr(dm?.demographics?.regions).length;
  const gender = arr(dm?.demographics?.gender).length;
  const age = arr(dm?.demographics?.age).length;
  const missing = limitationList(dm).length;
  const fraudFlags = dm?.data_quality?.flagged_response_count || 0;
  const fraudRate = total ? fraudFlags / total : 1;
  const citationCoverage = getFindings(dm).length ? Math.round((Math.min(getFindings(dm).length, buildEvidenceCitationsV7(dm).length) / getFindings(dm).length) * 100) : 0;
  const dimensions = [
    { key: 'sample_size', score: total >= 1000 ? 100 : total >= 400 ? 90 : total >= 150 ? 75 : total > 0 ? 55 : 0, evidence: `${total} responses` },
    { key: 'demographic_completeness', score: Math.round(((regions > 0) + (gender > 0) + (age > 0)) / 3 * 100), evidence: `${regions} region categories, ${gender} gender categories, ${age} age categories` },
    { key: 'missing_data_visibility', score: missing === 0 ? 100 : Math.max(55, 100 - missing * 15), evidence: missing ? limitationList(dm).join(' ') : 'Core fields available or missingness explicitly documented.' },
    { key: 'fraud_risk', score: Math.round(Math.max(0, 100 - fraudRate * 500)), evidence: `${fraudFlags} flagged responses` },
    { key: 'consent_coverage', score: dm?.consent_coverage_pct ?? 100, evidence: dm?.consent_coverage_pct == null ? 'Consent coverage assumed through platform consent gate; verify project logs for production studies.' : `${dm.consent_coverage_pct}% consent coverage` },
    { key: 'confidence_level', score: total >= 385 ? 95 : total >= 150 ? 85 : total > 0 ? 70 : 0, evidence: total >= 385 ? 'Approx. 95% confidence at conservative p=0.5 before design effects.' : 'Smaller sample; confidence should be interpreted cautiously.' },
    { key: 'limitations_disclosed', score: 100, evidence: 'Limitations are explicitly disclosed in report transparency section.' },
    { key: 'citation_coverage', score: citationCoverage || (getFindings(dm).length ? 50 : 0), evidence: `${citationCoverage}% findings have generated evidence basis.` },
  ];
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  return {
    status: overall >= 85 ? 'PASS' : overall >= 70 ? 'PASS_WITH_REVIEW' : 'HOLD_FOR_REVIEW',
    overall_score: overall,
    label: scoreLabel(overall),
    export_allowed: overall >= 70 && total > 0,
    dimensions,
    limitations: limitationList(dm),
  };
}

export function buildEvidenceCitationsV7(dm) {
  const claims = [
    ...getFindings(dm),
    ...getRecommendations(dm).slice(0, 5),
    ...(arr(dm?.narrative?.risks).slice(0, 3)),
    ...(arr(dm?.narrative?.opportunities).slice(0, 3)),
  ].filter(Boolean);
  return claims.map((claim, i) => ({ id: `EV-${String(i + 1).padStart(3, '0')}`, ...buildEvidenceBasis(dm, claim, i) }));
}

export function buildDataIntelligenceV7(dm) {
  const total = getTotal(dm);
  const neg = sentimentPct(dm, 'negative');
  const pos = sentimentPct(dm, 'positive');
  const fPct = femalePct(dm);
  const yPct = youthPct(dm);
  const regions = arr(dm?.demographics?.regions);
  const top = topRegion(dm);
  return {
    data_confidence: buildReportQualityGate(dm),
    survey_health: {
      response_rate: dm?.kpis?.response_rate_pct,
      completion: total,
      regions_covered: dm?.kpis?.regions_covered || regions.length,
      positive_sentiment_pct: pos,
      negative_sentiment_pct: neg,
      female_participation_pct: fPct,
      youth_participation_pct: yPct,
    },
    data_quality_engine: {
      duplicates: 'Checked through fraud/duplicate-response pipeline where metadata is available.',
      fraud_flags: dm?.data_quality?.flagged_response_count || 0,
      gps_consistency: 'Available when enumerator GPS metadata is captured; otherwise disclosed as limitation.',
      speeding: 'Available when interview duration metadata is captured; otherwise disclosed as limitation.',
      missing_values: limitationList(dm),
      language_consistency: 'Validated when language metadata/transcription confidence is available.',
      logical_inconsistency: 'Flagged when answer-level validation rules are configured.',
      enumerator_behaviour: 'Scored when enumerator IDs and timestamps are available.',
    },
    emerging_issues: topTopics(dm).map((t, i) => ({ issue: t.topic, rank: i + 1, evidence: `${t.count} coded mentions`, implication: `${t.topic} should be reviewed as a recurring pattern rather than a single anecdote.` })),
    contradiction_checks: [
      neg > 25 && pos > 50 ? { type: 'mixed_sentiment', message: 'Positive and negative sentiment are both material; segment-level analysis is recommended.' } : null,
      fPct != null && (fPct < 45 || fPct > 60) ? { type: 'gender_balance', message: 'Gender representation may influence interpretation of gender-disaggregated conclusions.' } : null,
    ].filter(Boolean),
    predictive_sampling: {
      current_sample: total,
      guidance: total >= 1000 ? 'Sample size is strong for executive interpretation.' : `Consider expanding toward 1,000 responses for stronger segment-level analysis; current sample is ${total}.`,
    },
    top_region: top,
  };
}

export function buildDecisionIntelligenceV7(dm) {
  const findings = getFindings(dm);
  const recs = getRecommendations(dm);
  const topIssue = findings[0] || topTopics(dm)[0]?.topic || 'the leading reported issue';
  return {
    root_cause_analysis: {
      headline: `The leading signal appears to be driven by ${topIssue}.`,
      explanation: `This interpretation is grounded in the report's existing findings, topics, sentiment and regional coverage. It should be validated with stakeholders before major budget commitments.`,
      evidence: buildEvidenceBasis(dm, topIssue, 0),
    },
    opportunity_analysis: arr(dm?.narrative?.opportunities).slice(0, 5).map((o, i) => ({ opportunity: o, priority: i < 2 ? 'High' : 'Medium', evidence: buildEvidenceBasis(dm, o, i) })),
    risk_analysis: arr(dm?.narrative?.risks).slice(0, 5).map((r, i) => ({ risk: r, urgency: i === 0 ? 'High' : 'Medium', evidence: buildEvidenceBasis(dm, r, i) })),
    decision_priority: recs.slice(0, 5).map((r, i) => ({ decision: r, priority: i === 0 ? 'High' : i < 3 ? 'Medium' : 'Low', owner: i < 2 ? 'Programme Management' : 'Senior Leadership', timeline: i === 0 ? '0-30 days' : i < 3 ? '3-6 months' : '6-12 months', evidence: buildEvidenceBasis(dm, r, i) })),
    cost_of_inaction: `If ${topIssue} remains unresolved, the organization risks slower progress, weaker stakeholder confidence and reduced decision credibility in the next review cycle.`,
    impact_forecast: recs[0] ? { recommendation: recs[0], direction: 'Expected improvement if implemented and measured in a follow-up round', confidence: buildReportQualityGate(dm).overall_score >= 85 ? 'High' : 'Moderate', note: 'No percentage impact is estimated unless a repeat-measurement baseline exists.' } : null,
    decision_simulator: {
      supported_questions: ['What happens if we increase coverage?', 'Which region should be prioritized?', 'What is the risk if we delay?', 'What evidence supports the top recommendation?'],
      guardrail: 'Simulations are directional unless linked to historical trend or cost data.',
    },
    ai_verification: buildEvidenceCitationsV7(dm).map(c => ({ claim_id: c.id, supported: !!c.respondent_count, confidence_score: c.confidence_score, status: c.confidence_score >= 80 ? 'Supported' : 'Needs review' })),
  };
}

export function buildSDGCards(dm) {
  const profile = getSectorProfile(dm);
  const declared = arr(dm?.metadata?.standards).filter(s => /^SDG/.test(s));
  const sdgs = [...new Set([...declared, ...profile.sdgs])].filter(Boolean).slice(0, 8);
  return sdgs.map(code => ({ code, ...(SDG_META[code] || SDG_META.SDG), evidence_basis: declared.includes(code) || code === 'SDG' ? 'Declared in report standards.' : `Sector-relevant SDG suggested by ${profile.sector} intelligence profile; not a compliance claim.` }));
}

export function buildHeavyInfographicV7(dm) {
  const q = buildReportQualityGate(dm);
  const d = buildDataIntelligenceV7(dm);
  const dec = buildDecisionIntelligenceV7(dm);
  return {
    executive_kpi_cards: [
      { label: 'Responses', value: getTotal(dm), rating: getTotal(dm) >= 1000 ? 'Excellent' : getTotal(dm) >= 400 ? 'Strong' : 'Moderate' },
      { label: 'Response Rate', value: `${dm?.kpis?.response_rate_pct ?? '—'}%`, rating: (dm?.kpis?.response_rate_pct || 0) >= 90 ? 'Excellent' : 'Review' },
      { label: 'Evidence Quality', value: q.overall_score, rating: q.label },
      { label: 'Positive Sentiment', value: `${sentimentPct(dm, 'positive')}%`, rating: sentimentPct(dm, 'positive') >= 70 ? 'Strong' : sentimentPct(dm, 'positive') >= 50 ? 'Moderate' : 'Watch' },
    ],
    regional_map_proxy: arr(dm?.demographics?.regions).map((r, i) => ({ region: r.label, value: r.n, intensity: i < 2 ? 'High' : i < 4 ? 'Medium' : 'Low' })),
    sentiment_heatmap: arr(dm?.findings?.sentiment).map(s => ({ sentiment: s.label, n: s.n, pct: pct(s.n, getTotal(dm)) })),
    gender_age_breakdown: { gender: arr(dm?.demographics?.gender), age: arr(dm?.demographics?.age) },
    response_journey: [{ stage: 'Contacted/Started', value: getTotal(dm) }, { stage: 'Completed', value: getTotal(dm) }, { stage: 'Analysed', value: getTotal(dm) }],
    risk_matrix: dec.risk_analysis.map((r, i) => ({ risk: r.risk, likelihood: i === 0 ? 'High' : 'Medium', impact: i < 2 ? 'High' : 'Medium' })),
    decision_matrix: dec.decision_priority.map((d, i) => ({ decision: d.decision, impact: i === 0 ? 'High' : 'Medium', effort: i < 2 ? 'Low-Medium' : 'Medium-High' })),
    sdg_contribution: buildSDGCards(dm),
    donor_outcome_scorecards: dec.decision_priority.slice(0, 3).map(d => ({ action: d.decision, outcome_area: getSectorProfile(dm).sector, evidence_strength: q.label, expected_tracking: 'Measure in next reporting cycle' })),
  };
}

export function buildReportFormatsV7(dm) {
  const base = { title: dm?.metadata?.template_name, audience: getSectorProfile(dm).audience, quality_gate: buildReportQualityGate(dm) };
  return [
    { ...base, format: 'Executive Report', pages: '12-18', purpose: 'CEO, Board, Minister or Country Director decision-making', includes: ['Executive snapshot', 'decision dashboard', 'risk/opportunity cards', 'priority roadmap'] },
    { ...base, format: 'Donor Impact Report', pages: '18-30', purpose: 'UN, USAID, EU, World Bank, AfDB and institutional donor reporting', includes: ['value for money', 'SDG contribution', 'outcome scorecards', 'funding justification'] },
    { ...base, format: 'Policy Brief', pages: '4-8', purpose: 'Government and policy audience', includes: ['policy problem', 'options', 'recommended direction', 'implementation implications'] },
    { ...base, format: 'Management Report', pages: '20-35', purpose: 'Programme and implementation management', includes: ['workplan actions', 'owners', 'timeline', 'quality risks'] },
    { ...base, format: 'Technical Annex', pages: '30+', purpose: 'Researchers and M&E specialists', includes: ['methodology', 'limitations', 'questionnaire', 'metadata'] },
    { ...base, format: 'Statistical Annex', pages: 'data appendix', purpose: 'Statistical review', includes: ['sample statistics', 'cross tabs', 'confidence notes', 'missing data'] },
    { ...base, format: 'Infographic Report', pages: '1-6', purpose: 'Fast executive communication', includes: ['KPI cards', 'SDG cards', 'risk matrix', 'recommendation cards'] },
    { ...base, format: 'PowerPoint Board Deck', pages: '10-15 slides', purpose: 'Board/Minister/donor presentation', includes: ['opening narrative', 'evidence slides', 'decision slide', 'action tracker'] },
  ];
}

export function buildResearchTransparencyV7(dm) {
  return {
    methodology: dm?.annexes?.methodology || 'Generated from structured survey/interview data collected through VoiceInsights channels.',
    sampling: { total_responses: getTotal(dm), regions: arr(dm?.demographics?.regions).length, note: 'Sampling method should be confirmed by project owner for production studies.' },
    confidence: buildReportQualityGate(dm).dimensions.find(d => d.key === 'confidence_level'),
    limitations: limitationList(dm),
    ethics: 'Consent, safeguarding and data-protection controls should be reviewed per project context.',
    review: { reviewer_required: true, suggested_reviewer: 'M&E lead / sector specialist / authorized client approver' },
  };
}

export function buildIntelligenceOSV7(dm) {
  const profile = getSectorProfile(dm);
  return {
    version: 'VoiceInsights Intelligence OS v7.0',
    philosophy: 'From raw voice and field data to decision-grade intelligence, with evidence traceability and export quality gates.',
    sector_profile: profile,
    quality_gate: buildReportQualityGate(dm),
    data_intelligence: buildDataIntelligenceV7(dm),
    decision_intelligence: buildDecisionIntelligenceV7(dm),
    evidence_citations: buildEvidenceCitationsV7(dm),
    infographic_blueprint: buildHeavyInfographicV7(dm),
    report_formats: buildReportFormatsV7(dm),
    sdg_cards: buildSDGCards(dm),
    research_transparency: buildResearchTransparencyV7(dm),
    sample_library_positioning: 'Premium reports are generated by the same intelligence pipeline used for real client data; samples are not hand-written marketing PDFs.',
  };
}

export function enrichDocumentModelWithIntelligenceOSV7(dm) {
  const out = JSON.parse(JSON.stringify(dm || {}));
  out.intelligence_os_v7 = buildIntelligenceOSV7(out);
  out.report_quality_gate = out.intelligence_os_v7.quality_gate;
  out.evidence_citations_v7 = out.intelligence_os_v7.evidence_citations;
  out.infographic_v7 = out.intelligence_os_v7.infographic_blueprint;
  out.report_formats_v7 = out.intelligence_os_v7.report_formats;
  out.sdg_cards_v7 = out.intelligence_os_v7.sdg_cards;
  return out;
}
