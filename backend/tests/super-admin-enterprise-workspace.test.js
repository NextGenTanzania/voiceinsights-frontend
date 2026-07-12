
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSuperAdminEnterpriseWorkspaceV207A, buildSuperAdminNavigationV207A, buildSuperAdminClientReadinessV207A } from '../src/super-admin-enterprise-workspace.js';

test('v207A builds Super Admin Enterprise Workspace with mission control, operations, growth and governance', () => {
  const ws = buildSuperAdminEnterpriseWorkspaceV207A({ organizations: 12, projects: 48, surveys: 31, users: 240, uptime_pct: 99.98, api_latency_ms: 140, ai_queue_depth: 3, rendering_queue_depth: 2, failed_jobs: 0, storage_usage_pct: 45, active_trials: 7, conversions_this_month: 3 });
  assert.equal(ws.release, 'v207A — Super Admin Enterprise Workspace');
  assert.equal(ws.workspace.role, 'super_admin');
  assert.ok(ws.workspace.mission_control.kpis.length >= 6);
  assert.ok(ws.workspace.mission_control.quick_actions.some(a => a.label === 'Create organization'));
  assert.ok(ws.workspace.operations_center.services.some(s => s.name === 'AI processing'));
  assert.ok(ws.workspace.growth_center.workflows.some(w => w.label === 'Demo organizations'));
  assert.ok(ws.workspace.governance_center.controls.some(c => c.label === 'Organization isolation'));
  assert.ok(ws.client_readiness.score >= 98);
});

test('v207A navigation respects role-specific architecture and does not replace other dashboards', () => {
  const nav = buildSuperAdminNavigationV207A();
  assert.equal(nav.role, 'super_admin');
  assert.ok(nav.navigation_groups.some(g => g.label === 'Mission Control'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Organizations'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'AI & Reports'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Commercial'));
  assert.ok(nav.navigation_groups.some(g => g.label === 'Governance'));
});

test('v207A readiness is based on workspace checks, not a static marketing label', () => {
  const ready = buildSuperAdminClientReadinessV207A(buildSuperAdminEnterpriseWorkspaceV207A({ organizations: 3 }).workspace);
  assert.ok(ready.score >= 98);
  assert.match(ready.rating, /9\.9|10/);
  assert.equal(ready.status, 'READY_FOR_ENTERPRISE_DEMOS');
  assert.ok(ready.checks.every(c => typeof c.passed === 'boolean'));
});

test('route and Super Admin workspace page are wired into source and frontend', () => {
  const index = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../site/admin/super-admin-workspace.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../../site/assets/js/super-admin-workspace.js', import.meta.url), 'utf8');
  const dashboard = fs.readFileSync(new URL('../../site/admin/dashboard.html', import.meta.url), 'utf8');
  assert.match(index, /super-admin-workspace/);
  assert.match(index, /Super Admin access required/);
  assert.match(page, /v207a-workspace-root/);
  assert.match(js, /initV207ASuperAdminWorkspace/);
  assert.match(dashboard, /Open Enterprise Workspace/);
});
