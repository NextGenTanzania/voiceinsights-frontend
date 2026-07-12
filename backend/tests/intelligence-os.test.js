import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceOSV7, buildReportQualityGate, buildEvidenceCitationsV7, buildReportFormatsV7, buildSDGCards, enrichDocumentModelWithIntelligenceOSV7 } from '../src/intelligence-os.js';
import { buildReportStudioV7 } from '../src/report-studio.js';

const dm = {
  is_demo: true,
  metadata: { template_id: 'health_survey', template_name: 'Health Survey Report', organization_name: 'Demo Org', campaign_name: 'Demo Campaign', standards: ['SDG', 'WHO'] },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 6 },
  demographics: { gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }], age: [{ label: '18-25', n: 250 }], regions: [{ label: 'Dar es Salaam', n: 300 }, { label: 'Mwanza', n: 200 }] },
  findings: { sentiment: [{ label: 'positive', n: 700 }, { label: 'negative', n: 100 }], topics: [{ topic: 'facility access', count: 61 }, { topic: 'medicine availability', count: 54 }] },
  representative_quotes: [{ quote: 'The clinic was close but medicine was unavailable.' }],
  data_quality: { avg_fraud_score: 0.04, flagged_response_count: 2 },
  narrative: { executive_summary: 'This report shows strong health-service evidence.', key_findings: ['Facility access is the strongest constraint.', 'Medicine availability requires follow-up.', 'Dar es Salaam has the strongest evidence base.', 'Female participation is balanced.', 'Positive sentiment is strong.'], risks: ['Medicine shortages may weaken trust.'], opportunities: ['Use community health workers to improve coverage.'] },
  recommendations: { immediate: ['Prioritise medicine availability checks.'], medium_term: ['Strengthen community health worker follow-up.'], long_term: ['Integrate health access monitoring into routine planning.'] },
  annexes: { questionnaire: [{ question_text: 'How was your health service experience?' }] },
};

test('quality gate passes strong evidence and blocks neither export nor citations', () => {
  const q = buildReportQualityGate(dm);
  assert.equal(q.status, 'PASS');
  assert.equal(q.export_allowed, true);
  assert.ok(q.overall_score >= 85);
});

test('evidence citations attach source details to claims', () => {
  const citations = buildEvidenceCitationsV7(dm);
  assert.ok(citations.length >= 5);
  assert.ok(citations[0].respondent_count === 1000);
  assert.ok(citations[0].quote);
  assert.ok(citations[0].confidence_score >= 80);
});

test('eight international report products are declared', () => {
  const formats = buildReportFormatsV7(dm);
  assert.equal(formats.length, 8);
  assert.ok(formats.some(f => f.format === 'PowerPoint Board Deck'));
  assert.ok(formats.some(f => f.format === 'Donor Impact Report'));
});

test('SDG cards include recognizable SDG metadata', () => {
  const cards = buildSDGCards(dm);
  assert.ok(cards.some(c => c.code === 'SDG 3'));
  assert.ok(cards.every(c => c.color && c.icon && c.goal));
});

test('Intelligence OS does not insert Not enough data text for populated reports', () => {
  const out = enrichDocumentModelWithIntelligenceOSV7(dm);
  assert.equal(JSON.stringify(out).includes('Not enough data has been collected yet'), false);
  assert.ok(out.intelligence_os_v7.infographic_blueprint.executive_kpi_cards.length >= 4);
});

test('Report Studio v7 exposes interactive report products', () => {
  const studio = buildReportStudioV7(enrichDocumentModelWithIntelligenceOSV7(dm));
  assert.equal(studio.studio_version, 'Report Studio v7.0');
  assert.ok(studio.report_products.executive_report.findings.length >= 5);
  assert.ok(studio.intelligence_chapters.some(c => c.id === 'sdgs'));
});
