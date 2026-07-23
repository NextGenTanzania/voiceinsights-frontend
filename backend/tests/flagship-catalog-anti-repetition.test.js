// Sector Intelligence Platform: one consolidated anti-repetition check,
// replacing the pattern of six separate hand-written `.size,N` assertions
// scattered across unrelated test files (flagship-launch-regressions,
// flagship-publication-intelligence, flagship-report-engine-phase1/5,
// flagship-sample-generator, flagship-editorial-brain). Uses the existing
// checkCatalogConsistency() (flagship-editorial-brain.js) — built in a past
// release but, until now, only ever exercised against 2-3 synthetic fixture
// objects, never the real, full built catalog. This is the one place that
// must be re-run (not re-written) every time the catalog grows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCatalogConsistency } from '../src/flagship-editorial-brain.js';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { resolveEditorialIdentity, identityFingerprint, familyFor } from '../src/publication-editorial-identity.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';

const built = FLAGSHIP_SAMPLE_REPORTS.map((s) => ({ key: s.key, model: buildFlagshipSampleReport(s.key) }));

const FIELDS = {
  title: (m) => m.report.title,
  first_finding_text: (m) => m.report.findings[0].text,
  first_quote: (m) => m.report.evidence[0].quote,
  strategic_outlook: (m) => m.report.executive_book.strategic_outlook,
  executive_confidence: (m) => m.report.executive_book.executive_confidence,
  budget_implications: (m) => m.report.executive_book.budget_implications,
  cost_of_inaction: (m) => m.report.executive_book.cost_of_inaction,
  cover_layout_variant: (m) => m.sample.cover.layout_variant,
  // NOT cover_composition alone: composition is a small (8-value), intentionally
  // reusable layout-template selector — like a chart type, cycling through a
  // finite set is the design, not a defect, and asserting strict 1:1
  // distinctness on it is mathematically impossible once the catalog exceeds
  // 8 samples. The genuinely meaningful anti-repetition question for a
  // reader is whether the FULL rendered cover — composition, theme and
  // accent color together — repeats, so this combined signature is checked
  // instead (see flagship-publication-design-system.test.js for the
  // composition pool's own size pin).
  cover_visual_signature: (m) => `${m.design_system.cover.composition}:${m.design_system.cover.theme.primary}:${m.sample.cover.accent}`,
  monitoring_indicator_0: (m) => m.report.recommendations[0]?.monitoring_indicator,
  critical_risks: (m) => m.report.executive_book.critical_risks,
  top_opportunities: (m) => m.report.executive_book.top_opportunities,
};

test('every checked field is genuinely distinct across the full real catalog', () => {
  const results = checkCatalogConsistency(built, FIELDS);
  for (const r of results) {
    assert.ok(r.consistent, `${r.field} collides across samples: ${JSON.stringify(r.collisions)}`);
    assert.equal(r.distinctCount, r.sampleCount, `${r.field}: expected ${r.sampleCount} distinct values, got ${r.distinctCount}`);
  }
});

// Editorial Division Release (Editorial Constitution Article V): "two
// publications should never feel like copies of each other" made literal
// and testable. Structural variation is sector-anchored (real, bounded,
// deliberately shared within a family) — this test encodes exactly that:
// every distinct family actually present in the catalog gets a fingerprint
// no other family shares (real structural diversity exists), while
// publications within the SAME family are internally consistent (sharing
// a fingerprint there is correct, not a diversity failure, since they
// genuinely serve the same kind of executive question).
test('every domain family present in the catalog has a distinct structural identity fingerprint, and publications within one family are internally consistent', () => {
  const byFamily = new Map();
  for (const { key, model } of built) {
    const domain = model.report.knowledge_routing?.domain;
    const family = familyFor(domain);
    const fingerprint = identityFingerprint(resolveEditorialIdentity(domain));
    if (!byFamily.has(family)) byFamily.set(family, { fingerprint, keys: [] });
    const entry = byFamily.get(family);
    assert.equal(fingerprint, entry.fingerprint, `${key} (family ${family}) produced a different fingerprint than other ${family} publications — same family must mean same real editorial identity`);
    entry.keys.push(key);
  }
  assert.ok(byFamily.size >= 4, `expected at least 4 distinct domain families present in the real catalog, found ${byFamily.size}`);
  const fingerprints = [...byFamily.values()].map((v) => v.fingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length, 'every distinct family must produce a fingerprint no other family shares');
});

// The literal, rendered form of the same property: real spread-ID sequence
// (not just the abstract fingerprint) must actually differ on the page for
// publications in different families, and match for publications in the
// same family — verified against composePublicationSpreads' real output,
// not merely the identity resolver's own claim about itself.
test('composed spread order actually differs by family and matches within a family, for real rendered publications', () => {
  const REPRESENTATIVE_KEYS = ['hospital-performance-intelligence', 'executive-board-intelligence', 'humanitarian-needs-assessment', 'digital-government-services-intelligence', 'maternal-child-health-intelligence'];
  const orders = new Map();
  for (const key of REPRESENTATIVE_KEYS) {
    const model = buildFlagshipSampleReport(key);
    const { spreads } = composePublicationSpreads(model);
    const family = familyFor(model.report.knowledge_routing?.domain);
    orders.set(key, { family, order: spreads.map((s) => s.id).join('|') });
  }
  // hospital-performance-intelligence and maternal-child-health-intelligence
  // are both real Health-family publications — same family, must match.
  assert.equal(orders.get('hospital-performance-intelligence').order, orders.get('maternal-child-health-intelligence').order, 'two real Health-family publications must share the same real spread order');
  // executive-board-intelligence (Corporate, decision-led) must genuinely
  // differ from humanitarian-needs-assessment (Humanitarian, evidence-led)
  // and from digital-government-services-intelligence (Governance,
  // governance-led) — three different families, three different orders.
  const distinctFamilyOrders = new Set(['executive-board-intelligence', 'humanitarian-needs-assessment', 'digital-government-services-intelligence'].map((k) => orders.get(k).order));
  assert.equal(distinctFamilyOrders.size, 3, 'publications from 3 different domain families must render 3 genuinely different real spread orders');
});

test('the catalog has grown beyond the original 16 without losing any original sample', () => {
  assert.ok(FLAGSHIP_SAMPLE_REPORTS.length > 16, 'expected new samples to have been added this release');
  const ORIGINAL_16 = ['national-human-development', 'donor-impact-evaluation', 'government-policy-intelligence', 'humanitarian-needs-assessment', 'executive-board-intelligence', 'customer-experience-intelligence', 'employee-experience-intelligence', 'community-scorecard-intelligence', 'annual-impact-report', 'quarterly-performance-intelligence', 'market-intelligence', 'technical-research', 'statistical-intelligence', 'interactive-intelligence', 'evidence-explorer', 'sdg-progress-intelligence'];
  for (const key of ORIGINAL_16) assert.ok(FLAGSHIP_SAMPLE_REPORTS.some((s) => s.key === key), `missing original sample: ${key}`);
});
