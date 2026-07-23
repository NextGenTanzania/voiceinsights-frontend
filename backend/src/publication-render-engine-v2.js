// Publication Rendering Engine V2 — Release 2 (masterpiece publication),
// PX Release 4 adds the Publication Quality Gate wiring below.
//
// Scope: render a governed publication to real PDF bytes via Cloudflare
// Browser Rendering, using the editorial-arc Spread Composer. This module
// does not compute findings, modify evidence, or create a second
// publication model — the quality gate it now calls is deterministic,
// reads only what the composer and editorial validator already produce,
// and never invents content.
//
// Wiring remains intentionally narrow: eligible only in the preview
// environment, behind an explicit feature flag, for one approved publication
// key, PDF format only. Every other request continues through the existing
// dedicated-binary-renderer.js path untouched — see application.js's flagship
// export route for the eligibility check and fallback behaviour.
//
// PX Release 4: the Publication Quality Gate (publication-quality-gate.js)
// always computes and attaches a full PX assessment to every render — this
// is real, active infrastructure, not a stub. Whether a low score actually
// BLOCKS the render is controlled by one env flag,
// PX_PUBLICATION_GATE_ENFORCED, which defaults to unset/false — both new
// env vars are read defensively so no wrangler.toml change is required for
// this release, and enforcement can be switched on later with zero code
// changes. The gate runs before the (expensive) Puppeteer render, on the
// composed HTML alone, so a blocked publication never pays the render cost.
import puppeteer from '@cloudflare/puppeteer';
import { SPREAD_COMPOSER_VERSION } from './publication-spread-composer.js';
import { composePublicationRuntime, PUBLICATION_RUNTIME_VERSION } from './publication-runtime.js';
import { evaluateGateEnforcement } from './publication-quality-gate.js';

export const PUBLICATION_RENDER_ENGINE_V2_VERSION = 'publication-render-engine-v2.0-release2';

// Publications this renderer is allowed to touch. Phase 0 deliberately
// scoped this to a single approved key ('national-human-development') while
// the editorial-arc Spread Composer pipeline was still being built out and
// validated; that validation is now real and repeated — PX Releases 3
// through 6, the Editorial Brain, GKIS, Narrative Intelligence, VPX
// Release 1, and EIE/ESCI releases each rendered and honestly reviewed all
// 16 flagship samples (not just this one), and the catalog-wide PX Quality
// Gate/editorial-validator scoring run the same way. Product Experience
// Evolution Phase 2 (World-Class Publications) widens this allowlist to
// the full flagship catalog on that basis: every one of the 16 samples now
// gets the same premium-publication rendering path, still gated behind the
// unchanged preview-environment + explicit-flag + PDF-only conditions in
// isPublicationV2Eligible below, and still falling back safely (with
// fallback_used observability) to the existing dedicated-binary-renderer.js
// path on any failure — nothing about the eligibility gate's safety
// properties changes, only which keys pass it.
export const V2_ELIGIBLE_PUBLICATION_KEYS = Object.freeze([
  'national-human-development',
  'donor-impact-evaluation',
  'government-policy-intelligence',
  'humanitarian-needs-assessment',
  'executive-board-intelligence',
  'customer-experience-intelligence',
  'employee-experience-intelligence',
  'community-scorecard-intelligence',
  'annual-impact-report',
  'quarterly-performance-intelligence',
  'market-intelligence',
  'technical-research',
  'statistical-intelligence',
  'interactive-intelligence',
  'evidence-explorer',
  'sdg-progress-intelligence',
  'hospital-performance-intelligence',
  'maternal-child-health-intelligence',
  'disease-surveillance-intelligence',
  'nutrition-security-intelligence',
  'health-financing-uhc-intelligence',
  'education-access-intelligence',
  'climate-adaptation-intelligence',
  'social-protection-targeting-intelligence',
  'digital-government-services-intelligence',
  'wash-access-intelligence',
  'energy-access-intelligence',
  'food-security-intelligence',
  'justice-legal-services-intelligence',
  'financial-inclusion-intelligence',
  'displacement-durable-solutions-intelligence',
  'youth-skills-employability-intelligence',
  'public-financial-management-intelligence',
]);

export function browserRenderingAvailable(env) {
  return Boolean(env?.BROWSER);
}

// Eligibility gate for Part 6 controlled preview wiring: preview environment,
// flag enabled, approved publication key, PDF format only.
export function isPublicationV2Eligible(env, key, format) {
  return format === 'pdf'
    && env?.PUBLICATION_RENDERER_V2_ENABLED === 'true'
    && env?.ENVIRONMENT === 'preview'
    && V2_ELIGIBLE_PUBLICATION_KEYS.includes(key)
    && browserRenderingAvailable(env);
}

function withTimeout(promise, ms, failureCode) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const t = setTimeout(() => {
        const err = new Error(failureCode);
        err.failure_code = failureCode;
        reject(err);
      }, ms);
      t.unref?.();
    }),
  ]);
}

// Core renderer: HTML in, PDF bytes out. Enforces a timeout, closes the
// browser/page in a finally block regardless of outcome, and never throws an
// un-coded error — every failure carries a structured failure_code so callers
// can log a sanitized event without ever logging publication content.
// Layout Engine page geometry (VPDS Part 1): A4, 22/20/22/18mm margins,
// running header/footer with real page numbering via Puppeteer's own
// header/footer template mechanism — not simulated in HTML. Callers that
// don't pass these options keep the exact prior behavior (no margin object,
// no header/footer) — this is additive, not a breaking change to the
// existing renderHtmlToPdfBytes(env, html) call sites.
const VPDS_PAGE_MARGIN = Object.freeze({ top: '22mm', bottom: '20mm', left: '22mm', right: '18mm' });

function vpdsHeaderTemplate(title) {
  return `<div style="font-size:9px;width:100%;padding:0 18mm;display:flex;justify-content:space-between;color:#374151;">
    <span>${title || ''}</span><span></span></div>`;
}
function vpdsFooterTemplate(publicationId, classification) {
  return `<div style="font-size:9px;width:100%;padding:0 18mm;display:flex;justify-content:space-between;color:#374151;">
    <span>${publicationId || ''} ${classification && classification !== 'Public' ? `&middot; ${classification}` : ''}</span>
    <span class="pageNumber"></span></div>`;
}

async function renderHtmlToPdfBytesOnce(env, html, {
  timeoutMs = 20000, pageSize = 'A4', margin = null, headerTemplate = null, footerTemplate = null,
} = {}) {
  if (!browserRenderingAvailable(env)) {
    const err = new Error('BROWSER_BINDING_MISSING');
    err.failure_code = 'BROWSER_BINDING_MISSING';
    throw err;
  }
  let browser = null;
  try {
    browser = await withTimeout(puppeteer.launch(env.BROWSER), timeoutMs, 'BROWSER_LAUNCH_TIMEOUT');
    const page = await browser.newPage();
    // Direct content injection — the publication HTML never touches a public
    // URL, so there is no page for Browser Rendering to fetch and no SSRF
    // surface introduced by this call.
    await withTimeout(page.setContent(html, { waitUntil: 'networkidle0' }), timeoutMs, 'CONTENT_LOAD_TIMEOUT');
    const pdfOptions = { format: pageSize, printBackground: true, preferCSSPageSize: !margin };
    if (margin) pdfOptions.margin = margin;
    if (headerTemplate || footerTemplate) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = headerTemplate || '<span></span>';
      pdfOptions.footerTemplate = footerTemplate || '<span></span>';
    }
    const pdf = await withTimeout(page.pdf(pdfOptions), timeoutMs, 'PDF_GENERATION_TIMEOUT');
    return new Uint8Array(pdf);
  } catch (err) {
    if (!err.failure_code) err.failure_code = 'BROWSER_RENDER_FAILED';
    throw err;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* best-effort cleanup only */ }
    }
  }
}

export async function renderHtmlToPdfBytes(env, html, options = {}) {
  const maxRetries = Math.max(0, Math.min(1, options.maxRetries ?? 1));
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await renderHtmlToPdfBytesOnce(env, html, options);
    } catch (err) {
      lastErr = err;
      // BROWSER_BINDING_MISSING is a configuration fact, not a transient
      // failure — retrying it cannot succeed, so fail fast.
      if (err.failure_code === 'BROWSER_BINDING_MISSING') break;
    }
  }
  throw lastErr;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Content below is plain text, not pre-escaped HTML — print-composer.js's
// renderSection/renderList already HTML-escape every field this adapter
// supplies, so nothing here should escape twice.
//
// Part 5 safe HTML contract: a minimal adapter that maps the existing,
// already-governed flagship publication model onto the layout shape
// print-composer.js already knows how to render — no layout redesign, no new
// findings, no new evidence. Preserves the specific disclosures Phase 0 must
// not lose: synthetic-demonstration labelling, evidence classification,
// dataset version, publication ID, publication status, methodology and
// limitations, and responsible-AI governance.
export function adaptFlagshipModelToPrintLayout(model = {}) {
  const report = model.report || {};
  const full = model.full_publication || {};
  const assurance = report.publication_assurance || model.publication_assurance || {};
  const evidenceLabel = report.branding?.synthetic_notice || 'Synthetic demonstration evidence';
  const datasetVersion = report.evidence?.[0]?.dataset_version || full.methodology?.sampling_frame || 'unversioned';

  const metadata = {
    title: report.title,
    organization: 'VoiceInsights Africa',
    campaign: report.subtitle || report.sector,
    sector: report.sector,
    generated_at: report.publication_date,
    classification: report.classification,
    export_engine: PUBLICATION_RENDER_ENGINE_V2_VERSION,
  };

  const sections = [
    {
      id: 'executive-brief', type: 'executive_brief', title: 'Executive brief',
      content: {
        summary: report.executive_summary,
        key_findings: (report.findings || []).map(f => f.text).filter(Boolean),
        decisions_required: (report.recommendations || []).slice(0, 3).map(r => r.recommendation).filter(Boolean),
        confidence_score: assurance.overall ?? '—',
        evidence_label: evidenceLabel,
      },
    },
    {
      id: 'regional-intelligence', type: 'narrative', title: 'Regional and equity intelligence',
      content: {
        summary: 'Regional performance below is sourced from the single governed regional-metrics function shared by every visualization and narrative section in this publication.',
        findings: (full.regional || []).map(r => `${r.name}: ${r.primary_score}% performance, ${r.responses} responses, risk ${r.risk}`),
      },
    },
    {
      id: 'methodology', type: 'methodology', title: 'Methodology summary',
      content: {
        sample_size: full.sample_size,
        response_rate_pct: full.response_rate_pct,
        regions_covered: full.regions_covered,
        limitations: report.limitations || [],
        evidence_type: evidenceLabel,
      },
    },
    {
      id: 'publication-integrity', type: 'narrative', title: 'Publication integrity and responsible use',
      content: {
        summary: `Publication ID: ${report.branding?.publication_id || report.id || 'unassigned'} | Status: ${report.publication_readiness?.status || 'not set'} | Dataset version: ${datasetVersion}`,
        findings: [
          report.branding?.synthetic_notice,
          ...(report.limitations || []),
          report.ai_governance ? `Responsible AI: model ${report.ai_governance.model}; reviewer ${report.ai_governance.reviewer}; approval ${report.ai_governance.approval}` : null,
        ].filter(Boolean),
      },
    },
  ];

  return {
    layout_version: `${PUBLICATION_RENDER_ENGINE_V2_VERSION}-adapter`,
    metadata,
    table_of_contents: sections.map((s, i) => ({ page_hint: i + 2, id: s.id, title: s.title })),
    sections,
  };
}

// Top-level Phase 0 orchestrator: checks eligibility, adapts the model,
// renders, and always returns the full observability metadata contract
// (Part 7) — callers decide whether to fall back, this function never
// silently mislabels its own output.
export async function renderPublicationV2Preview({ model, key, format, env }) {
  const startedAt = Date.now();
  const base = {
    renderer_name: 'publication-render-engine-v2',
    renderer_version: PUBLICATION_RENDER_ENGINE_V2_VERSION,
    browser_render_attempted: false,
    browser_render_succeeded: false,
    fallback_used: false,
    duration_ms: 0,
    failure_code: null,
    checksum: null,
  };

  if (!isPublicationV2Eligible(env, key, format)) {
    return { ok: false, artifact: null, metadata: { ...base, failure_code: 'NOT_ELIGIBLE' } };
  }

  base.browser_render_attempted = true;
  try {
    // Unified Publication Runtime, Phase 2: this render path now goes through
    // the same composePublicationRuntime(model) call every other consumer
    // (View Publication, and every export adapter migrated in later phases)
    // uses — spreads/html/editorial_validation/px_assessment are computed
    // ONCE, here, in the runtime object itself, not recomputed locally. This
    // is the "Preview and View Publication provably render the same
    // publication" proof point: both now originate from one function call.
    const runtime = composePublicationRuntime(model);
    const { metadata: publicationMetadata, spreads, html } = runtime;
    const editorialValidation = runtime.quality.editorial_validation;
    const pxAssessment = runtime.quality.px_assessment;
    const gateEnforced = env?.PX_PUBLICATION_GATE_ENFORCED === 'true';
    const gateThreshold = Number(env?.PX_PUBLICATION_GATE_THRESHOLD) || 70;
    const gateResult = evaluateGateEnforcement(pxAssessment, { enforced: gateEnforced, threshold: gateThreshold });

    if (gateResult.blocked) {
      // Checked before the Puppeteer render (which is the expensive step)
      // — a blocked publication never pays that cost. The gate never fails
      // silently: the full assessment and the reason travel with the
      // failure so a caller can see exactly why.
      const durationMs = Date.now() - startedAt;
      return {
        ok: false,
        artifact: null,
        metadata: {
          ...base,
          duration_ms: durationMs,
          failure_code: 'PX_QUALITY_GATE_BLOCKED',
          px_assessment: pxAssessment,
          px_gate_result: gateResult,
        },
      };
    }

    const bytes = await renderHtmlToPdfBytes(env, html, {
      margin: VPDS_PAGE_MARGIN,
      headerTemplate: vpdsHeaderTemplate(publicationMetadata.title),
      footerTemplate: vpdsFooterTemplate(model.report?.branding?.publication_id, publicationMetadata.classification),
    });
    const checksum = await sha256Hex(bytes);
    const durationMs = Date.now() - startedAt;
    return {
      ok: true,
      artifact: {
        bytes,
        byte_length: bytes.length,
        checksum,
        content_type: 'application/pdf',
        file_extension: 'pdf',
        filename: `voiceinsights-${key}-v2-preview.pdf`,
      },
      metadata: {
        ...base,
        browser_render_succeeded: true,
        duration_ms: durationMs,
        checksum,
        spread_composer_version: SPREAD_COMPOSER_VERSION,
        runtime_version: PUBLICATION_RUNTIME_VERSION,
        build_id: runtime.build_id,
        spread_count: spreads.length,
        editorial_validation: editorialValidation,
        px_assessment: pxAssessment,
        px_gate_result: gateResult,
      },
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    // Deliberately sanitized: only a coded failure reason and timing, never
    // the publication HTML, model content, or any respondent evidence.
    return {
      ok: false,
      artifact: null,
      metadata: { ...base, duration_ms: durationMs, failure_code: err.failure_code || 'BROWSER_RENDER_FAILED' },
    };
  }
}
