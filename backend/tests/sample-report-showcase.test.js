import test from 'node:test';
import assert from 'node:assert/strict';
import { listSampleReportShowcaseV20, getSampleReportShowcaseV20, attachSampleReportShowcaseV20 } from '../src/sample-report-showcase.js';

test('Sample Report Showcase v20 defines exactly 16 international sample products', () => {
  const items = listSampleReportShowcaseV20();
  assert.equal(items.length, 16);
  assert.equal(new Set(items.map(i => i.template_id)).size, 16);
  for (const item of items) {
    assert.ok(item.product_name.includes('Report'));
    assert.ok(item.flagship_use_case.length > 40);
    assert.ok(item.executive_question.endsWith('?'));
    assert.ok(item.audiences.length >= 3);
    assert.ok(item.formats.length >= 4);
    assert.ok(item.sample_sections.length >= 5);
    assert.ok(item.visual_package.length >= 3);
    assert.ok(item.decision_outputs.length >= 2);
    assert.ok(item.premium_score >= 94);
  }
});

test('Sample Report Showcase v20 attaches metadata without changing core document fields', () => {
  const dm = {
    metadata: { template_id: 'health_survey', template_name: 'Health Survey Report' },
    kpis: { total_responses: 1000 },
    is_demo: true,
  };
  const out = attachSampleReportShowcaseV20(dm);
  assert.equal(out.metadata.template_name, 'Health Survey Report');
  assert.equal(out.kpis.total_responses, 1000);
  assert.equal(out.sample_showcase_v20.template_id, 'health_survey');
  assert.equal(out.sample_showcase_v20.standard_label, 'International sample report standard');
  assert.match(out.sample_showcase_v20.evidence_disclosure, /Demonstration data only/);
});

test('Sample Report Showcase lookup returns null for unknown templates', () => {
  assert.equal(getSampleReportShowcaseV20('unknown_template'), null);
});
