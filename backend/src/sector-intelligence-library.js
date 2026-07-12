// ============================================================
// PHASE 18 — SECTOR INTELLIGENCE LIBRARY
// ------------------------------------------------------------
// A reusable, deterministic interpretation layer that improves the
// professional language of reports WITHOUT changing the underlying
// Report Engine, templates, findings, recommendations, benchmarks,
// quality scores, or numeric outputs.
//
// Design rules:
// - No Claude calls.
// - No fabricated statistics.
// - No fabricated standards compliance.
// - No new findings or recommendations are invented.
// - All interpretation text is derived from document_model_json fields
//   that already exist: metadata, KPIs, demographics, topics, findings,
//   recommendations, standards and quality indicators.
// ============================================================

const COMMON_AUDIENCE_LANGUAGE = {
  government: 'Frame the implication as policy prioritisation, service-delivery accountability and budget-cycle alignment.',
  donor: 'Frame the implication as evidence strength, funding justification, risk mitigation and measurable implementation follow-up.',
  ngo: 'Frame the implication as programme adaptation, frontline learning and community accountability.',
  ingo: 'Frame the implication as portfolio management, safeguarding of outcomes and multi-country learning.',
  un_agency: 'Frame the implication as mandate alignment, SDG contribution, inclusion and system-strengthening.',
  research_institution: 'Frame the implication as evidence quality, representativeness, methodological transparency and repeat measurement.',
  private_sector: 'Frame the implication as customer value, operational efficiency, retention risk and growth opportunity.',
  board: 'Frame the implication as decision priority, governance risk, investment need and accountability for execution.',
  ceo: 'Frame the implication as strategic direction, resource allocation and execution discipline.',
  programme_manager: 'Frame the implication as operational planning, prioritisation, ownership and monitoring.',
  field_coordinator: 'Frame the implication as practical field action, respondent follow-up and local implementation barriers.',
};

const DEFAULT_LIBRARY = {
  id: 'general_intelligence',
  name: 'General Decision Intelligence',
  applicable_templates: [],
  aliases: ['general', 'monitoring_evaluation'],
  professional_vocabulary: ['evidence base', 'response pattern', 'implementation signal', 'decision pathway', 'priority constraint'],
  executive_phrases: [
    'The evidence points to a clear management priority rather than an isolated operational concern.',
    'The data should be used as a decision input, not merely as a descriptive survey output.',
    'Follow-up should focus on the highest-severity constraint first, then track whether the pattern changes over time.',
  ],
  international_terminology: ['results-based management', 'accountability', 'evidence-informed planning', 'implementation learning'],
  policy_terminology: ['policy prioritisation', 'public-service responsiveness', 'budget-cycle alignment'],
  programme_terminology: ['programme adaptation', 'field implementation', 'monitoring cadence'],
  donor_terminology: ['funding justification', 'risk mitigation', 'measurable follow-up'],
  risk_terminology: ['implementation risk', 'credibility risk', 'service-delivery bottleneck'],
  recommendation_language: {
    immediate: 'Start with the most actionable constraint and assign ownership immediately.',
    medium_term: 'Translate the finding into a programme-design adjustment and track progress in the next review cycle.',
    long_term: 'Institutionalise the response through policy, budget or system-level alignment.',
  },
  impact_language: ['implementation effectiveness', 'decision confidence', 'stakeholder trust'],
  standards: ['SDG', 'OECD-DAC', 'RBM'],
  interpretation_rules: {
    response_rate_high: 'This response rate provides a strong evidence base for management interpretation, subject to the sampling design used by the project.',
    response_rate_medium: 'This response rate is usable for programme learning, though leadership should review non-response patterns before making high-stakes decisions.',
    response_rate_low: 'This response rate should be treated cautiously and may require targeted follow-up before major decisions are made.',
    data_quality_high: 'The quality score supports executive use of the report as an evidence base for planning and accountability.',
    data_quality_medium: 'The quality score is adequate for internal learning, but sensitive decisions should include analyst review.',
    data_quality_low: 'The quality score indicates that additional verification is needed before relying on the report for high-stakes decisions.',
    sentiment_positive: 'The sentiment pattern suggests the programme has a usable foundation, while remaining constraints should be addressed through targeted follow-up.',
    sentiment_negative: 'The sentiment pattern indicates reputational or implementation risk that should be reviewed by leadership.',
  },
};

const SECTOR_LIBRARIES = [
  {
    ...DEFAULT_LIBRARY,
    id: 'health_intelligence',
    name: 'Health Intelligence',
    applicable_templates: ['health_survey'],
    aliases: ['health', 'public_health'],
    professional_vocabulary: ['service utilisation', 'quality of care', 'health-system access', 'patient experience', 'continuity of care'],
    international_terminology: ['WHO-aligned service quality', 'universal health coverage', 'patient-centred care', 'health equity'],
    policy_terminology: ['health-service planning', 'referral pathway', 'coverage gaps', 'facility readiness'],
    standards: ['SDG', 'WHO'],
    interpretation_rules: {
      ...DEFAULT_LIBRARY.interpretation_rules,
      response_rate_high: 'This response rate exceeds commonly accepted thresholds for population health surveys, increasing confidence in the representativeness of programme findings.',
      sentiment_positive: 'Positive sentiment in a health survey should be read as a service-experience signal, while access, waiting time and medicine availability remain the operational issues to examine first.',
    },
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'education_intelligence',
    name: 'Education Intelligence',
    applicable_templates: ['education_assessment'],
    aliases: ['education'],
    professional_vocabulary: ['learning outcomes', 'school participation', 'teaching quality', 'attendance', 'education equity'],
    international_terminology: ['UNESCO-aligned learning outcomes', 'inclusive education', 'foundational learning', 'school retention'],
    policy_terminology: ['school-quality improvement', 'teacher support', 'learning recovery', 'education-sector planning'],
    standards: ['SDG', 'UNESCO', 'UNICEF'],
    interpretation_rules: {
      ...DEFAULT_LIBRARY.interpretation_rules,
      response_rate_high: 'This response rate provides a strong basis for interpreting school-level or learner-experience patterns, subject to the sampling frame used.',
      sentiment_positive: 'Positive sentiment in an education assessment suggests a usable foundation, but disparities by location, age or gender should still guide programme targeting.',
    },
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'agriculture_intelligence',
    name: 'Agriculture Intelligence',
    applicable_templates: ['agriculture_survey'],
    aliases: ['agriculture', 'food_security'],
    professional_vocabulary: ['smallholder productivity', 'market access', 'input affordability', 'extension services', 'climate resilience'],
    international_terminology: ['FAO-aligned food systems', 'climate-smart agriculture', 'resilient livelihoods', 'value-chain access'],
    policy_terminology: ['agricultural extension', 'input subsidy targeting', 'market linkage', 'rural finance'],
    standards: ['SDG', 'FAO'],
    interpretation_rules: {
      ...DEFAULT_LIBRARY.interpretation_rules,
      response_rate_high: 'This response rate gives a strong evidence base for interpreting farmer experience across the sampled production areas.',
      sentiment_positive: 'Positive sentiment among farmers should be interpreted alongside constraints such as market access, input costs and climate risk, which often determine whether satisfaction translates into productivity.',
    },
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'livelihood_intelligence',
    name: 'Livelihood Intelligence',
    applicable_templates: ['livelihood_assessment'],
    aliases: ['livelihood', 'economic_resilience'],
    professional_vocabulary: ['income security', 'household resilience', 'asset base', 'coping strategy', 'economic vulnerability'],
    international_terminology: ['resilience programming', 'social protection linkages', 'economic inclusion', 'household vulnerability'],
    standards: ['SDG', 'World Bank', 'ILO'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'humanitarian_intelligence',
    name: 'Humanitarian Intelligence',
    applicable_templates: ['humanitarian_needs'],
    aliases: ['humanitarian', 'emergency'],
    professional_vocabulary: ['priority needs', 'vulnerability concentration', 'protection risk', 'coping capacity', 'assistance gap'],
    international_terminology: ['Sphere Standards', 'Core Humanitarian Standard', 'protection mainstreaming', 'needs severity'],
    risk_terminology: ['acute vulnerability', 'protection exposure', 'service-access gap', 'dignity risk'],
    standards: ['CHS', 'Sphere', 'SDG'],
    interpretation_rules: {
      ...DEFAULT_LIBRARY.interpretation_rules,
      response_rate_high: 'This response rate supports rapid humanitarian prioritisation, while triangulation with operational and protection data remains important before final targeting decisions.',
      sentiment_negative: 'Negative sentiment in a humanitarian assessment should be treated as an early warning signal where service gaps, protection risks or unmet needs may be concentrating.',
    },
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'evaluation_intelligence',
    name: 'Evaluation Intelligence',
    applicable_templates: ['baseline_study', 'endline_evaluation', 'monitoring_report', 'quarterly_performance', 'annual_impact', 'sdg_progress'],
    aliases: ['evaluation', 'monitoring_evaluation', 'impact'],
    professional_vocabulary: ['results chain', 'outcome signal', 'implementation fidelity', 'performance trajectory', 'learning agenda'],
    international_terminology: ['OECD-DAC criteria', 'results-based management', 'logical framework', 'SDG progress tracking'],
    policy_terminology: ['planning cycle', 'performance review', 'accountability framework', 'national development alignment'],
    standards: ['SDG', 'OECD-DAC', 'RBM', 'LogFrame'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'citizen_feedback_intelligence',
    name: 'Citizen Feedback Intelligence',
    applicable_templates: ['citizen_feedback', 'community_scorecard'],
    aliases: ['citizen_feedback', 'community_scorecard', 'governance', 'public_sector'],
    professional_vocabulary: ['citizen experience', 'service responsiveness', 'trust signal', 'complaint resolution', 'social accountability'],
    international_terminology: ['participatory accountability', 'service-delivery feedback', 'public trust', 'citizen-centred governance'],
    standards: ['SDG', 'UNDP'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'market_research_intelligence',
    name: 'Market Research Intelligence',
    applicable_templates: ['market_research', 'customer_satisfaction'],
    aliases: ['market_research', 'customer_experience', 'private_sector'],
    professional_vocabulary: ['customer value', 'purchase intent', 'market adoption', 'retention risk', 'brand trust'],
    international_terminology: ['customer experience management', 'market segmentation', 'loyalty driver', 'growth opportunity'],
    policy_terminology: ['not primarily policy-oriented'],
    standards: ['CX', 'Market Research'],
    interpretation_rules: {
      ...DEFAULT_LIBRARY.interpretation_rules,
      sentiment_positive: 'Positive sentiment should be interpreted as a customer-retention asset, while complaint themes identify the operating levers most likely to improve loyalty.',
    },
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'employee_engagement_intelligence',
    name: 'Employee Engagement Intelligence',
    applicable_templates: ['employee_engagement'],
    aliases: ['employee_engagement', 'hr'],
    professional_vocabulary: ['engagement driver', 'retention risk', 'workforce confidence', 'management trust', 'career-development signal'],
    international_terminology: ['employee experience', 'organizational health', 'talent retention', 'workforce productivity'],
    standards: ['HR Analytics'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'financial_inclusion_intelligence',
    name: 'Financial Inclusion Intelligence',
    applicable_templates: [],
    aliases: ['financial_inclusion', 'access_to_finance', 'digital_payments'],
    professional_vocabulary: ['financial access', 'credit constraint', 'digital transaction behaviour', 'affordability barrier', 'trust in providers'],
    international_terminology: ['financial inclusion', 'responsible finance', 'digital financial services', 'MSME finance'],
    standards: ['World Bank', 'AfDB', 'SDG'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'wash_intelligence',
    name: 'Water & Sanitation Intelligence',
    applicable_templates: [],
    aliases: ['wash', 'water_sanitation'],
    professional_vocabulary: ['water access', 'sanitation coverage', 'hygiene behaviour', 'service reliability', 'community health risk'],
    international_terminology: ['WASH service level', 'safe water access', 'hygiene promotion', 'public-health protection'],
    standards: ['SDG', 'UNICEF', 'WHO'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'climate_intelligence',
    name: 'Climate Intelligence',
    applicable_templates: [],
    aliases: ['climate', 'environment', 'resilience'],
    professional_vocabulary: ['climate exposure', 'adaptation capacity', 'shock preparedness', 'resilience pathway', 'environmental risk'],
    international_terminology: ['climate adaptation', 'loss and damage', 'resilience building', 'risk-informed programming'],
    standards: ['SDG', 'UNDP', 'World Bank'],
  },
  {
    ...DEFAULT_LIBRARY,
    id: 'gender_youth_inclusion_intelligence',
    name: 'Gender, Youth & Inclusion Intelligence',
    applicable_templates: [],
    aliases: ['gender', 'youth', 'social_protection', 'inclusion'],
    professional_vocabulary: ['inclusion gap', 'gender-responsive programming', 'youth participation', 'leave no one behind', 'social protection access'],
    international_terminology: ['LNOB', 'gender-responsive evaluation', 'youth inclusion', 'social protection coverage'],
    standards: ['SDG', 'UNICEF', 'ILO'],
  },
];

function normalize(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function getSectorLibrary(documentModelOrTemplate) {
  const templateId = normalize(documentModelOrTemplate?.metadata?.template_id || documentModelOrTemplate?.template_id || documentModelOrTemplate?.id);
  const sector = normalize(documentModelOrTemplate?.metadata?.sector || documentModelOrTemplate?.sector);

  const byTemplate = SECTOR_LIBRARIES.find(lib => (lib.applicable_templates || []).map(normalize).includes(templateId));
  if (byTemplate) return byTemplate;
  const byAlias = SECTOR_LIBRARIES.find(lib => (lib.aliases || []).map(normalize).includes(sector));
  return byAlias || DEFAULT_LIBRARY;
}

export function applicableStandards(documentModel) {
  const declared = documentModel?.metadata?.standards || [];
  const lib = getSectorLibrary(documentModel);
  return declared.filter(s => (lib.standards || []).some(x => normalize(x) === normalize(s)) || /^SDG/i.test(s));
}

function pctFromRows(rows, label) {
  const total = (rows || []).reduce((s, r) => s + (Number(r.n) || 0), 0);
  const row = (rows || []).find(r => normalize(r.label) === normalize(label));
  return total > 0 && row ? Math.round((Number(row.n) / total) * 100) : null;
}

function band(value, high = 80, medium = 60) {
  if (value == null) return 'not_available';
  if (value >= high) return 'high';
  if (value >= medium) return 'medium';
  return 'low';
}

export function buildSectorKpiInterpretations(documentModel) {
  const dm = documentModel;
  const lib = getSectorLibrary(dm);
  const rules = lib.interpretation_rules || DEFAULT_LIBRARY.interpretation_rules;
  const responseBand = band(dm?.kpis?.response_rate_pct, 80, 60);
  const qualityScore = dm?.quality?.overall_quality_score || dm?.quality_score?.overall_quality_score || null;
  const qualityBand = band(qualityScore, 85, 70);
  const positivePct = pctFromRows(dm?.findings?.sentiment, 'positive');
  const sentimentRule = positivePct != null && positivePct >= 50 ? rules.sentiment_positive : rules.sentiment_negative;

  const interpretations = [];
  if (dm?.kpis?.response_rate_pct != null) {
    interpretations.push({
      metric: 'response_rate_pct',
      value: dm.kpis.response_rate_pct,
      label: `${dm.kpis.response_rate_pct}% response rate`,
      interpretation: rules[`response_rate_${responseBand}`] || DEFAULT_LIBRARY.interpretation_rules[`response_rate_${responseBand}`],
      evidence_field: 'kpis.response_rate_pct',
    });
  }
  if (qualityScore != null) {
    interpretations.push({
      metric: 'quality_score',
      value: qualityScore,
      label: `${qualityScore}/100 quality score`,
      interpretation: rules[`data_quality_${qualityBand}`] || DEFAULT_LIBRARY.interpretation_rules[`data_quality_${qualityBand}`],
      evidence_field: 'quality.overall_quality_score',
    });
  }
  if (positivePct != null) {
    interpretations.push({
      metric: 'positive_sentiment_pct',
      value: positivePct,
      label: `${positivePct}% positive sentiment`,
      interpretation: sentimentRule,
      evidence_field: 'findings.sentiment',
    });
  }
  return interpretations;
}

export function buildSectorExecutiveLanguage(documentModel) {
  const dm = documentModel;
  const lib = getSectorLibrary(dm);
  const topTopic = dm?.findings?.topics?.[0];
  const topRegion = dm?.demographics?.regions?.[0];
  const standards = applicableStandards(dm);

  return {
    library_id: lib.id,
    library_name: lib.name,
    professional_vocabulary: lib.professional_vocabulary,
    executive_phrases: lib.executive_phrases,
    international_terminology: lib.international_terminology,
    policy_terminology: lib.policy_terminology,
    programme_terminology: lib.programme_terminology,
    donor_terminology: lib.donor_terminology,
    government_terminology: lib.government_terminology || lib.policy_terminology,
    risk_terminology: lib.risk_terminology,
    recommendation_language: lib.recommendation_language,
    impact_language: lib.impact_language,
    applicable_standards: standards,
    standard_alignment_note: standards.length
      ? `This report may reference ${standards.join(', ')} because those standards are already declared in the report metadata.`
      : 'No sector standard is asserted beyond the standards already declared in this report metadata.',
    sector_interpretation: topTopic
      ? `In ${lib.name.toLowerCase()}, the leading theme "${topTopic.topic}" should be treated as a decision signal that requires follow-up through the report's existing recommendations, not as a standalone statistic.`
      : `In ${lib.name.toLowerCase()}, there is not enough coded thematic evidence to identify a leading sector interpretation without analyst review.`,
    regional_interpretation: topRegion
      ? `${topRegion.label} provides the largest evidence base in this report and is therefore a practical entry point for validation or management follow-up.`
      : 'Regional interpretation is not available because no regional distribution is present in the report model.',
  };
}

export function adaptRecommendationLanguage(documentModel, audience = 'donor') {
  const dm = documentModel;
  const lib = getSectorLibrary(dm);
  const recs = dm?.recommendations || {};
  const guidance = COMMON_AUDIENCE_LANGUAGE[normalize(audience)] || COMMON_AUDIENCE_LANGUAGE.donor;
  const out = [];
  for (const [tier, items] of Object.entries(recs)) {
    for (const action of items || []) {
      out.push({
        audience,
        tier,
        original_recommendation: action,
        framing_guidance: guidance,
        sector_language: lib.recommendation_language?.[tier] || DEFAULT_LIBRARY.recommendation_language[tier] || DEFAULT_LIBRARY.recommendation_language.medium_term,
        evidence_rule: 'This reframes an existing recommendation only; it does not create a new recommendation or statistic.',
      });
    }
  }
  return out;
}

export function buildSectorIntelligence(documentModel) {
  return {
    ...buildSectorExecutiveLanguage(documentModel),
    kpi_interpretations: buildSectorKpiInterpretations(documentModel),
    audience_adaptations: {
      government: adaptRecommendationLanguage(documentModel, 'government').slice(0, 5),
      donor: adaptRecommendationLanguage(documentModel, 'donor').slice(0, 5),
      un_agency: adaptRecommendationLanguage(documentModel, 'un_agency').slice(0, 5),
      board: adaptRecommendationLanguage(documentModel, 'board').slice(0, 5),
      programme_manager: adaptRecommendationLanguage(documentModel, 'programme_manager').slice(0, 5),
    },
  };
}

export { SECTOR_LIBRARIES };
