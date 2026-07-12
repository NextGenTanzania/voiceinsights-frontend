import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SECTOR_EXCELLENCE_PROFILES, buildV183SectorExcellence, buildV183PublicationInfographic, buildV183ExportPackage } from '../src/international-report-excellence.js';
import { buildVRDSShowcaseExperience, buildVRDSShowcaseCard } from '../src/vrds-showcase-experience.js';
import { buildDonorBriefFormat, buildGovernmentReportFormat, buildBoardDeckFormat, buildTechnicalAnnexFormat } from '../src/multi-format-renderer.js';

const viewerSource = fs.readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');
const librarySource = fs.readFileSync(new URL('../../site/sample-reports.html', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
const showcaseCss = fs.readFileSync(new URL('../../site/assets/css/vrds-showcase.css', import.meta.url), 'utf8');

const baseModel = (template_id = 'health_survey') => ({
  id: `report_${template_id}`,
  is_demo: true,
  demo_country: 'Tanzania',
  metadata: { template_id, template_name: 'Demonstration Report', organization_name: 'VoiceInsights Demo Organization', campaign_name: 'Demo Campaign', generated_at: '2026-01-01T00:00:00Z', standards: ['SDG'] },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 6 },
  demographics: { regions: [{ label: 'Dar es Salaam', n: 220 }, { label: 'Mwanza', n: 180 }], gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }], age: [{ label: '18-25', n: 250 }, { label: '26-35', n: 300 }] },
  findings: { sentiment: [{ label: 'positive', n: 650 }, { label: 'negative', n: 120 }], topics: [{ topic: 'service access', count: 42 }], representative_quotes: [{ raw_text: 'Services improved but coverage is uneven.' }] },
  narrative: { executive_summary: 'The report indicates progress with unresolved gaps that require management attention.', key_findings: ['The leading constraint requires priority action.', 'Regional differences require targeted follow-up.', 'Inclusion evidence supports differentiated programming.', 'Positive sentiment provides a usable base.', 'Quality and evidence are sufficient for controlled executive review.'], risks: ['The leading constraint may reduce programme credibility if ignored.', 'Regional gaps may widen.'], opportunities: ['Use evidence to focus high-return intervention areas.'], conclusions: 'Leadership should assign the highest-priority recommendation and measure progress in the next cycle.' },
  recommendations: { immediate: ['Assign owners for the highest-priority corrective action.'], medium_term: ['Strengthen targeted implementation in lower-performing locations.'], long_term: ['Institutionalise routine measurement and evidence review.'] },
  data_quality: { score: 94, avg_fraud_score: 0.03, flagged_response_count: 0 },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'How would you describe your experience?', question_type: 'open_voice' }] },
  report_quality_gate_v19: { overall_score: 94, status: 'passed', dimensions: [{ key: 'citation_coverage', score: 91 }] },
});

const templates = Object.keys(SECTOR_EXCELLENCE_PROFILES);

test('Worker import succeeds with route aliases', async () => {
  await import('../src/application.js');
});

test('all 16 sample reports have sector-specific terminology and metadata', () => {
  assert.equal(templates.length, 16);
  for (const t of templates) {
    const profile = SECTOR_EXCELLENCE_PROFILES[t];
    assert.ok(profile.sector, t);
    assert.ok(profile.title, t);
    assert.ok(profile.terminology.length >= 8, t);
    assert.ok(profile.kpis.length >= 5, t);
    const exp = buildV183SectorExcellence(baseModel(t));
    assert.equal(exp.sector, profile.sector);
    assert.ok(exp.terminology.some(term => profile.terminology.includes(term)), t);
    assert.ok(exp.donor.logframe_alignment);
    assert.ok(exp.government.cabinet_memo_summary);
    assert.ok(exp.research.methodology);
  }
});

test('public routes remain safe and format aliases exist', () => {
  assert.match(indexSource, /WHERE id = \? AND is_demo = 1 AND status = 'published'/);
  for (const key of ['government_report','board_deck','technical_annex','one_page_executive_brief','print_ready_report']) {
    assert.match(indexSource, new RegExp(`${key}:`));
  }
});

test('public wording contains no buyer-facing technical leaks in visible surfaces', () => {
  const visible = (viewerSource + librarySource).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  for (const phrase of ['VoiceInsights Intelligence OS v7.0','Report Trust & Evidence Layer','VRDS Showcase Experience','structured assistant actions','Not enough data','raw JSON','undefined','NaN']) {
    assert.doesNotMatch(visible, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(viewerSource, /Executive Intelligence Report/);
  assert.match(viewerSource, /Decision Support Assistant/);
});

test('export outputs are report-like previews, not raw dumps, and labels are honest', () => {
  const dm = baseModel('agriculture_survey');
  for (const format of ['executive_summary','donor_brief','government_report','policy_brief','board_deck','infographic','statistical_annex','technical_annex','one_page_executive_brief','print_ready_report']) {
    const pack = buildV183ExportPackage(dm, format);
    assert.ok(pack.cover.report_title, format);
    assert.ok(pack.executive_summary, format);
    assert.ok(pack.methodology_summary, format);
    assert.ok(pack.evidence_label.includes('Synthetic demo evidence'), format);
    assert.ok(pack.quality_confidence, format);
    assert.ok(pack.recommendations.length <= (/board/.test(format) ? 3 : 5), format);
    assert.doesNotMatch(JSON.stringify(pack), /\[object Object\]|raw JSON|Not enough data|undefined|NaN/i, format);
    assert.match(pack.honest_export_type, /preview|outline|print-ready|Browser print-ready|Clean export/i, format);
  }
});

test('infographics include publication-grade structure, not only cards', () => {
  const ig = buildV183PublicationInfographic(baseModel('sdg_progress'));
  const ids = ig.pages.map(p => p.id);
  for (const id of ['executive-kpi-dashboard','regional-intelligence','gender-inclusion-profile','youth-age-profile','sentiment-dashboard','risk-matrix','decision-matrix','evidence-quality-dashboard','recommendation-priority','implementation-timeline','impact-forecast','donor-impact-summary','government-policy-options','board-one-page-summary']) {
    assert.ok(ids.includes(id), id);
  }
  for (const page of ig.pages) {
    assert.ok(page.headline, page.id);
    assert.ok(page.main_visual, page.id);
    assert.ok(page.supporting_insight_cards.length <= 4, page.id);
    assert.ok(page.decision_implication, page.id);
    assert.ok(page.evidence_label, page.id);
    assert.equal(page.print_safe, true, page.id);
    assert.equal(page.mobile_safe, true, page.id);
  }
});

test('donor, government, board and research formats contain required sections', () => {
  const dm = baseModel('humanitarian_needs');
  const donor = buildDonorBriefFormat(dm);
  assert.ok(donor.v183_export_package.donor_sections.logframe_alignment);
  assert.ok(donor.v183_export_package.donor_sections.value_for_money);
  assert.ok(donor.v183_export_package.donor_sections.inclusion);
  assert.ok(donor.v183_export_package.donor_sections.funding_justification);
  assert.ok(donor.v183_export_package.donor_sections.next_cycle_recommendations.length);
  const gov = buildGovernmentReportFormat(dm);
  assert.ok(gov.cabinet_memo_summary);
  assert.ok(gov.policy_problem);
  assert.ok(gov.policy_options.length <= 3);
  assert.ok(gov.fiscal_implications);
  assert.ok(gov.implementation_risks.length);
  assert.ok(gov.decision_required);
  const board = buildBoardDeckFormat(dm);
  assert.ok(board.key_insights.length <= 5);
  assert.ok(board.decisions_required.length <= 3);
  assert.ok(board.top_risks.length <= 3);
  assert.ok(board.expected_impact);
  assert.ok(board.confidence_score);
  assert.ok(board.evidence_quality);
  const tech = buildTechnicalAnnexFormat(dm);
  assert.ok(tech.methodology);
  assert.ok(tech.limitations);
  assert.ok(tech.evidence_type);
});

test('sample viewer displays v183 sections and mobile-safe hooks', () => {
  assert.match(viewerSource, /sector-excellence/);
  assert.match(viewerSource, /publication_grade_infographic/);
  assert.match(viewerSource, /supporting_insight_cards/);
  assert.match(showcaseCss, /v183 international report excellence/);
  assert.match(showcaseCss, /@media\(max-width:680px\)/);
  assert.match(showcaseCss, /grid-template-columns:1fr/);
});

test('showcase experience exposes sector excellence and export manifest for controlled demos', () => {
  const exp = buildVRDSShowcaseExperience(baseModel('education_assessment'));
  assert.ok(exp.international_report_excellence.terminology.includes('learning outcomes'));
  assert.ok(exp.publication_grade_infographic.pages.length >= 14);
  assert.ok(exp.export_manifest.some(f => f.key === 'government_report'));
  assert.ok(exp.export_manifest.some(f => f.key === 'technical_annex'));
  const card = buildVRDSShowcaseCard(baseModel('customer_satisfaction'));
  assert.ok(card.sector_excellence.terminology.includes('customer journey'));
  assert.ok(card.export_quality_note.includes('honest'));
});
