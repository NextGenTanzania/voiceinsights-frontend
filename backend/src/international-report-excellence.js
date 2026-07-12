// VoiceInsights v183 — International Report Engine & 16-Sample Sector Excellence Upgrade
// Additive report-facing layer only. No schema, homepage, auth, dashboard or route contract changes.

import {
  buildOnePageExecutiveBriefV20,
  buildMethodologyTransparencyV20,
  buildEvidenceTraceabilityV20,
  buildProcurementGradeReportFormatsV20,
  buildPublicationInfographicV20,
  sanitizePublicReportTextV20,
} from './report-experience.js';
import { getSampleReportShowcaseV20 } from './sample-report-showcase.js';

export const INTERNATIONAL_REPORT_EXCELLENCE_VERSION = 'v183-report-excellence';

function arr(v) { return Array.isArray(v) ? v : []; }
function t(dm) { return dm?.metadata?.template_id || dm?.template_id || 'unknown'; }
function title(dm) { return getSectorProfile(t(dm)).title || dm?.metadata?.template_name || 'Executive Intelligence Report'; }
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function total(dm) { return n(dm?.kpis?.total_responses); }
function rate(dm) { return n(dm?.kpis?.response_rate_pct); }
function regions(dm) { return arr(dm?.demographics?.regions || dm?.statistical_tables?.regions); }
function qScore(dm) { return n(dm?.report_quality_gate_v19?.overall_score || dm?.data_quality?.score || 0); }
function demoEvidence(dm) { return dm?.is_demo ? 'Synthetic demo evidence — fictional data for product demonstration only' : 'Report-model evidence'; }
function clean(v) { return sanitizePublicReportTextV20(v == null || v === '' ? 'Insufficient verified evidence is available for this section.' : v); }
function findings(dm) { return arr(dm?.narrative?.key_findings).slice(0, 5).map(clean); }
function risks(dm) { return arr(dm?.narrative?.risks).slice(0, 3).map(clean); }
function recs(dm) {
  const r = dm?.recommendations || {};
  return [
    ...arr(r.immediate).map((text, i) => ({ recommendation: clean(text), horizon: '0–30 days', priority: i === 0 ? 'High' : 'Medium', owner: 'Operations / Field Lead' })),
    ...arr(r.medium_term).map((text, i) => ({ recommendation: clean(text), horizon: '30–90 days', priority: i === 0 ? 'High' : 'Medium', owner: 'Programme Management' })),
    ...arr(r.long_term).map(text => ({ recommendation: clean(text), horizon: '6–12 months', priority: 'High', owner: 'Country Leadership / Partner Liaison' })),
  ].slice(0, 6);
}

export const SECTOR_EXCELLENCE_PROFILES = Object.freeze({
  health_survey: {
    title: 'Health Systems Access & Quality Intelligence Report', sector: 'Health Systems',
    terminology: ['service readiness','access to care','patient pathway','referral system','maternal health','community health workers','facility readiness','medicine availability','health equity','quality of care','health-seeking behaviour','coverage','continuity of care'],
    kpis: ['Service readiness','Access to care','Patient pathway continuity','Medicine availability','Referral performance'],
    storyline: 'A health-systems report should interpret access barriers, facility readiness and quality-of-care signals as management and policy decisions, not only patient feedback.',
    risks: ['Service readiness gap','Referral-delay risk','Medicine availability risk'],
    donor_focus: ['service coverage','equity of access','beneficiary reach','continuity of care'],
    government_focus: ['district prioritisation','facility readiness','health equity','referral pathway improvement'],
  },
  education_assessment: {
    title: 'Education Quality & Learning Conditions Intelligence Report', sector: 'Education',
    terminology: ['learning outcomes','attendance','retention','teacher availability','classroom environment','school leadership','learning materials','foundational literacy','numeracy','school safety','transition','dropout risk','learner engagement'],
    kpis: ['Attendance','Learner engagement','Teacher availability','Learning materials','School safety'], storyline: 'Education intelligence should connect attendance, teacher availability and learning conditions to retention and foundational learning risks.',
    risks: ['Dropout risk','Teacher availability gap','Learning material constraint'], donor_focus: ['learning outcomes','equity','school participation'], government_focus: ['teacher deployment','school safety','learning recovery'],
  },
  agriculture_survey: {
    title: 'Agriculture & Climate Resilience Intelligence Report', sector: 'Agriculture & Climate',
    terminology: ['smallholder productivity','input access','extension services','climate resilience','rainfall variability','post-harvest loss','market access','aggregation','irrigation','soil health','climate-smart agriculture','value chain','yield improvement'],
    kpis: ['Input access','Extension service reach','Market access','Climate resilience','Post-harvest risk'], storyline: 'Agriculture reporting should connect farmer voice to productivity, climate resilience, input systems and market decisions.',
    risks: ['Rainfall variability','Input affordability risk','Post-harvest loss'], donor_focus: ['farmer reach','resilience outcome','market inclusion'], government_focus: ['extension coverage','irrigation priority','value-chain bottlenecks'],
  },
  livelihood_assessment: {
    title: 'Household Livelihood Resilience Intelligence Report', sector: 'Livelihoods',
    terminology: ['household resilience','income diversification','coping strategies','asset ownership','savings','livelihood security','vulnerability','shock exposure','food security','economic inclusion','social protection'],
    kpis: ['Income security','Shock exposure','Savings access','Food security','Economic inclusion'], storyline: 'Livelihood intelligence should translate household resilience and coping evidence into targeted economic inclusion decisions.',
    risks: ['Shock exposure','Income insecurity','Food security pressure'], donor_focus: ['household resilience','economic inclusion','vulnerability reduction'], government_focus: ['social protection linkage','income resilience','targeted support'],
  },
  humanitarian_needs: {
    title: 'Multi-Sector Humanitarian Response Intelligence Report', sector: 'Humanitarian Response',
    terminology: ['multi-sector needs','protection risk','displacement','food security','WASH','shelter','accountability to affected populations','response coverage','vulnerability','referral pathway','safeguarding','dignity','urgency'],
    kpis: ['Needs severity','Response coverage','Protection risk','WASH access','Referral pathway'], storyline: 'Humanitarian intelligence must prioritize urgency, dignity, response gaps and protection-sensitive sequencing.',
    risks: ['Protection risk','WASH access gap','Response coverage gap'], donor_focus: ['response coverage','protection mainstreaming','accountability to affected populations'], government_focus: ['coordination','referral pathway','priority locations'],
  },
  baseline_study: {
    title: 'Baseline Measurement & Indicator Framework Report', sector: 'Baseline Study',
    terminology: ['baseline indicators','starting conditions','reference values','pre-intervention status','measurement framework','benchmark','target setting','theory of change','indicator framework'],
    kpis: ['Reference value','Baseline indicator coverage','Target setting readiness','Measurement framework','Pre-intervention status'], storyline: 'Baseline reports should define starting conditions and measurement logic for future comparison.',
    risks: ['Weak baseline indicator coverage','Target-setting risk','Measurement framework gap'], donor_focus: ['measurement readiness','reference values','learning agenda'], government_focus: ['baseline targets','indicator framework','planning assumptions'],
  },
  endline_evaluation: {
    title: 'Endline Evaluation & Outcome Contribution Report', sector: 'Endline Evaluation',
    terminology: ['outcome achievement','contribution','change over time','effectiveness','sustainability','learning','attribution limits','before/after comparison','impact pathway','lessons learned'],
    kpis: ['Outcome achievement','Change over time','Contribution signal','Sustainability','Learning value'], storyline: 'Endline evaluation should explain change, contribution and limits without overstating attribution.',
    risks: ['Attribution limit','Sustainability risk','Scale decision risk'], donor_focus: ['outcome contribution','lessons learned','future funding rationale'], government_focus: ['scale decision','sustainability','policy learning'],
  },
  market_research: {
    title: 'Market Segmentation & Adoption Intelligence Report', sector: 'Market Research',
    terminology: ['market segmentation','consumer behaviour','adoption drivers','willingness to pay','price sensitivity','purchase intent','brand trust','channel preference','market sizing','buyer persona'],
    kpis: ['Adoption driver','Purchase intent','Brand trust','Channel preference','Price sensitivity'], storyline: 'Market research outputs should convert consumer behaviour into segment strategy and go-to-market decisions.',
    risks: ['Low trust barrier','Price sensitivity','Channel mismatch'], donor_focus: ['financial inclusion relevance','market access','consumer protection'], government_focus: ['market participation','consumer trust','digital inclusion'],
  },
  customer_satisfaction: {
    title: 'Customer Experience & Loyalty Intelligence Report', sector: 'Customer Experience',
    terminology: ['customer journey','satisfaction','NPS','CSAT','retention risk','loyalty','pain points','service recovery','churn','trust','channel experience','complaint resolution'],
    kpis: ['Customer journey quality','Satisfaction','Retention risk','Complaint resolution','Channel experience'], storyline: 'Customer experience reporting should identify service moments that affect trust, loyalty and churn risk.',
    risks: ['Retention risk','Complaint resolution gap','Channel experience friction'], donor_focus: ['service inclusion','customer protection','trust'], government_focus: ['consumer trust','complaint resolution','service access'],
  },
  employee_engagement: {
    title: 'Employee Engagement & Workplace Culture Intelligence Report', sector: 'Employee Engagement',
    terminology: ['employee engagement','retention risk','leadership trust','psychological safety','productivity','morale','internal communication','workload','recognition','workplace culture'],
    kpis: ['Engagement','Leadership trust','Retention risk','Psychological safety','Workload balance'], storyline: 'Employee engagement reporting should connect employee voice to retention, productivity and leadership actions.',
    risks: ['Retention risk','Leadership trust gap','Workload pressure'], donor_focus: ['delivery capacity','staff wellbeing','implementation risk'], government_focus: ['workforce productivity','staff morale','management action'],
  },
  citizen_feedback: {
    title: 'Citizen Feedback & Public Service Trust Report', sector: 'Citizen Feedback',
    terminology: ['public service delivery','citizen trust','grievance handling','accountability','responsiveness','transparency','regional equity','participation','service satisfaction'],
    kpis: ['Citizen trust','Service satisfaction','Responsiveness','Grievance handling','Regional equity'], storyline: 'Citizen feedback should translate public voice into accountability, responsiveness and service delivery decisions.',
    risks: ['Trust erosion','Grievance backlog','Regional equity gap'], donor_focus: ['accountability','participation','service responsiveness'], government_focus: ['public trust','regional equity','service improvement'],
  },
  community_scorecard: {
    title: 'Community Scorecard & Social Accountability Report', sector: 'Community Scorecard',
    terminology: ['community accountability','service provider responsiveness','joint action plan','scorecard indicators','community priorities','feedback loop','social accountability','participatory monitoring'],
    kpis: ['Scorecard priority','Provider responsiveness','Joint action plan','Feedback loop','Community accountability'], storyline: 'Community scorecards should convert participatory monitoring into joint action plans and service provider accountability.',
    risks: ['Feedback loop failure','Provider responsiveness gap','Joint action plan delay'], donor_focus: ['community accountability','participatory monitoring','service improvement'], government_focus: ['joint action planning','service provider responsiveness','community priorities'],
  },
  monitoring_report: {
    title: 'Programme Monitoring & Corrective Action Report', sector: 'Programme Monitoring',
    terminology: ['implementation progress','output tracking','activity completion','delivery bottlenecks','field monitoring','target achievement','red-amber-green status','corrective action'],
    kpis: ['Implementation progress','Output tracking','Activity completion','Delivery bottleneck','Corrective action'], storyline: 'Monitoring reports should help managers identify bottlenecks and assign corrective action before delivery risk grows.',
    risks: ['Delivery bottleneck','Output tracking gap','Corrective action delay'], donor_focus: ['implementation assurance','delivery risk','adaptive management'], government_focus: ['target achievement','field monitoring','corrective action'],
  },
  quarterly_performance: {
    title: 'Quarterly Performance & Management Actions Report', sector: 'Quarterly Performance',
    terminology: ['portfolio performance','quarterly targets','operational efficiency','regional performance','delivery risk','management actions','KPI trend','resource utilisation'],
    kpis: ['Quarterly targets','Operational efficiency','Regional performance','Delivery risk','Resource utilisation'], storyline: 'Quarterly reporting should compress performance, risk and management action into board-ready decisions.',
    risks: ['Quarterly target slippage','Regional performance gap','Resource utilisation risk'], donor_focus: ['portfolio performance','adaptive management','delivery assurance'], government_focus: ['management action','resource utilisation','regional performance'],
  },
  annual_impact: {
    title: 'Annual Impact & Value-for-Money Intelligence Report', sector: 'Annual Impact',
    terminology: ['annual outcomes','impact narrative','beneficiary reach','value for money','contribution story','institutional learning','sustainability','outcome harvesting','donor accountability'],
    kpis: ['Beneficiary reach','Outcome contribution','Value for money','Sustainability','Institutional learning'], storyline: 'Annual impact reporting should connect outcomes, contribution, value for money and learning for the next funding cycle.',
    risks: ['Sustainability risk','Outcome contribution limit','Learning not institutionalised'], donor_focus: ['value for money','donor accountability','next funding cycle'], government_focus: ['sustainability','institutional learning','outcome contribution'],
  },
  sdg_progress: {
    title: 'SDG Progress & National Development Alignment Report', sector: 'SDG Progress',
    terminology: ['SDG alignment','local indicator contribution','inclusive progress','target pathway','sustainability','equity lens','national development alignment','evidence of contribution'],
    kpis: ['SDG alignment','Local indicator contribution','Inclusive progress','Target pathway','Equity lens'], storyline: 'SDG reporting should show how local evidence contributes to national development priorities without claiming official compliance.',
    risks: ['Target pathway delay','Equity gap','Sustainability risk'], donor_focus: ['SDG contribution','inclusive progress','evidence of contribution'], government_focus: ['national development alignment','local indicator contribution','planning priority'],
  },
});

export function getSectorProfile(templateId) {
  return SECTOR_EXCELLENCE_PROFILES[templateId] || {
    title: 'Executive Research Intelligence Report', sector: 'Research Intelligence', terminology: ['evidence quality','decision readiness','methodology transparency'], kpis: ['Responses','Quality','Confidence'], storyline: 'Evidence-to-decision reporting for executive review.', risks: ['Evidence limitation'], donor_focus: ['accountability'], government_focus: ['decision required'],
  };
}

export function buildV183SectorExcellence(dm) {
  const profile = getSectorProfile(t(dm));
  const showcase = getSampleReportShowcaseV20(t(dm)) || {};
  const brief = buildOnePageExecutiveBriefV20(dm);
  const methodology = buildMethodologyTransparencyV20(dm);
  const evidence = buildEvidenceTraceabilityV20(dm).slice(0, 8);
  const cleanFindings = findings(dm);
  const cleanRecs = recs(dm);
  return sanitizePublicReportTextV20({
    version: INTERNATIONAL_REPORT_EXCELLENCE_VERSION,
    sector: profile.sector,
    title: showcase.product_name || profile.title,
    storyline: profile.storyline,
    terminology: profile.terminology,
    sector_kpis: profile.kpis.map((label, i) => ({ label, evidence_basis: i === 0 ? demoEvidence(dm) : 'Report-model evidence', interpretation: `${label} is interpreted using ${profile.sector.toLowerCase()} decision language and existing report evidence only.` })),
    sector_risks: profile.risks.map((risk, i) => ({ risk, evidence_basis: i === 0 ? demoEvidence(dm) : 'Report-model evidence', priority: i === 0 ? 'High' : 'Medium' })),
    executive_board: {
      headline: brief.headline_insight,
      key_insights: cleanFindings.slice(0, 5),
      decisions_required: brief.three_recommended_decisions.slice(0, 3),
      top_risks: risks(dm),
      confidence_score: brief.confidence_score,
      evidence_quality: brief.evidence_quality,
      expected_impact: brief.expected_impact,
    },
    donor: {
      logframe_alignment: `Links existing findings and recommendations to ${profile.donor_focus.join(', ')}. No invented logframe indicators.`,
      outputs: cleanFindings.slice(0, 3),
      outcomes: [clean(dm?.narrative?.conclusions || brief.headline_insight)],
      value_for_money: `${total(dm)} demonstration respondents across ${methodology?.geography?.regions_covered || regions(dm).length || 0} regions; no cost-per-outcome figure is invented without budget data.`,
      inclusion: 'Gender, youth and regional equity are discussed where demographic evidence exists in the report model.',
      funding_justification: clean(dm?.donor_brief_v20?.funding_justification || dm?.narrative?.conclusions || brief.decision_required),
      lessons_learned: arr(dm?.narrative?.opportunities).slice(0, 3).map(clean),
      next_cycle_recommendations: cleanRecs.slice(0, 3),
    },
    government: {
      cabinet_memo_summary: brief.headline_insight,
      policy_problem: cleanFindings[0] || brief.headline_insight,
      policy_options: cleanRecs.slice(0, 3),
      fiscal_implications: 'Fiscal implications require programme budget validation before public decision use; no fiscal estimate is invented.',
      implementation_risks: risks(dm),
      regional_comparison: regions(dm).slice(0, 6),
      decision_required: brief.decision_required,
    },
    research: {
      sampling: methodology.sample_size,
      methodology,
      limitations: methodology.limitations,
      evidence_type: methodology.evidence_type,
      quality_score: qScore(dm),
      confidence_score: brief.confidence_score,
      annex_logic: 'Statistical and dataset annexes should support sampling, variables, missingness and evidence classification.',
    },
    evidence_classification: evidence.map(e => ({ claim: e.claim, evidence_classification: e.evidence_classification || e.evidence_label, raw_available: !!e.raw_available, confidence_score: e.confidence_score })),
  });
}

export function buildV183PublicationInfographic(dm) {
  const profile = getSectorProfile(t(dm));
  const base = buildPublicationInfographicV20(dm);
  const brief = buildOnePageExecutiveBriefV20(dm);
  const cleanRecs = recs(dm);
  const evidence = demoEvidence(dm);
  const mkPage = (id, title, mainVisual, cards, implication, label = evidence) => ({
    id, title, render_mode: 'publication-page', headline: `${title}: ${profile.sector} decision view`, main_visual: mainVisual,
    supporting_insight_cards: cards.slice(0, 4), decision_implication: implication, evidence_label: label,
    confidence_label: `${brief.confidence_score || qScore(dm) || 80}% confidence`, source_label: dm?.is_demo ? 'Fictional demonstration dataset' : 'Report evidence package',
    print_safe: true, mobile_safe: true, spacing: 'spacious-publication-layout', clutter_check: 'one headline, one main visual, two to four supporting cards',
  });
  const pages = [
    mkPage('executive-kpi-dashboard','Executive KPI Dashboard','large KPI strip with confidence and evidence quality', [
      { label: 'Responses', value: total(dm) }, { label: 'Response Rate', value: `${rate(dm)}%` }, { label: 'Quality', value: `${qScore(dm) || '—'}/100` }, { label: profile.kpis[0], value: 'Sector priority' },
    ], 'Use the KPI dashboard to decide whether the report is ready for executive discussion.'),
    mkPage('regional-intelligence','Regional Intelligence','ranked regional map/list with coverage intensity', regions(dm).map(r => ({ label: r.label || r.region, value: r.n || r.responses || 0 })), 'Use regional intelligence to prioritize field validation and targeted follow-up.', 'Report-model evidence'),
    mkPage('gender-inclusion-profile','Gender & Inclusion Profile','gender and inclusion profile cards', arr(dm?.demographics?.gender).map(g => ({ label: g.label, value: g.n })), 'Use inclusion evidence to ensure decisions do not overlook underrepresented groups.', 'Report-model evidence'),
    mkPage('youth-age-profile','Youth & Age Profile','age-distribution visual', arr(dm?.demographics?.age).map(a => ({ label: a.label, value: a.n })), 'Use age profile evidence to target communication and programme design.', 'Report-model evidence'),
    mkPage('sentiment-dashboard','Sentiment Dashboard','sentiment split with driver note', arr(dm?.findings?.sentiment).map(s => ({ label: s.label, value: s.n })), 'Use sentiment as an early signal, not as a standalone outcome measure.', 'Report-model evidence'),
    mkPage('risk-matrix','Risk Matrix','likelihood × impact matrix', profile.risks.map((r, i) => ({ label: r, value: i === 0 ? 'High impact' : 'Medium impact' })), 'Assign mitigation owners to high-priority risks before implementation.'),
    mkPage('decision-matrix','Decision Matrix','impact × effort matrix', cleanRecs.map(r => ({ label: r.priority, value: r.recommendation })), 'Start with high-impact actions that can be assigned immediately.'),
    mkPage('evidence-quality-dashboard','Evidence Quality Dashboard','evidence classification dashboard', buildEvidenceTraceabilityV20(dm).slice(0, 4).map(e => ({ label: e.evidence_classification || e.evidence_label, value: e.confidence_score })), 'Use evidence classification to avoid overstating what the data can support.'),

    mkPage('sdg-contribution','SDG-Aligned Contribution','SDG-aligned contribution cards', arr(dm?.metadata?.standards).filter(s => /SDG/i.test(s)).map(s => ({ label: s, value: 'Contribution is described only where the report evidence supports it.' })).slice(0,4), 'Use the SDG page to discuss alignment without claiming official certification.', 'Report-model evidence'),
    mkPage('recommendation-priority','Recommendation Priority Page','ranked recommendation ladder', cleanRecs.map(r => ({ label: r.horizon, value: r.recommendation })), 'Approve the highest-priority recommendation and assign an accountable owner.'),
    mkPage('implementation-timeline','Implementation Timeline','0–30 / 30–90 / 6–12 month roadmap', cleanRecs.map(r => ({ label: r.horizon, value: r.owner })), 'Use the roadmap to sequence action and follow-up measurement.'),
    mkPage('impact-forecast','Impact Forecast','expected impact and confidence panel', [{ label: 'Expected Impact', value: brief.expected_impact }, { label: 'Confidence', value: `${brief.confidence_score}%` }], 'Treat expected impact as a planning assumption unless follow-up measurement confirms it.'),
    mkPage('donor-impact-summary','Donor Impact Summary','outputs, outcomes and value-for-money panel', [{ label: 'Outputs', value: profile.donor_focus[0] }, { label: 'VFM', value: 'Budget data required for cost ratio' }], 'Use the donor page to discuss funding justification without inventing budget ratios.'),
    mkPage('government-policy-options','Government Policy Options','three-option policy memo layout', cleanRecs.slice(0, 3).map((r, i) => ({ label: `Option ${i + 1}`, value: r.recommendation })), 'Use the options page to support ministerial or management decisions.'),
    mkPage('board-one-page-summary','Board One-Page Summary','single-page board decision brief', brief.three_recommended_decisions.map(d => ({ label: d.priority || 'Decision', value: d.decision })), 'Use the board summary to secure a decision, not to present every detail.'),
  ];
  const inherited = arr(base.pages).filter(p => /sdg/i.test(p.id || p.title)).map(p => ({ id: p.id || 'sdg-aligned-reference', title: p.title || 'SDG-Aligned Reference', render_mode: 'publication-page', headline: p.headline || `${p.title || 'SDG-Aligned Reference'}: evidence-aware alignment view`, main_visual: p.main_visual || p.visual || 'SDG-aligned contribution reference cards', supporting_insight_cards: arr(p.supporting_insight_cards || p.cards).slice(0, 4), decision_implication: p.decision_implication || 'Use this page to discuss SDG alignment only where the report evidence supports it.', evidence_label: 'Report-model evidence', confidence_label: p.confidence_label || `${brief.confidence_score || qScore(dm) || 80}% confidence`, source_label: p.source_label || 'Report evidence package', print_safe: true, mobile_safe: true, spacing: 'spacious-publication-layout', clutter_check: 'one headline, one main visual, two to four supporting cards' }));
  return sanitizePublicReportTextV20({ version: INTERNATIONAL_REPORT_EXCELLENCE_VERSION, sector: profile.sector, pages: [...pages, ...inherited] });
}

export function buildV183ExportPackage(dm, formatKey = 'executive_summary') {
  const profile = getSectorProfile(t(dm));
  const brief = buildOnePageExecutiveBriefV20(dm);
  const methodology = buildMethodologyTransparencyV20(dm);
  const excellence = buildV183SectorExcellence(dm);
  const baseFormats = buildProcurementGradeReportFormatsV20(dm);
  const formatTitles = {
    executive_summary: 'Executive Report Preview', management_report: 'Management Report Preview', donor_brief: 'Donor Impact Report Preview', policy_brief: 'Government and Policy Brief Preview', government_report: 'Government Cabinet Brief Preview', board_deck: 'Presentation-ready Board Brief', infographic: 'Infographic Report Preview', statistical_annex: 'Statistical Annex Preview', dataset_appendix: 'Technical Annex Preview', technical_annex: 'Technical Annex Preview', ai_talking_points: 'Presentation-ready Board Talking Points', one_page_executive_brief: 'One-page Executive Brief Preview', print_ready_report: 'Print-ready Report Preview',
  };
  return sanitizePublicReportTextV20({
    format_key: formatKey,
    export_label: formatTitles[formatKey] || 'Report Export Preview',
    honest_export_type: /board|talking/.test(formatKey) ? 'Presentation-ready outline' : formatKey === 'print_ready_report' ? 'Browser print-ready report' : 'Clean export preview',
    cover: { report_title: title(dm), audience: formatTitles[formatKey] || 'Report audience', sector: profile.sector, date_or_version: dm?.metadata?.generated_at || 'Generated date in report metadata', classification: dm?.is_demo ? 'Demonstration report — fictional sample data only' : 'Client report' },
    executive_summary: clean(dm?.narrative?.executive_summary || brief.headline_insight),
    methodology_summary: `${methodology.sample_size} responses; ${methodology?.geography?.regions_covered || 0} regions; ${methodology.evidence_type}.`,
    evidence_label: demoEvidence(dm),
    quality_confidence: { quality_score: qScore(dm), confidence_score: brief.confidence_score, evidence_note: 'Evidence labels distinguish raw-source, report-model and synthetic demo evidence.' },
    recommendations: recs(dm).slice(0, /board/.test(formatKey) ? 3 : 5),
    limitations: methodology.limitations,
    sector_excellence: excellence,
    donor_sections: excellence.donor,
    government_sections: excellence.government,
    board_sections: excellence.executive_board,
    research_sections: excellence.research,
    infographic_pages: buildV183PublicationInfographic(dm).pages,
  });
}
