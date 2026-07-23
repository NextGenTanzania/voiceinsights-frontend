// tests/decision-action-concurrency.test.js
// RC1 Part 2 — optimistic concurrency on the two Action-mutation routes that
// previously had none (PATCH /api/decisions/actions/:id and POST .../evidence).
// A real Sprint 2.1 UAT session reproduced a genuine silent lost update on
// these exact routes; live-Preview verification (documented in the RC1
// report) confirmed the fix end-to-end against the real deployed Worker and
// D1. This file guards the specific code shape that verification depends on,
// matching the source-pattern-assertion style already used in
// decision-action-lifecycle.test.js:199-255 for the same file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSrc = fs.readFileSync(path.join(__dirname, '../src/application.js'), 'utf8');

function routeSource(match) {
  const start = appSrc.indexOf(match);
  assert.ok(start !== -1, `route marker not found: ${match}`);
  return appSrc.slice(start, start + 4200);
}

test('PATCH /api/decisions/actions/:id — expected_updated_at is optional (no breaking change for existing callers)', () => {
  const src = routeSource("if (actionByIdMatch && method === 'PATCH')");
  assert.match(src, /body\.expected_updated_at\s*!==\s*undefined/, 'must branch only when the caller actually supplies expected_updated_at');
});

test('PATCH /api/decisions/actions/:id — the conditional UPDATE is atomic (updated_at check lives in the same WHERE clause as id/organization_id, both inline so tenant-scoping stays statically visible)', () => {
  const src = routeSource("if (actionByIdMatch && method === 'PATCH')");
  assert.match(src, /WHERE id=\? AND organization_id=\?\$\{checkStale \? ' AND updated_at=\?' : ''\}/, 'the staleness check must be part of the UPDATE\'s WHERE, not a separate racy SELECT-then-UPDATE, and organization_id must stay inline for the tenant-isolation source scanner');
});

test('PATCH /api/decisions/actions/:id — a lost race returns 409 with the real current updated_at, and never writes history/outbox for the rejected write', () => {
  const src = routeSource("if (actionByIdMatch && method === 'PATCH')");
  assert.match(src, /updateResult\.meta\.changes === 0/);
  assert.match(src, /409/);
  assert.match(src, /current_updated_at/);
  // The event/history write-set must be built and batched strictly AFTER the
  // conflict check returns, not before — otherwise a rejected write would
  // still leave a phantom audit trail.
  const conflictIdx = src.indexOf('updateResult.meta.changes === 0');
  const writeSetIdx = src.indexOf('buildActionEventWriteSet');
  assert.ok(conflictIdx > -1 && writeSetIdx > -1 && conflictIdx < writeSetIdx, 'conflict check must run before the event write-set is built');
});

test('POST /api/decisions/actions/:id/evidence — same optional, atomic optimistic-concurrency check as the PATCH route', () => {
  const src = routeSource("if (actionEvidenceMatch && method === 'POST')");
  assert.match(src, /checkStale\s*=\s*body\.expected_updated_at\s*!==\s*undefined/);
  assert.match(src, /WHERE id=\? AND organization_id=\?\$\{checkStale \? ' AND updated_at=\?' : ''\}/);
  assert.match(src, /updateResult\.meta\.changes === 0/);
  assert.match(src, /409/);
  const conflictIdx = src.indexOf('updateResult.meta.changes === 0');
  const writeSetIdx = src.indexOf('buildActionEventWriteSet');
  assert.ok(conflictIdx > -1 && writeSetIdx > -1 && conflictIdx < writeSetIdx, 'conflict check must run before the event write-set is built (no phantom evidence-added event on a rejected write)');
});

test('config.js apiRequest attaches status/data to thrown errors so callers can detect a real 409 without pattern-matching message text', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../site/assets/js/config.js'), 'utf8');
  assert.match(src, /err\.status\s*=\s*res\.status/);
  assert.match(src, /err\.data\s*=\s*data/);
});

test('decision-detail-page.js sends expected_updated_at on every field-mutation call (progress, reassign, evidence, edit) and treats a 409 as a real conflict, not a generic error toast', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../site/assets/js/decision-detail-page.js'), 'utf8');
  const mutationCalls = [
    /patchAction\(actionId,\s*\{\s*progress_pct:\s*value,\s*expected_updated_at:\s*current\.updated_at\s*\}\)/,
    /patchAction\(actionId,\s*\{\s*owner:\s*newOwner,\s*expected_updated_at:\s*current\.updated_at\s*\}\)/,
    /expected_updated_at:\s*current\.updated_at,\s*\}\);\s*\}\s*catch \(e\) \{\s*\n\s*await DW\.Api\.addEvidence|addEvidence\(actionId,[\s\S]{0,120}expected_updated_at:\s*current\.updated_at/,
  ];
  assert.match(src, /patchAction\(actionId,\s*\{\s*progress_pct:\s*value,\s*expected_updated_at:\s*current\.updated_at\s*\}\)/);
  assert.match(src, /patchAction\(actionId,\s*\{\s*owner:\s*newOwner,\s*expected_updated_at:\s*current\.updated_at\s*\}\)/);
  assert.match(src, /addEvidence\(actionId,\s*\{[^}]*expected_updated_at:\s*current\.updated_at[^}]*\}\)/);
  assert.match(src, /expected_updated_at:\s*current\.updated_at,\s*\n\s*\};/, 'Edit Details body must include expected_updated_at');
  assert.match(src, /function handleConflict\(e\)\s*\{\s*\n\s*if \(e\.status === 409\)/);
});
