import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEvidenceTraceabilityV20 } from '../src/report-experience.js';

const indexSource = readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
const viewerSource = readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');
const enrichSource = readFileSync(new URL('../scripts/enrich-demo-reports.js', import.meta.url), 'utf8');

test('Phase 20 public experience route exists and is hard-filtered to published demo reports', () => {
  assert.ok(indexSource.includes('/api/public/demo-reports') && indexSource.includes('/experience'));
  assert.match(indexSource, /is_demo\s*=\s*1\s+AND\s+status\s*=\s*'published'/);
  assert.match(indexSource, /buildReportExperienceV20\(enriched\)/);
});

test('Phase 20 enrichment script calls an implemented public read route after authenticated enrich', () => {
  assert.match(enrichSource, /\/api\/reports\/\$\{report\.id\}\/trust\/enrich/);
  assert.match(enrichSource, /\/api\/public\/demo-reports\/\$\{report\.id\}\/experience/);
});

test('Sample report viewer visibly renders Phase 20 sections instead of leaving backend-only data', () => {
  assert.match(viewerSource, /async function loadPhase20Experience\(\)/);
  assert.match(viewerSource, /One-Page Executive Brief/);
  assert.match(viewerSource, /Procurement-Grade Infographic Pages/);
  assert.match(viewerSource, /Methodology Transparency/);
  assert.match(viewerSource, /Evidence Panel/);
  assert.match(viewerSource, /Report Assistant Actions/);
  assert.match(viewerSource, /Quality Gate Status/);
});

test('Public viewer export text is polished and avoids raw JSON formatting for text downloads', () => {
  assert.match(viewerSource, /function appendReadable/);
  assert.doesNotMatch(viewerSource, /typeof item === 'object' \? JSON\.stringify\(item\)/);
  assert.match(viewerSource, /Export preview prepared from the public demonstration report evidence package|Prepared from the public demonstration report evidence package/);
  assert.match(viewerSource, /data-format="statistical_annex" data-ext="txt"/);
});

test('Quote-only demo evidence is synthetic demo evidence, not raw-source evidence', () => {
  const dm = {
    is_demo: true,
    kpis: { total_responses: 20 },
    metadata: { template_id: 'health_survey', template_name: 'Demo' },
    narrative: { key_findings: ['Quote-only finding'] },
    findings: { representative_quotes: [{ quote: 'A quote without raw pointers.' }], topics: [] },
    demographics: { regions: [{ label: 'Demo Region', n: 20 }] },
    annexes: { questionnaire: [{ question_text: 'Demo question?' }] },
  };
  const evidence = buildEvidenceTraceabilityV20(dm);
  assert.ok(evidence.length >= 1);
  assert.equal(evidence[0].evidence_classification, 'synthetic demo evidence');
  assert.equal(evidence[0].raw_available, false);
});
