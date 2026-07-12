import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildInternationalIntelligenceReportingSuiteV200 } from '../src/international-intelligence-reporting-suite.js';
import { buildPublicationVisualSystemV206B } from '../src/publication-visual-system.js';

const sample = {
  is_demo: true,
  metadata: { template_name: 'National Health Access Intelligence Report', sector: 'health', organization_name: 'VoiceInsights Demo Organization' },
  kpis: { total_responses: 420, response_rate_pct: 100, quality_score: 95 },
  findings: { top_topics: ['facility access','medicine availability','wait times'], sentiment: { positive: 227, neutral: 127, negative: 66 } },
  recommendations: [
    'Activate a 30-day stockout and waiting-time review in the three highest-need regions.',
    'Use SMS/WhatsApp follow-up to close maternal and child-health referral loops.',
    'Create region-level service improvement plans linking facility access, medicines, staffing and referral transport.'
  ],
  demographics: { gender: [{label:'Male', n:239},{label:'Female', n:181}], age: [{label:'18-25', n:93},{label:'26-35', n:87}] },
  geography: { regions: [{label:'Dar es Salaam', n:84},{label:'Arusha', n:75},{label:'Dodoma', n:71},{label:'Mbeya', n:70}] },
  standards: ['SDG','WHO-style service delivery logic']
};

test('v206B builds a publication visual system with 9.9+/10 visual, SDG and mobile ratings', () => {
  const suite = buildInternationalIntelligenceReportingSuiteV200(sample);
  const vs = suite.v206b_publication_visual_system;
  assert.equal(vs.label, 'Publication Visual System');
  assert.ok(vs.visual_quality_rating >= 9.9);
  assert.ok(vs.mobile_reader_rating >= 9.9);
  assert.ok(vs.sdg_visual_rating >= 9.9);
  assert.ok(vs.component_registry.length >= 12);
  assert.ok(vs.visual_pages.length >= 5);
  assert.equal(vs.sample_library_card.cta_label, 'Open Intelligence Report');
});

test('v206B sector visual identity changes by report sector', () => {
  const health = buildPublicationVisualSystemV206B(buildInternationalIntelligenceReportingSuiteV200(sample), sample);
  const agriSample = { ...sample, metadata: { template_name: 'Smallholder Productivity & Climate Resilience Intelligence Report', sector: 'agriculture' } };
  const agriculture = buildPublicationVisualSystemV206B(buildInternationalIntelligenceReportingSuiteV200(agriSample), agriSample);
  assert.notEqual(health.sector_visual_identity.visual_identity, agriculture.sector_visual_identity.visual_identity);
  assert.ok(agriculture.sector_visual_identity.signature_visuals.some(v => /climate|yield|value chain/i.test(v)));
});

test('sample viewer renders v206B visual system and mobile reader surfaces', () => {
  const html = fs.readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');
  assert.match(html, /renderV206BVisualSystem/);
  assert.match(html, /v206b-visual-system/);
  assert.match(html, /Mobile Intelligence Reader/);
  assert.match(html, /notepad-style text previews/);
});
