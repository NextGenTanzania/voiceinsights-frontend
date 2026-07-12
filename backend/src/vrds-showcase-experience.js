// VoiceInsights report showcase experience layer.
// Public demonstration surface only; no schema, auth, homepage, navigation or core API contract changes.

import { vrdsTokens, vrdsExportTokens, classifyVRDSConfidence, getVRDSEvidenceStyle } from './vrds-foundation.js';
import { buildVRDSReportExperience, buildVRDSAllReportTypes } from './vrds-report-experience.js';
import {
  buildReportExperienceV20,
  buildOnePageExecutiveBriefV20,
  buildPublicationInfographicV20,
  buildMethodologyTransparencyV20,
  buildEvidenceTraceabilityV20,
  buildSampleLibraryPremiumCardV20,
  sanitizePublicReportTextV20,
} from './report-experience.js';
import { getSampleReportShowcaseV20, listSampleReportShowcaseV20 } from './sample-report-showcase.js';
import { buildV183SectorExcellence, buildV183PublicationInfographic, getSectorProfile } from './international-report-excellence.js';

export const VRDS_SHOWCASE_VERSION = '1.0.0-showcase-phase-c';

const FORMATS = Object.freeze([
  { key: 'executive_summary', label: 'Executive Report Preview', audience: 'Executive', export: 'Print-ready report preview' },
  { key: 'one_page_executive_brief', label: 'One-page Executive Brief Preview', audience: 'Executive/Board', export: 'Print-ready one-page preview' },
  { key: 'donor_brief', label: 'Donor Impact Report Preview', audience: 'Donor', export: 'Print-ready donor preview' },
  { key: 'government_report', label: 'Government Cabinet Brief Preview', audience: 'Government', export: 'Print-ready government preview' },
  { key: 'policy_brief', label: 'Policy Brief Preview', audience: 'Government/Policy', export: 'Print-ready policy preview' },
  { key: 'board_deck', label: 'Presentation-ready Board Brief', audience: 'Board', export: 'Presentation-ready board outline' },
  { key: 'ai_talking_points', label: 'Board Deck Outline Preview', audience: 'Board', export: 'Presentation-ready outline' },
  { key: 'infographic', label: 'Infographic Report Preview', audience: 'Executive/Public', export: 'Print-ready infographic preview' },
  { key: 'statistical_annex', label: 'Statistical Annex Preview', audience: 'Research', export: 'Technical annex preview' },
  { key: 'technical_annex', label: 'Technical Annex Preview', audience: 'Research/M&E', export: 'Technical annex preview' },
  { key: 'print_ready_report', label: 'Print-ready Report Preview', audience: 'All', export: 'Browser print-ready report' },
]);

function arr(v) { return Array.isArray(v) ? v : []; }
function safeText(v, fallback = 'Insufficient verified evidence is available for this section.') { return sanitizePublicReportTextV20(v || fallback); }
function templateId(dm) { return dm?.metadata?.template_id || dm?.template_id || 'unknown'; }
function title(dm) { return dm?.sample_showcase_v20?.product_name || dm?.metadata?.template_name || dm?.title || 'VoiceInsights Intelligence Report'; }
function totalResponses(dm) { return Number(dm?.kpis?.total_responses || 0); }
function responseRate(dm) { return Number(dm?.kpis?.response_rate_pct ?? 0); }
function regions(dm) { return arr(dm?.demographics?.regions || dm?.statistical_tables?.regions); }
function qualityScore(dm) { return Number(dm?.report_quality_gate_v19?.overall_score || dm?.phase20?.report_quality_gate?.overall_score || dm?.data_quality?.score || 0); }
function evidenceScore(dm) {
  const dims = arr(dm?.report_quality_gate_v19?.dimensions || dm?.phase20?.report_quality_gate?.dimensions);
  const citation = dims.find(d => d.key === 'citation_coverage' || /evidence|citation/i.test(d.label || ''));
  return Number(citation?.score || qualityScore(dm) || 0);
}
function keyFindings(dm) { return arr(dm?.narrative?.key_findings).slice(0, 5).map(x => safeText(x)); }
function risks(dm) { return arr(dm?.narrative?.risks).slice(0, 3).map(x => safeText(x)); }
function recommendations(dm) {
  const recs = dm?.recommendations || {};
  return [
    ...arr(recs.immediate).map((action, i) => ({ action: safeText(action), tier: 'Immediate', priority: i === 0 ? 'High' : 'Medium', timeline: '0–30 days', owner: 'Field / Operations Team' })),
    ...arr(recs.medium_term).map((action, i) => ({ action: safeText(action), tier: 'Medium-term', priority: i === 0 ? 'High' : 'Medium', timeline: '30–90 days', owner: 'Programme Management' })),
    ...arr(recs.long_term).map(action => ({ action: safeText(action), tier: 'Long-term', priority: 'High', timeline: '6–12 months', owner: 'Country Leadership / Donor Liaison' })),
  ].slice(0, 6);
}

const TEMPLATE_VISUAL_STORIES = Object.freeze({
  health_survey: { sector: 'Health Systems', storyline: 'Access, quality, service readiness and district-level prioritisation.', hero_visual: 'Health-system service readiness dashboard', standards: ['WHO', 'SDG 3'] },
  education_assessment: { sector: 'Education', storyline: 'Learning conditions, attendance, teacher availability and equity.', hero_visual: 'School quality and participation dashboard', standards: ['UNICEF', 'SDG 4'] },
  agriculture_survey: { sector: 'Agriculture & Climate', storyline: 'Productivity, input access, market barriers and climate resilience.', hero_visual: 'Farmer resilience and market access infographic', standards: ['FAO', 'SDG 2', 'SDG 13'] },
  livelihood_assessment: { sector: 'Livelihoods', storyline: 'Income resilience, shock exposure and household livelihood pathways.', hero_visual: 'Livelihood resilience pathway', standards: ['SDG 1', 'SDG 8'] },
  humanitarian_needs: { sector: 'Humanitarian Response', storyline: 'Needs severity, response gaps, protection risks and priority locations.', hero_visual: 'Humanitarian severity and response priority map', standards: ['Sphere', 'CHS'] },
  baseline_study: { sector: 'Baseline Study', storyline: 'Starting conditions, indicator baselines and measurement priorities.', hero_visual: 'Baseline indicator framework', standards: ['OECD-DAC'] },
  endline_evaluation: { sector: 'Endline Evaluation', storyline: 'Change, contribution, lessons and scale decisions.', hero_visual: 'Outcome contribution story', standards: ['OECD-DAC'] },
  market_research: { sector: 'Market Research', storyline: 'Demand, trust, segmentation and adoption opportunities.', hero_visual: 'Market segmentation dashboard', standards: ['Market Research'] },
  customer_satisfaction: { sector: 'Customer Experience', storyline: 'Satisfaction, trust, service pain points and retention risk.', hero_visual: 'Customer journey and pain-point map', standards: ['CX'] },
  employee_engagement: { sector: 'Employee Engagement', storyline: 'Engagement, retention risk, leadership trust and productivity signals.', hero_visual: 'Engagement heatmap', standards: ['People Analytics'] },
  citizen_feedback: { sector: 'Citizen Feedback', storyline: 'Service delivery trust, complaint resolution and accountability priorities.', hero_visual: 'Citizen accountability dashboard', standards: ['Public Sector'] },
  community_scorecard: { sector: 'Community Scorecard', storyline: 'Community priorities, facility accountability and service improvement.', hero_visual: 'Community priority matrix', standards: ['Social Accountability'] },
  monitoring_report: { sector: 'Programme Monitoring', storyline: 'Implementation progress, bottlenecks, risk and corrective action.', hero_visual: 'Traffic-light monitoring dashboard', standards: ['RBM'] },
  quarterly_performance: { sector: 'Quarterly Performance', storyline: 'Quarterly progress, management risks and board-level actions.', hero_visual: 'Quarterly executive scorecard', standards: ['RBM'] },
  annual_impact: { sector: 'Annual Impact', storyline: 'Outcomes, value for money, learning and next-cycle priorities.', hero_visual: 'Annual impact contribution dashboard', standards: ['OECD-DAC', 'SDG'] },
  sdg_progress: { sector: 'SDG Progress', storyline: 'SDG-aligned progress, gaps, equity and planning priorities.', hero_visual: 'SDG contribution and planning dashboard', standards: ['SDGs', 'UNDP'] },
});

export function getVRDSSampleStory(template) {
  const showcase = getSampleReportShowcaseV20(template) || {};
  const profile = getSectorProfile(template);
  return {
    ...(TEMPLATE_VISUAL_STORIES[template] || { sector: showcase.sector || 'Research Intelligence', storyline: showcase.flagship_use_case || 'Evidence-to-decision intelligence.', hero_visual: 'Executive intelligence dashboard', standards: showcase.standards || [] }),
    product_name: showcase.product_name || profile.title || null,
    sector_terms: profile.terminology || [],
    sector_kpis: profile.kpis || [],
    audiences: showcase.audiences || ['Executive', 'Donor', 'Government', 'Research'],
    formats: showcase.formats || FORMATS.map(f => f.label),
    sample_sections: showcase.sample_sections || [],
    visual_package: showcase.visual_package || [],
    decision_outputs: showcase.decision_outputs || [],
  };
}

export function buildVRDSPremiumCover(dm) {
  const story = getVRDSSampleStory(templateId(dm));
  return {
    component: 'vrdsPremiumCover',
    report_title: story.product_name || title(dm),
    report_type: 'Sample Intelligence Report',
    sector: story.sector,
    country: dm?.demo_country || story.country || 'Demo country',
    prepared_for: dm?.metadata?.organization_name || 'VoiceInsights Demo Organization',
    classification: dm?.is_demo ? 'Demonstration Report — fictional sample data only' : 'Client report',
    hero_visual: story.hero_visual,
    executive_storyline: story.storyline,
    standards: story.standards,
    experience_label: 'Executive Intelligence Report',
  };
}

export function buildVRDSShowcaseCard(dm) {
  const story = getVRDSSampleStory(templateId(dm));
  const card = buildSampleLibraryPremiumCardV20(dm);
  const q = qualityScore(dm);
  const e = evidenceScore(dm);
  return {
    component: 'vrdsShowcaseCard',
    report_id: dm.id || null,
    title: story.product_name || card.title || title(dm),
    sector_badge: story.sector,
    audience_badges: story.audiences,
    standards_badges: story.standards,
    format_badges: ['Executive Report','Donor Report','Policy Brief','Board Deck','Infographic','Statistical Annex'],
    quality_score: q || card.quality_score || null,
    evidence_score: e || card.evidence_score || null,
    confidence_label: classifyVRDSConfidence(q).label,
    preview_thumbnail: {
      style: 'executive-report-preview',
      headline: keyFindings(dm)[0] || story.storyline,
      hero_visual: story.hero_visual,
      kpi_strip: [
        { label: 'Responses', value: totalResponses(dm) || '—' },
        { label: 'Response', value: responseRate(dm) ? `${responseRate(dm)}%` : '—' },
        { label: 'Quality', value: q ? `${q}/100` : '—' },
        { label: 'Evidence', value: e ? `${e}/100` : '—' },
      ],
    },
    methodology_preview: buildMethodologyTransparencyV20(dm),
    sector_excellence: buildV183SectorExcellence(dm),
    export_quality_note: 'Preview exports are honest print-ready or presentation-ready outputs prepared from the public demonstration evidence package.',
    actions: FORMATS.map(f => ({ ...f, label: f.key === 'ai_talking_points' ? 'View Board Deck' : (f.label.startsWith('View ') ? f.label : `View ${f.label}`), display_label: f.label.startsWith('View ') ? f.label : `View ${f.label}`, href_format: f.key })),
  };
}

export function buildVRDSShowcaseInfographicPages(dm) {
  const base = buildV183PublicationInfographic(dm);
  const brief = buildOnePageExecutiveBriefV20(dm);
  const recs = recommendations(dm);
  const trace = buildEvidenceTraceabilityV20(dm);
  const story = getVRDSSampleStory(templateId(dm));
  return {
    component: 'vrdsShowcaseInfographicSet',
    visual_standard: 'Publication-style public sample report experience',
    pages: [
      {
        id: 'premium-cover', title: 'Premium Cover', layout: 'full-page cover with metadata and sector story',
        components: [buildVRDSPremiumCover(dm)], evidence_label: dm.is_demo ? 'Synthetic demo evidence' : 'Report-model evidence',
      },
      {
        id: 'executive-kpi-page', title: 'Executive KPI Page', layout: 'executive headline, main KPI visual area, interpretation and evidence note',
        executive_headline: 'Executive KPI dashboard',
        interpretation: 'Use these indicators to judge whether the report is ready for executive review.',
        decision_implication: 'Proceed to detailed evidence review if quality and evidence scores are acceptable.',
        components: [
          { type: 'kpi', label: 'Responses', value: totalResponses(dm), interpretation: 'Evidence base size' },
          { type: 'kpi', label: 'Response Rate', value: responseRate(dm) ? `${responseRate(dm)}%` : '—', interpretation: 'Participation confidence' },
          { type: 'kpi', label: 'Quality', value: qualityScore(dm) ? `${qualityScore(dm)}/100` : '—', interpretation: 'Report readiness' },
          { type: 'kpi', label: 'Evidence', value: evidenceScore(dm) ? `${evidenceScore(dm)}/100` : '—', interpretation: 'Traceability coverage' },
        ], evidence_label: 'Report-model evidence',
      },
      {
        id: 'one-page-executive-brief', title: 'One-Page Executive Brief', layout: 'headline + findings + risks + decisions',
        components: brief, evidence_label: dm.is_demo ? 'Synthetic demo evidence' : 'Report-model evidence',
      },
      {
        id: 'regional-intelligence-page', title: 'Regional Intelligence', layout: 'ranked regional intelligence page with primary visual area and evidence note',
        executive_headline: 'Regional intelligence',
        interpretation: 'Regional coverage is used to identify where follow-up or validation should be prioritized.',
        decision_implication: 'Prioritize lower-coverage or higher-risk locations for management review.',
        components: regions(dm).map(r => ({ region: r.label || r.region, responses: r.n || r.responses || 0, priority: 'Follow-up based on coverage and evidence strength' })), evidence_label: 'Report-model evidence',
      },
      {
        id: 'risk-matrix-page', title: 'Risk Matrix', layout: 'publication-style likelihood × impact risk matrix with mitigation notes',
        executive_headline: 'Risk matrix',
        interpretation: 'Risk priority is based on the report evidence model and does not introduce unsupported figures.',
        decision_implication: 'Assign owners to the highest-priority risks before implementation.',
        components: risks(dm).map((risk, i) => ({ risk, likelihood: i === 0 ? 'High' : 'Medium', impact: i === 0 ? 'High' : 'Medium', mitigation: recs[i]?.action || 'Assign mitigation owner' })), evidence_label: 'Report-model evidence',
      },
      {
        id: 'decision-matrix-page', title: 'Decision Matrix', layout: 'publication-style impact × effort decision matrix',
        executive_headline: 'Decision matrix',
        interpretation: 'Recommended actions are organized by expected impact and implementation effort.',
        decision_implication: 'Start with high-impact, lower-effort actions before longer-term reforms.',
        components: recs.map((r, i) => ({ ...r, impact: r.priority === 'High' ? 'High' : 'Medium', effort: i < 2 ? 'Low' : i < 4 ? 'Medium' : 'High' })), evidence_label: 'Report-model evidence',
      },
      {
        id: 'evidence-dashboard-page', title: 'Evidence Quality Dashboard', layout: 'evidence quality dashboard with classification and traceability notes',
        executive_headline: 'Evidence quality dashboard',
        interpretation: 'Evidence is separated into raw-source, report-model and synthetic demo evidence to avoid misleading claims.',
        decision_implication: 'Use raw-source evidence for audit questions and report-model evidence for executive interpretation.',
        components: trace.slice(0, 6).map(t => ({ claim: t.claim, evidence: t.evidence_classification, confidence: t.confidence_score, raw_available: !!t.raw_available, style: getVRDSEvidenceStyle(t.evidence_classification) })), evidence_label: 'Mixed evidence classification',
      },
      ...((base.pages || []).filter(p => !['executive-kpi-dashboard','regional-intelligence','risk-matrix','decision-matrix','evidence-quality-dashboard','recommendation-priority'].includes(p.id)).map(p => ({ ...p, inherited_publication_page: true }))),
      {
        id: 'audience-formats-page', title: 'Audience & Format Selector', layout: 'executive-ready export matrix',
        components: FORMATS, evidence_label: 'Report format metadata',
      },
    ],
    story,
  };
}

export function buildVRDSShowcaseExperience(dm) {
  const clean = sanitizePublicReportTextV20(dm);
  const phase20 = buildReportExperienceV20(clean);
  const vrds = buildVRDSReportExperience(clean, 'interactive_report');
  const allReportTypes = buildVRDSAllReportTypes(clean);
  const trace = buildEvidenceTraceabilityV20(clean);
  const methodology = buildMethodologyTransparencyV20(clean);
  const sectorExcellence = buildV183SectorExcellence(clean);
  const v183Infographic = buildV183PublicationInfographic(clean);
  const brief = buildOnePageExecutiveBriefV20(clean);
  return {
    version: VRDS_SHOWCASE_VERSION,
    public_version: 'International Report Experience v183',
    public_name: 'International Report Experience',
    design_system: 'VoiceInsights Report Experience',
    public_safety: {
      demo_only: !!clean.is_demo,
      public_wording_sanitized: true,
      raw_evidence_rule: 'Raw-source evidence is only claimed when actual raw response, transcript, audio or consent metadata exists.',
    },
    tokens: {
      colors: vrdsTokens.colors,
      evidenceColors: vrdsTokens.evidenceColors,
      confidenceColors: vrdsTokens.confidenceColors,
      export: vrdsExportTokens,
    },
    premium_cover: buildVRDSPremiumCover(clean),
    international_report_excellence: sectorExcellence,
    publication_grade_infographic: v183Infographic,
    sample_library_card: buildVRDSShowcaseCard(clean),
    executive_brief: brief,
    executive_snapshot: vrds.sections.executive_snapshot,
    decision_dashboard: vrds.sections.decision_dashboard,
    risk_dashboard: vrds.sections.risk_dashboard,
    regional_intelligence: vrds.sections.regional_intelligence,
    demographic_intelligence: vrds.sections.demographic_intelligence,
    evidence_dashboard: vrds.sections.evidence_summary,
    methodology,
    quality_assessment: {
      quality_score: qualityScore(clean) || phase20.report_quality_gate?.overall_score || null,
      evidence_score: evidenceScore(clean) || null,
      confidence: classifyVRDSConfidence(qualityScore(clean)),
      gate_status: phase20.report_quality_gate?.status || clean.report_quality_gate_v19?.status || 'checked',
      export_ready: phase20.ai_verification?.export_allowed !== false,
    },
    recommendation_priority: recommendations(clean),
    implementation_timeline: vrds.sections.implementation_roadmap,
    expected_impact: brief.expected_impact,
    sector_interpretation: getVRDSSampleStory(templateId(clean)),
    audience_language: {
      executive: 'decision-first and compressed',
      donor: 'outcome, accountability and value-for-money oriented',
      government: 'policy option, fiscal implication and implementation risk oriented',
      research: 'methodology, confidence and limitations oriented',
    },
    infographic_pages: buildVRDSShowcaseInfographicPages(clean),
    all_report_types: allReportTypes,
    assistant_actions: phase20.report_assistant_actions,
    evidence_traceability: trace,
    export_manifest: FORMATS.map(f => ({ ...f, quality_gate_required: true, public_format_route: `/api/public/demo-reports/:id/format/${f.key}`, export_note: f.export })),
  };
}

export function buildAllVRDSSampleShowcaseCards() {
  return listSampleReportShowcaseV20().map(meta => ({
    template_id: meta.template_id,
    title: meta.product_name,
    sector_badge: meta.sector,
    audience_badges: meta.audiences,
    standards_badges: meta.standards,
    format_badges: meta.formats,
    premium_score: meta.premium_score,
    hero_visual: meta.visual_package?.[0] || 'Executive intelligence dashboard',
    storyline: meta.flagship_use_case,
  }));
}
