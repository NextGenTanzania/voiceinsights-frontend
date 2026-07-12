import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVRDSShowcaseExperience, buildVRDSShowcaseCard, buildVRDSShowcaseInfographicPages, getVRDSSampleStory } from '../src/vrds-showcase-experience.js';

const demoModel = {
  id: 'report_demo_vrds',
  is_demo: true,
  demo_country: 'Tanzania',
  metadata: { template_id: 'sdg_progress', template_name: 'SDG Progress Report', organization_name: 'VoiceInsights Demo Organization', generated_at: '2026-01-01T00:00:00Z', standards: ['SDG'] },
  kpis: { total_responses: 1000, response_rate_pct: 96, regions_covered: 6 },
  demographics: { regions: [{ label: 'Dar es Salaam', n: 230 }, { label: 'Mwanza', n: 170 }], gender: [{ label: 'Female', n: 520 }, { label: 'Male', n: 480 }], age: [{ label: '18-25', n: 220 }] },
  findings: { sentiment: [{ label: 'positive', n: 640 }, { label: 'negative', n: 120 }], topics: [{ topic: 'service access', count: 40 }], representative_quotes: [{ raw_text: 'Services improved but some areas still need support.' }] },
  narrative: { executive_summary: 'Progress is visible while climate resilience and income security remain priority gaps.', key_findings: ['Climate resilience is the highest priority signal.', 'Income security remains a secondary concern.', 'Dar es Salaam has the largest evidence base.', 'Female participation is balanced.', 'Positive sentiment is a useful foundation.'], risks: ['Climate resilience gaps may reduce progress.'], opportunities: ['Use SDG scorecards to focus planning.'], conclusions: 'Leadership should focus on weakest SDG indicators.' },
  recommendations: { immediate: ['Prioritise weakest SDG indicators in the next planning cycle.'], medium_term: ['Build an integrated SDG dashboard.'], long_term: ['Align local SDG monitoring with national planning.'] },
  data_quality: { score: 94, avg_fraud_score: 0.03, flagged_response_count: 0 },
  annexes: { questionnaire: [{ variable_id: 'Q1', question_text: 'How would you describe progress?', question_type: 'open_voice' }] },
  report_quality_gate_v19: { overall_score: 94, status: 'passed', dimensions: [{ key: 'citation_coverage', score: 90 }] },
};

test('VRDS showcase experience builds visible report sections for public samples', () => {
  const exp = buildVRDSShowcaseExperience(demoModel);
  assert.equal(exp.version, '1.0.0-showcase-phase-c');
  assert.ok(exp.premium_cover.report_title.includes('SDG') || exp.premium_cover.report_title.includes('Progress'));
  assert.ok(exp.executive_brief.five_key_findings.length >= 5);
  assert.ok(exp.decision_dashboard);
  assert.ok(exp.risk_dashboard);
  assert.ok(exp.evidence_dashboard);
  assert.ok(exp.methodology.sample_size >= 1000);
  assert.ok(exp.infographic_pages.pages.length >= 8);
  assert.ok(exp.export_manifest.length >= 6);
});

test('VRDS showcase card exposes premium sample library fields', () => {
  const card = buildVRDSShowcaseCard(demoModel);
  assert.ok(card.sector_badge);
  assert.ok(card.audience_badges.length >= 1);
  assert.ok(card.standards_badges.length >= 1);
  assert.ok(card.format_badges.includes('Executive Report'));
  assert.ok(card.preview_thumbnail.kpi_strip.length >= 4);
  assert.ok(card.actions.some(a => a.label === 'View Board Deck'));
});

test('VRDS sample stories are sector-specific for all 16 samples', () => {
  const templates = ['health_survey','education_assessment','agriculture_survey','livelihood_assessment','humanitarian_needs','baseline_study','endline_evaluation','market_research','customer_satisfaction','employee_engagement','citizen_feedback','community_scorecard','monitoring_report','quarterly_performance','annual_impact','sdg_progress'];
  for (const t of templates) {
    const story = getVRDSSampleStory(t);
    assert.ok(story.sector, t);
    assert.ok(story.storyline, t);
    assert.ok(story.hero_visual, t);
  }
});

test('VRDS showcase evidence avoids misleading raw-source claims for quote-only demo evidence', () => {
  const exp = buildVRDSShowcaseExperience(demoModel);
  const labels = exp.evidence_traceability.map(e => String(e.evidence_classification || e.evidence_label).toLowerCase());
  assert.ok(labels.some(l => l.includes('synthetic') || l.includes('report-model')));
  assert.equal(exp.public_safety.raw_evidence_rule.includes('only claimed'), true);
});

test('VRDS infographic set includes board, risk, decision, methodology-facing pages', () => {
  const set = buildVRDSShowcaseInfographicPages(demoModel);
  const ids = set.pages.map(p => p.id);
  assert.ok(ids.includes('one-page-executive-brief'));
  assert.ok(ids.includes('risk-matrix-page'));
  assert.ok(ids.includes('decision-matrix-page'));
  assert.ok(ids.includes('evidence-dashboard-page'));
});
