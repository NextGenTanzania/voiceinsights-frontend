// Enterprise Report Studio — Customer Report Generation UI Pilot.
// Pure functions only (no `document`/`fetch` here) so they can be unit
// tested under Node without a browser — the DOM wiring that calls these
// lives inline in enterprise-reports-studio.html.
(function (root) {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Part 4: builds the exact request body sent to POST /api/reports/generate.
  function buildGenerateRequestPayload({ templateId, scopeType, campaignId }) {
    if (!templateId) throw new Error('templateId is required');
    if (scopeType === 'CAMPAIGN' && !campaignId) throw new Error('campaignId is required when scopeType is CAMPAIGN');
    const body = { template_id: templateId };
    if (scopeType === 'CAMPAIGN' && campaignId) body.campaign_id = campaignId;
    return body;
  }

  // Part 6: classifies a fetch response into exactly one UI state, reading
  // ONLY the canonical publication_evaluation object when present — never
  // recomputing readiness from the numeric score, never trusting legacy
  // fields over the canonical object.
  function classifyResult({ httpStatus, body }) {
    body = body || {};
    if (httpStatus === 409) {
      return { state: 'invalidated', message: body.error || 'This report could not be evaluated due to a data integrity issue. The event has been recorded.' };
    }
    if (httpStatus === 404) {
      return { state: 'scope_not_found', message: body.error || 'Report scope was not found or is not available.' };
    }
    if (httpStatus === 403) {
      return { state: 'permission_denied', message: body.error || 'You do not have permission to generate reports.' };
    }
    if (httpStatus < 200 || httpStatus >= 300 || !body.ok) {
      return { state: 'generation_failed', message: body.error || 'Report generation failed. Please try again.' };
    }
    // ok:true beyond this point — a draft was generated.
    if (body.publication_evaluation_warning) {
      return { state: 'persistence_warning', body, warningMessage: body.publication_evaluation_warning };
    }
    const pe = body.publication_evaluation;
    if (!pe) {
      // Feature flag disabled, or an older backend without the pilot —
      // preserve prior behavior: generated, not publication-ready, no score.
      return { state: 'generated_no_canonical', body };
    }
    if (pe.score_state === 'NOT_EVALUATED') return { state: 'not_evaluated', body };
    if (pe.score_state === 'PROVISIONAL') return { state: 'provisional', body };
    if (pe.publication_status === 'BLOCKED') return { state: 'blocked_draft', body };
    return { state: 'valid', body };
  }

  // Part 5/7: one HTML fragment per state. Score is displayed ONLY for
  // 'valid' and 'provisional' (and only when overall_score is a number) —
  // every other state is contractually forbidden from showing a number.
  function renderResultHtml(classification) {
    const { state } = classification;
    const commonMeta = (pe) => `<p class="gr-meta">Report ID: <code>${escapeHtml(classification.body?.report_id)}</code> &middot; Scope: ${escapeHtml(pe?.scope_type || classification.body?.document_model?.metadata?.scope_type)} &middot; Dataset version: <code>${escapeHtml((pe?.dataset_version || '').slice(0, 12))}&hellip;</code></p>`;
    const blockingList = (pe) => (pe?.blocking_failures?.length ? `<div class="gr-issues"><strong>Blocking issues:</strong><ul>${pe.blocking_failures.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul></div>` : '');
    const warningList = (pe) => (pe?.warnings?.length ? `<div class="gr-warnings"><strong>Warnings:</strong><ul>${pe.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : '');

    switch (state) {
      case 'valid': {
        const pe = classification.body.publication_evaluation;
        const hasScore = typeof pe.overall_score === 'number';
        return `<div class="gr-result gr-result--valid" role="status"><h3>Report generated</h3>${commonMeta(pe)}<p>Publication status: <strong>${escapeHtml(pe.publication_status)}</strong></p>${hasScore ? `<p class="gr-score">Score: ${escapeHtml(pe.overall_score)}/100</p>` : ''}${blockingList(pe)}${warningList(pe)}</div>`;
      }
      case 'provisional': {
        const pe = classification.body.publication_evaluation;
        const hasScore = typeof pe.overall_score === 'number';
        return `<div class="gr-result gr-result--provisional" role="status"><h3>Report generated</h3>${commonMeta(pe)}<p class="gr-provisional-label">Provisional quality assessment. Additional evidence, review or approval is required before final publication.</p>${hasScore ? `<p class="gr-score">Provisional score: ${escapeHtml(pe.overall_score)}/100</p>` : ''}${blockingList(pe)}${warningList(pe)}</div>`;
      }
      case 'not_evaluated': {
        const pe = classification.body.publication_evaluation;
        return `<div class="gr-result gr-result--not-evaluated" role="status"><h3>Report draft generated</h3>${commonMeta(pe)}<p>Report draft generated, but there is not enough eligible data to calculate a reliable publication-quality score.</p>${blockingList(pe)}</div>`;
      }
      case 'blocked_draft': {
        const pe = classification.body.publication_evaluation;
        const hasScore = typeof pe.overall_score === 'number';
        return `<div class="gr-result gr-result--blocked" role="status"><h3>Report draft generated — publication blocked</h3>${commonMeta(pe)}<p>The draft was generated successfully, but it is not eligible for publication yet.</p>${hasScore ? `<p class="gr-score">Score: ${escapeHtml(pe.overall_score)}/100</p>` : ''}${blockingList(pe)}${warningList(pe)}</div>`;
      }
      case 'generated_no_canonical': {
        return `<div class="gr-result gr-result--generated" role="status"><h3>Report generated</h3><p class="gr-meta">Report ID: <code>${escapeHtml(classification.body.report_id)}</code></p><p>This report has been generated. Publication-quality evaluation is not enabled for this workspace.</p></div>`;
      }
      case 'persistence_warning': {
        const pe = classification.body.publication_evaluation;
        return `<div class="gr-result gr-result--warning" role="status"><h3>Report generated</h3>${commonMeta(pe)}<p class="gr-warning-banner">Your report draft was generated, but its quality evaluation could not be saved. Do not treat this draft as approved for publication.</p></div>`;
      }
      case 'invalidated':
        return `<div class="gr-result gr-result--invalidated" role="alert"><h3>Quality assessment unavailable</h3><p>Quality assessment unavailable because an integrity or security issue was detected.</p></div>`;
      case 'scope_not_found':
        return `<div class="gr-result gr-result--error" role="alert"><h3>Report scope unavailable</h3><p>${escapeHtml(classification.message)}</p></div>`;
      case 'permission_denied':
        return `<div class="gr-result gr-result--error" role="alert"><h3>Permission required</h3><p>${escapeHtml(classification.message)}</p></div>`;
      case 'generation_failed':
      default:
        return `<div class="gr-result gr-result--error" role="alert"><h3>Report generation failed</h3><p>${escapeHtml(classification.message || 'Please try again.')}</p></div>`;
    }
  }

  const api = { escapeHtml, buildGenerateRequestPayload, classifyResult, renderResultHtml };
  root.ReportGenerationStudio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
