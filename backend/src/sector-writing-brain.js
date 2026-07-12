// VoiceInsights v190 — Sector Writing Brain
// ------------------------------------------------------------
// Deterministic sector-specific writing standards and narrative phrases.
// This module does not fabricate statistics. It transforms the existing
// document model into professional, audience-specific language using only
// metadata, KPIs, evidence labels and existing findings/recommendations.

export const SECTOR_WRITING_BRAIN_VERSION = 'v190.0.0';

const COMMON_AUDIENCE_TONES = Object.freeze({
  executive: {
    tone: 'decision-first, concise, board-ready',
    emphasis: ['strategic implication', 'risk exposure', 'decision required', 'expected impact'],
    sentence_starters: ['The evidence indicates', 'The analysis points to', 'Leadership attention should focus on'],
  },
  donor: {
    tone: 'outcome-oriented, evidence-backed, value-for-money aware',
    emphasis: ['outputs', 'outcomes', 'inclusion', 'value for money', 'next-cycle funding'],
    sentence_starters: ['The contribution story suggests', 'The evidence base supports', 'The next funding cycle should prioritise'],
  },
  government: {
    tone: 'policy-ready, implementation-oriented, fiscally aware',
    emphasis: ['policy option', 'fiscal implication', 'implementation risk', 'regional equity', 'decision required'],
    sentence_starters: ['The policy implication is', 'Government decision-makers should consider', 'Implementation risk is concentrated in'],
  },
  board: {
    tone: 'compressed, risk-aware, action-focused',
    emphasis: ['five insights maximum', 'three decisions', 'top risks', 'confidence', 'timeline'],
    sentence_starters: ['The Board should note', 'The immediate decision is', 'The main exposure is'],
  },
  research: {
    tone: 'methodological, transparent, limitations-aware',
    emphasis: ['sampling', 'confidence', 'bias risk', 'limitations', 'annex references'],
    sentence_starters: ['The methodology indicates', 'The confidence level should be interpreted alongside', 'The main limitation is'],
  },
});

const PROFILE = {
  health: {
    match: ['health', 'maternal', 'child health', 'facility', 'patient'],
    sector: 'Health Systems',
    lexicon: ['service readiness', 'access to care', 'patient pathway', 'referral system', 'maternal health', 'community health workers', 'facility readiness', 'medicine availability', 'health equity', 'quality of care', 'health-seeking behaviour', 'coverage', 'continuity of care'],
    headline: 'Health service performance is assessed through access, continuity of care, service readiness and equity of coverage.',
    indicators: ['Service readiness', 'Access to care', 'Referral continuity', 'Medicine availability', 'Equity of coverage'],
    risks: ['Referral pathway failure', 'Medicine stock-out risk', 'Unequal access across regions', 'Weak continuity of care'],
    decisions: ['Prioritise low-coverage service areas', 'Strengthen referral follow-up', 'Target facility readiness bottlenecks'],
    standards: ['WHO-style service delivery logic', 'Health equity lens', 'Continuity-of-care review'],
  },
  education: {
    match: ['education', 'school', 'learning', 'teacher', 'primary'],
    sector: 'Education',
    lexicon: ['learning outcomes', 'attendance', 'retention', 'teacher availability', 'classroom environment', 'school leadership', 'learning materials', 'foundational literacy', 'numeracy', 'school safety', 'transition', 'dropout risk', 'learner engagement'],
    headline: 'Education performance is interpreted through learning outcomes, attendance, teacher availability and learner engagement.',
    indicators: ['Learning outcomes', 'Attendance', 'Teacher availability', 'Learning materials', 'Dropout risk'],
    risks: ['Attendance decline', 'Learning-material shortage', 'Teacher availability gap', 'Dropout risk'],
    decisions: ['Prioritise foundational learning support', 'Target attendance bottlenecks', 'Strengthen school leadership follow-up'],
    standards: ['Learning-outcome framing', 'School participation analysis', 'Equity in education access'],
  },
  agriculture: {
    match: ['agriculture', 'smallholder', 'climate', 'productivity', 'farmer'],
    sector: 'Agriculture & Climate',
    lexicon: ['smallholder productivity', 'input access', 'extension services', 'climate resilience', 'rainfall variability', 'post-harvest loss', 'market access', 'aggregation', 'irrigation', 'soil health', 'climate-smart agriculture', 'value chain', 'yield improvement'],
    headline: 'Agriculture results are assessed through productivity, input access, climate resilience, extension support and market access.',
    indicators: ['Smallholder productivity', 'Input access', 'Extension services', 'Climate resilience', 'Market access'],
    risks: ['Rainfall variability', 'Input affordability constraint', 'Post-harvest loss', 'Market access weakness'],
    decisions: ['Target extension support to low-yield clusters', 'Improve input access pathways', 'Prioritise climate-smart agriculture actions'],
    standards: ['Climate-smart agriculture lens', 'Value-chain interpretation', 'Smallholder resilience analysis'],
  },
  livelihoods: {
    match: ['livelihood', 'resilience', 'household', 'vulnerability', 'income'],
    sector: 'Livelihoods',
    lexicon: ['household resilience', 'income diversification', 'coping strategies', 'asset ownership', 'savings', 'livelihood security', 'vulnerability', 'shock exposure', 'food security', 'economic inclusion', 'social protection'],
    headline: 'Livelihood resilience is interpreted through income security, coping strategies, vulnerability and shock exposure.',
    indicators: ['Household resilience', 'Income diversification', 'Shock exposure', 'Savings behaviour', 'Food security'],
    risks: ['Negative coping strategies', 'Income concentration risk', 'Food-security stress', 'Weak social protection linkage'],
    decisions: ['Strengthen resilience pathways', 'Support income diversification', 'Target households exposed to shocks'],
    standards: ['Household resilience framing', 'Vulnerability pathway analysis', 'Economic inclusion lens'],
  },
  humanitarian: {
    match: ['humanitarian', 'needs', 'displacement', 'wash', 'shelter', 'protection'],
    sector: 'Humanitarian Response',
    lexicon: ['multi-sector needs', 'protection risk', 'displacement', 'food security', 'WASH', 'shelter', 'accountability to affected populations', 'response coverage', 'vulnerability', 'referral pathway', 'safeguarding', 'dignity', 'urgency'],
    headline: 'Humanitarian findings are prioritised by severity, vulnerability, protection risk, coverage gaps and urgency.',
    indicators: ['Need severity', 'Response coverage', 'Protection risk', 'WASH access', 'Referral pathway'],
    risks: ['Protection risk', 'Unmet WASH needs', 'Referral pathway gaps', 'Safeguarding exposure'],
    decisions: ['Prioritise high-severity locations', 'Close critical response coverage gaps', 'Strengthen accountability to affected populations'],
    standards: ['Sphere-style urgency', 'CHS accountability lens', 'Protection mainstreaming'],
  },
  baseline: {
    match: ['baseline', 'starting condition', 'pre-intervention'],
    sector: 'Baseline Study',
    lexicon: ['baseline indicators', 'starting conditions', 'reference values', 'pre-intervention status', 'measurement framework', 'benchmark', 'target setting', 'theory of change', 'indicator framework'],
    headline: 'Baseline findings establish reference values for target setting, indicator tracking and future impact comparison.',
    indicators: ['Baseline indicators', 'Reference values', 'Starting conditions', 'Target setting', 'Measurement framework'],
    risks: ['Weak baseline comparability', 'Missing reference value', 'Indicator ambiguity', 'Target-setting risk'],
    decisions: ['Confirm indicator framework', 'Set realistic targets', 'Use baseline gaps for implementation planning'],
    standards: ['Theory-of-change alignment', 'Indicator framework discipline', 'Pre-intervention measurement'],
  },
  endline: {
    match: ['endline', 'evaluation', 'outcome achievement', 'before/after'],
    sector: 'Endline Evaluation',
    lexicon: ['outcome achievement', 'contribution', 'change over time', 'effectiveness', 'sustainability', 'learning', 'attribution limits', 'before/after comparison', 'impact pathway', 'lessons learned'],
    headline: 'Endline analysis focuses on change over time, contribution, sustainability and lessons for future programming.',
    indicators: ['Outcome achievement', 'Change over time', 'Contribution', 'Sustainability', 'Lessons learned'],
    risks: ['Attribution limits', 'Sustainability risk', 'Uneven outcome achievement', 'Learning not institutionalised'],
    decisions: ['Document outcome contribution', 'Prioritise sustainability actions', 'Translate lessons into next-cycle design'],
    standards: ['OECD-DAC evaluation logic', 'Contribution analysis', 'Before/after interpretation'],
  },
  market: {
    match: ['market', 'consumer', 'digital financial', 'adoption', 'willingness'],
    sector: 'Market Research',
    lexicon: ['market segmentation', 'consumer behaviour', 'adoption drivers', 'willingness to pay', 'price sensitivity', 'purchase intent', 'brand trust', 'channel preference', 'market sizing', 'buyer persona'],
    headline: 'Market intelligence is interpreted through segmentation, adoption drivers, trust, price sensitivity and channel preference.',
    indicators: ['Market segmentation', 'Adoption drivers', 'Willingness to pay', 'Brand trust', 'Channel preference'],
    risks: ['Weak purchase intent', 'Low brand trust', 'Price sensitivity barrier', 'Channel mismatch'],
    decisions: ['Prioritise high-intent segments', 'Adjust channel strategy', 'Address trust barriers before scale-up'],
    standards: ['Segmentation logic', 'Adoption funnel analysis', 'Buyer persona interpretation'],
  },
  customer: {
    match: ['customer', 'satisfaction', 'banking', 'mobile money', 'cx', 'nps'],
    sector: 'Customer Experience',
    lexicon: ['customer journey', 'satisfaction', 'NPS', 'CSAT', 'retention risk', 'loyalty', 'pain points', 'service recovery', 'churn', 'trust', 'channel experience', 'complaint resolution'],
    headline: 'Customer experience is interpreted through satisfaction, journey pain points, trust, complaint resolution and retention risk.',
    indicators: ['CSAT', 'NPS-style sentiment', 'Channel experience', 'Complaint resolution', 'Retention risk'],
    risks: ['Churn risk', 'Service recovery failure', 'Channel trust gap', 'Complaint resolution delay'],
    decisions: ['Prioritise high-friction journey moments', 'Improve service recovery', 'Reduce retention risk in vulnerable segments'],
    standards: ['CX journey mapping', 'NPS-style interpretation', 'Service recovery lens'],
  },
  employee: {
    match: ['employee', 'engagement', 'culture', 'retention', 'workplace'],
    sector: 'Employee Engagement',
    lexicon: ['employee engagement', 'retention risk', 'leadership trust', 'psychological safety', 'productivity', 'morale', 'internal communication', 'workload', 'recognition', 'workplace culture'],
    headline: 'Employee engagement is interpreted through leadership trust, workload, recognition, psychological safety and retention risk.',
    indicators: ['Engagement', 'Leadership trust', 'Retention risk', 'Psychological safety', 'Workload'],
    risks: ['Retention risk', 'Low leadership trust', 'Workload pressure', 'Weak recognition'],
    decisions: ['Target retention-risk drivers', 'Strengthen leadership communication', 'Prioritise psychological safety and recognition'],
    standards: ['Organisational health logic', 'Employee experience lens', 'Retention-risk analysis'],
  },
  citizen: {
    match: ['citizen', 'municipal', 'public service', 'governance'],
    sector: 'Citizen Feedback',
    lexicon: ['public service delivery', 'citizen trust', 'grievance handling', 'accountability', 'responsiveness', 'transparency', 'regional equity', 'participation', 'service satisfaction'],
    headline: 'Citizen feedback is interpreted through service delivery, trust, responsiveness, accountability and regional equity.',
    indicators: ['Citizen trust', 'Service satisfaction', 'Grievance handling', 'Responsiveness', 'Regional equity'],
    risks: ['Public trust erosion', 'Weak grievance handling', 'Regional service inequity', 'Low responsiveness'],
    decisions: ['Prioritise services with low trust', 'Strengthen grievance resolution', 'Publish response actions for accountability'],
    standards: ['Good governance lens', 'Service delivery analysis', 'Accountability framing'],
  },
  scorecard: {
    match: ['scorecard', 'community accountability', 'social accountability'],
    sector: 'Community Scorecard',
    lexicon: ['community accountability', 'service provider responsiveness', 'joint action plan', 'scorecard indicators', 'community priorities', 'feedback loop', 'social accountability', 'participatory monitoring'],
    headline: 'Community scorecard results are interpreted through community priorities, provider responsiveness and joint action planning.',
    indicators: ['Scorecard indicators', 'Community priorities', 'Provider responsiveness', 'Joint action plan', 'Feedback loop'],
    risks: ['Unclosed feedback loop', 'Weak provider response', 'Low joint-action ownership', 'Community trust risk'],
    decisions: ['Agree joint action plan', 'Assign provider commitments', 'Create public feedback loop'],
    standards: ['Social accountability logic', 'Participatory monitoring', 'Joint action planning'],
  },
  monitoring: {
    match: ['monitoring', 'quarterly livelihoods', 'field monitoring'],
    sector: 'Programme Monitoring',
    lexicon: ['implementation progress', 'output tracking', 'activity completion', 'delivery bottlenecks', 'field monitoring', 'target achievement', 'red-amber-green status', 'corrective action'],
    headline: 'Monitoring results translate implementation progress, delivery bottlenecks and target achievement into corrective action.',
    indicators: ['Implementation progress', 'Output tracking', 'Target achievement', 'Delivery bottlenecks', 'Corrective action'],
    risks: ['Delivery bottleneck', 'Target slippage', 'Field monitoring gap', 'Delayed corrective action'],
    decisions: ['Escalate red-status bottlenecks', 'Reallocate support to lagging outputs', 'Track corrective action weekly'],
    standards: ['Adaptive management logic', 'Output tracking discipline', 'RAG status reporting'],
  },
  quarterly: {
    match: ['quarterly performance', 'portfolio performance', 'multi-region'],
    sector: 'Quarterly Performance',
    lexicon: ['portfolio performance', 'quarterly targets', 'operational efficiency', 'regional performance', 'delivery risk', 'management actions', 'KPI trend', 'resource utilisation'],
    headline: 'Quarterly performance is interpreted through KPI trends, regional performance, delivery risk and management action.',
    indicators: ['Quarterly targets', 'KPI trend', 'Regional performance', 'Operational efficiency', 'Resource utilisation'],
    risks: ['Delivery risk', 'Regional underperformance', 'Resource-utilisation gap', 'KPI trend deterioration'],
    decisions: ['Prioritise management actions for lagging regions', 'Rebalance resources', 'Escalate delivery risks to leadership'],
    standards: ['Board reporting logic', 'Portfolio performance view', 'Operational efficiency lens'],
  },
  annual: {
    match: ['annual impact', 'youth empowerment', 'beneficiary reach'],
    sector: 'Annual Impact',
    lexicon: ['annual outcomes', 'impact narrative', 'beneficiary reach', 'value for money', 'contribution story', 'institutional learning', 'sustainability', 'outcome harvesting', 'donor accountability'],
    headline: 'Annual impact is interpreted through outcome contribution, beneficiary reach, value for money and sustainability.',
    indicators: ['Annual outcomes', 'Beneficiary reach', 'Contribution story', 'Value for money', 'Sustainability'],
    risks: ['Weak outcome contribution evidence', 'Sustainability risk', 'Learning not applied', 'Funding-continuity risk'],
    decisions: ['Prioritise continuation case', 'Document outcome contribution', 'Translate learning into next-year strategy'],
    standards: ['Impact reporting logic', 'Outcome harvesting lens', 'Donor accountability'],
  },
  sdg: {
    match: ['sdg', 'local sdg', 'goal', 'sustainable development'],
    sector: 'SDG Progress',
    lexicon: ['SDG alignment', 'local indicator contribution', 'inclusive progress', 'target pathway', 'sustainability', 'equity lens', 'national development alignment', 'evidence of contribution'],
    headline: 'SDG progress is interpreted through local indicator contribution, equity gaps, sustainability and national development alignment.',
    indicators: ['SDG alignment', 'Local indicator contribution', 'Inclusive progress', 'Equity lens', 'Target pathway'],
    risks: ['Uneven SDG contribution', 'Equity gap', 'Weak target pathway', 'Sustainability risk'],
    decisions: ['Prioritise SDG gaps', 'Align local planning with national targets', 'Strengthen evidence of contribution'],
    standards: ['UNDP-style SDG framing', 'Equity lens', 'Target pathway interpretation'],
  },
};

export function identifySectorWritingProfile(documentModel = {}) {
  const text = [
    documentModel?.metadata?.template_id,
    documentModel?.metadata?.template_name,
    documentModel?.metadata?.sector,
    documentModel?.sample_showcase_v20?.sector,
    documentModel?.sample_showcase_v20?.product_name,
  ].filter(Boolean).join(' ').toLowerCase();

  for (const [key, profile] of Object.entries(PROFILE)) {
    if (profile.match.some(token => text.includes(token.toLowerCase()))) return { key, ...profile };
  }
  return { key: 'general', sector: documentModel?.metadata?.sector || 'Research Intelligence', lexicon: ['evidence', 'confidence', 'decision readiness', 'implementation risk', 'stakeholder feedback'], headline: 'This report interprets validated evidence for executive decision-making.', indicators: ['Evidence quality', 'Decision readiness', 'Stakeholder feedback'], risks: ['Evidence gap', 'Implementation risk'], decisions: ['Prioritise evidence-backed actions'], standards: ['Research transparency'] };
}

export function buildSectorWritingBrain(documentModel = {}) {
  const profile = identifySectorWritingProfile(documentModel);
  return {
    version: SECTOR_WRITING_BRAIN_VERSION,
    sector_key: profile.key,
    sector: profile.sector,
    required_lexicon: profile.lexicon,
    prohibited_public_language: ['VRDS', 'Phase', 'backend', 'system-generated', 'placeholder', 'Not enough data', 'undefined', 'null', 'NaN', 'raw JSON'],
    sector_headline: profile.headline,
    interpretation_indicators: profile.indicators,
    typical_risks: profile.risks,
    decision_patterns: profile.decisions,
    applicable_standards: profile.standards,
    audience_tones: COMMON_AUDIENCE_TONES,
  };
}

export function buildSectorSentencePack(documentModel = {}) {
  const brain = buildSectorWritingBrain(documentModel);
  const responses = documentModel?.kpis?.total_responses ?? 0;
  const regions = documentModel?.kpis?.regions_covered ?? 0;
  const evidenceLabel = documentModel?.is_demo ? 'synthetic demo evidence' : 'verified report evidence';
  const sampleContext = responses ? `${responses} respondent records across ${regions || 'reported'} regions` : 'the available evidence package';
  return {
    executive: `${brain.sector_headline} The current evidence base covers ${sampleContext}, and should be read through ${evidenceLabel}.`,
    donor: `For development partners, the strongest use of this analysis is to connect ${brain.interpretation_indicators.slice(0, 3).join(', ')} with outcome contribution, value for money and next-cycle funding decisions.`,
    government: `For public-sector decision-makers, the report frames ${brain.interpretation_indicators.slice(0, 3).join(', ')} as policy and implementation choices with regional-equity implications.`,
    board: `For Board review, the report compresses the evidence into a short list of decisions, risks and expected impact pathways that require leadership attention.`,
    research: `For analysts, the narrative preserves the distinction between raw-source evidence, report-model evidence and synthetic demo evidence, with methodology and limitations kept visible.`,
  };
}
