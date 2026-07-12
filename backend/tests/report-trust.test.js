import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportQualityGateV19,
  buildEvidenceTraceabilityV19,
  buildTrueInfographicRendererV19,
  buildSDGVisualCardsV19,
  buildAIVerificationLayerV19,
  enrichDocumentModelWithPhase19,
} from '../src/report-trust.js';
import { buildReportStudioV7 } from '../src/report-studio.js';

const dm = {
  is_demo: true,
  metadata: { template_id: 'health_survey', template_name: 'Health Survey Report', sector: 'health', organization_name: 'Demo Org', standards: ['SDG 3', 'WHO'] },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 5 },
  demographics: {
    gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }],
    age: [{ label: '18-25', n: 220 }, { label: '26-35', n: 300 }],
    regions: [{ label: 'Dar es Salaam', n: 400 }, { label: 'Mwanza', n: 250 }, { label: 'Dodoma', n: 180 }],
  },
  findings: {
    sentiment: [{ label: 'positive', n: 710 }, { label: 'neutral', n: 190 }, { label: 'negative', n: 100 }],
    topics: [{ topic: 'facility access', count: 61 }, { topic: 'medicine availability', count: 54 }],
    representative_quotes: [{ raw_text: 'The clinic was nearby but medicines were missing.', response_id: 'resp_1', audio_key: 'audio/1.mp3' }],
  },
  data_quality: { flagged_response_count: 0, avg_fraud_score: 0.04 },
  narrative: {
    executive_summary: 'The report shows strong health evidence with specific service delivery gaps.',
    key_findings: ['Facility access is the strongest constraint.', 'Medicine availability requires follow-up.', 'Dar es Salaam has the strongest evidence base.', 'Female participation is balanced.', 'Positive sentiment is strong.'],
  },
  recommendations: {
    immediate: ['Prioritise medicine availability checks.'],
    medium_term: ['Strengthen community health worker follow-up.'],
    long_term: ['Integrate health access monitoring into routine planning.'],
  },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'How was your health service experience?' }], methodology: 'Demo methodology.' },
};

test('Phase 19 quality gate enforces export readiness across required dimensions', () => {
  const gate = buildReportQualityGateV19(dm);
  assert.equal(gate.export_allowed, true);
  assert.ok(gate.dimensions.some(d => d.key === 'sample_size'));
  assert.ok(gate.dimensions.some(d => d.key === 'citation_coverage'));
  assert.ok(gate.overall_score >= 85);
});

test('Phase 19 evidence traceability is clickable from claim to source', () => {
  const ev = buildEvidenceTraceabilityV19(dm);
  assert.ok(ev.length >= 5);
  assert.equal(ev[0].clickable, true);
  assert.ok(ev[0].trace_path.some(p => p.level === 'source'));
  assert.equal(ev[0].audio_available, true);
  assert.equal(ev[0].respondent_count, 1000);
});

test('Phase 19 true infographic has multiple publication-style pages', () => {
  const ig = buildTrueInfographicRendererV19(dm);
  assert.equal(ig.render_mode, 'publication_infographic');
  assert.ok(ig.pages.some(p => p.id === 'risk-matrix'));
  assert.ok(ig.pages.some(p => p.id === 'decision-matrix'));
  assert.ok(ig.pages.some(p => p.id === 'sdg-cards'));
});

test('Phase 19 SDG visual cards include goal number, color and icon metadata', () => {
  const sdgs = buildSDGVisualCardsV19(dm);
  assert.ok(sdgs.some(s => s.code === 'SDG 3'));
  assert.ok(sdgs.every(s => s.goal_number && s.color && s.icon && s.contribution_summary));
});

test('Phase 19 AI verification blocks Not enough data text', () => {
  const bad = structuredClone(dm);
  bad.narrative.executive_summary = 'Not enough data has been collected yet to generate this section.';
  const v = buildAIVerificationLayerV19(bad);
  assert.equal(v.export_allowed, false);
  assert.equal(v.hallucination_guard.no_not_enough_data_public_text, false);
});

test('Phase 19 enriched model is backward-compatible with Report Studio v7', () => {
  const enriched = enrichDocumentModelWithPhase19(dm);
  const studio = buildReportStudioV7(enriched);
  assert.equal(enriched.phase19.export_allowed, true);
  assert.ok(studio.phase19_trust_layer.true_infographic.pages.length >= 5);
  assert.ok(studio.intelligence_chapters.some(c => c.id === 'ai-verification'));
});

test('Phase 19 labels raw evidence only when raw source pointers exist', () => {
  const ev = buildEvidenceTraceabilityV19(dm);
  assert.equal(ev[0].evidence_type, 'raw_response_evidence');
  assert.equal(ev[0].evidence_label, 'Raw response evidence');
  assert.equal(ev[0].raw_response_evidence, true);
  assert.ok(ev[0].quote);
});

test('Phase 19 labels report-model evidence when raw pointers are absent', () => {
  const modelOnly = structuredClone(dm);
  modelOnly.findings.representative_quotes = [{ quote: 'Summarized participant feedback without a raw transcript pointer.' }];
  const ev = buildEvidenceTraceabilityV19(modelOnly);
  assert.equal(ev[0].evidence_type, 'report_model_evidence');
  assert.equal(ev[0].evidence_label, 'Report-model evidence');
  assert.equal(ev[0].raw_response_evidence, false);
  assert.equal(ev[0].quote, null);
  assert.match(ev[0].evidence_basis, /report summary\/model data/);
});

test('Phase 19 SDG cards do not claim official logo assets', () => {
  const sdgs = buildSDGVisualCardsV19(dm);
  assert.ok(sdgs.every(s => s.sdg_aligned_label && s.visual_system_note));
  assert.ok(sdgs.every(s => !Object.prototype.hasOwnProperty.call(s, 'official_style_label')));
});
