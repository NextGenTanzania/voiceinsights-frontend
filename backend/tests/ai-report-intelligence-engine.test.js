import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSectorWritingBrain, buildSectorSentencePack } from '../src/sector-writing-brain.js';
import { buildInternationalAIReportIntelligenceV190, buildV190FormatNarrative } from '../src/international-ai-report-intelligence-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteRoot = join(root, '..', 'site');

function dm(template_id, template_name, sector = 'Agriculture & Climate') {
  return {
    is_demo: true,
    metadata: { template_id, template_name, sector, organization_name: 'VoiceInsights Demo', campaign_name: 'Demo Campaign', standards: ['SDG', 'OECD-DAC'] },
    kpis: { total_responses: 350, completed_responses: 330, response_rate_pct: 94, regions_covered: 5 },
    demographics: { regions: [{ label: 'Arusha', n: 120 }, { label: 'Morogoro', n: 95 }], gender: [{ label: 'Female', n: 180 }, { label: 'Male', n: 170 }], age: [{ label: '18-24', n: 80 }] },
    findings: { topics: [{ topic: 'input access', count: 90 }, { topic: 'extension services', count: 70 }], sentiment: [{ label: 'positive', n: 210 }, { label: 'negative', n: 45 }], representative_quotes: [] },
    data_quality: { flagged_response_count: 4, avg_transcription_confidence: 0.92 },
    recommendations: { immediate: ['Target extension support to low-yield clusters'], medium_term: ['Improve input access pathways'], long_term: ['Prioritise climate-smart agriculture actions'] },
  };
}

test('modules exist and Worker imports with the AI report intelligence engine', async () => {
  for (const file of ['src/sector-writing-brain.js', 'src/international-ai-report-intelligence-engine.js']) {
    assert.ok(existsSync(join(root, file)), `${file} missing`);
  }
  const worker = await import('../src/application.js');
  assert.ok(worker.default?.fetch);
});

test('sector writing brain uses specialized language for agriculture, education, health and humanitarian samples', () => {
  const agriculture = buildSectorWritingBrain(dm('agriculture_climate', 'Smallholder Productivity & Climate Resilience Intelligence Report'));
  assert.ok(agriculture.required_lexicon.includes('smallholder productivity'));
  assert.ok(agriculture.required_lexicon.includes('climate-smart agriculture'));

  const education = buildSectorWritingBrain(dm('education_quality', 'Primary Education Quality Intelligence Report', 'Education'));
  assert.ok(education.required_lexicon.includes('learning outcomes'));
  assert.ok(education.required_lexicon.includes('teacher availability'));

  const health = buildSectorWritingBrain(dm('health_systems', 'National Health Access Intelligence Report', 'Health'));
  assert.ok(health.required_lexicon.includes('service readiness'));
  assert.ok(health.required_lexicon.includes('referral system'));

  const humanitarian = buildSectorWritingBrain(dm('humanitarian_needs', 'Multi-Sector Humanitarian Needs Intelligence Report', 'Humanitarian Response'));
  assert.ok(humanitarian.required_lexicon.includes('protection risk'));
  assert.ok(humanitarian.required_lexicon.includes('accountability to affected populations'));
});

test('engine builds consultant-grade audience outputs without claiming raw evidence for demo reports', () => {
  const pkg = buildInternationalAIReportIntelligenceV190(dm('agriculture_climate', 'Smallholder Productivity & Climate Resilience Intelligence Report'));
  assert.equal(pkg.engine_label, 'International AI Report Intelligence Engine');
  assert.equal(pkg.quality_gate_support.report_generation_ready, true);
  assert.match(pkg.consultant_narrative.executive_interpretation, /smallholder|Agriculture|productivity|climate/i);
  assert.match(pkg.donor_logic.value_for_money, /value-for-money|value for money|resources/i);
  assert.match(pkg.government_logic.policy_problem, /implementation|policy|risk|equity/i);
  assert.ok(pkg.board_logic.three_decisions_required.length <= 3);
  assert.equal(pkg.quality_gate_support.evidence_type, 'Synthetic demo evidence');
});

test('v190 format narratives are audience-specific and sector-aware', () => {
  const model = dm('customer_satisfaction', 'Banking & Mobile Financial Services Satisfaction Intelligence Report', 'Customer Experience');
  assert.match(buildV190FormatNarrative(model, 'donor'), /outcome|value|funding|development/i);
  assert.match(buildV190FormatNarrative(model, 'government'), /policy|public-sector|regional|decision/i);
  assert.match(buildV190FormatNarrative(model, 'board'), /Board|decision|risk|leadership/i);
});

test('public routes expose v190 demo and internal report intelligence safely', () => {
  const index = readFileSync(join(root, 'src/application.js'), 'utf8');
  assert.match(index, /ai-report-intelligence/);
  assert.match(index, /is_demo = 1 AND status = 'published'/);
  assert.match(index, /organization_id = \?/);
});

test('sample viewer renders the v190 intelligence layer on desktop, tablet and mobile surfaces', () => {
  const viewer = readFileSync(join(siteRoot, 'sample-report-viewer.html'), 'utf8');
  assert.match(viewer, /loadV190Intelligence/);
  assert.match(viewer, /AI Report Intelligence Engine/);
  assert.match(viewer, /Audience-Specific Intelligence/);
  assert.match(viewer, /Consultant Findings & Ranked Recommendations/);
  const css = readFileSync(join(siteRoot, 'assets/css/vrds-showcase.css'), 'utf8');
  assert.match(css, /v190-panel/);
  assert.match(css, /max-width:\s*900px/);
  assert.match(css, /max-width:\s*1180px/);
});

