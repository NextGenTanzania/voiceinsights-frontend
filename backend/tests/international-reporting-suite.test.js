import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildInternationalIntelligenceReportingSuiteV200, buildV200InfographicAtlas, buildV200ReportProducts, buildV200FormatNarrative } from '../src/international-intelligence-reporting-suite.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRoot = join(root, '..');
function src(path) { return readFileSync(join(root, path), 'utf8'); }
function site(path) { return readFileSync(join(projectRoot, 'site', path), 'utf8'); }

const demoHealth = {
  is_demo: true,
  metadata: { template_id: 'health_survey', template_name: 'National Health Access Intelligence Report', sector: 'health', organization_name: 'VoiceInsights Demo Organization', standards: ['SDG', 'WHO'] },
  kpis: { total_responses: 420, completed_responses: 420, response_rate_pct: 100, regions_covered: 6 },
  demographics: {
    regions: [{ label: 'Dar es Salaam', n: 84 }, { label: 'Arusha', n: 75 }, { label: 'Dodoma', n: 71 }],
    gender: [{ label: 'Male', n: 239 }, { label: 'Female', n: 181 }],
    age: [{ label: '18-25', n: 93 }, { label: '26-35', n: 87 }, { label: '36-45', n: 71 }],
  },
  findings: { sentiment: [{ label: 'negative', n: 68 }, { label: 'positive', n: 251 }], topics: [{ topic: 'facility access', n: 88 }, { topic: 'medicine availability', n: 70 }] },
  recommendations: { immediate: ['Activate a 30-day stockout and waiting-time review.'], medium_term: ['Improve referral continuity.'], long_term: ['Align financing with low-coverage regions.'] },
  narrative: { executive_summary: 'Health access is uneven and service readiness requires leadership action.' },
  data_quality: { flagged_response_count: 0, avg_fraud_score: 0.04 },
};

test('modules exist and Worker imports with reporting suite', async () => {
  for (const path of ['src/international-intelligence-reporting-suite.js', 'src/application.js', 'src/multi-format-renderer.js']) assert.ok(existsSync(join(root, path)), `${path} missing`);
  const worker = await import('../src/application.js');
  assert.equal(typeof worker.default.fetch, 'function');
});

test('v200 builds a differentiated publication suite with 10/10 report products', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(demoHealth);
  assert.equal(suite.version, 'v200.0.0');
  assert.equal(suite.sector_key, 'health');
  assert.ok(suite.benchmark_standard.some(x => /World Bank|UNDP/.test(x)));
  assert.ok(suite.report_products.executive_publication);
  assert.ok(suite.report_products.board_deck);
  assert.ok(suite.report_products.donor_publication);
  assert.ok(suite.report_products.government_memo);
  assert.ok(suite.report_products.infographic_report);
  assert.ok(suite.quality_assurance?.sdg_integrity.includes('official logo assets'));
});

test('v200 infographic atlas contains rich publication pages beyond simple cards', () => {
  const atlas = buildV200InfographicAtlas(demoHealth);
  assert.ok(atlas.length >= 15);
  const titles = atlas.map(x => x.title).join(' | ');
  for (const required of ['Executive KPI Command Center', 'Risk Heatmap', 'Decision Matrix', 'SDG Contribution Wheel', 'Board One-Page Decision Brief', 'Donor Value-for-Money']) assert.ok(titles.includes(required), `${required} missing`);
  for (const page of atlas) {
    assert.equal(page.render_mode, 'executive-publication-page');
    assert.equal(page.print_safe, true);
    assert.equal(page.mobile_safe, true);
    assert.equal(page.presentation_safe, true);
    assert.ok(page.decision_implication);
  }
});

test('v200 SDG framework uses sector-specific visual badges with evidence integrity', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(demoHealth);
  const sdg3 = suite.sdg_visual_framework.find(x => x.number === 3);
  assert.ok(sdg3);
  assert.equal(sdg3.label, 'Good Health and Well-being');
  assert.ok(/^#/.test(sdg3.color));
  assert.equal(sdg3.evidence_label, 'Synthetic demo evidence');
  assert.ok(sdg3.icon_style.includes('official UN logo asset can be mapped'));
});

test('v200 narratives and report products change by audience and sector', () => {
  const executive = buildV200FormatNarrative(demoHealth, 'executive_summary');
  const donor = buildV200FormatNarrative(demoHealth, 'donor_brief');
  const board = buildV200FormatNarrative(demoHealth, 'board_deck');
  assert.notEqual(executive, donor);
  assert.notEqual(donor, board);
  const products = buildV200ReportProducts(demoHealth);
  assert.ok(products.board_deck.slides.length >= 6);
  assert.ok(products.government_memo.page_flow.includes('Policy options'));
});

test('v200 public and internal routes are exposed safely', () => {
  const index = src('src/application.js');
  assert.ok(index.includes('/international-reporting-suite'));
  assert.ok(index.includes("is_demo = 1 AND status = 'published'"));
  assert.ok(index.includes('organization_id = ?'));
});

test('multi-format exports attach v200 suite and do not remain text-preview only', () => {
  const renderer = src('src/multi-format-renderer.js');
  assert.ok(renderer.includes('v200_international_reporting_suite'));
  assert.ok(renderer.includes('v200_infographic_atlas'));
  assert.ok(renderer.includes('v200_sdg_visual_framework'));
});

test('sample viewer renders v200 suite, responsive atlas and visual HTML downloads', () => {
  const viewer = site('sample-report-viewer.html');
  assert.ok(viewer.includes('international-reporting-suite'));
  assert.ok(viewer.includes('v200-suite-panel'));
  assert.ok(viewer.includes('Publication-grade infographic atlas'));
  assert.ok(viewer.includes('v200SdgBadges'));
  assert.ok(viewer.includes('visualHtmlFromFormat(formatName, data, v190, dm, v200Suite)'));
});

test('v200 package contains clean top-level release structure', () => {
  for (const p of ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'backend', 'site', 'docs', 'examples', 'screenshots']) assert.ok(existsSync(join(projectRoot, p)), `${p} missing`);
});
