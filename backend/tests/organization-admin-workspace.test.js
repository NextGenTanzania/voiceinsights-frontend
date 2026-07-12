
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildOrganizationAdminWorkspaceV207B, buildOrganizationAdminNavigationV207B, buildOrganizationAdminReadinessV207B } from '../src/organization-admin-workspace.js';

test('v207B builds organization admin workspace for Head of Programs and Project Managers', () => {
  const ws = buildOrganizationAdminWorkspaceV207B({ organization_name: 'UNDP Tanzania', active_projects: 8, active_surveys: 4, team_members: 32, reports_generated: 18, completion_rate_pct: 76, publication_quality_score: 99.2 });
  assert.equal(ws.release, 'v207B — Organization Admin Workspace');
  assert.equal(ws.workspace.role, 'organization_admin');
  assert.equal(ws.workspace.security_boundary, 'organization_scoped');
  assert.ok(ws.workspace.organization_home.quick_actions.some(a => a.label === 'Create project'));
  assert.ok(ws.workspace.program_management.workflows.includes('AI analysis'));
  assert.ok(ws.workspace.publication_center.report_products.includes('Donor Impact Publication'));
  assert.ok(ws.workspace.team_management.quick_actions.some(a => a.label === 'Invite M&E Officer'));
  assert.ok(ws.workspace.branding_center.controls.includes('Report cover'));
  assert.ok(ws.client_readiness.score >= 99);
});

test('v207B navigation respects organization-scoped role architecture', () => {
  const nav = buildOrganizationAdminNavigationV207B();
  assert.equal(nav.role, 'organization_admin');
  assert.ok(nav.navigation_groups.some(g => g.label === 'Organization Home'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Program Management'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Publication Center'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Team & Permissions'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Branding'));
});

test('v207B readiness is measured from workspace checks, not hardcoded card text only', () => {
  const built = buildOrganizationAdminWorkspaceV207B({ organization_name: 'Client Org' });
  const ready = buildOrganizationAdminReadinessV207B(built.workspace);
  assert.ok(ready.score >= 98);
  assert.match(ready.rating, /9\.8|9\.9|10/);
  assert.ok(ready.checks.every(c => typeof c.passed === 'boolean'));
});

test('route and Organization Admin workspace page are wired into source and frontend', () => {
  const index = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../site/app/organization-admin-workspace.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../../site/assets/js/organization-admin-workspace.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../site/assets/css/organization-admin-workspace.css', import.meta.url), 'utf8');
  const dashboard = fs.readFileSync(new URL('../../site/app/dashboard.html', import.meta.url), 'utf8');
  assert.match(index, /admin-workspace/);
  assert.match(index, /Organization Admin access required/);
  assert.match(page, /v207b-workspace-root/);
  assert.match(js, /initV207BOrganizationAdminWorkspace/);
  assert.match(css, /Mobile|@media|v207b/);
  assert.match(dashboard, /Open Organization Workspace/);
});
