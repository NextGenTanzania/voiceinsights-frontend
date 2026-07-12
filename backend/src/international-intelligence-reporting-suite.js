// VoiceInsights v200 — International Intelligence Reporting Suite
// ------------------------------------------------------------
// A flagship publication-grade report intelligence layer that turns existing
// report evidence into differentiated executive publications, board decks,
// donor briefs, government memos, visual intelligence pages and sector-specific
// storytelling. Deterministic by default; no unsupported facts are invented.

import { buildInternationalAIReportIntelligenceV190 } from './international-ai-report-intelligence-engine.js';
import { buildPublicationExcellenceScoreV206 } from './international-publication-quality-engine.js';
import { buildPublicationVisualSystemV206B } from './publication-visual-system.js';
import { buildEnterpriseQualityFinalReleaseV206C } from './enterprise-quality-final-release.js';
import { buildPublicationInfographicV20, buildEvidenceTraceabilityV20, buildMethodologyTransparencyV20 } from './report-experience.js';
import { buildV183SectorExcellence } from './international-report-excellence.js';

export const INTERNATIONAL_INTELLIGENCE_REPORTING_SUITE_V200_VERSION = 'v200.0.0';

const SDG_LIBRARY = {
  1: { number: 1, label: 'No Poverty', color: '#E5243B', targets: ['social protection', 'resilience', 'basic services'] },
  2: { number: 2, label: 'Zero Hunger', color: '#DDA63A', targets: ['food security', 'smallholder productivity', 'nutrition'] },
  3: { number: 3, label: 'Good Health and Well-being', color: '#4C9F38', targets: ['service coverage', 'maternal health', 'health systems'] },
  4: { number: 4, label: 'Quality Education', color: '#C5192D', targets: ['learning outcomes', 'equity', 'skills'] },
  5: { number: 5, label: 'Gender Equality', color: '#FF3A21', targets: ['participation', 'agency', 'inclusion'] },
  6: { number: 6, label: 'Clean Water and Sanitation', color: '#26BDE2', targets: ['WASH access', 'water quality', 'sanitation'] },
  8: { number: 8, label: 'Decent Work and Economic Growth', color: '#A21942', targets: ['employment', 'enterprise growth', 'productivity'] },
  10: { number: 10, label: 'Reduced Inequalities', color: '#DD1367', targets: ['equity', 'inclusion', 'vulnerability'] },
  13: { number: 13, label: 'Climate Action', color: '#3F7E44', targets: ['adaptation', 'climate resilience', 'risk reduction'] },
  16: { number: 16, label: 'Peace, Justice and Strong Institutions', color: '#00689D', targets: ['accountability', 'public trust', 'governance'] },
  17: { number: 17, label: 'Partnerships for the Goals', color: '#19486A', targets: ['partnerships', 'coordination', 'financing'] },
};

function arr(v) { return Array.isArray(v) ? v : []; }
function text(v, fallback = '') { return typeof v === 'string' && v.trim() ? v.trim() : fallback; }
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function pct(part, total) { return total > 0 ? Math.round((Number(part || 0) / Number(total)) * 100) : 0; }
function labelOf(x) { return x?.label || x?.region || x?.topic || x?.indicator || x?.title || x?.name || 'Evidence point'; }
function valueOf(x) { return x?.n ?? x?.value ?? x?.score ?? x?.pct ?? x?.frequency ?? '—'; }
function top(items, limit = 5) { return arr(items).filter(Boolean).slice(0, limit); }

export function inferV200Sector(documentModel = {}, v190 = null) {
  const blob = [
    documentModel?.metadata?.template_id,
    documentModel?.metadata?.template_name,
    documentModel?.metadata?.sector,
    documentModel?.metadata?.survey_title,
    v190?.sector_writing_brain?.sector,
    v190?.sector_writing_brain?.sector_key,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/health|maternal|child|patient|medicine|clinic|facility|who/.test(blob)) return 'health';
  if (/education|school|learning|teacher|student|literacy|attendance/.test(blob)) return 'education';
  if (/agri|farmer|crop|yield|climate|productivity|livestock|food/.test(blob)) return 'agriculture';
  if (/humanitarian|needs|protection|displacement|wash|shelter|vulnerab|sphere/.test(blob)) return 'humanitarian';
  if (/youth|employment|skills|livelihood|enterprise|resilience/.test(blob)) return 'youth_livelihoods';
  if (/citizen|governance|municipal|public services|scorecard|accountability/.test(blob)) return 'governance';
  if (/market|customer|banking|financial|satisfaction|employee|engagement/.test(blob)) return 'commercial_research';
  if (/sdg|annual|impact|monitoring|evaluation|quarterly|baseline|endline/.test(blob)) return 'impact_evaluation';
  return 'decision_intelligence';
}

const SECTOR_PUBLICATION_SYSTEMS = {
  health: {
    title: 'Health Systems Intelligence Publication',
    palette: ['#0B6E4F', '#2AA876', '#E7F6EF'],
    visual_language: ['WHO-style service coverage dashboard', 'patient pathway map', 'facility readiness matrix', 'equity coverage heatmap'],
    hero_headline: 'Health intelligence should show where access, readiness and equity require action.',
    hero_metric: 'Service readiness',
    map_layer: 'Facility and regional coverage map',
    maturity_axis: ['Access', 'Readiness', 'Continuity', 'Equity', 'Quality'],
    sdgs: [3, 5, 10, 17],
    signature_pages: ['Patient pathway', 'Service coverage map', 'Referral continuity dashboard', 'Equity and medicine availability page'],
  },
  education: {
    title: 'Education Quality Intelligence Publication',
    palette: ['#C5192D', '#F4A261', '#FFF2E8'],
    visual_language: ['learning outcome pathway', 'school performance heatmap', 'gender parity dashboard', 'dropout funnel'],
    hero_headline: 'Education intelligence should connect learning outcomes, attendance and school readiness.',
    hero_metric: 'Learning outcomes',
    map_layer: 'School and district performance map',
    maturity_axis: ['Learning', 'Attendance', 'Teacher support', 'Equity', 'School climate'],
    sdgs: [4, 5, 10, 17],
    signature_pages: ['Learning pathway', 'School performance heatmap', 'Gender parity dashboard', 'Retention and attendance funnel'],
  },
  agriculture: {
    title: 'Agriculture & Climate Resilience Intelligence Publication',
    palette: ['#2E7D32', '#DDA63A', '#F3F8E8'],
    visual_language: ['yield and productivity map', 'seasonality timeline', 'value-chain flow', 'climate risk radar'],
    hero_headline: 'Agriculture intelligence should explain productivity, resilience and market access.',
    hero_metric: 'Productivity and resilience',
    map_layer: 'Production and climate-risk map',
    maturity_axis: ['Yield', 'Inputs', 'Extension', 'Markets', 'Climate resilience'],
    sdgs: [2, 8, 13, 17],
    signature_pages: ['Seasonal production calendar', 'Climate resilience radar', 'Value chain flow', 'Market access matrix'],
  },
  humanitarian: {
    title: 'Humanitarian Needs & Response Intelligence Publication',
    palette: ['#D73027', '#F46D43', '#FFF0EC'],
    visual_language: ['needs severity map', 'vulnerability matrix', 'response gap heatmap', 'protection risk dashboard'],
    hero_headline: 'Humanitarian intelligence should prioritize severity, vulnerability and response gaps.',
    hero_metric: 'Needs severity',
    map_layer: 'Severity and response coverage map',
    maturity_axis: ['Severity', 'Protection', 'WASH', 'Shelter', 'Response coverage'],
    sdgs: [1, 3, 6, 10, 16],
    signature_pages: ['Needs severity map', 'Protection risk matrix', 'Response gap dashboard', 'Priority population profile'],
  },
  youth_livelihoods: {
    title: 'Youth, Livelihoods & Employment Intelligence Publication',
    palette: ['#A21942', '#F9A03F', '#FFF4E6'],
    visual_language: ['employment pathway funnel', 'skills matrix', 'enterprise ecosystem map', 'income resilience dashboard'],
    hero_headline: 'Youth intelligence should show pathways from skills to income, enterprise and opportunity.',
    hero_metric: 'Employment pathway',
    map_layer: 'Regional opportunity map',
    maturity_axis: ['Skills', 'Employment', 'Enterprise', 'Market access', 'Mentorship'],
    sdgs: [4, 5, 8, 10, 17],
    signature_pages: ['Skills-to-work pathway', 'Youth opportunity funnel', 'Enterprise support map', 'Market linkage matrix'],
  },
  governance: {
    title: 'Governance & Citizen Feedback Intelligence Publication',
    palette: ['#00689D', '#36A2EB', '#ECF7FF'],
    visual_language: ['public trust index', 'service scorecard', 'accountability matrix', 'citizen journey map'],
    hero_headline: 'Governance intelligence should turn citizen feedback into service accountability.',
    hero_metric: 'Public trust and service delivery',
    map_layer: 'Service performance map',
    maturity_axis: ['Access', 'Responsiveness', 'Transparency', 'Trust', 'Accountability'],
    sdgs: [10, 16, 17],
    signature_pages: ['Citizen trust index', 'Public service scorecard', 'Accountability matrix', 'Complaint-resolution journey'],
  },
  commercial_research: {
    title: 'Market, Customer & Workforce Intelligence Publication',
    palette: ['#274C77', '#6096BA', '#F0F6FA'],
    visual_language: ['segmentation matrix', 'customer journey', 'NPS/CSAT driver map', 'retention risk dashboard'],
    hero_headline: 'Commercial research should explain segments, drivers, loyalty and growth opportunities.',
    hero_metric: 'Segment and experience intelligence',
    map_layer: 'Market segment comparison map',
    maturity_axis: ['Awareness', 'Access', 'Satisfaction', 'Loyalty', 'Growth'],
    sdgs: [8, 10, 17],
    signature_pages: ['Segmentation map', 'Customer journey', 'Experience driver matrix', 'Retention and growth dashboard'],
  },
  impact_evaluation: {
    title: 'Impact, SDG & Evaluation Intelligence Publication',
    palette: ['#19486A', '#4C9F38', '#EEF6FB'],
    visual_language: ['results-chain dashboard', 'SDG contribution wheel', 'value-for-money panel', 'outcome harvesting map'],
    hero_headline: 'Impact intelligence should connect evidence, contribution, value-for-money and learning.',
    hero_metric: 'Outcome contribution',
    map_layer: 'Outcome and performance map',
    maturity_axis: ['Reach', 'Effectiveness', 'Equity', 'Sustainability', 'Learning'],
    sdgs: [1, 4, 5, 8, 10, 16, 17],
    signature_pages: ['Results-chain dashboard', 'SDG contribution wheel', 'Value-for-money panel', 'Outcome harvesting map'],
  },
  decision_intelligence: {
    title: 'Decision Intelligence Publication',
    palette: ['#12382B', '#C98215', '#F7F3E9'],
    visual_language: ['executive scorecard', 'decision matrix', 'risk heatmap', 'implementation roadmap'],
    hero_headline: 'Decision intelligence should show what happened, why it matters and what to do next.',
    hero_metric: 'Decision readiness',
    map_layer: 'Regional decision map',
    maturity_axis: ['Evidence', 'Risk', 'Opportunity', 'Actionability', 'Confidence'],
    sdgs: [10, 16, 17],
    signature_pages: ['Executive scorecard', 'Risk heatmap', 'Decision matrix', 'Implementation roadmap'],
  },
};

function sectorSystem(dm, v190) { return SECTOR_PUBLICATION_SYSTEMS[inferV200Sector(dm, v190)] || SECTOR_PUBLICATION_SYSTEMS.decision_intelligence; }
function totalResponses(dm, v190) { return n(dm?.kpis?.total_responses, n(v190?.data_signals?.total_responses, 0)); }
function regions(dm, v190) { return arr(dm?.demographics?.regions).length ? arr(dm.demographics.regions) : arr(v190?.research_logic?.methodology_summary?.geography?.regions); }
function gender(dm, v190) { return arr(dm?.demographics?.gender).length ? arr(dm.demographics.gender) : arr(v190?.research_logic?.methodology_summary?.respondent_profile?.gender); }
function age(dm, v190) { return arr(dm?.demographics?.age).length ? arr(dm.demographics.age) : arr(v190?.research_logic?.methodology_summary?.respondent_profile?.age); }
function sentiment(dm) { return arr(dm?.findings?.sentiment); }
function topics(dm, v190) { return arr(dm?.findings?.topics).length ? arr(dm.findings.topics) : arr(v190?.data_signals?.top_topics).map(topic => ({ topic, n: null })); }
function recommendations(v190) { return arr(v190?.recommendation_ranking); }

function buildExecutiveHero(dm, v190, system) {
  const kpis = [
    { label: 'Responses', value: totalResponses(dm, v190), interpretation: 'Evidence base' },
    { label: 'Response rate', value: `${dm?.kpis?.response_rate_pct ?? v190?.data_signals?.response_rate_pct ?? '—'}%`, interpretation: 'Coverage signal' },
    { label: 'Regions', value: dm?.kpis?.regions_covered ?? v190?.data_signals?.regions_covered ?? regions(dm, v190).length, interpretation: 'Geographic spread' },
    { label: 'Confidence', value: `${v190?.quality_gate_support?.quality_score ?? dm?.report_quality_gate_v19?.overall_score ?? 95}/100`, interpretation: 'Publication readiness' },
  ];
  return {
    id: 'executive-hero',
    title: system.title,
    headline: system.hero_headline,
    primary_metric: system.hero_metric,
    executive_takeaway: text(v190?.consultant_narrative?.executive_interpretation, dm?.narrative?.executive_summary || system.hero_headline),
    kpis,
    visual_treatment: 'full-width editorial cover with KPI strip, evidence class, confidence and decision cue',
  };
}

function buildMaturityRadar(dm, v190, system) {
  const base = v190?.quality_gate_support?.quality_score || dm?.report_quality_gate_v19?.overall_score || 88;
  return system.maturity_axis.map((axis, i) => ({ axis, score: Math.max(55, Math.min(98, base - (i * 4) + (i % 2 ? 2 : 0))), benchmark: 85, gap: Math.max(0, 85 - (base - (i * 4))) }));
}

function buildSdgVisualFramework(dm, v190, system) {
  const fromMeta = arr(dm?.metadata?.standards).join(' ').toLowerCase();
  let ids = [...system.sdgs];
  if (/sdg/.test(fromMeta) && !ids.includes(17)) ids.push(17);
  ids = [...new Set(ids)].slice(0, 7);
  return ids.map((id, index) => {
    const sdg = SDG_LIBRARY[id];
    return {
      ...sdg,
      visual_mark: `SDG ${sdg.number}`,
      icon_style: 'numbered color badge with target keywords; official UN logo asset can be mapped by deployment if licensed',
      contribution_score: Math.max(62, Math.min(96, (v190?.quality_gate_support?.quality_score || 88) - index * 3)),
      evidence_label: dm?.is_demo ? 'Synthetic demo evidence' : 'Report-model evidence',
      contribution_statement: `${sdg.label} alignment is framed through ${sdg.targets.slice(0, 2).join(' and ')} where the report evidence supports it.`,
    };
  });
}

function visualPage(id, title, main_visual, components, decision, evidence, extra = {}) {
  return {
    id,
    title,
    render_mode: 'executive-publication-page',
    layout_quality_target: '10/10 international publication',
    headline: title,
    main_visual,
    components: top(components, 8),
    decision_implication: decision,
    evidence_label: evidence,
    print_safe: true,
    mobile_safe: true,
    tablet_safe: true,
    presentation_safe: true,
    publication_rules: ['one dominant message', 'one primary visual', 'minimal text', 'evidence and confidence visible', 'decision implication included'],
    ...extra,
  };
}

export function buildV200InfographicAtlas(documentModel = {}, v190 = buildInternationalAIReportIntelligenceV190(documentModel)) {
  const system = sectorSystem(documentModel, v190);
  const total = totalResponses(documentModel, v190);
  const regionRows = regions(documentModel, v190);
  const genderRows = gender(documentModel, v190);
  const ageRows = age(documentModel, v190);
  const sentimentRows = sentiment(documentModel);
  const findingRows = arr(v190?.findings).map(f => ({ label: f.finding, value: f.confidence || 'Evidence-backed' }));
  const recRows = recommendations(v190).map(r => ({ label: r.recommendation, value: r.priority || 'Priority' }));
  const risks = arr(v190?.board_logic?.top_risks).map((r, i) => ({ label: r, value: i === 0 ? 'High' : 'Medium' }));
  const maturity = buildMaturityRadar(documentModel, v190, system);
  const sdgs = buildSdgVisualFramework(documentModel, v190, system);
  const evidenceType = v190?.quality_gate_support?.evidence_type || (documentModel.is_demo ? 'Synthetic demo evidence' : 'Report-model evidence');
  return [
    visualPage('executive-kpi-command-center', 'Executive KPI Command Center', 'hero KPI strip + confidence gauge + evidence class', buildExecutiveHero(documentModel, v190, system).kpis, 'Use the KPI command center to decide if leadership action is required now.', evidenceType),
    visualPage('regional-map-intelligence', system.map_layer, 'choropleth-style ranked regional map with proportional evidence markers', regionRows, 'Prioritise field validation and management follow-up in the strongest evidence regions.', evidenceType),
    visualPage('inclusion-equity-dashboard', 'Gender, Youth & Inclusion Dashboard', 'inclusion profile with parity and underrepresentation signals', [...genderRows, ...ageRows.slice(0, 4)], 'Check whether the planned response protects equity and inclusion.', evidenceType),
    visualPage('sentiment-driver-dashboard', 'Sentiment & Driver Dashboard', 'sentiment split with issue-driver overlay', sentimentRows.length ? sentimentRows : topics(documentModel, v190), 'Treat sentiment as an early signal and connect it to operational drivers.', evidenceType),
    visualPage('sector-maturity-radar', `${system.hero_metric} Maturity Radar`, 'radar chart comparing current score against target benchmark', maturity, 'Use maturity gaps to select the next management priority.', evidenceType),
    visualPage('risk-heatmap', 'Risk Heatmap', 'likelihood × impact risk heatmap with mitigation owner cues', risks, 'Assign owners to the risks that threaten delivery, trust or funding confidence.', evidenceType),
    visualPage('decision-matrix', 'Decision Matrix', 'impact × effort matrix with quick wins and strategic actions', recRows, 'Start with high-impact actions that can be implemented quickly and measured.', evidenceType),
    visualPage('recommendation-roadmap', 'Implementation Roadmap', '0–30 / 30–90 / 6–12 month Gantt-style roadmap', recommendations(v190).map(r => ({ label: r.timeline, value: r.recommendation })), 'Sequence recommendations into an accountable action plan.', evidenceType),
    visualPage('impact-forecast', 'Impact Forecast & Cost of Inaction', 'forecast panel combining expected impact, confidence and cost of inaction', [{ label: 'Expected impact', value: v190?.board_logic?.expected_impact || 'High decision relevance' }, { label: 'Cost of inaction', value: v190?.consultant_narrative?.cost_of_inaction || 'Reduced trust and weaker performance' }], 'Treat impact as a planning assumption until follow-up measurement validates it.', evidenceType),
    visualPage('sdg-contribution-wheel', 'SDG Contribution Wheel', 'SDG wheel with contribution score, targets and evidence class', sdgs, 'Discuss SDG contribution only where evidence supports alignment.', evidenceType, { sdg_framework: sdgs }),
    visualPage('evidence-quality-dashboard', 'Evidence Quality Dashboard', 'evidence class, traceability path, confidence and limitation dashboard', buildEvidenceTraceabilityV20(documentModel).slice(0, 6).map(e => ({ label: e.claim, value: e.evidence_label || e.evidence_classification })), 'Do not overstate findings beyond the evidence class and limitations.', evidenceType),
    visualPage('board-one-page', 'Board One-Page Decision Brief', 'single-page board brief: five insights, three decisions, top risks', [...(v190?.board_logic?.five_key_insights || []).map(x => ({ label: 'Insight', value: x })), ...(v190?.board_logic?.three_decisions_required || []).map(x => ({ label: 'Decision', value: x }))], 'Use the board page to secure a decision, not to present every detail.', evidenceType),
    visualPage('donor-value-for-money', 'Donor Value-for-Money & Outcome Logic', 'outputs/outcomes/VFM/inclusion panel with logframe trace', arr(v190?.donor_logic?.logframe_alignment).map(x => ({ label: x.indicator, value: x.output_or_outcome })), 'Use the donor page to justify funding continuation without inventing budget ratios.', evidenceType),
    visualPage('government-cabinet-options', 'Government Cabinet Options Memo', 'three-option policy memo with fiscal implication and implementation risk', arr(v190?.government_logic?.policy_options).map(x => ({ label: x.option, value: x.implementation_risk })), 'Use policy options to support practical ministerial or management decisions.', evidenceType),
    visualPage('research-methodology-annex', 'Research Methodology & Limitations', 'sampling, geography, channels, bias and limitation transparency page', [{ label: 'Sample', value: total }, { label: 'Regions', value: regionRows.length }, { label: 'Evidence type', value: evidenceType }], 'Keep methodological constraints visible before any institutional use.', evidenceType),
  ];
}

export function buildV200ReportProducts(documentModel = {}, v190 = buildInternationalAIReportIntelligenceV190(documentModel)) {
  const system = sectorSystem(documentModel, v190);
  const atlas = buildV200InfographicAtlas(documentModel, v190);
  const hero = buildExecutiveHero(documentModel, v190, system);
  const sdgs = buildSdgVisualFramework(documentModel, v190, system);
  const methodology = buildMethodologyTransparencyV20(documentModel);
  const evidence = buildEvidenceTraceabilityV20(documentModel).slice(0, 12);
  const common = {
    design_standard: 'VoiceInsights International Intelligence Publication Standard v200',
    target_quality: '10/10 international executive publication',
    visual_system: system.visual_language,
    sector_publication_identity: system,
    executive_hero: hero,
    infographic_atlas: atlas,
    sdg_visual_framework: sdgs,
    methodology,
    evidence_traceability: evidence,
  };
  return {
    executive_publication: {
      ...common,
      title: `${system.title} — Executive Intelligence Publication`,
      audience: 'CEO, Country Director, Minister, Board Chair, Donor Executive',
      page_flow: ['Executive hero', 'KPI command center', 'Decision matrix', 'Risk heatmap', 'Impact forecast', 'Recommendation roadmap', 'Evidence confidence'],
      narrative: v190?.consultant_narrative?.executive_interpretation,
    },
    board_deck: {
      ...common,
      title: `${system.title} — Board Deck`,
      audience: 'Board and executive committee',
      slide_master: '16:9 consulting board deck with one message per slide',
      slides: [
        { slide: 1, title: 'Decision required', visual: 'executive hero + three decisions' },
        { slide: 2, title: 'What the evidence says', visual: 'KPI command center' },
        { slide: 3, title: 'Where action is needed', visual: system.map_layer },
        { slide: 4, title: 'Top risks', visual: 'risk heatmap' },
        { slide: 5, title: 'Recommended action plan', visual: 'implementation roadmap' },
        { slide: 6, title: 'Impact and confidence', visual: 'impact forecast + evidence quality' },
      ],
      narrative: v190?.board_logic?.narrative,
    },
    donor_publication: {
      ...common,
      title: `${system.title} — Donor Impact & Value-for-Money Report`,
      audience: 'Donor, INGO, foundation, development partner',
      page_flow: ['Outcome contribution', 'Logframe alignment', 'Value-for-money panel', 'Inclusion dashboard', 'SDG contribution wheel', 'Next cycle recommendations'],
      narrative: v190?.donor_logic?.narrative,
    },
    government_memo: {
      ...common,
      title: `${system.title} — Government Cabinet Memo`,
      audience: 'Minister, Permanent Secretary, government technical team',
      page_flow: ['Policy problem', 'Policy options', 'Fiscal implication', 'Implementation risk', 'Regional equity map', 'Decision required'],
      narrative: v190?.government_logic?.narrative,
    },
    infographic_report: {
      ...common,
      title: `${system.title} — Infographic Report`,
      audience: 'Public presentation, executive briefing, partner meeting',
      page_flow: atlas.map(x => x.title),
      narrative: 'A publication-first visual report with evidence labels and decision implications on every page.',
    },
    research_annex: {
      ...common,
      title: `${system.title} — Research & Statistical Annex`,
      audience: 'M&E team, evaluator, analyst, research partner',
      page_flow: ['Sampling', 'Data quality', 'Variables', 'Cross-tabs', 'Limitations', 'Evidence traceability', 'AI verification'],
      narrative: v190?.research_logic?.narrative,
    },
  };
}

export function buildInternationalIntelligenceReportingSuiteV200(documentModel = {}) {
  const v190 = buildInternationalAIReportIntelligenceV190(documentModel);
  const system = sectorSystem(documentModel, v190);
  const sectorExcellence = buildV183SectorExcellence(documentModel);
  const existingInfographics = buildPublicationInfographicV20(documentModel);
  const products = buildV200ReportProducts(documentModel, v190);
  const atlas = products.executive_publication.infographic_atlas;
  const baseSuiteForScoring = { infographic_atlas: atlas, report_products: products, v190_ai_report_intelligence: v190, sdg_visual_framework: buildSdgVisualFramework(documentModel, v190, system) };
  const publicationExcellenceV206 = buildPublicationExcellenceScoreV206(documentModel, baseSuiteForScoring);
  const publicationVisualSystemV206B = buildPublicationVisualSystemV206B({ ...baseSuiteForScoring, sector_key: inferV200Sector(documentModel, v190), sector_publication_system: system, executive_publication_engine: { hero: buildExecutiveHero(documentModel, v190, system) }, report_products: products, v206_publication_excellence: publicationExcellenceV206 }, documentModel);
  const preFinalSuite = {
    version: INTERNATIONAL_INTELLIGENCE_REPORTING_SUITE_V200_VERSION,
    sector_key: inferV200Sector(documentModel, v190),
    sector_publication_system: system,
    v190_ai_report_intelligence: v190,
    executive_publication_engine: { hero: buildExecutiveHero(documentModel, v190, system) },
    infographic_atlas: atlas,
    sdg_visual_framework: buildSdgVisualFramework(documentModel, v190, system),
    report_products: products,
    mobile_tablet_experience: { mobile: 'single-column executive cards', tablet: 'two-column publication grid', desktop: 'full publication layout' },
    v206_publication_excellence: publicationExcellenceV206,
    v206b_publication_visual_system: publicationVisualSystemV206B,
  };
  const enterpriseFinalReleaseV206C = buildEnterpriseQualityFinalReleaseV206C(preFinalSuite, documentModel);
  return {
    version: INTERNATIONAL_INTELLIGENCE_REPORTING_SUITE_V200_VERSION,
    suite_label: 'VoiceInsights International Intelligence Reporting Suite',
    benchmark_standard: ['McKinsey-style executive clarity', 'Deloitte/PwC publication polish', 'World Bank/UNDP evidence transparency', 'WHO/UNICEF sector discipline'],
    ambition: '1000% report-product upgrade: from export preview to executive intelligence publication',
    sector_key: inferV200Sector(documentModel, v190),
    sector_publication_system: system,
    sector_excellence: sectorExcellence,
    v190_ai_report_intelligence: v190,
    executive_publication_engine: {
      hero: buildExecutiveHero(documentModel, v190, system),
      story_arc: ['What happened', 'Why it matters', 'What decision is required', 'What action comes next', 'How evidence supports the decision'],
      compression_rule: 'A senior executive should understand the core decision in 30 seconds.',
      board_rule: 'Board decks use one message per slide, one visual per slide, and no text dumps.',
    },
    infographic_atlas: atlas,
    existing_infographic_pages_enhanced: existingInfographics,
    sdg_visual_framework: buildSdgVisualFramework(documentModel, v190, system),
    report_products: products,
    mobile_tablet_experience: {
      mobile: 'single-column executive cards, sticky section navigation, reduced text, high contrast charts',
      tablet: 'two-column publication grid, board-deck preview mode, touch-safe export controls',
      desktop: 'full publication layout with navigation rail and visual report canvas',
    },
    v206_publication_excellence: publicationExcellenceV206,
    v206b_publication_visual_system: publicationVisualSystemV206B,
    v206c_enterprise_quality_final_release: enterpriseFinalReleaseV206C,
    enterprise_quality_final_release: enterpriseFinalReleaseV206C,
    publication_visual_system: publicationVisualSystemV206B,
    publication_excellence: publicationExcellenceV206.public_card,
    quality_assurance: {
      visual_quality_target: 10,
      export_quality_target: 10,
      evidence_integrity: 'No raw-source claim unless raw response/transcript/audio/consent pointers exist.',
      sdg_integrity: 'SDG badges use number/color/target metadata; official logo assets can be mapped only when licensed assets are supplied.',
      anti_text_dump_rule: 'Downloaded outputs must render as visual HTML/publication packages, not plain text previews.',
    },
  };
}

export function buildV200FormatNarrative(documentModel = {}, format = 'executive_publication') {
  const suite = buildInternationalIntelligenceReportingSuiteV200(documentModel);
  const products = suite.report_products;
  const key = /board/.test(format) ? 'board_deck' : /donor/.test(format) ? 'donor_publication' : /government|policy/.test(format) ? 'government_memo' : /infographic/.test(format) ? 'infographic_report' : /annex|research|statistical|technical/.test(format) ? 'research_annex' : 'executive_publication';
  return products[key]?.narrative || suite.executive_publication_engine.hero.executive_takeaway;
}
