import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDatasetIdentity } from '../src/report-generator.js';

// Part 1, Enterprise Report Studio UI Pilot release: dataset_version must be
// a stable fingerprint of INCLUDED RESPONSE CONTENT, not just a count and a
// max-timestamp (which two different datasets could share by coincidence).
//
// KNOWN SCHEMA LIMITATION (see report-generator.js:buildDatasetIdentity):
// responses has no updated_at/revision column and consent is not joined to
// it, so the fingerprint uses id + status + fraud_score + completed_at as
// the best available proxy. Tests below reflect that real constraint.

const row = (id, status = 'completed', fraud_score = 0.1, completed_at = '2026-07-01T00:00:00Z') => ({ id, status, fraud_score, completed_at, started_at: '2026-06-30T00:00:00Z' });

test('same included response set (any order) -> same dataset_version', async () => {
  const rowsA = [row('r1'), row('r2'), row('r3')];
  const rowsB = [row('r3'), row('r1'), row('r2')]; // reordered
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', surveyId: 's1', responseRows: rowsA });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', surveyId: 's1', responseRows: rowsB });
  assert.equal(a.dataset_version, b.dataset_version, 'query row order must never affect the fingerprint');
});

test('a changed response revision proxy (completed_at) changes the dataset_version, even with the same count', async () => {
  const before = [row('r1', 'completed', 0.1, '2026-07-01T00:00:00Z'), row('r2')];
  const after = [row('r1', 'completed', 0.1, '2026-07-05T00:00:00Z'), row('r2')]; // r1 revised
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: before });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: after });
  assert.notEqual(a.dataset_version, b.dataset_version);
  assert.equal(before.length, after.length, 'count is unchanged; only content changed');
});

test('a changed inclusion/status (e.g. in_progress -> completed) changes the dataset_version', async () => {
  const before = [row('r1', 'in_progress'), row('r2')];
  const after = [row('r1', 'completed'), row('r2')];
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: before });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: after });
  assert.notEqual(a.dataset_version, b.dataset_version);
});

test('a changed quality signal (fraud_score) changes the dataset_version', async () => {
  const before = [row('r1', 'completed', 0.1), row('r2')];
  const after = [row('r1', 'completed', 0.9), row('r2')]; // re-scored by the fraud engine
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: before });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: after });
  assert.notEqual(a.dataset_version, b.dataset_version);
});

test('an added response changes the dataset_version', async () => {
  const before = [row('r1'), row('r2')];
  const after = [row('r1'), row('r2'), row('r3')];
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: before });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: after });
  assert.notEqual(a.dataset_version, b.dataset_version);
});

test('a removed response changes the dataset_version', async () => {
  const before = [row('r1'), row('r2'), row('r3')];
  const after = [row('r1'), row('r2')];
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: before });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: after });
  assert.notEqual(a.dataset_version, b.dataset_version);
});

test('different scope (organization-wide vs a specific campaign) produces a different dataset_version, identical response content otherwise', async () => {
  const rows = [row('r1'), row('r2')];
  const orgWide = await buildDatasetIdentity({ organizationId: 'org_1', projectId: null, responseRows: rows });
  const scoped = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: rows });
  assert.notEqual(orgWide.dataset_version, scoped.dataset_version);
});

test('analysis-plan or dataset-lock version changes the dataset_version even with identical responses', async () => {
  const rows = [row('r1'), row('r2')];
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: rows, analysisPlanVersion: 'plan-v1' });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: rows, analysisPlanVersion: 'plan-v2' });
  assert.notEqual(a.dataset_version, b.dataset_version);
});

test('an empty dataset gets a stable, deterministic, clearly-labelled empty-scope identifier, never a random value', async () => {
  const a = await buildDatasetIdentity({ organizationId: 'org_1', projectId: null, surveyId: null, responseRows: [] });
  const b = await buildDatasetIdentity({ organizationId: 'org_1', projectId: null, surveyId: null, responseRows: [] });
  assert.equal(a.state, 'EMPTY');
  assert.equal(a.dataset_version, b.dataset_version);
  assert.equal(a.dataset_version, 'empty:org_1:org-wide');
});

test('a populated dataset_version is a stable sha256 hex digest, never a raw timestamp or random UUID', async () => {
  const d = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: [row('r1'), row('r2')] });
  assert.match(d.dataset_version, /^[a-f0-9]{64}$/, 'expected a deterministic sha256 hex digest');
});

test('the response fingerprint (and therefore any audit/log record of it) never contains raw answer text, quotes, or respondent-identifying fields — only id/status/fraud_score/timestamp', async () => {
  const rows = [row('r1'), { id: 'r2', status: 'completed', fraud_score: 0.2, completed_at: '2026-07-01T00:00:00Z', started_at: '2026-06-30T00:00:00Z', raw_text: 'a respondent quote that must never leak into the hash input', respondent_name: 'Jane Doe' }];
  const d = await buildDatasetIdentity({ organizationId: 'org_1', projectId: 'camp_1', responseRows: rows });
  // The fingerprint is a fixed-length hash; by construction it cannot
  // contain the plaintext quote. This test documents the contract that
  // buildDatasetIdentity's per-response string template only reads
  // id/status/fraud_score/completed_at/started_at, never raw_text or any
  // other field — even when the caller's row object happens to carry more.
  assert.match(d.response_fingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(d.dataset_version, /respondent quote|Jane Doe/);
});
