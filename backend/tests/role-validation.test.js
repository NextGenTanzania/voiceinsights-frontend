// Run with: node --test tests/role-validation.test.js
// Tests the PURE decision logic of the role-whitelist fix for
// POST /api/users/invite, extracted here so it's testable without a full
// D1/HTTP round trip. Mirrors the exact ALLOWED_ROLES_BY_INVITER table and
// decision logic in src/application.js -- if that table changes, this test file
// must be updated to match.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ALLOWED_ROLES_BY_INVITER = {
  org_admin: ['me_officer', 'enumerator'],
  super_admin: ['org_admin', 'me_officer', 'enumerator'],
};

function validateInviteRole(inviterRole, requestedRole) {
  const resolvedRole = requestedRole || 'me_officer';
  const allowedRoles = ALLOWED_ROLES_BY_INVITER[inviterRole] || [];
  if (!allowedRoles.includes(resolvedRole)) {
    return { allowed: false, status: 400 };
  }
  return { allowed: true, resolvedRole };
}

test('org_admin inviting enumerator -> allowed', () => {
  const result = validateInviteRole('org_admin', 'enumerator');
  assert.equal(result.allowed, true);
  assert.equal(result.resolvedRole, 'enumerator');
});

test('org_admin inviting me_officer -> allowed', () => {
  const result = validateInviteRole('org_admin', 'me_officer');
  assert.equal(result.allowed, true);
});

test('org_admin inviting org_admin -> rejected', () => {
  const result = validateInviteRole('org_admin', 'org_admin');
  assert.equal(result.allowed, false);
  assert.equal(result.status, 400);
});

test('org_admin inviting super_admin -> rejected (the original exploit)', () => {
  const result = validateInviteRole('org_admin', 'super_admin');
  assert.equal(result.allowed, false);
  assert.equal(result.status, 400);
});

test('super_admin inviting org_admin -> allowed', () => {
  const result = validateInviteRole('super_admin', 'org_admin');
  assert.equal(result.allowed, true);
});

test('super_admin inviting super_admin -> rejected (no one can create super_admin via invite)', () => {
  const result = validateInviteRole('super_admin', 'super_admin');
  assert.equal(result.allowed, false);
});

test('invalid/unknown role -> rejected', () => {
  const result = validateInviteRole('org_admin', 'definitely_not_a_real_role');
  assert.equal(result.allowed, false);
});

test('missing role defaults to me_officer and is allowed for org_admin', () => {
  const result = validateInviteRole('org_admin', undefined);
  assert.equal(result.allowed, true);
  assert.equal(result.resolvedRole, 'me_officer');
});

test('an inviter role outside the whitelist table entirely (e.g. enumerator) is rejected for everything', () => {
  const result = validateInviteRole('enumerator', 'enumerator');
  assert.equal(result.allowed, false);
});
