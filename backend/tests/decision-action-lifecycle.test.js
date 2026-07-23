import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import { ACTION_STATUSES, ACTION_TRANSITIONS, nextActionStatuses, buildActionTransition, validateActionCreate, validateActionUpdate, buildInternationalProgrammeWorkspace, validateManagementResponse } from '../src/international-programme-lifecycle.js';
import { ROLE_PERMISSIONS, hasPermission } from '../src/enterprise-identity-access.js';

const root = path.resolve('..');
const appSrc = fs.readFileSync(path.join(root, 'backend/src/application.js'), 'utf8');
const routeSrc = (marker) => { const start = appSrc.indexOf(marker); if (start < 0) return ''; return appSrc.slice(start, appSrc.indexOf('\n      }', start)); };

// ============================================================
// Unit Tests — the state machine itself
// ============================================================

test('ACTION_STATUSES and ACTION_TRANSITIONS are internally consistent (every referenced status is declared)', () => {
  for (const [from, edges] of Object.entries(ACTION_TRANSITIONS)) {
    assert.ok(ACTION_STATUSES.includes(from), `${from} is not a declared status`);
    for (const to of Object.keys(edges)) assert.ok(ACTION_STATUSES.includes(to), `${to} is not a declared status`);
  }
});

test('draft can move to under_review or cancelled, and nowhere else', () => {
  assert.deepEqual(nextActionStatuses('draft').sort(), ['cancelled','under_review']);
});

test('verified and cancelled are terminal — no further transitions permitted', () => {
  assert.deepEqual(nextActionStatuses('verified'), []);
  assert.deepEqual(nextActionStatuses('cancelled'), []);
});

test('rejected can only move back to draft (rework), never directly to verified or completed', () => {
  assert.deepEqual(nextActionStatuses('rejected'), ['draft']);
});

test('an illegal transition (draft straight to verified) is rejected with a clear error', () => {
  const r = buildActionTransition({ id: 'a1', status: 'draft' }, 'verified', { role: 'org_admin' }, { hasPermission });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /Cannot move from draft to verified/);
});

test('an unknown target status is rejected', () => {
  const r = buildActionTransition({ id: 'a1', status: 'draft' }, 'bogus_status', { role: 'org_admin' }, { hasPermission });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /Unknown action status/);
});

test('a legal transition succeeds for an actor holding the required permission, and produces a real audit_event', () => {
  const r = buildActionTransition({ id: 'a1', status: 'draft' }, 'under_review', { role: 'org_admin', sub: 'u1' }, { hasPermission });
  assert.equal(r.ok, true);
  assert.equal(r.from, 'draft');
  assert.equal(r.to, 'under_review');
  assert.equal(r.audit_event.action, 'decision_action.transition');
  assert.equal(r.audit_event.resource_id, 'a1');
  assert.ok(r.audit_event.occurred_at);
});

test('a legal transition is rejected for an actor lacking the required permission (enumerator cannot review)', () => {
  const r = buildActionTransition({ id: 'a1', status: 'under_review' }, 'approved', { role: 'enumerator' }, { hasPermission });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /Permission required: action\.review/);
});

test('reopening a completed action requires a stated reason', () => {
  const withoutReason = buildActionTransition({ id: 'a1', status: 'completed' }, 'in_progress', { role: 'org_admin' }, { hasPermission });
  assert.equal(withoutReason.ok, false);
  assert.match(withoutReason.errors.join(' '), /reason is required/);
  const withReason = buildActionTransition({ id: 'a1', status: 'completed' }, 'in_progress', { role: 'org_admin' }, { hasPermission, reason: 'Verification found the fix incomplete' });
  assert.equal(withReason.ok, true);
});

test('the full happy-path lifecycle is walkable end to end for an org_admin', () => {
  const path_ = ['draft','under_review','approved','assigned','in_progress','completed','verified'];
  let record = { id: 'a1', status: 'draft' };
  for (let i = 1; i < path_.length; i++) {
    const to = path_[i];
    const ctx = { hasPermission, reason: to === 'verified' ? 'confirmed complete' : undefined };
    const r = buildActionTransition(record, to, { role: 'org_admin', sub: 'u1' }, ctx);
    assert.equal(r.ok, true, `expected ${record.status} -> ${to} to succeed: ${r.errors.join(', ')}`);
    record = { ...record, status: to };
  }
});

test('a rejected action can be reworked back to draft and resubmitted', () => {
  const rejected = buildActionTransition({ id: 'a1', status: 'under_review' }, 'rejected', { role: 'org_admin' }, { hasPermission });
  assert.equal(rejected.ok, true);
  const reworked = buildActionTransition({ id: 'a1', status: 'rejected' }, 'draft', { role: 'org_admin' }, { hasPermission });
  assert.equal(reworked.ok, true);
});

// ============================================================
// Validation Tests
// ============================================================

test('validateActionCreate requires project_id, recommendation, owner and due_date — matching the real NOT NULL schema, not a fabricated stricter rule', () => {
  assert.equal(validateActionCreate({}).ok, false);
  assert.equal(validateActionCreate({ project_id: 'p1', recommendation: 'Do the thing', owner: 'u1', due_date: '2026-08-01' }).ok, true);
});

test('validateActionCreate rejects an invalid priority value rather than silently accepting it', () => {
  const r = validateActionCreate({ project_id: 'p1', recommendation: 'x', owner: 'u1', due_date: '2026-08-01', priority: 'extremely-urgent' });
  assert.equal(r.ok, false);
});

test('validateActionUpdate rejects an out-of-range progress_pct', () => {
  assert.equal(validateActionUpdate({ progress_pct: 150 }).ok, false);
  assert.equal(validateActionUpdate({ progress_pct: 50 }).ok, true);
});

test('validateActionUpdate rejects a non-array dependencies value', () => {
  assert.equal(validateActionUpdate({ dependencies: 'act_123' }).ok, false);
  assert.equal(validateActionUpdate({ dependencies: ['act_123'] }).ok, true);
});

// ============================================================
// RBAC Tests — the real, explicit permission matrix
// ============================================================

test('every one of the 9 real roles has an explicit (not implicit) action.read decision', () => {
  for (const role of Object.keys(ROLE_PERMISSIONS)) {
    // Explicit means: either granted via '*' / a real listed permission, or
    // genuinely absent — never undefined/crashing.
    assert.equal(typeof hasPermission(role, 'action.read'), 'boolean');
  }
});

test('only roles with real report.publish authority today can review or verify an Action', () => {
  const reviewers = Object.keys(ROLE_PERMISSIONS).filter(r => hasPermission(r, 'action.review'));
  const publishers = Object.keys(ROLE_PERMISSIONS).filter(r => hasPermission(r, 'report.publish') || ROLE_PERMISSIONS[r].includes('*'));
  assert.deepEqual(reviewers.sort(), publishers.sort());
});

test('enumerator has no action permissions at all, unchanged from its existing minimal scope', () => {
  for (const perm of ['action.create','action.read','action.update','action.submit','action.review','action.assign','action.progress','action.verify','action.cancel']) {
    assert.equal(hasPermission('enumerator', perm), false, `enumerator should not have ${perm}`);
  }
});

test('data_analyst can read Actions but cannot create, review, or verify one — consistent with its real read/generate-only permission set', () => {
  assert.equal(hasPermission('data_analyst', 'action.read'), true);
  assert.equal(hasPermission('data_analyst', 'action.create'), false);
  assert.equal(hasPermission('data_analyst', 'action.verify'), false);
});

test('project_manager and me_officer can create and progress Actions but cannot verify one — matching their real report.generate-not-publish posture', () => {
  for (const role of ['project_manager', 'me_officer']) {
    assert.equal(hasPermission(role, 'action.create'), true, `${role} should be able to create`);
    assert.equal(hasPermission(role, 'action.progress'), true, `${role} should be able to progress`);
    assert.equal(hasPermission(role, 'action.verify'), false, `${role} should not be able to verify`);
  }
});

test('founder_executive retains full wildcard authority over the Action lifecycle without any new explicit grant', () => {
  for (const perm of ['action.create','action.review','action.verify','action.cancel']) assert.equal(hasPermission('founder_executive', perm), true);
});

// ============================================================
// Migration safety
// ============================================================

test('the new migration only adds columns/tables/indexes — never drops or renames an existing one', () => {
  const sql = fs.readFileSync(path.join(root, 'backend/migrations/042_decision_action_lifecycle.sql'), 'utf8');
  assert.doesNotMatch(sql, /DROP\s+TABLE|DROP\s+COLUMN|ALTER\s+TABLE\s+\w+\s+RENAME/i);
  assert.match(sql, /ALTER TABLE management_response_actions ADD COLUMN/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS action_history/);
  // Every new column is nullable or carries a safe default — never a bare
  // NOT NULL with no default, which would break inserts from the untouched
  // legacy route that doesn't know about these new columns.
  const addColumnLines = sql.split('\n').filter(l => /ADD COLUMN/.test(l));
  for (const line of addColumnLines) {
    const isNotNullNoDefault = /NOT NULL/.test(line) && !/DEFAULT/.test(line);
    assert.ok(!isNotNullNoDefault, `column addition is NOT NULL with no default, would break existing inserts: ${line}`);
  }
});

test('the legacy /api/programme-lifecycle/management-response route is untouched and still defaults status to open', () => {
  const handler = routeSrc("path === '/api/programme-lifecycle/management-response'");
  assert.match(handler, /validateManagementResponse\(body\)/);
  assert.match(handler, /body\.status\|\|'open'/);
});

test('buildInternationalProgrammeWorkspace is untouched and still exposes the original 5 modules', () => {
  const ws = buildInternationalProgrammeWorkspace({ organization_id: 'org1' });
  assert.deepEqual(Object.keys(ws.modules).sort(), ['management_response','programme_design','results_framework','role_acceptance','sampling_methodology'].sort());
});

// ============================================================
// API / tenant-isolation / audit regression guards (this codebase has no
// live D1 harness — every other route in this 1,200+ test suite is verified
// the same way: by reading the real handler source, not by mocking HTTP).
// ============================================================

const NEW_ROUTES = [
  ["path === '/api/decisions/actions' && method === 'POST'", 'action.create'],
  ["actionTransitionMatch && method === 'POST'", null],
  ["actionHistoryMatch && method === 'GET'", null],
  ["actionByIdMatch && method === 'GET'", 'action.read'],
  ["actionByIdMatch && method === 'PATCH'", 'action.update'],
  ["path === '/api/decisions/actions' && method === 'GET'", 'action.read'],
];

test('every new Decision API route requires authentication and calls getEffectiveOrgId for tenant scoping', () => {
  for (const [marker] of NEW_ROUTES) {
    const handler = routeSrc(marker);
    assert.ok(handler.length > 0, `route not found: ${marker}`);
    assert.match(handler, /requireAuth\(request, ?env\)/, `${marker} must call requireAuth`);
    assert.match(handler, /getEffectiveOrgId\(request, ?env, ?claims\)/, `${marker} must call getEffectiveOrgId`);
  }
});

test('every new Decision API route checks an explicit action.* permission (never an inline role-array)', () => {
  for (const [marker, perm] of NEW_ROUTES) {
    if (!perm) continue;
    const handler = routeSrc(marker);
    assert.match(handler, new RegExp(`assertPermission\\(claims\\.role, ?'${perm.replace('.', '\\.')}'\\)`), `${marker} must check ${perm} via assertPermission`);
  }
});

test('every SELECT/UPDATE against management_response_actions or action_history in the new routes filters by organization_id — never a caller-supplied tenant', () => {
  for (const [marker] of NEW_ROUTES) {
    const handler = routeSrc(marker);
    // INSERTs are checked separately below (organization_id is a bound
    // column value there, not a WHERE-clause filter) — this test covers the
    // read/update paths, where a missing organization_id filter would let
    // one tenant read or modify another tenant's Action.
    const sqlStatements = handler.match(/(SELECT|UPDATE)[^`]*?(management_response_actions|action_history)[^`]*/g) || [];
    for (const stmt of sqlStatements) {
      assert.match(stmt, /organization_id\s*=\s*\?/, `query against a tenant table must filter by organization_id: ${stmt}`);
    }
  }
});

test('every INSERT into management_response_actions or action_history in the new routes includes organization_id as a real bound column', () => {
  for (const [marker] of NEW_ROUTES) {
    const handler = routeSrc(marker);
    const inserts = handler.match(/INSERT INTO (management_response_actions|action_history)\s*\([^)]*\)/g) || [];
    for (const stmt of inserts) {
      assert.match(stmt, /\borganization_id\b/, `insert into a tenant table must include organization_id: ${stmt}`);
    }
  }
});

// Program Beta Sprint 1.5 replaced the best-effort recordActionHistory()
// helper with buildActionEventWriteSet(), whose statements are committed
// atomically via env.DB.batch() alongside the Action mutation (Blueprint
// Part 5). This test was updated to assert the new, more atomic behavior —
// not to preserve the old sequential-write shape.
test('the create and transition routes write to action_history, the audit trail, and the outbox atomically via env.DB.batch()', () => {
  const createHandler = routeSrc("path === '/api/decisions/actions' && method === 'POST'");
  assert.match(createHandler, /buildActionEventWriteSet\(/);
  assert.match(createHandler, /env\.DB\.batch\(\[createStmt, \.\.\.statements\]\)/);
  const transitionHandler = routeSrc("actionTransitionMatch && method === 'POST'");
  assert.match(transitionHandler, /buildActionEventWriteSet\(/);
  assert.match(transitionHandler, /env\.DB\.batch\(batchStatements\)/);
  // application.js must import the shared write-set builders, not redefine
  // them locally — one real mechanism, shared with the scheduled overdue
  // sweep, not a second copy.
  assert.match(appSrc, /import \{ buildActionEventWriteSet \} from '\.\/decision-action-write-set\.js'/);
  // buildActionEventWriteSet's own statement builders (in the shared module)
  // must write to action_history, security_audit_events_v2, and the new
  // domain_event_outbox — not a parallel, disconnected logging mechanism.
  const writeSetSrc = fs.readFileSync(path.join(root, 'backend/src/decision-action-write-set.js'), 'utf8');
  const writeSetStart = writeSetSrc.indexOf('function buildActionEventWriteSet');
  const writeSet = writeSetSrc.slice(writeSetStart, writeSetSrc.indexOf('\n}', writeSetStart));
  assert.match(writeSet, /buildActionHistoryStatement/);
  assert.match(writeSet, /buildActionAuditStatement/);
  assert.match(writeSet, /buildOutboxStatement/);
  const historyBuilder = writeSetSrc.slice(writeSetSrc.indexOf('function buildActionHistoryStatement'), writeSetSrc.indexOf('function buildActionAuditStatement'));
  assert.match(historyBuilder, /INSERT INTO action_history/);
  const auditBuilder = writeSetSrc.slice(writeSetSrc.indexOf('function buildActionAuditStatement'), writeSetSrc.indexOf('function buildOutboxStatement'));
  assert.match(auditBuilder, /INSERT INTO security_audit_events_v2/);
  const outboxBuilder = writeSetSrc.slice(writeSetSrc.indexOf('function buildOutboxStatement'), writeSetSrc.indexOf('function buildActionEventWriteSet'));
  assert.match(outboxBuilder, /INSERT INTO domain_event_outbox/);
});

test('the create route rate-limits and the state-transition route validates via buildActionTransition before writing anything', () => {
  const createHandler = routeSrc("path === '/api/decisions/actions' && method === 'POST'");
  assert.match(createHandler, /isRateLimited\(/);
  const transitionHandler = routeSrc("actionTransitionMatch && method === 'POST'");
  assert.match(transitionHandler, /buildActionTransition\(/);
  assert.match(transitionHandler, /if \(!result\.ok\) return json\(result, ?409\)/);
});

test('the list route supports search, filtering and pagination, capped at a sane page size', () => {
  const handler = routeSrc("path === '/api/decisions/actions' && method === 'GET'");
  assert.match(handler, /LIKE \?/);
  assert.match(handler, /LIMIT \?/);
  assert.match(handler, /Math\.min\(100/, 'page size must be capped, not caller-unbounded');
});

test('verification can only be reached through the governed transition endpoint — no route sets verification_status directly from caller input without going through buildActionTransition', () => {
  const patchHandler = routeSrc("actionByIdMatch && method === 'PATCH'");
  assert.doesNotMatch(patchHandler, /verification_status/, 'PATCH must not allow verification_status to be set directly, bypassing the state machine');
});
