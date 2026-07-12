import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVRDSReportExperience, buildVRDSAllReportTypes, VRDS_REPORT_TYPES, VRDS_REPORT_EXPERIENCE_VERSION } from '../src/vrds-report-experience.js';
import { buildExecutiveSummaryFormat, buildDonorBriefFormat, buildPolicyBriefFormat, buildInfographicFormat } from '../src/multi-format-renderer.js';

const base = {
  id: 'report_demo',
  is_demo: true,
  demo_country: 'Tanzania',
  metadata: { template_id: 'health_survey', template_name: 'Health Survey Report', organization_name: 'Demo Org', campaign_name: 'Demo Campaign', standards: ['WHO', 'SDG 3'], generated_at: '2026-01-01T00:00:00Z' },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 5 },
  demographics: { gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }], age: [{ label: '18-25', n: 220 }], regions: [{ label: 'Dar es Salaam', n: 400 }, { label: 'Mwanza', n: 250 }] },
  findings: { sentiment: [{ label: 'positive', n: 710 }, { label: 'negative', n: 100 }], topics: [{ topic: 'facility access', count: 61 }, { topic: 'medicine availability', count: 54 }], representative_quotes: [{ raw_text: 'The clinic was nearby but medicines were missing.', response_id: 'resp_1', audio_key: 'audio/1.mp3', consent_id: 'consent_1' }] },
  data_quality: { flagged_response_count: 0, avg_fraud_score: 0.04 },
  narrative: { executive_summary: 'The report demonstrates strong evidence of improved health access while medicine availability remains the key operational gap.', key_findings: ['Facility access is the strongest constraint.', 'Medicine availability requires follow-up.', 'Dar es Salaam has the strongest evidence base.', 'Female participation is balanced.', 'Positive sentiment is strong.'], conclusions: 'Leadership should prioritise medicine availability and district-level follow-up.', risks: ['Stock-out risks may reduce confidence in service delivery.'], opportunities: ['Use community health worker follow-up to close gaps.'] },
  recommendations: { immediate: ['Prioritise medicine availability checks.'], medium_term: ['Strengthen community health worker follow-up.'], long_term: ['Integrate health access monitoring into routine planning.'] },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'How was your health service experience?', question_type: 'open_voice' }] },
};

test('VRDS report experience applies foundation components to a report', () => {
  const exp = buildVRDSReportExperience(base, 'executive_report');
  assert.equal(exp.vrds_report_experience_version, VRDS_REPORT_EXPERIENCE_VERSION);
  assert.equal(exp.layout.report_type, 'executive_report');
  assert.equal(exp.sections.cover.component, 'cover');
  assert.equal(exp.sections.executive_snapshot.component, 'executiveSnapshot');
  assert.ok(exp.sections.executive_brief.component_spec.required.includes('headline'));
  assert.ok(exp.sections.evidence_summary.evidence_mix.length >= 1);
  assert.ok(exp.sections.methodology.sample_size === 1000);
});

test('VRDS report experience is available for all required report types', () => {
  const all = buildVRDSAllReportTypes(base);
  for (const type of Object.keys(VRDS_REPORT_TYPES)) {
    assert.ok(all[type], type);
    assert.equal(all[type].layout.report_type, type);
    assert.ok(all[type].layout.page_sequence.includes('executive_snapshot'));
    assert.ok(all[type].layout.page_sequence.includes('evidence_traceability'));
  }
});

test('VRDS package is attached to multi-format report outputs without removing Phase 20 data', () => {
  const executive = buildExecutiveSummaryFormat(base);
  const donor = buildDonorBriefFormat(base);
  const policy = buildPolicyBriefFormat(base);
  const infographic = buildInfographicFormat(base);
  for (const output of [executive, donor, policy, infographic]) {
    assert.ok(output.one_page_executive_brief_v20);
    assert.ok(output.vrds_report_experience);
    assert.ok(output.vrds_report_experience.sections.decision_dashboard);
    assert.ok(output.vrds_report_experience.sections.risk_dashboard);
    assert.ok(output.vrds_report_experience.sections.evidence_summary);
  }
});

test('VRDS evidence summary does not invent raw evidence when raw pointers are absent', () => {
  const shallow = structuredClone(base);
  shallow.findings.representative_quotes = [{ raw_text: 'A general quote without trace metadata.' }];
  const exp = buildVRDSReportExperience(shallow, 'research_report');
  const labels = exp.sections.evidence_summary.evidence_mix.map(x => x.label.toLowerCase());
  assert.ok(labels.some(l => l.includes('report-model') || l.includes('synthetic')));
});
