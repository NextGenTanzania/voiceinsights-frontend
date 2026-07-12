// Run with: node --test tests/sector-intelligence-library.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSectorLibrary,
  buildSectorIntelligence,
  buildSectorKpiInterpretations,
  adaptRecommendationLanguage,
} from '../src/sector-intelligence-library.js';

function baseModel(template_id = 'health_survey') {
  return {
    metadata: {
      template_id,
      template_name: 'Health Survey Report',
      sector: 'health',
      standards: ['SDG', 'WHO'],
    },
    kpis: { total_responses: 420, response_rate_pct: 96, regions_covered: 5 },
    demographics: {
      gender: [{ label: 'Female', n: 220 }, { label: 'Male', n: 200 }],
      age: [{ label: '18-25', n: 100 }],
      regions: [{ label: 'Dar es Salaam', n: 120 }],
    },
    findings: {
      sentiment: [{ label: 'positive', n: 280 }, { label: 'negative', n: 60 }],
      topics: [{ topic: 'facility access', count: 18 }],
    },
    recommendations: {
      immediate: ['Improve patient triage at high-volume facilities.'],
      medium_term: ['Strengthen medicine availability monitoring.'],
      long_term: ['Align facility planning with district-level service demand.'],
    },
    data_quality: { flagged_response_count: 0 },
    quality: { overall_quality_score: 94 },
  };
}

test('loads the correct sector library by report template', () => {
  assert.equal(getSectorLibrary(baseModel('health_survey')).id, 'health_intelligence');
  assert.equal(getSectorLibrary(baseModel('education_assessment')).id, 'education_intelligence');
  assert.equal(getSectorLibrary(baseModel('agriculture_survey')).id, 'agriculture_intelligence');
  assert.equal(getSectorLibrary(baseModel('humanitarian_needs')).id, 'humanitarian_intelligence');
});

test('produces sector-aware KPI interpretations without changing numeric values', () => {
  const model = baseModel('health_survey');
  const interpretations = buildSectorKpiInterpretations(model);
  assert.equal(interpretations.find(x => x.metric === 'response_rate_pct').value, 96);
  assert.equal(interpretations.find(x => x.metric === 'quality_score').value, 94);
  assert.match(interpretations.find(x => x.metric === 'response_rate_pct').interpretation, /population health surveys|representativeness/i);
});

test('does not fabricate standards; only declared applicable standards are returned', () => {
  const model = baseModel('agriculture_survey');
  model.metadata.sector = 'agriculture';
  model.metadata.standards = ['SDG'];
  const intelligence = buildSectorIntelligence(model);
  assert.deepEqual(intelligence.applicable_standards, ['SDG']);
  assert.ok(!intelligence.applicable_standards.includes('FAO'));
});

test('adapts existing recommendations for audiences without inventing new actions', () => {
  const model = baseModel('health_survey');
  const donor = adaptRecommendationLanguage(model, 'donor');
  assert.equal(donor.length, 3);
  assert.equal(donor[0].original_recommendation, model.recommendations.immediate[0]);
  assert.match(donor[0].evidence_rule, /does not create a new recommendation/i);
});
