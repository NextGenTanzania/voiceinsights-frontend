// Publication Benchmark Engine — Publication Experience (PX) Release 4,
// permanent architectural layer 3 of 6 (see the PX Release 4 plan).
//
// A codified checklist of structural/editorial characteristics common to
// real international flagship publications (an executive summary early,
// a methodology section, a risk framework, a monitoring framework, a
// decision/recommendation framework, an evidence register, multiple
// reading depths). This deliberately does NOT scrape, fetch, or compare
// against actual McKinsey/World Bank/OECD/etc. documents — that would be
// both copyright-risky and something this codebase has no access to.
// "Benchmark" here means a rubric of characteristics, checked against the
// real composed spreads, not a document comparison. Deterministic: the
// same spread list always produces the same checklist result.
import { assessSpreadDensity } from './publication-director.js';
import { SPINE_SPREAD_ORDER } from './flagship-narrative-arc.js';

export const PUBLICATION_BENCHMARK_ENGINE_VERSION = 'publication-benchmark-engine-v1';

const CHARACTERISTICS = [
  {
    key: 'executive_summary_early',
    label: 'Executive summary appears within the first 3 spreads',
    check: spreads => spreads.slice(0, 3).some(s => (s.components || []).some(c => c.type === 'executive_brief')),
  },
  {
    key: 'methodology_section_present',
    label: 'A methodology section is present',
    check: spreads => spreads.some(s => s.id === 'methodology'),
  },
  {
    key: 'risk_framework_present',
    label: 'A risk framework is present',
    check: spreads => spreads.some(s => s.id === 'risks'),
  },
  {
    key: 'monitoring_framework_present',
    label: 'A monitoring/accountability framework is present',
    check: spreads => spreads.some(s => s.id === 'monitoring'),
  },
  {
    key: 'decision_framework_present',
    label: 'A decision/recommendation framework is present',
    check: spreads => spreads.some(s => s.id.startsWith('decisions-')),
  },
  {
    key: 'evidence_register_present',
    label: 'A full evidence register is present',
    check: spreads => spreads.some(s => s.id === 'evidence-annex'),
  },
  {
    key: 'closing_perspective_present',
    label: 'A closing/outlook perspective is present',
    check: spreads => spreads.some(s => s.id === 'closing'),
  },
  {
    key: 'multiple_reading_depths',
    label: 'The publication supports more than one reading depth (executive scan vs. full read)',
    check: spreads => {
      const layerSets = new Set(spreads.flatMap(s => s.layers || []));
      return layerSets.size >= 2;
    },
  },
  {
    key: 'whitespace_within_bounds',
    label: 'Most spreads are neither underfilled nor overfilled',
    // EAD Release 1: uses assessSpreadDensity (real visibleWords + a
    // per-spread-type ceiling) rather than the bare estimatedWords-only
    // call — two independent reviews confirmed this check failed on every
    // one of the 16 real samples under the old signal, for pages that
    // genuinely were not overfilled once measured against what a reader
    // actually sees.
    check: spreads => {
      const densities = spreads.map(s => assessSpreadDensity(s).density);
      const balanced = densities.filter(d => d === 'balanced').length;
      return spreads.length > 0 && balanced / spreads.length >= 0.6;
    },
  },
  {
    // PX Release 5.1, Part 9: every spine spread (flagship-narrative-arc.js)
    // carries a real arc bridge — a rubric characteristic, not a document
    // comparison, same as every other check in this file.
    key: 'arc_continuity_present',
    label: 'Every spine spread carries a real narrative-arc transition and takeaway',
    check: spreads => {
      const spineSpreads = spreads.filter(s => SPINE_SPREAD_ORDER.includes(s.id));
      return spineSpreads.length > 0 && spineSpreads.every(s => (s.html || '').includes('arc-takeaway'));
    },
  },
  {
    key: 'transitions_non_repetitive',
    label: 'No transition phrase is reused within the same publication',
    check: spreads => {
      const transitions = spreads.flatMap(s => [...(s.html || '').matchAll(/<p class="arc-transition">(.*?)<\/p>/g)].map(m => m[1]));
      return transitions.length > 0 && new Set(transitions).size === transitions.length;
    },
  },
];

// Runs every characteristic against the real composed spreads. Never
// throws on a missing/odd spread shape — a characteristic simply reads as
// not-present rather than crashing the whole checklist.
export function checkBenchmarkCharacteristics(spreads = []) {
  const results = CHARACTERISTICS.map(({ key, label, check }) => {
    let present = false;
    try { present = Boolean(check(spreads)); } catch { present = false; }
    return { key, label, present };
  });
  const presentCount = results.filter(r => r.present).length;
  return {
    engine_version: PUBLICATION_BENCHMARK_ENGINE_VERSION,
    characteristics: results,
    present_count: presentCount,
    total_count: results.length,
    score: results.length ? Math.round((presentCount / results.length) * 100) : 0,
  };
}
