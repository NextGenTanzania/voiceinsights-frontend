// Program Beta Sprint 2 — Decision Workspace frontend test suite.
//
// site/assets/js/decision-workspace.js is a plain browser script (global
// `DW` namespace, matching the existing VISafeDOM convention — this
// codebase does not use ES modules on the frontend). It has no DOM
// dependency at parse time, so it loads cleanly under plain Node via a
// side-effect import, attaching DW to globalThis exactly as it would
// attach to `window` in a real browser. This lets the pure formatting/
// permission-hint/query-string logic get REAL unit test coverage, not
// just source-inspection — the same "real function execution" standard
// used throughout this test suite wherever the logic is DOM-independent.
//
// Route-wiring, RBAC-gating markup, and rendering are verified separately
// via a real browser (Claude Code's Browser pane, driven against a local
// static server) during this sprint's manual verification pass — documented
// in the Sprint 2 report, not re-asserted here as a second, weaker check.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ACTION_STATUSES as REAL_ACTION_STATUSES, ACTION_TRANSITIONS as REAL_ACTION_TRANSITIONS } from '../src/international-programme-lifecycle.js';
import { ROLE_PERMISSIONS } from '../src/enterprise-identity-access.js';

const root = path.resolve('..');
const dwPath = path.join(root, 'site', 'assets', 'js', 'decision-workspace.js');
await import(pathToFileURL(dwPath).href);
const DW = globalThis.DW;

test('DW loaded onto globalThis with the expected shape', () => {
  assert.ok(DW, 'decision-workspace.js must attach a DW namespace to globalThis when no window exists');
  for (const fn of ['roleHasPermission', 'nextStatusesFor', 'requiredPermissionForTransition', 'statusLabel', 'statusBadgeClass', 'priorityBadgeClass', 'riskBadgeClass', 'formatDate', 'formatDateTime', 'daysSince', 'freshnessLabel', 'freshnessBadgeClass', 'ownerDisplay', 'isOwnedByCurrentUser', 'buildQueryString', 'parseQueryString', 'escapeHtml', 'safeHref']) {
    assert.equal(typeof DW[fn], 'function', `DW.${fn} should be a function`);
  }
});

// ============================================================
// Drift guards — the frontend's mirrored copies of backend contracts must
// exactly match the real source, not just "look right".
// ============================================================
test('DW.ACTION_STATUSES exactly matches the real backend ACTION_STATUSES', () => {
  assert.deepEqual([...DW.ACTION_STATUSES].sort(), [...REAL_ACTION_STATUSES].sort());
});

test('DW.ACTION_TRANSITIONS exactly matches the real backend ACTION_TRANSITIONS graph', () => {
  assert.deepEqual(DW.ACTION_TRANSITIONS, REAL_ACTION_TRANSITIONS);
});

test('DW.ROLE_ACTION_PERMISSIONS exactly matches the real action.* subset of ROLE_PERMISSIONS for every mirrored role, including the real wildcard rule', () => {
  // Sprint 2.1 correction: this filter used to only look for literal
  // "action."-prefixed strings, which silently ignores a bare '*' entry —
  // exactly the mistake that let Sprint 2 ship believing founder_executive
  // had zero action.* access, when live-Preview UAT proved otherwise (the
  // real ROLE_PERMISSIONS.founder_executive is ['*'], and the real
  // hasPermission() treats '*' as "matches everything"). A role holding
  // the real wildcard must mirror as exactly ['*'], not an empty array.
  for (const role of Object.keys(DW.ROLE_ACTION_PERMISSIONS)) {
    const realPerms = ROLE_PERMISSIONS[role] || [];
    const real = realPerms.includes('*') ? ['*'] : realPerms.filter(p => p.startsWith('action.'));
    assert.deepEqual([...DW.ROLE_ACTION_PERMISSIONS[role]].sort(), real.sort(), `role ${role} action-permission mirror drifted from the real backend`);
  }
  // Every real role that exists in ROLE_PERMISSIONS must also be mirrored —
  // a role added to the backend later must not silently fall through DW's
  // roleHasPermission() to "no permissions" without this test catching it.
  for (const role of Object.keys(ROLE_PERMISSIONS)) {
    assert.ok(role in DW.ROLE_ACTION_PERMISSIONS, `real backend role "${role}" is missing from DW.ROLE_ACTION_PERMISSIONS`);
  }
});

// ============================================================
// Permission-hint pure functions
// ============================================================
test('roleHasPermission reflects the real RBAC matrix — founder_executive holds a genuine wildcard, enumerator holds no action.* permission at all', () => {
  assert.equal(DW.roleHasPermission('super_admin', 'action.verify'), true);
  assert.equal(DW.roleHasPermission('me_officer', 'action.verify'), false);
  assert.equal(DW.roleHasPermission('me_officer', 'action.progress'), true);
  assert.equal(DW.roleHasPermission('data_analyst', 'action.read'), true);
  assert.equal(DW.roleHasPermission('data_analyst', 'action.create'), false);
  // Confirmed via live-Preview UAT (Sprint 2.1) against the real deployed
  // backend: founder_executive holds ROLE_PERMISSIONS['*'], a genuine
  // wildcard — every action.* check (and every other permission) passes.
  assert.equal(DW.roleHasPermission('founder_executive', 'action.read'), true);
  assert.equal(DW.roleHasPermission('founder_executive', 'action.verify'), true);
  assert.equal(DW.roleHasPermission('founder_executive', 'action.cancel'), true);
  assert.equal(DW.roleHasPermission('enumerator', 'action.read'), false);
  assert.equal(DW.roleHasPermission('not_a_real_role', 'action.read'), false);
});

test('nextStatusesFor mirrors the real transition graph for every status, including terminal states', () => {
  assert.deepEqual(DW.nextStatusesFor('draft').sort(), ['cancelled', 'under_review'].sort());
  assert.deepEqual(DW.nextStatusesFor('verified'), []);
  assert.deepEqual(DW.nextStatusesFor('cancelled'), []);
  assert.deepEqual(DW.nextStatusesFor('completed').sort(), ['in_progress', 'verified'].sort());
});

test('requiredPermissionForTransition returns the correct, edge-specific permission (the same target status needs different permissions from different origins)', () => {
  assert.equal(DW.requiredPermissionForTransition('draft', 'cancelled'), 'action.cancel');
  assert.equal(DW.requiredPermissionForTransition('under_review', 'cancelled'), 'action.cancel');
  assert.equal(DW.requiredPermissionForTransition('completed', 'verified'), 'action.verify');
  assert.equal(DW.requiredPermissionForTransition('completed', 'in_progress'), 'action.verify', 'reopening a completed Action requires action.verify, not action.progress');
  assert.equal(DW.requiredPermissionForTransition('assigned', 'in_progress'), 'action.progress');
  assert.equal(DW.requiredPermissionForTransition('draft', 'verified'), null, 'an impossible edge has no permission — it should never be offered in the UI at all');
});

// ============================================================
// Labeling / badge mapping
// ============================================================
test('statusLabel and statusBadgeClass cover every real status plus the legacy fallback, without throwing on an unknown value', () => {
  for (const s of DW.ACTION_STATUSES) {
    assert.notEqual(DW.statusLabel(s), s, `status ${s} should have a human label, not just echo the raw value`);
    assert.match(DW.statusBadgeClass(s), /^badge-/);
  }
  assert.equal(DW.statusLabel('legacy_unknown'), 'Legacy (Unmigrated)');
  assert.equal(DW.statusLabel(undefined), 'Unknown');
  assert.equal(DW.statusBadgeClass('some_future_status_not_yet_known'), 'badge-neutral');
});

test('priorityBadgeClass and riskBadgeClass are case-insensitive and never fabricate a positive signal from unset/unknown values', () => {
  assert.equal(DW.priorityBadgeClass('CRITICAL'), 'badge-danger');
  assert.equal(DW.priorityBadgeClass('High'), 'badge-warn');
  assert.equal(DW.priorityBadgeClass(''), 'badge-accent');
  assert.equal(DW.riskBadgeClass('high'), 'badge-danger');
  assert.equal(DW.riskBadgeClass('CRITICAL'), 'badge-danger');
  assert.equal(DW.riskBadgeClass('medium'), 'badge-warn');
  assert.equal(DW.riskBadgeClass('low'), 'badge-success');
  assert.equal(DW.riskBadgeClass(null), 'badge-neutral');
  assert.equal(DW.riskBadgeClass('some free-text value nobody validated'), 'badge-neutral');
});

test('freshnessLabel/freshnessBadgeClass never present "lagging" or "unknown" data as authoritative "current" data', () => {
  assert.equal(DW.freshnessBadgeClass('current'), 'badge-success');
  assert.equal(DW.freshnessBadgeClass('lagging'), 'badge-warn');
  assert.equal(DW.freshnessBadgeClass('failed'), 'badge-danger');
  assert.equal(DW.freshnessBadgeClass('unknown'), 'badge-neutral');
  assert.equal(DW.freshnessLabel('unknown'), 'Not yet available');
});

// ============================================================
// Dates / age
// ============================================================
test('formatDate and formatDateTime handle null/empty/invalid input honestly, never throwing or printing "Invalid Date"', () => {
  assert.equal(DW.formatDate(null), '—');
  assert.equal(DW.formatDate(''), '—');
  assert.equal(DW.formatDate('not-a-date'), 'not-a-date');
  assert.doesNotThrow(() => DW.formatDate('2026-01-01'));
  assert.doesNotThrow(() => DW.formatDateTime('2026-01-01T00:00:00Z'));
});

test('daysSince returns a non-negative whole number of days for a real past timestamp, and null for no timestamp', () => {
  assert.equal(DW.daysSince(null), null);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const result = DW.daysSince(threeDaysAgo);
  assert.ok(Number.isInteger(result) && result >= 2 && result <= 4, `expected roughly 3 days, got ${result}`);
});

// ============================================================
// Ownership / display
// ============================================================
test('ownerDisplay never presents an unresolved owner id as a confirmed identity', () => {
  assert.equal(DW.ownerDisplay({ owner: 'user_123', owner_display_name: 'Jane Owner' }), 'Jane Owner');
  assert.match(DW.ownerDisplay({ owner: 'user_123', owner_display_name: null }), /unresolved/);
  assert.equal(DW.ownerDisplay({ owner: null, owner_display_name: null }), 'Unassigned');
});
test('isOwnedByCurrentUser only matches a real, non-empty owner/current-user pair', () => {
  assert.equal(DW.isOwnedByCurrentUser({ owner: 'user_1' }, 'user_1'), true);
  assert.equal(DW.isOwnedByCurrentUser({ owner: 'user_1' }, 'user_2'), false);
  assert.equal(DW.isOwnedByCurrentUser({ owner: null }, 'user_1'), false);
  assert.equal(DW.isOwnedByCurrentUser({ owner: 'user_1' }, null), false);
});

// ============================================================
// Query-string round trip (Part 4 — stable URL state)
// ============================================================
test('buildQueryString omits empty/null/undefined/false values and round-trips through parseQueryString', () => {
  const qs = DW.buildQueryString({ status: 'draft', overdue: true, escalated: false, q: '', owner: undefined, limit: 20 });
  assert.equal(qs, '?status=draft&overdue=true&limit=20');
  assert.deepEqual(DW.parseQueryString(qs), { status: 'draft', overdue: 'true', limit: '20' });
});
test('buildQueryString returns an empty string, not "?", when every value is empty', () => {
  assert.equal(DW.buildQueryString({ q: '', owner: undefined }), '');
});

// ============================================================
// Security-relevant helpers (Part 26)
// ============================================================
test('escapeHtml neutralizes every HTML-significant character', () => {
  assert.equal(DW.escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(DW.escapeHtml(`"quoted" & 'single'`), '&quot;quoted&quot; &amp; &#39;single&#39;');
  assert.equal(DW.escapeHtml(null), '');
});
test('safeHref only ever returns http(s) URLs, rejecting javascript:/data:/vbscript: schemes', () => {
  assert.equal(DW.safeHref('https://example.com/evidence.pdf'), 'https://example.com/evidence.pdf');
  assert.equal(DW.safeHref('http://example.com'), 'http://example.com/');
  assert.equal(DW.safeHref('javascript:alert(1)'), null);
  assert.equal(DW.safeHref('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(DW.safeHref('not a url at all'), null);
});

// ============================================================
// API contract — every wrapper calls the real, documented route/method
// ============================================================
test('DW.Api wrappers call the exact real backend routes with the exact real methods (Part 27 contract check)', async () => {
  const calls = [];
  globalThis.apiRequest = async (path, options) => { calls.push({ path, options }); return { ok: true, actions: [], owners: [] }; };

  await DW.Api.listActions({ status: 'draft' });
  await DW.Api.getAction('act1');
  await DW.Api.getOrganizationPortfolio();
  await DW.Api.getProjectPortfolio('proj1');
  await DW.Api.listOwners({ limit: 10 });
  await DW.Api.getReviewQueue('proj1');
  await DW.Api.getExecutive();
  await DW.Api.getHealth();
  await DW.Api.createAction({ recommendation: 'x' });
  await DW.Api.getActionDetail('act1');
  await DW.Api.getActionHistory('act1');
  await DW.Api.patchAction('act1', { progress_pct: 50 });
  await DW.Api.transitionAction('act1', { to_status: 'under_review' });
  await DW.Api.addEvidence('act1', { description: 'x' });

  const byIndex = calls.map(c => c.path);
  assert.match(byIndex[0], /^\/api\/decisions\/projections\/actions\?status=draft$/);
  assert.equal(byIndex[1], '/api/decisions/projections/actions/act1');
  assert.equal(byIndex[2], '/api/decisions/projections/organization');
  assert.equal(byIndex[3], '/api/decisions/projections/projects/proj1');
  assert.match(byIndex[4], /^\/api\/decisions\/projections\/owners\?limit=10$/);
  assert.match(byIndex[5], /^\/api\/decisions\/projections\/reviewers\?project=proj1$/);
  assert.equal(byIndex[6], '/api/decisions/projections/executive');
  assert.equal(byIndex[7], '/api/decisions/projections/health');
  assert.equal(byIndex[8], '/api/decisions/actions');
  assert.equal(calls[8].options.method, 'POST');
  assert.equal(byIndex[9], '/api/decisions/actions/act1');
  assert.equal(byIndex[10], '/api/decisions/actions/act1/history');
  assert.equal(byIndex[11], '/api/decisions/actions/act1');
  assert.equal(calls[11].options.method, 'PATCH');
  assert.equal(byIndex[12], '/api/decisions/actions/act1/transition');
  assert.equal(calls[12].options.method, 'POST');
  assert.equal(byIndex[13], '/api/decisions/actions/act1/evidence');
  assert.equal(calls[13].options.method, 'POST');

  delete globalThis.apiRequest;
});
