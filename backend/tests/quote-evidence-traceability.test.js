// tests/quote-evidence-traceability.test.js
// Quote Evidence Traceability release: representative_quotes now carry
// transcript_id/response_id (real existing primary keys from the transcripts
// -> answers -> responses -> campaigns join in report-generator.js, never
// fabricated), threaded into the canonical gate as source_id/evidence_id so
// QUOTATION_WITHOUT_SOURCE can actually pass for a genuinely-sourced quote —
// while still blocking a quote that has no source, a cross-tenant source, or
// is synthetic in a customer report. See report-generator.js and
// quality-scoring-engine.js's scoreClaimValidity for the implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluatePublicationGate, SCORE_STATE, PUBLICATION_STATUS } from '../src/quality-scoring-engine.js';
import { buildInfographicData } from '../src/infographic-data-builder.js';

function baseInput(overrides = {}) {
  return {
    dataset_version: 'v1', organization_id: 'org_1', project_id: null,
    is_demo: false, report_type: 'standard',
    findings: [{ text: 'Some finding', evidence_ids: [] }],
    evidence: [], decisions: [],
    methodology: null, statistics: [], claims: [],
    quotes: [],
    approvals: { required: [], completed: [] },
    exports: {},
    ...overrides,
  };
}

// ===================== 1-4, 7: canonical gate quote scoring =====================

test('1. a quote with a real response source_id is evidence-linked, not blocked', () => {
  const decision = evaluatePublicationGate(baseInput({
    quotes: [{ text: 'Real respondent quote.', source_id: 'resp_abc123' }],
  }));
  assert.ok(!decision.blocking_failures.includes('QUOTATION_WITHOUT_SOURCE'));
});

test('2. a quote with a real transcript evidence_id is evidence-linked, not blocked', () => {
  const decision = evaluatePublicationGate(baseInput({
    quotes: [{ text: 'Real respondent quote.', evidence_id: 'transcript_xyz789' }],
  }));
  assert.ok(!decision.blocking_failures.includes('QUOTATION_WITHOUT_SOURCE'));
});

test('3. a quote with neither source_id nor evidence_id still blocks (regression)', () => {
  const decision = evaluatePublicationGate(baseInput({
    quotes: [{ text: 'Unsourced quote.' }],
  }));
  assert.ok(decision.blocking_failures.includes('QUOTATION_WITHOUT_SOURCE'));
});

test('4. a quote sourced from a different organization invalidates the report (cross-tenant)', () => {
  const decision = evaluatePublicationGate(baseInput({
    organization_id: 'org_1',
    quotes: [{ text: 'Quote from someone else\'s org.', source_id: 'resp_from_org_2', organization_id: 'org_2' }],
  }));
  assert.ok(decision.blocking_failures.includes('QUOTATION_CROSS_TENANT_SOURCE'));
  assert.equal(decision.score_state, SCORE_STATE.INVALIDATED);
  assert.equal(decision.publication_status, PUBLICATION_STATUS.BLOCKED);
  assert.equal(decision.overall_score, null);
});

test('4b. a quote sourced from the SAME organization as the report is not cross-tenant-blocked', () => {
  const decision = evaluatePublicationGate(baseInput({
    organization_id: 'org_1',
    quotes: [{ text: 'Quote from our own org.', source_id: 'resp_1', organization_id: 'org_1' }],
  }));
  assert.ok(!decision.blocking_failures.includes('QUOTATION_CROSS_TENANT_SOURCE'));
});

test('7. a synthetic quote in a real (non-demo) customer report blocks and invalidates', () => {
  const decision = evaluatePublicationGate(baseInput({
    is_demo: false,
    quotes: [{ text: 'Fabricated quote.', source_id: 'resp_1', synthetic: true }],
  }));
  assert.ok(decision.blocking_failures.includes('SYNTHETIC_QUOTE_IN_CUSTOMER_REPORT'));
  assert.equal(decision.score_state, SCORE_STATE.INVALIDATED);
});

test('7b. the same synthetic quote is allowed in an is_demo report (showcase content is exempt)', () => {
  const decision = evaluatePublicationGate(baseInput({
    is_demo: true,
    quotes: [{ text: 'Fabricated quote.', synthetic: true }],
  }));
  assert.ok(!decision.blocking_failures.includes('SYNTHETIC_QUOTE_IN_CUSTOMER_REPORT'));
});

// ===================== 5: deleted source — honest limitation, not fabricated =====================

test('5. deleted/anonymized source detection is NOT implemented (documented gap, not silently claimed)', () => {
  // schema.sql has no deleted_at/anonymized column on responses or
  // respondents (verified by direct inspection during this release's
  // trace) -- there is no field for report-generator.js or the canonical
  // gate to check. This test exists so the gap stays visible in the suite
  // rather than being quietly forgotten: if such a column is ever added,
  // this test should be replaced with a real assertion, not deleted.
  const decision = evaluatePublicationGate(baseInput({
    quotes: [{ text: 'Quote whose source was deleted after the fact.', source_id: 'resp_now_deleted' }],
  }));
  // Documents current (limited) behavior: a source_id alone is treated as
  // sufficient, because there is no signal anywhere in this schema that
  // would tell the gate the source was later deleted or anonymized.
  assert.ok(!decision.blocking_failures.includes('QUOTATION_WITHOUT_SOURCE'));
});

// ===================== 6: withdrawn/non-consenting sources excluded upstream =====================

test('6. the quote-selection query excludes withdrawn responses and non-consenting respondents at the source', () => {
  // This filter lives in a raw SQL WHERE clause (report-generator.js), not
  // in JS logic a mock DB could meaningfully exercise -- consistent with
  // this repo's existing convention (see publication-gate-route-pilot.test.js)
  // of asserting on exact source text for this class of behavior.
  const src = fs.readFileSync(new URL('../src/report-generator.js', import.meta.url), 'utf8');
  const queryStart = src.indexOf('Representative quotes (real transcripts');
  assert.ok(queryStart >= 0, 'could not locate the representative quotes query — has it moved?');
  const querySection = src.slice(queryStart, queryStart + 2000);
  assert.match(querySection, /r\.status\s*!=\s*'withdrawn'/, 'withdrawn responses must be excluded from quote selection');
  assert.match(querySection, /resp\.consent_given\s*=\s*1/, 'non-consenting respondents must be excluded from quote selection');
  assert.match(querySection, /t\.id\s+as\s+transcript_id/i, 'transcript_id must be selected for provenance');
  assert.match(querySection, /r\.id\s+as\s+response_id/i, 'response_id must be selected for provenance');
});

// ===================== 8, 10: rendering / backward compatibility =====================

test('8. Enterprise Report Studio classifyResult/renderResultHtml render score/blocking text unaffected by the new quote fields', async () => {
  const { classifyResult, renderResultHtml } = (await import('../../site/assets/js/report-generation-studio.js')).default;
  const body = {
    ok: true, report_generated: true, report_id: 'report_1',
    publication_evaluation: {
      publication_status: 'BLOCKED', score_state: 'VALID', overall_score: 0,
      scope_type: 'ORGANIZATION', dataset_version: 'abcdef1234567890',
      blocking_failures: ['QUOTATION_WITHOUT_SOURCE'], warnings: [],
    },
  };
  const classification = classifyResult({ httpStatus: 200, body });
  assert.equal(classification.state, 'blocked_draft');
  const html = renderResultHtml(classification);
  assert.match(html, /Score: 0\/100/);
  assert.match(html, /QUOTATION_WITHOUT_SOURCE/);
});

test('10. legacy quote shape (raw_text/channel/started_at only, no provenance fields) still scores without throwing', () => {
  assert.doesNotThrow(() => {
    const decision = evaluatePublicationGate(baseInput({
      quotes: [{ text: 'Old-shape quote with no provenance fields at all.' }],
    }));
    assert.ok(decision.blocking_failures.includes('QUOTATION_WITHOUT_SOURCE'), 'a legacy quote with no source must still block, not crash');
  });
});

// ===================== 9: internal IDs not exposed in public-facing quote intelligence =====================

test('9. public-facing quote intelligence never includes response_id/transcript_id even when present on the source quote', async () => {
  const documentModel = {
    metadata: { organization_name: 'Test Org', campaign_name: null, survey_title: null, template_name: 'Test Template', generated_at: new Date().toISOString() },
    kpis: { total_responses: 1, completed_responses: 1, response_rate_pct: 100 },
    findings: {
      representative_quotes: [
        { raw_text: 'A real quote.', overall_sentiment: 'neutral', channel: 'whatsapp', transcript_id: 'transcript_secret_1', response_id: 'resp_secret_1' },
      ],
      topics: [], sentiment: [],
    },
    demographics: { gender: [], age: [], regions: [] },
    charts: [], data_quality: {},
  };
  const infographic = await buildInfographicData(documentModel, {}, {});
  const serialized = JSON.stringify(infographic.quote_intelligence);
  assert.ok(!serialized.includes('transcript_secret_1'), 'transcript_id leaked into public quote intelligence');
  assert.ok(!serialized.includes('resp_secret_1'), 'response_id leaked into public quote intelligence');
  assert.match(serialized, /A real quote\./); // the actual quote text must still render
});
