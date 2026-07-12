import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportExperienceV20,
  buildPublicationInfographicV20,
  buildOnePageExecutiveBriefV20,
  buildEvidenceTraceabilityV20,
  buildMethodologyTransparencyV20,
  buildSampleLibraryPremiumCardV20,
  buildReportAssistantActionsV20,
  sanitizePublicReportTextV20,
  enrichDocumentModelWithPhase20,
} from '../src/report-experience.js';
import { buildExecutiveSummaryFormat, buildDonorBriefFormat, buildPolicyBriefFormat, buildInfographicFormat } from '../src/multi-format-renderer.js';

const base = {
  id: 'report_demo',
  is_demo: true,
  demo_country: 'Tanzania',
  metadata: { template_id: 'health_survey', template_name: 'Health Survey Report', sector: 'health', organization_name: 'Demo Org', campaign_name: 'Demo Campaign', standards: ['WHO', 'SDG 3'], generated_at: '2026-01-01T00:00:00Z' },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 5 },
  demographics: {
    gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }],
    age: [{ label: '18-25', n: 220 }, { label: '26-35', n: 300 }, { label: '36-45', n: 260 }],
    regions: [{ label: 'Dar es Salaam', n: 400 }, { label: 'Mwanza', n: 250 }, { label: 'Dodoma', n: 180 }, { label: 'Arusha', n: 170 }],
  },
  findings: {
    sentiment: [{ label: 'positive', n: 710 }, { label: 'neutral', n: 190 }, { label: 'negative', n: 100 }],
    topics: [{ topic: 'facility access', count: 61 }, { topic: 'medicine availability', count: 54 }, { topic: 'wait times', count: 42 }],
    representative_quotes: [{ raw_text: 'The clinic was nearby but medicines were missing.', response_id: 'resp_1', audio_key: 'audio/1.mp3', consent_id: 'consent_1' }],
  },
  data_quality: { flagged_response_count: 0, avg_fraud_score: 0.04 },
  narrative: {
    executive_summary: 'The report demonstrates strong evidence of improved health access while medicine availability remains the key operational gap.',
    key_findings: ['Facility access is the strongest constraint.', 'Medicine availability requires follow-up.', 'Dar es Salaam has the strongest evidence base.', 'Female participation is balanced.', 'Positive sentiment is strong.'],
    conclusions: 'Leadership should prioritise medicine availability and district-level follow-up.',
    risks: ['Stock-out risks may reduce confidence in service delivery.', 'Regional follow-up may be uneven.'],
    opportunities: ['Use community health worker follow-up to close gaps.', 'Strengthen routine health access monitoring.'],
  },
  recommendations: {
    immediate: ['Prioritise medicine availability checks.'],
    medium_term: ['Strengthen community health worker follow-up.'],
    long_term: ['Integrate health access monitoring into routine planning.'],
  },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'How was your health service experience?', question_type: 'open_voice' }], statistical_tables: { regions: [] } },
};

test('Phase 20 builds procurement-grade package with all required sections', () => {
  const pkg = buildReportExperienceV20(base);
  assert.equal(pkg.phase, '20');
  assert.ok(pkg.one_page_executive_brief.five_key_findings.length >= 5);
  assert.ok(pkg.publication_infographic.pages.length >= 8);
  assert.ok(pkg.methodology_transparency.sample_size === 1000);
  assert.ok(pkg.procurement_grade_formats.donor_impact_report.sections.includes('Value for money'));
  assert.ok(pkg.procurement_grade_formats.government_report.sections.includes('Policy options'));
  assert.ok(pkg.procurement_grade_formats.board_report.max_findings <= 5);
});

test('Phase 20 true infographic contains expected publication-grade pages', () => {
  const ig = buildPublicationInfographicV20(base);
  const ids = ig.pages.map(p => p.id);
  assert.ok(ids.includes('executive-kpi-dashboard'));
  assert.ok(ids.includes('regional-intelligence'));
  assert.ok(ids.includes('risk-matrix'));
  assert.ok(ids.includes('decision-matrix'));
  assert.ok(ids.includes('sdg-contribution'));
  assert.ok(ids.includes('one-page-board-summary'));
});

test('Phase 20 executive brief compresses board-level information', () => {
  const brief = buildOnePageExecutiveBriefV20(base);
  assert.equal(brief.five_key_findings.length, 5);
  assert.ok(brief.three_critical_risks.length <= 3);
  assert.ok(brief.three_recommended_decisions.length <= 3);
  assert.ok(brief.decision_required);
});

test('Phase 20 evidence traceability labels raw-source evidence only when source pointers exist', () => {
  const evidence = buildEvidenceTraceabilityV20(base);
  assert.ok(evidence[0].evidence_classification === 'raw-source evidence');
  assert.equal(evidence[0].raw_available, true);
  const noRaw = structuredClone(base);
  noRaw.findings.representative_quotes = [{ quote: 'Aggregated model quote only.' }];
  const modelEvidence = buildEvidenceTraceabilityV20(noRaw);
  assert.notEqual(modelEvidence[0].evidence_classification, 'raw-source evidence');
  assert.match(modelEvidence[0].public_disclosure, /not presented as raw transcript\/audio evidence/);
});

test('Phase 20 methodology transparency includes required procurement fields', () => {
  const m = buildMethodologyTransparencyV20(base);
  assert.equal(m.sample_size, 1000);
  assert.ok(m.geography.regions_covered >= 1);
  assert.ok(m.limitations.length >= 3);
  assert.ok(m.questionnaire_items.length >= 1);
  assert.ok(m.evidence_type.includes('Synthetic demo evidence'));
});

test('Phase 20 sample library card includes premium buyer fields and actions', () => {
  const c = buildSampleLibraryPremiumCardV20(base);
  assert.ok(c.sector_badge);
  assert.ok(c.audience_badges.length >= 3);
  assert.ok(c.standards_badges.includes('WHO'));
  assert.ok(c.methodology_summary.includes('1000 responses'));
  assert.ok(c.actions.some(a => a.label === 'View Executive Report'));
  assert.ok(c.actions.some(a => a.label === 'View Board Deck'));
});

test('Phase 20 report assistant actions are safe structured outputs', () => {
  const actions = buildReportAssistantActionsV20(base);
  const ids = actions.map(a => a.id);
  assert.ok(ids.includes('summarize_report'));
  assert.ok(ids.includes('show_evidence'));
  assert.ok(ids.includes('prepare_board_talking_points'));
  assert.ok(ids.includes('prepare_minister_brief'));
});

test('Phase 20 public wording sanitizer removes unsafe report phrases', () => {
  const unsafe = { text: 'Not enough data has been collected yet. Generated by system. Demo placeholder.' };
  const clean = sanitizePublicReportTextV20(unsafe);
  assert.doesNotMatch(clean.text, /Not enough data|Generated by system|Demo placeholder/);
  assert.match(clean.text, /Insufficient verified evidence/);
});

test('Phase 20 enrichment remains compatible with existing format renderers', () => {
  const enriched = enrichDocumentModelWithPhase20(base);
  const exec = buildExecutiveSummaryFormat(enriched);
  const donor = buildDonorBriefFormat(enriched);
  const policy = buildPolicyBriefFormat(enriched);
  const info = buildInfographicFormat(enriched);
  assert.ok(exec.one_page_executive_brief_v20);
  assert.ok(donor.procurement_grade_format_v20.sections.includes('Value for money'));
  assert.ok(policy.procurement_grade_format_v20.sections.includes('Policy options'));
  assert.ok(info.publication_infographic_v20.pages.length >= 8);
});
