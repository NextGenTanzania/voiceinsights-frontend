// Unified Publication Runtime™ — Phase 1: Canonical Runtime Foundation.
//
// The single canonical publication object every consumer (Preview, View
// Publication, and every export adapter migrated in later phases) is meant
// to originate from. This module adds nothing new to what the publication
// says — it wraps the existing, already-governed `composePublicationSpreads`
// engine, attaches version/audit metadata, and exposes the real recommendation
// and evidence arrays directly (no re-derivation, no new fields).
//
// Deliberately synchronous (matching composePublicationSpreads's existing
// signature) so Phase 2's reroute of publication-render-engine-v2.js is a
// one-line change, not a ripple through every await-site. `build_id` is a
// simple deterministic content hash (not cryptographic) — its only job is
// "same input produces the same id," which this satisfies without forcing
// every caller to become async for a Web Crypto digest.
import {
  composePublicationSpreads,
  SPREAD_COMPOSER_VERSION,
  buildTypographyCss,
} from './publication-spread-composer.js';
import { FLAGSHIP_DECISION_REASONING_ENGINE_VERSION } from './flagship-decision-reasoning-engine.js';
import { validatePublication } from './editorial-intelligence-validator.js';
import { computePXAssessment } from './publication-quality-gate.js';
import { checkBenchmarkCharacteristics } from './publication-benchmark-engine.js';
import { buildIntelligenceChains } from './publication-intelligence-layer.js';

export const PUBLICATION_RUNTIME_VERSION = 'publication-runtime-v1';

// Simple rolling hash (not cryptographic — no need for one here) over a
// stable JSON fingerprint of the composed output, so build_id changes if
// and only if the actual composed content changes.
function contentHash(value) {
  let hash = 0;
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// composePublicationRuntime(model, { now }) -> PublicationRuntimeObject
//
// `now` is injectable purely for deterministic testing (same model, same
// now -> byte-identical runtime object including generated_at); real callers
// omit it and get the actual current time.
export function composePublicationRuntime(model = {}, { now } = {}) {
  const { metadata, spreads, html, artDirectionPlans } = composePublicationSpreads(model);
  const report = model.report || {};
  const full = model.full_publication || {};

  // Real, already-governed data — not re-derived, not sliced the way the
  // composer slices its own top-5 decision cards. This is the full set an
  // adapter (DOCX/XLSX/PPTX in later phases) needs, independent of how many
  // of them the print layout had room to feature as cards.
  const recommendations = report.recommendations || [];
  const evidenceRegister = report.evidence || [];
  const evidenceById = new Map(evidenceRegister.map(e => [e.id, e]));
  const findings = report.findings || [];
  const datasetVersion = evidenceRegister[0]?.dataset_version || full.methodology?.sampling_frame || 'unversioned';

  // Same three quality engines publication-render-engine-v2.js already runs
  // against a composed publication — computed once here so every consumer
  // (not just the V2 preview path) can see the same real assessment, rather
  // than each caller recomputing it (or, worse, skipping it).
  const editorialValidation = validatePublication(spreads, {
    recommendations,
    regionNames: (full.regional || []).map(r => r.name),
  });
  const intelligenceChains = buildIntelligenceChains(recommendations, findings, evidenceById, report.executive_book?.cost_of_inaction || null);
  const pxAssessment = computePXAssessment(spreads, editorialValidation, {
    cssText: buildTypographyCss(),
    metadata,
    intelligenceChains,
  });
  const benchmark = checkBenchmarkCharacteristics(spreads);

  const generatedAt = now || new Date().toISOString();
  const buildId = contentHash(`${SPREAD_COMPOSER_VERSION}:${PUBLICATION_RUNTIME_VERSION}:${datasetVersion}:${html.length}:${html}`);

  const sections = spreads.map(s => ({
    id: s.id,
    title: metadata.title, // per-section display title lives in each spread's own header markup; s.id is the stable machine identifier adapters should key on
    arc: s.arc,
    category: s.layers?.includes('90s') && (s.id === 'cover' || s.id === 'inside-cover') ? 'front-matter'
      : ['methodology', 'evidence-annex', 'quality-gate'].includes(s.id) ? 'appendix'
      : 'spine',
    blocks: s.blocks || [],
    html: s.html,
    text: s.text,
    estimatedWords: s.estimatedWords,
    visibleWords: s.visibleWords,
    componentCount: s.componentCount,
    components: s.components,
    layers: s.layers,
  }));

  const runtime = {
    runtime_version: PUBLICATION_RUNTIME_VERSION,
    build_id: buildId,
    generated_at: generatedAt,
    profile: model.sample?.profile || null,
    dataset_version: datasetVersion,
    reasoning_version: FLAGSHIP_DECISION_REASONING_ENGINE_VERSION,
    evidence_version: datasetVersion,
    metadata,
    cover: model.design_system?.cover || null,
    sections,
    spreads, // preserved verbatim for existing consumers (art-direction/quality-gate/benchmark tests) — same shape as composePublicationSpreads always returned
    html,
    artDirectionPlans,
    evidence_register: evidenceRegister,
    recommendations,
    quality: {
      editorial_validation: editorialValidation,
      px_assessment: pxAssessment,
      benchmark,
    },
    // Full pass-throughs so any not-yet-migrated adapter (Phase 3/4) can keep
    // reading exactly the fields it always read from `model`/`report`,
    // unchanged, while being fed `runtime` instead of `model`.
    report,
    full_publication: full,
    sample: model.sample || null,
  };

  return deepFreeze(runtime);
}
