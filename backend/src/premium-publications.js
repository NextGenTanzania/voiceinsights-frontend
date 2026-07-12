/**
 * VoiceInsights Flagship Report Engine™ v2 — Phase 2: Premium Publications
 * Audience-specific publication systems for Government, Donor, UN, Board,
 * Corporate, Research and Humanitarian intelligence products.
 *
 * The composer never fabricates findings, statistics, budgets, policy claims or
 * confidence. Missing requirements remain explicitly unverified and are passed
 * to the Phase 1 quality gate.
 */
import { compileFlagshipReport, evaluateFlagshipPublicationQuality, INTERNATIONAL_PUBLICATION_PROFILES } from './flagship-report-engine.js';

export const PREMIUM_PUBLICATIONS_VERSION = '2.2.0-phase2';
export const PREMIUM_PUBLICATIONS_NAME = 'VoiceInsights Premium Publications™';

const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=v=>typeof v==='string'?v.trim():'';
const pick=(v,fallback='Not documented')=>text(v)||fallback;
const has=v=>Array.isArray(v)?v.length>0:Boolean(v&&String(v).trim());

export const PREMIUM_PUBLICATION_STYLES = {
  government: {
    key:'government', label:'Government Policy Intelligence', profile:'government', audience:['Minister','Permanent Secretary','Cabinet Secretariat','Technical Directorate','National Statistics Office'],
    personality:'Authoritative, concise, nationally aligned and implementation-focused.',
    palette:{ primary:'#0B3A67', secondary:'#1E6FA8', accent:'#D6A93B', background:'#F5F8FC', ink:'#102235' },
    cover:{ eyebrow:'Government Decision Intelligence', motif:'National map, policy-priority bands and institutional seal-safe space', title_pattern:'{country} {sector} Policy Intelligence Report', footer:'Evidence for Cabinet, ministerial and public-service decisions' },
    tone:['cabinet-ready','fiscally cautious','non-partisan','regionally disaggregated','implementation specific'],
    mandatory_sections:['Cabinet memo','Minister dashboard','National trends','Policy problem and gap','Regional equity heat map','Policy options','Fiscal and legislative implications','Implementation risks','Decision required','Technical annex'],
    visuals:['National map','Regional heat map','Policy option matrix','Budget implication waterfall','Implementation timeline','Risk matrix','SDG alignment cards'],
    deliverables:['Policy Intelligence Report','Cabinet Memo','Minister Brief','Regional Action Atlas','Implementation Scorecard'],
    standards:['National policy alignment','SDGs','Evidence traceability','Accessibility','Fiscal caution'],
  },
  donor: {
    key:'donor', label:'Donor Impact & Accountability', profile:'donor', audience:['Donor Programme Officer','Country Director','Grants Manager','Evaluation Manager','Board'],
    personality:'Outcome-led, accountable, learning-oriented and funding-decision ready.',
    palette:{ primary:'#52258A', secondary:'#7651B5', accent:'#E0B44C', background:'#FAF8FD', ink:'#251A34' },
    cover:{ eyebrow:'Impact, Accountability & Learning', motif:'Theory-of-change pathway, beneficiary voice and outcome markers', title_pattern:'{programme} Donor Impact Evaluation Report', footer:'Results, value for money, sustainability and next-cycle decisions' },
    tone:['OECD-DAC structured','beneficiary-centred','transparent about contribution','value-for-money cautious','learning oriented'],
    mandatory_sections:['Donor executive brief','Theory of Change','Results chain','OECD-DAC assessment','Outputs and outcomes','Impact contribution','Value for money','Inclusion and safeguarding','Sustainability','Lessons learned','Management response','Next funding cycle'],
    visuals:['Theory of Change','Results chain','Outcome contribution chart','Value-for-money matrix','Beneficiary voice cards','Sustainability radar','Management response tracker'],
    deliverables:['Donor Impact Report','OECD-DAC Evaluation','Funding Brief','Results & Learning Annex','Management Response Matrix'],
    standards:['OECD-DAC','SDGs','CHS where applicable','Evidence confidence','Management response'],
  },
  un: {
    key:'un', label:'UN Evaluation & Country Intelligence', profile:'un_agency', audience:['UN Country Representative','Deputy Representative','Programme Director','Evaluation Manager','Donor'],
    personality:'Rights-based, inclusive, transparent, independent and management-response oriented.',
    palette:{ primary:'#0072BC', secondary:'#4EA3D8', accent:'#F2C94C', background:'#F5FAFD', ink:'#153246' },
    cover:{ eyebrow:'United Nations Evaluation Intelligence', motif:'Human-rights lens, SDG wheel, country map and evidence network', title_pattern:'{country} {programme} Evaluation & Intelligence Report', footer:'Independent evidence, inclusion, learning and accountable action' },
    tone:['UNEG-aware','human-rights based','gender responsive','disability inclusive','ethically transparent','do-no-harm'],
    mandatory_sections:['Evaluation executive summary','Terms of Reference summary','Evaluation questions and matrix','Theory of Change','Methodology and ethics','Gender, disability and inclusion','Findings by evaluation question','Conclusions','Recommendations','Management response','Environmental and social implications','Technical annex'],
    visuals:['SDG contribution map','Evaluation matrix','Inclusion dashboard','Evidence confidence cards','Recommendation priority matrix','Management response tracker','Country/regional map'],
    deliverables:['Executive Evaluation Report','Country Office Brief','Management Response Matrix','Evaluation Evidence Annex','SDG Contribution Brief'],
    standards:['UNEG norms and standards readiness','Human rights','Gender equality','Disability inclusion','Ethics','Management response'],
  },
  board: {
    key:'board', label:'Executive Board Intelligence', profile:'corporate', audience:['Board Chair','CEO','Executive Committee','Audit & Risk Committee','Programme Board'],
    personality:'Decisive, compressed, risk-aware and accountability-led.',
    palette:{ primary:'#111827', secondary:'#374151', accent:'#D4AF37', background:'#FBFAF6', ink:'#111827' },
    cover:{ eyebrow:'Board Decision Intelligence', motif:'Executive KPI wall, risk exposure and decision agenda', title_pattern:'{organization} Executive Board Intelligence Report', footer:'Decisions, accountability, value and risk' },
    tone:['board concise','decision first','financially disciplined','risk explicit','owner and deadline specific'],
    mandatory_sections:['Chair and CEO brief','Executive KPI wall','Decisions required','Strategic performance','Risk and assurance','Financial/operational implications','Customer or beneficiary intelligence','Opportunity portfolio','Owner matrix','90-day agenda','Board appendix'],
    visuals:['Executive KPI cards','Risk heat map','Decision matrix','Performance waterfall','Opportunity matrix','Owner timeline','Board scorecard'],
    deliverables:['Board Report','Board Deck','Executive Talking Points','Decision Register','90-Day Action Scorecard'],
    standards:['Board governance','Risk and assurance','Decision traceability','Accessibility','Materiality'],
  },
  corporate: {
    key:'corporate', label:'Corporate & Market Intelligence', profile:'corporate', audience:['CEO','Chief Customer Officer','CHRO','Business Unit Lead','Strategy Director','Investor Relations'],
    personality:'Premium, commercial, segment-driven and ROI focused.',
    palette:{ primary:'#0B0F19', secondary:'#1F2937', accent:'#D6A93B', background:'#F7F5EF', ink:'#111827' },
    cover:{ eyebrow:'Enterprise Growth Intelligence', motif:'Market segmentation, customer journey and value pools', title_pattern:'{organization} {topic} Intelligence Report', footer:'Growth, experience, risk and return' },
    tone:['commercially sharp','segment specific','ROI cautious','competitive','customer and employee centred'],
    mandatory_sections:['Executive commercial brief','Market or workforce context','Segment intelligence','Customer/employee journey','Drivers and barriers','Competitive or benchmark position','Revenue/operational implications','Risks','Growth opportunities','Decision portfolio','Implementation scorecard'],
    visuals:['Segment treemap','Customer journey','Retention-risk curve','Value-pool matrix','Benchmark chart','ROI waterfall','Opportunity matrix'],
    deliverables:['Corporate Intelligence Report','Management Dashboard','Investment Brief','Experience Scorecard','Executive Deck'],
    standards:['Materiality','Data privacy','Evidence confidence','Commercial caution','Board readability'],
  },
  research: {
    key:'research', label:'Technical Research & Statistical Publication', profile:'research', audience:['Principal Investigator','Statistician','Research Director','Peer Reviewer','Academic Partner'],
    personality:'Neutral, reproducible, academically rigorous and statistically explicit.',
    palette:{ primary:'#FFFFFF', secondary:'#E5E7EB', accent:'#8B1E3F', background:'#FFFFFF', ink:'#1F2937' },
    cover:{ eyebrow:'Technical Research Publication', motif:'Research design, confidence intervals and analytical model', title_pattern:'{study} Technical Research Report', footer:'Methods, evidence, reproducibility and limitations' },
    tone:['objective','methodologically explicit','statistically cautious','reproducible','peer-review ready'],
    mandatory_sections:['Abstract','Research questions','Literature/context','Study design','Sampling and power','Instrument and field protocol','Data management','Analysis plan','Descriptive results','Inferential results','Reliability and validity','Sensitivity analysis','Limitations','Conclusions','Data dictionary','Reproducibility annex'],
    visuals:['Sampling flow diagram','Population pyramid','Confidence interval plot','Regression coefficient plot','Missingness map','Reliability table','Model diagnostics'],
    deliverables:['Technical Research Report','Statistical Annex','Data Dictionary','Codebook','Reproducibility Pack'],
    standards:['Sampling transparency','Statistical precision','Reproducibility','Research ethics','Citation consistency'],
  },
  humanitarian: {
    key:'humanitarian', label:'Humanitarian Needs & Severity Intelligence', profile:'humanitarian', audience:['Humanitarian Coordinator','Cluster Lead','Emergency Director','Government Emergency Unit','Donor'],
    personality:'Urgent, protection-centred, severity-led and operationally actionable.',
    palette:{ primary:'#9B1C1C', secondary:'#E05A2A', accent:'#F4B740', background:'#FFF8F3', ink:'#331B16' },
    cover:{ eyebrow:'Humanitarian Severity Intelligence', motif:'Severity map, displacement flow and crisis timeline', title_pattern:'{location} Humanitarian Needs Assessment', footer:'People, severity, access, protection and response priorities' },
    tone:['urgent but non-sensational','do-no-harm','protection centred','cluster compatible','access aware'],
    mandatory_sections:['Crisis executive overview','Affected population','Population movement','Severity methodology','Protection risks','Food security','WASH','Shelter','Health','Education','Accessibility and inclusion','Access constraints','Priority geography','Response gaps','Urgency index','Operational recommendations'],
    visuals:['Severity map','Displacement Sankey','Population pyramid','Cluster needs radar','Access constraint map','Urgency matrix','Crisis timeline'],
    deliverables:['Humanitarian Needs Assessment','Severity Overview','Cluster Briefs','Response Priority Matrix','Donor Flash Brief'],
    standards:['Do no harm','Protection mainstreaming','CHS readiness','Disaggregation','Data responsibility'],
  },
};

export const PREMIUM_REPORT_ASSIGNMENTS = {
  national_human_development:'government', donor_impact_evaluation:'donor', government_policy_intelligence:'government', humanitarian_needs_assessment:'humanitarian',
  executive_board_intelligence:'board', customer_experience:'corporate', employee_experience:'corporate', community_scorecard:'donor', annual_impact:'donor', quarterly_performance:'board',
  market_intelligence:'corporate', citizen_voice:'government', technical_research:'research', statistical_annex:'research', interactive_intelligence:'research', evidence_explorer:'un',
};

function sectionStatus(section, report, compiled) {
  const source={...obj(report),...obj(report.methodology),...obj(report.policy),...obj(report.donor),...obj(report.humanitarian)};
  const keywords=section.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(w=>w.length>4);
  const serialized=JSON.stringify(source).toLowerCase();
  const matched=keywords.some(k=>serialized.includes(k));
  if (matched) return 'EVIDENCE_AVAILABLE';
  if (/executive|decision|risk|opportun|recommend/.test(section.toLowerCase()) && compiled?.executive_intelligence) return 'COMPILED_FROM_GOVERNED_MODEL';
  return 'EVIDENCE_REQUIRED';
}

export function getPremiumPublicationCatalog() {
  return {
    engine: PREMIUM_PUBLICATIONS_NAME,
    version: PREMIUM_PUBLICATIONS_VERSION,
    styles: Object.values(PREMIUM_PUBLICATION_STYLES),
    assignments: PREMIUM_REPORT_ASSIGNMENTS,
    non_fabrication_policy:'Missing evidence remains explicitly unverified. Styling never overrides the publication quality gate.',
  };
}

export function buildPremiumCover(report={}, styleKey='government') {
  const style=PREMIUM_PUBLICATION_STYLES[styleKey]||PREMIUM_PUBLICATION_STYLES.government;
  const country=pick(report.country,'National');
  const programme=pick(report.programme_name||report.project_name,'Programme');
  const organization=pick(report.organization_name,'Organization');
  const sector=pick(report.sector,'Development');
  const topic=pick(report.topic||report.title,'Intelligence');
  const study=pick(report.study_name||report.title,'Research Study');
  const location=pick(report.location||report.country,'Affected Area');
  const title=style.cover.title_pattern.replace('{country}',country).replace('{programme}',programme).replace('{organization}',organization).replace('{sector}',sector).replace('{topic}',topic).replace('{study}',study).replace('{location}',location);
  return { ...style.cover, title, palette:style.palette, personality:style.personality, audience:style.audience, edition:report.edition||'Flagship Intelligence Edition', classification:report.classification||'Public / Controlled according to project policy' };
}

export function composePremiumPublication(input={}, styleKey='government') {
  const style=PREMIUM_PUBLICATION_STYLES[styleKey]||PREMIUM_PUBLICATION_STYLES.government;
  const report=obj(input.report||input);
  const compiled=compileFlagshipReport({...report, publication_profile:style.profile});
  const gate=evaluateFlagshipPublicationQuality({...report, publication_profile:style.profile});
  const sections=style.mandatory_sections.map((title,index)=>({ order:index+1, title, status:sectionStatus(title,report,compiled), purpose:`Required ${style.label} publication section.` }));
  const evidenceRequired=sections.filter(s=>s.status==='EVIDENCE_REQUIRED').map(s=>s.title);
  return {
    engine:PREMIUM_PUBLICATIONS_NAME, version:PREMIUM_PUBLICATIONS_VERSION, style_key:style.key, style_label:style.label,
    cover:buildPremiumCover(report,style.key), editorial:{personality:style.personality,tone:style.tone,standards:style.standards},
    publication_profile:INTERNATIONAL_PUBLICATION_PROFILES[style.profile], sections, visual_system:{palette:style.palette,visuals:style.visuals,rule:'Use only visuals supported by governed data; otherwise mark as unavailable.'},
    deliverables:style.deliverables.map(name=>({name,status:gate.status==='PASS'?'READY_TO_RENDER':'SUBJECT_TO_QUALITY_GATE'})),
    compiled_core:compiled, publication_quality_gate:gate,
    premium_readiness:{ status:gate.status, required_sections:sections.length, sections_with_evidence:sections.length-evidenceRequired.length, evidence_required:evidenceRequired, publishable:gate.status==='PASS' && evidenceRequired.length===0 },
    integrity_notice:'This publication composition applies premium structure and visual identity only. It does not create evidence, statistics, budgets, policy claims or assurance not present in the governed report model.',
  };
}

export function buildPremiumPublicationManifest(input={}, styleKey='government') {
  const publication=composePremiumPublication(input,styleKey);
  return {
    style:publication.style_key, title:publication.cover.title, audience:publication.cover.audience,
    products:publication.deliverables, sections:publication.sections.map(s=>s.title), visuals:publication.visual_system.visuals,
    quality_status:publication.publication_quality_gate.status, publishable:publication.premium_readiness.publishable,
    formats:['Interactive HTML','Print-ready PDF','PowerPoint / Board Deck','Word / Editable Report','Excel / Statistical Workbook'],
  };
}
