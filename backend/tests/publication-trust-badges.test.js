// Enterprise Market Validation Release, Part A.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeTrustBadges, stripInternalScoresForPublicResponse } from '../src/publication-trust-badges.js';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, buildFlagshipSampleDeck, getFlagshipSampleCatalog } from '../src/flagship-sample-library.js';
import { composePublicationRuntime } from '../src/publication-runtime.js';

const root = path.resolve('..');

test('computeTrustBadges returns 5 badges at composer-time, 6 once runtime validation is known', () => {
  const badges5 = computeTrustBadges({ editorialConsensus: { consensus: true }, assurance: { components: { evidence_traceability: 100, contradiction_free: 100, accessibility: 100, export_consistency: 100 } } });
  assert.equal(badges5.length, 5);
  const badges6 = computeTrustBadges({ editorialConsensus: { consensus: true }, assurance: { components: {} }, runtimeValidationPassed: true });
  assert.equal(badges6.length, 6);
  assert.ok(badges6.some(b => b.id === 'runtime_validation' && b.satisfied === true));
});

test('computeTrustBadges never fabricates a pass — an unmet component reads as not satisfied', () => {
  const badges = computeTrustBadges({ editorialConsensus: { consensus: false }, assurance: { components: { evidence_traceability: 10, contradiction_free: 0, accessibility: 10, export_consistency: 0 } } });
  assert.ok(badges.every(b => b.satisfied === false));
});

test('every real flagship sample satisfies its 6 composer-time trust badges (the underlying signals are genuinely real, not aspirational)', () => {
  // Editorial Division Release: computeTrustBadges auto-derives the new
  // Statistical Review badge from assurance.components.statistical_integrity
  // whenever that real component is present (every real flagship sample's
  // publication_assurance always carries it) — growing the composer-time
  // set from 5 to 6, additively, with no call-site change required.
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const badges = computeTrustBadges({ editorialConsensus: model.report.editorial_consensus, assurance: model.publication_assurance });
    assert.equal(badges.length, 6, `${sample.key} did not produce exactly 6 composer-time badges`);
    for (const b of badges) assert.equal(b.satisfied, true, `${sample.key}: badge "${b.id}" is not satisfied — the underlying signal is not actually real for this sample`);
  }
});

test('stripInternalScoresForPublicResponse removes every known raw-score path and attaches trust_badges', () => {
  const model = buildFlagshipSampleReport('hospital-performance-intelligence');
  const stripped = stripInternalScoresForPublicResponse(model);
  assert.ok(!('quality_score' in stripped.sample) && !('evidence_score' in stripped.sample) && !('decision_intelligence_score' in stripped.sample));
  assert.ok(!('quality_scores' in stripped.report) && !('publication_assurance' in stripped.report));
  assert.ok(!('overall_score' in stripped.full_publication) && !('quality_gate' in stripped.full_publication));
  assert.ok(!('report_intelligence_score' in stripped.platinum));
  assert.ok(!('quality_gate' in stripped) && !('publication_assurance' in stripped));
  assert.ok(Array.isArray(stripped.trust_badges) && stripped.trust_badges.length >= 5);
  // The original model is untouched — internal callers still need the real numbers.
  assert.ok('quality_scores' in model.report);
});

test('buildFlagshipSampleDeck\'s Publication Quality Gate slide shows badges, never a raw /100 score', () => {
  const model = buildFlagshipSampleReport('hospital-performance-intelligence');
  const deck = buildFlagshipSampleDeck(model);
  const qualitySlide = deck.find(s => s.id === 'quality');
  assert.ok(qualitySlide);
  for (const m of qualitySlide.metrics) {
    assert.doesNotMatch(String(m.value), /\/100/);
    assert.match(String(m.value), /^(Passed|Pending)$/);
  }
});

test('the public catalog exposes trust_badges, never a raw internal score', () => {
  const catalog = getFlagshipSampleCatalog();
  for (const r of catalog.reports) {
    assert.ok(!('quality_score' in r) && !('evidence_score' in r) && !('decision_intelligence_score' in r));
    assert.ok(Array.isArray(r.trust_badges) && r.trust_badges.length >= 5);
  }
});

test('no composed publication runtime HTML anywhere in the catalog contains a raw XX/100 Quality Gate score', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const runtime = composePublicationRuntime(model);
    assert.doesNotMatch(runtime.html, /Overall readiness:.*?\d{1,3}\/100/, `${sample.key}: runtime HTML still renders a raw readiness score`);
    assert.doesNotMatch(runtime.html, /Evidence traceability:\s*\d+\/100/, `${sample.key}: runtime HTML still renders a raw component score`);
  }
});

test('no static PDF export anywhere in the manifest contains a raw XX/100 Quality Gate score', () => {
  const exportsDir = path.join(root, 'site/sample-exports');
  const manifest = JSON.parse(fs.readFileSync(path.join(exportsDir, 'manifest.json'), 'utf8'));
  const pdfArtifacts = manifest.artifacts.filter(a => a.format === 'pdf');
  assert.ok(pdfArtifacts.length > 0);
  for (const a of pdfArtifacts) {
    const text = fs.readFileSync(path.join(root, 'site', a.path.replace(/^\//, ''))).toString('latin1');
    assert.doesNotMatch(text, /Overall readiness:.*?\d{1,3}\/100/, `${a.path} still renders a raw readiness score`);
    assert.doesNotMatch(text, /Evidence traceability:\s*\d+\/100/, `${a.path} still renders a raw component score`);
  }
});
