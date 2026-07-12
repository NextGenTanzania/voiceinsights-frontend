// VoiceInsights v186 Rendering Quality Validator
// Blocks corrupt/incomplete render artifacts before release.

export const V186_RENDERING_VALIDATOR_VERSION = 'v186-rendering-quality-validator';

export function validateRenderedDocument(composition = {}, artifact = composition.artifact || {}) {
  const issues = [];
  const layout = composition.layout || artifact.layout || {};
  const html = artifact.html_document || composition.html_document || '';
  const slides = artifact.slides || composition.slides || [];
  const rendererType = composition.renderer_type || artifact.production_export_type || '';

  if (!layout.metadata?.title && !artifact.label) issues.push('missing report title');
  if (!layout.sections?.length && !html && !slides.length) issues.push('missing composed sections');
  if (String(rendererType).includes('pptx') || slides.length) {
    const required = ['title', 'executive-summary', 'kpi', 'decision', 'risk', 'evidence', 'recommendations', 'appendix'];
    const ids = new Set(slides.map(s => s.id));
    for (const id of required) if (!ids.has(id)) issues.push(`missing PPTX slide: ${id}`);
  } else {
    for (const needle of ['vi-cover', 'Table of Contents', 'Methodology', 'Evidence', 'Limitations']) {
      if (!html.includes(needle)) issues.push(`missing PDF/HTML section: ${needle}`);
    }
    if (/\{\s*"|\[object Object\]|raw JSON|undefined|\bnull\b|\bNaN\b/i.test(html)) issues.push('raw/debug value detected in document HTML');
  }
  if (!composition.infographic_layout?.pages?.length && !artifact.infographic_layout?.pages?.length) issues.push('missing infographic layout');

  return {
    validator_version: V186_RENDERING_VALIDATOR_VERSION,
    valid: issues.length === 0,
    issues,
    release_allowed: issues.length === 0,
    checked_at: new Date().toISOString(),
  };
}

export function assertRenderReleaseAllowed(validation) {
  if (!validation?.release_allowed) {
    const err = new Error(`Rendered document failed quality validation: ${(validation?.issues || []).join('; ')}`);
    err.code = 'RENDER_VALIDATION_FAILED';
    throw err;
  }
  return true;
}
