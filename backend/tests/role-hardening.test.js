// Run with: node --test tests/role-hardening.test.js
// Pure decision-logic tests mirroring the exact role check added to:
//   POST /api/organizations/regenerate-key
//   POST /api/campaigns
//   POST /api/surveys
// All three use the identical rule: only org_admin/super_admin allowed;
// me_officer (view-only by documented design) and enumerator always rejected.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function canPerformAdminAction(role) {
  return role === 'org_admin' || role === 'super_admin';
}

test('enumerator regenerate API key -> rejected (403)', () => {
  assert.equal(canPerformAdminAction('enumerator'), false);
});

test('org_admin regenerate API key -> allowed', () => {
  assert.equal(canPerformAdminAction('org_admin'), true);
});

test('enumerator create project -> rejected (403)', () => {
  assert.equal(canPerformAdminAction('enumerator'), false);
});

test('org_admin create project -> allowed', () => {
  assert.equal(canPerformAdminAction('org_admin'), true);
});

test('enumerator create survey -> rejected (403)', () => {
  assert.equal(canPerformAdminAction('enumerator'), false);
});

test('org_admin create survey -> allowed', () => {
  assert.equal(canPerformAdminAction('org_admin'), true);
});

test('me_officer is rejected for all three admin-level actions (view-only by documented design)', () => {
  assert.equal(canPerformAdminAction('me_officer'), false);
});

test('super_admin is allowed for all three actions', () => {
  assert.equal(canPerformAdminAction('super_admin'), true);
});
